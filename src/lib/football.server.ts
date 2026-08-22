/**
 * API-Football (v3) access helpers. Server-only.
 */

import type {
  TeamHit,
  MatchRow,
  TeamAnalysis,
} from "./football.types";

const API_BASE = "https://v3.football.api-sports.io";

function apiKey() {
  const key = process.env["API_FOOTBALL_KEY"];
  if (!key) {
    throw new Error(
      "A chave da API de futebol não está configurada (API_FOOTBALL_KEY).",
    );
  }
  return key;
}

const RAPID_BASE = "https://api-football-v1.p.rapidapi.com/v3";

type Body<T> = { response?: T[]; errors?: unknown } | null;

function firstError<T>(body: Body<T>): string | null {
  const errors = body?.errors;
  if (Array.isArray(errors)) return errors.length ? String(errors[0]) : null;
  if (errors && Object.keys(errors).length > 0) {
    return Object.values(errors as Record<string, string>)[0] ?? "erro";
  }
  return null;
}

async function request<T>(
  url: string,
  headers: Record<string, string>,
): Promise<{ res: Response; body: Body<T> }> {
  const res = await fetch(url, { headers });
  const body = (await res.json().catch(() => null)) as Body<T>;
  return { res, body };
}

async function apiGet<T>(path: string): Promise<T[]> {
  const key = apiKey();

  // Chaves diretas (dashboard.api-football.com) usam o host api-sports.io.
  let { res, body } = await request<T>(`${API_BASE}${path}`, {
    "x-apisports-key": key,
  });
  let error = res.ok ? firstError(body) : `HTTP ${res.status}`;

  // Chaves obtidas via RapidAPI só funcionam no host da RapidAPI.
  if (error && /application key|token|HTTP 40[13]/i.test(error)) {
    const retry = await request<T>(`${RAPID_BASE}${path}`, {
      "x-rapidapi-key": key,
      "x-rapidapi-host": "api-football-v1.p.rapidapi.com",
    });
    res = retry.res;
    body = retry.body;
    error = res.ok ? firstError(body) : `HTTP ${res.status}`;
  }

  if (error) {
    console.error(`API-Football ${path} erro:`, error);
    if (/application key|token/i.test(error)) {
      throw new Error(
        "A chave da API de futebol foi recusada. Confira em dashboard.api-football.com (ou na RapidAPI) se ela está ativa e salve-a novamente.",
      );
    }
    throw new Error(error);
  }

  return body?.response ?? [];
}


const pct = (n: number, total: number) =>
  total > 0 ? Math.round((n / total) * 1000) / 10 : 0;
const avg = (values: number[]) =>
  values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
    : 0;

export async function searchTeams(query: string): Promise<TeamHit[]> {
  type Raw = {
    team: {
      id: number;
      name: string;
      logo: string | null;
      country: string | null;
      founded: number | null;
    };
  };
  const rows = await apiGet<Raw>(`/teams?search=${encodeURIComponent(query)}`);
  return rows.slice(0, 12).map((r) => ({
    id: r.team.id,
    name: r.team.name,
    logo: r.team.logo,
    country: r.team.country,
    founded: r.team.founded,
  }));
}

