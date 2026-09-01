import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const statusSchema = z.enum(["pendente", "green", "red"]);

export const listPalpitesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        from: z.string().optional(),
        to: z.string().optional(),
        status: statusSchema.optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("palpites")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    if (data.from) query = query.gte("created_at", `${data.from}T00:00:00Z`);
    if (data.to) query = query.lte("created_at", `${data.to}T23:59:59Z`);
    if (data.status) query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createPalpiteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        teamId: z.number().int().positive().nullable().optional(),
        teamName: z.string().trim().min(1).max(80),
        teamLogo: z.string().url().nullable().optional(),
        market: z.string().trim().min(1).max(80),
        rate: z.number().nullable().optional(),
        sample: z.number().int().nullable().optional(),
        matchDate: z.string().nullable().optional(),
        note: z.string().max(400).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("palpites")
      .insert({
        user_id: context.userId,
        team_id: data.teamId ?? null,
        team_name: data.teamName,
        team_logo: data.teamLogo ?? null,
        market: data.market,
        rate: data.rate ?? null,
        sample: data.sample ?? null,
        match_date: data.matchDate || null,
        note: data.note ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const setPalpiteStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ id: z.string().uuid(), status: statusSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("palpites")
      .update({
        status: data.status,
        settled_at: data.status === "pendente" ? null : new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePalpiteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("palpites")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Bot predictions - public read, internal write
export const listBotPredictionsFn = createServerFn({ method: "POST" })
  .validator((input) =>
    z
      .object({
        limit: z.number().int().default(5),
        hoursAgo: z.number().int().default(24),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    // Note: This would need a bot user ID - for now we'll filter by a special marker
    // In production, you'd have a dedicated bot account
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      {
        auth: { persistSession: false },
      },
    );

    const hoursAgo = new Date(Date.now() - data.hoursAgo * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from("palpites")
      .select("*")
      .like("note", "%[BOT]%")
      .gte("created_at", hoursAgo)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (error) throw new Error(error.message);
    return rows ?? [];
  });

