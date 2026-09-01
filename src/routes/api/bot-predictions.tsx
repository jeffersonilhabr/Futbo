import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Server function that can be called via HTTP or client-side
export const runBotPredictionsFn = createServerFn({ method: "POST" })
  .validator((input) =>
    z.object({ secret: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    // Optional: Verify secret token if provided
    const expectedSecret = process.env["BOT_SECRET"];
    if (expectedSecret && data.secret !== expectedSecret) {
      throw new Error("Unauthorized: Invalid secret");
    }

    const { runBotPredictions } = await import("@/lib/bot-runner");
    const result = await runBotPredictions();

    if (!result.success) {
      return { success: false, message: result.message };
    }

    return {
      success: true,
      message: result.message,
      predictions: result.predictions,
    };
  });

export const Route = createFileRoute("/api/bot-predictions")({
  component: () => (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Bot de Palpites</h1>
        <p className="mt-2 text-muted-foreground">
          Use o endpoint POST para disparar o bot
        </p>
        <pre className="mt-4 bg-muted p-4 rounded text-left text-sm">
          {`POST /api/bot-predictions
Content-Type: application/json

{
  "secret": "sua_chave_secreta"
}`}
        </pre>
      </div>
    </div>
  ),
});
