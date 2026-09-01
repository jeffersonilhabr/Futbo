/**
 * Bot runner - Executa o bot de palpites e salva no banco de dados.
 * Pode ser chamado via cron job ou endpoint HTTP.
 */

import { createClient } from "@supabase/supabase-js";
import { generateBotPredictions } from "./football.bot";

export async function runBotPredictions() {
  try {
    console.log("[BOT] Starting bot predictions run...");

    // Generate predictions
    const predictions = await generateBotPredictions(5);

    if (predictions.length === 0) {
      console.log("[BOT] No predictions generated");
      return { success: false, message: "No predictions generated" };
    }

    // Initialize Supabase with service role
    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Use a fixed bot user ID - you'll need to create this user
    // For now, we'll use a placeholder
    const BOT_USER_ID = process.env.BOT_USER_ID || "00000000-0000-0000-0000-000000000000";

    // Save predictions
    const savedPalpites = [];
    for (const pred of predictions) {
      const { data, error } = await supabase
        .from("palpites")
        .insert({
          user_id: BOT_USER_ID,
          team_id: pred.homeTeamId,
          team_name: `${pred.homeTeam} vs ${pred.awayTeam}`,
          team_logo: null,
          market: pred.market,
          rate: pred.confidence,
          sample: pred.homeAnalysis.sample,
          match_date: new Date(pred.date).toISOString().split("T")[0],
          note: `[BOT] ${pred.prediction} - ${pred.reasoning}`,
          status: "pendente",
        })
        .select()
        .single();

      if (error) {
        console.error(`[BOT] Error saving prediction for match ${pred.matchId}:`, error);
      } else {
        savedPalpites.push(data);
        console.log(`[BOT] Saved prediction: ${pred.market} for ${pred.homeTeam} vs ${pred.awayTeam}`);
      }
    }

    console.log(`[BOT] Bot run completed. Saved ${savedPalpites.length} predictions`);

    return {
      success: true,
      message: `Generated and saved ${savedPalpites.length} predictions`,
      predictions: savedPalpites,
    };
  } catch (error) {
    console.error("[BOT] Error running bot:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      error: error,
    };
  }
}
