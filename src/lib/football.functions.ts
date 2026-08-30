import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const searchTeamsFn = createServerFn({ method: "POST" })
  .validator((input) =>
    z.object({ query: z.string().trim().min(2).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { searchTeams } = await import("./football.server");
    return searchTeams(data.query);
  });

export const analyzeTeamFn = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        teamId: z.number().int().positive(),
        last: z.number().int().min(5).max(20).default(10),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { analyzeTeam } = await import("./football.server");
    return analyzeTeam(data.teamId, data.last);
  });
