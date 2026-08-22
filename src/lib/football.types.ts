/**
 * Tipos compartilhados da análise de times (seguro para o cliente).
 */

export type TeamHit = {
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
  founded: number | null;
};

export type MatchRow = {
  fixtureId: number;
  date: string;
  league: string;
  opponent: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: "W" | "D" | "L";
  corners: number | null;
  cornersTotal: number | null;
  cards: number | null;
  cardsTotal: number | null;
};

export type TeamAnalysis = {
  team: TeamHit;
  matches: MatchRow[];
  sample: number;
  statsSample: number;
  form: ("W" | "D" | "L")[];
  wins: number;
  draws: number;
  losses: number;
  winRate: number;
  drawRate: number;
  lossRate: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  avgGoalsTotal: number;
  over15: number;
  over25: number;
  over35: number;
  btts: number;
  cleanSheets: number;
  scoredRate: number;
  avgCorners: number | null;
  avgCornersTotal: number | null;
  cornersOver85: number | null;
  cornersOver95: number | null;
  avgCards: number | null;
  avgCardsTotal: number | null;
  cardsOver35: number | null;
  cardsOver45: number | null;
};

