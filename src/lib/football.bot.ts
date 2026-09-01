/**
 * Bot de palpites ao vivo - Analisa os melhores jogos do dia e gera palpites.
 * Executa a cada 1 hora para atualizar recomendações.
 */

import type { TeamAnalysis } from "./football.types";
import { analyzeTeam } from "./football.server";

export type BotPrediction = {
  matchId: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  market: string;
  prediction: string;
  confidence: number; // 0-100
  reasoning: string;
  homeAnalysis: TeamAnalysis;
  awayAnalysis: TeamAnalysis;
};

type MatchDay = {
  fixture: {
    id: number;
    date: string;
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  league: { name: string };
};

async function fetchTodayFixtures(): Promise<MatchDay[]> {
  const API_BASE = "https://v3.football.api-sports.io";
  const RAPID_BASE = "https://api-football-v1.p.rapidapi.com/v3";

  const apiKey = process.env["API_FOOTBALL_KEY"]?.trim();
  if (!apiKey) {
    // Return demo fixtures
    const today = new Date();
    return [
      {
        fixture: {
          id: 1,
          date: today.toISOString(),
        },
        teams: {
          home: { id: 1, name: "Palmeiras" },
          away: { id: 2, name: "Flamengo" },
        },
        league: { name: "Brasileirão" },
      },
      {
        fixture: {
          id: 2,
          date: today.toISOString(),
        },
        teams: {
          home: { id: 4, name: "Arsenal" },
          away: { id: 5, name: "Barcelona" },
        },
        league: { name: "Premier League" },
      },
    ];
  }

  // Format date as YYYY-MM-DD
  const today = new Date().toISOString().split("T")[0];

  type FixtureRaw = {
    fixture: {
      id: number;
      date: string;
    };
    teams: {
      home: { id: number; name: string };
      away: { id: number; name: string };
    };
    league: { name: string };
  };

  const headers = {
    "x-apisports-key": apiKey,
  };

  try {
    const res = await fetch(`${API_BASE}/fixtures?date=${today}`, { headers });
    const body = (await res.json()) as { response?: FixtureRaw[] };

    if (res.ok && body.response) {
      return body.response;
    }

    // Fallback to RapidAPI
    const rapidHeaders = {
      "x-rapidapi-key": apiKey,
      "x-rapidapi-host": "api-football-v1.p.rapidapi.com",
    };
    const rapidRes = await fetch(`${RAPID_BASE}/fixtures?date=${today}`, { headers: rapidHeaders });
    const rapidBody = (await rapidRes.json()) as { response?: FixtureRaw[] };
    return rapidBody.response ?? [];
  } catch (e) {
    console.error("Error fetching fixtures:", e);
    return [];
  }
}

/**
 * Score a match based on how interesting/valuable it is for betting
 */
function scoreMatch(home: TeamAnalysis, away: TeamAnalysis): number {
  let score = 0;

  // Prefer balanced matches (interesting odds)
  const homeWinRate = home.winRate;
  const awayWinRate = away.winRate;
  const balance = Math.abs(homeWinRate - awayWinRate);
  score += Math.max(0, 50 - balance); // Max 50 points for balance

  // Prefer high-scoring matches
  const avgGoalsTotal = (home.avgGoalsFor + away.avgGoalsFor) / 2;
  score += Math.min(30, avgGoalsTotal * 5); // Max 30 points

  // Prefer matches with good recent form
  const formScore = home.form.filter((r) => r === "W").length;
  score += formScore * 3; // Up to 15 points

  // Prefer leagues with more statistical data
  score += home.statsSample ? 10 : 0;
  score += away.statsSample ? 10 : 0;

  return Math.round(score);
}

/**
 * Generate a prediction for a market based on team analysis
 */
function generateMarketPrediction(home: TeamAnalysis, away: TeamAnalysis): {
  market: string;
  prediction: string;
  confidence: number;
  reasoning: string;
} {
  // Randomly pick a market to predict (in real scenario, try multiple)
  const avgTotal = home.avgGoalsTotal + away.avgGoalsTotal;
  const homeScore = scoreMatch(home, away);

  if (homeScore > 60) {
    // Over 2.5
    return {
      market: "Over 2.5 Gols",
      prediction: avgTotal > 2.5 ? "✓ OVER" : "✗ UNDER",
      confidence: Math.round((avgTotal / 5) * 100),
      reasoning: `Média de ${avgTotal.toFixed(1)} gols. ${home.team.name} marca ${home.avgGoalsFor.toFixed(1)} e ${away.team.name} marca ${away.avgGoalsFor.toFixed(1)} em média.`,
    };
  } else {
    // Ambas marcam
    return {
      market: "Ambas Marcam",
      prediction:
        home.scoredRate > 50 && away.scoredRate > 50 ? "✓ SIM" : "✗ NÃO",
      confidence: Math.round((Math.min(home.scoredRate, away.scoredRate) / 100) * 100),
      reasoning: `${home.team.name} marca em ${home.scoredRate.toFixed(1)}% dos jogos. ${away.team.name} marca em ${away.scoredRate.toFixed(1)}%.`,
    };
  }
}

export async function generateBotPredictions(limit: number = 5): Promise<BotPrediction[]> {
  const fixtures = await fetchTodayFixtures();

  if (fixtures.length === 0) {
    console.log("No fixtures found for today");
    return [];
  }

  console.log(`Found ${fixtures.length} fixtures for today, analyzing...`);

  // Analyze all teams
  const predictions: BotPrediction[] = [];
  const scoredMatches: Array<{ fixture: MatchDay; score: number; analyses: any }> = [];

  for (const fixture of fixtures) {
    try {
      const homeAnalysis = await analyzeTeam(fixture.teams.home.id, 10);
      const awayAnalysis = await analyzeTeam(fixture.teams.away.id, 10);

      const score = scoreMatch(homeAnalysis, awayAnalysis);
      scoredMatches.push({
        fixture,
        score,
        analyses: { home: homeAnalysis, away: awayAnalysis },
      });
    } catch (e) {
      console.error(`Error analyzing match ${fixture.fixture.id}:`, e);
    }
  }

  // Sort by score and take top N
  const topMatches = scoredMatches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  console.log(`Selected top ${topMatches.length} matches for predictions`);

  for (const { fixture, analyses } of topMatches) {
    const { market, prediction, confidence, reasoning } = generateMarketPrediction(
      analyses.home,
      analyses.away,
    );

    predictions.push({
      matchId: fixture.fixture.id,
      date: fixture.fixture.date,
      homeTeam: fixture.teams.home.name,
      awayTeam: fixture.teams.away.name,
      homeTeamId: fixture.teams.home.id,
      awayTeamId: fixture.teams.away.id,
      market,
      prediction,
      confidence,
      reasoning,
      homeAnalysis: analyses.home,
      awayAnalysis: analyses.away,
    });
  }

  return predictions;
}
