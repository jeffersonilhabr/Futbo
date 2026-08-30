import { beforeEach, describe, expect, it, vi } from "vitest";

import { analyzeTeam, searchTeams } from "./football.server";

describe("football.server", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("API_FOOTBALL_KEY", "");
  });

  it("returns demo teams when the API key is missing", async () => {
    const results = await searchTeams("palmeiras");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.name).toBeTruthy();
  });

  it("returns a valid demo analysis when the API key is missing", async () => {
    const analysis = await analyzeTeam(1, 10);

    expect(analysis.team.name).toBeTruthy();
    expect(analysis.matches).toHaveLength(10);
    expect(analysis.avgGoalsTotal).toBeGreaterThanOrEqual(0);
    expect(analysis.winRate).toBeGreaterThanOrEqual(0);
  });
});