type FixtureRaw = {
  fixture: { id: number; date: string };
  league: { name: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
};

type StatsRaw = {
  team: { id: number };
  statistics: { type: string; value: number | string | null }[];
};

function statValue(entry: StatsRaw | undefined, types: string[]): number | null {
  if (!entry) return null;
  let sum = 0;
  let found = false;
  for (const type of types) {
    const s = entry.statistics.find((x) => x.type === type);
    if (s && s.value !== null && s.value !== undefined) {
      found = true;
      sum += Number(s.value) || 0;
    }
  }
  return found ? sum : null;
}

export async function analyzeTeam(
  teamId: number,
  last: number,
): Promise<TeamAnalysis> {
  const [teamRow] = await apiGet<{
    team: {
      id: number;
      name: string;
      logo: string | null;
      country: string | null;
      founded: number | null;
    };
  }>(`/teams?id=${teamId}`);
  if (!teamRow) throw new Error("Time não encontrado.");

  const fixtures = await apiGet<FixtureRaw>(
    `/fixtures?team=${teamId}&last=${last}&status=FT`,
  );

  const matches: MatchRow[] = [];
  for (const f of fixtures) {
    const home = f.teams.home.id === teamId;
    const goalsFor = (home ? f.goals.home : f.goals.away) ?? 0;
    const goalsAgainst = (home ? f.goals.away : f.goals.home) ?? 0;

    let corners: number | null = null;
    let cornersTotal: number | null = null;
    let cards: number | null = null;
    let cardsTotal: number | null = null;
    try {
      const stats = await apiGet<StatsRaw>(
        `/fixtures/statistics?fixture=${f.fixture.id}`,
      );
      const mine = stats.find((s) => s.team.id === teamId);
      const other = stats.find((s) => s.team.id !== teamId);
      corners = statValue(mine, ["Corner Kicks"]);
      const oppCorners = statValue(other, ["Corner Kicks"]);
      cornersTotal =
        corners !== null && oppCorners !== null ? corners + oppCorners : null;
      cards = statValue(mine, ["Yellow Cards", "Red Cards"]);
      const oppCards = statValue(other, ["Yellow Cards", "Red Cards"]);
      cardsTotal = cards !== null && oppCards !== null ? cards + oppCards : null;
    } catch (err) {
      console.error("Estatísticas da partida indisponíveis", err);
    }

    matches.push({
      fixtureId: f.fixture.id,
      date: f.fixture.date,
      league: f.league.name,
      opponent: home ? f.teams.away.name : f.teams.home.name,
      home,
      goalsFor,
      goalsAgainst,
      result: goalsFor > goalsAgainst ? "W" : goalsFor === goalsAgainst ? "D" : "L",
      corners,
      cornersTotal,
      cards,
      cardsTotal,
    });
  }

  const n = matches.length;
  const totals = matches.map((m) => m.goalsFor + m.goalsAgainst);
  const cornerTotals = matches
    .map((m) => m.cornersTotal)
    .filter((v): v is number => v !== null);
  const cornerOwn = matches
    .map((m) => m.corners)
    .filter((v): v is number => v !== null);
  const cardTotals = matches
    .map((m) => m.cardsTotal)
    .filter((v): v is number => v !== null);
  const cardOwn = matches
    .map((m) => m.cards)
    .filter((v): v is number => v !== null);

  const wins = matches.filter((m) => m.result === "W").length;
  const draws = matches.filter((m) => m.result === "D").length;
  const losses = matches.filter((m) => m.result === "L").length;

  return {
    team: {
      id: teamRow.team.id,
      name: teamRow.team.name,
      logo: teamRow.team.logo,
      country: teamRow.team.country,
      founded: teamRow.team.founded,
    },
    matches,
    sample: n,
    statsSample: cornerTotals.length,
    form: matches.slice(0, 5).map((m) => m.result),
    wins,
    draws,
    losses,
    winRate: pct(wins, n),
    drawRate: pct(draws, n),
    lossRate: pct(losses, n),
    avgGoalsFor: avg(matches.map((m) => m.goalsFor)),
    avgGoalsAgainst: avg(matches.map((m) => m.goalsAgainst)),
    avgGoalsTotal: avg(totals),
    over15: pct(totals.filter((t) => t > 1.5).length, n),
    over25: pct(totals.filter((t) => t > 2.5).length, n),
    over35: pct(totals.filter((t) => t > 3.5).length, n),
    btts: pct(
      matches.filter((m) => m.goalsFor > 0 && m.goalsAgainst > 0).length,
      n,
    ),
    cleanSheets: pct(matches.filter((m) => m.goalsAgainst === 0).length, n),
    scoredRate: pct(matches.filter((m) => m.goalsFor > 0).length, n),
    avgCorners: cornerOwn.length ? avg(cornerOwn) : null,
    avgCornersTotal: cornerTotals.length ? avg(cornerTotals) : null,
    cornersOver85: cornerTotals.length
      ? pct(cornerTotals.filter((c) => c > 8.5).length, cornerTotals.length)
      : null,
    cornersOver95: cornerTotals.length
      ? pct(cornerTotals.filter((c) => c > 9.5).length, cornerTotals.length)
      : null,
    avgCards: cardOwn.length ? avg(cardOwn) : null,
    avgCardsTotal: cardTotals.length ? avg(cardTotals) : null,
    cardsOver35: cardTotals.length
      ? pct(cardTotals.filter((c) => c > 3.5).length, cardTotals.length)
      : null,
    cardsOver45: cardTotals.length
      ? pct(cardTotals.filter((c) => c > 4.5).length, cardTotals.length)
      : null,
  };
}
