import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LoaderCircle, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { runBotPredictionsFn } from "@/routes/api/bot-predictions";
import { listBotPredictionsFn } from "@/lib/palpites.functions";

export const Route = createFileRoute("/admin/bot")({
  head: () => ({
    meta: [
      { title: "Painel do Bot | Placar Analítico" },
    ],
  }),
  component: BotAdminPage,
});

function BotAdminPage() {
  const [secret, setSecret] = useState("");
  const [hoursAgo, setHoursAgo] = useState("24");

  const runBot = useServerFn(runBotPredictionsFn);
  const listPreds = useServerFn(listBotPredictionsFn);

  const runMutation = useMutation({
    mutationFn: () => runBot({ data: { secret } }),
  });

  const { data: predictions, isLoading: isLoadingPredictions, refetch } = useQuery({
    queryKey: ["botPredictions", hoursAgo],
    queryFn: () => listPreds({ data: { limit: 20, hoursAgo: Number(hoursAgo) } }),
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-4xl font-bold">Bot de Palpites</h1>
      <p className="mt-2 text-muted-foreground">
        Gerencie o bot de palpites automáticos
      </p>

      {/* Trigger Bot */}
      <Card className="mt-8 p-6">
        <h2 className="text-2xl font-semibold mb-4">Disparar Bot</h2>
        <div className="flex gap-3 mb-4">
          <Input
            type="password"
            placeholder="Secret (opcional)"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            size="lg"
          >
            {runMutation.isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Executar
          </Button>
        </div>

        {runMutation.isSuccess && (
          <div className="rounded-lg bg-green-50 p-4 text-green-900 dark:bg-green-900/20 dark:text-green-200">
            <p className="font-semibold">✓ Bot executado com sucesso!</p>
            <pre className="mt-2 overflow-auto text-sm bg-black/20 p-2 rounded">
              {JSON.stringify(runMutation.data, null, 2)}
            </pre>
          </div>
        )}

        {runMutation.isError && (
          <div className="rounded-lg bg-red-50 p-4 text-red-900 dark:bg-red-900/20 dark:text-red-200">
            <p className="font-semibold">✗ Erro ao executar bot</p>
            <p className="text-sm">
              {runMutation.error instanceof Error ? runMutation.error.message : "Unknown error"}
            </p>
          </div>
        )}
      </Card>

      {/* Predictions List */}
      <Card className="mt-8 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Palpites Recentes</h2>
          <div className="flex gap-2">
            <select
              value={hoursAgo}
              onChange={(e) => setHoursAgo(e.target.value)}
              className="px-3 py-1 rounded border border-border bg-background"
            >
              <option value="1">Última 1 hora</option>
              <option value="6">Últimas 6 horas</option>
              <option value="24">Últimas 24 horas</option>
              <option value="72">Últimos 3 dias</option>
            </select>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoadingPredictions}
            >
              Recarregar
            </Button>
          </div>
        </div>

        {isLoadingPredictions ? (
          <div className="flex items-center justify-center p-8">
            <LoaderCircle className="h-5 w-5 animate-spin" />
          </div>
        ) : predictions && predictions.length > 0 ? (
          <div className="space-y-3">
            {predictions.map((pred: any) => (
              <div key={pred.id} className="border border-border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{pred.team_name}</h3>
                      <Badge variant={pred.status === "pendente" ? "default" : "secondary"}>
                        {pred.status}
                      </Badge>
                      {pred.rate && (
                        <Badge variant="outline">
                          Confiança: {pred.rate.toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{pred.market}</p>
                    {pred.note && (
                      <p className="text-sm italic text-muted-foreground">{pred.note}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(pred.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-muted-foreground">
            Nenhum palpite encontrado
          </p>
        )}
      </Card>

      {/* Setup Instructions */}
      <Card className="mt-8 p-6">
        <h2 className="text-2xl font-semibold mb-4">Configuração</h2>
        <div className="bg-muted p-4 rounded text-sm space-y-2">
          <p>Para configurar o agendamento automático do bot, leia:</p>
          <code className="block font-mono bg-black/20 p-2 rounded">BOT_SETUP.md</code>
          <p>
            Você pode usar Render Cron, GitHub Actions, EasyCron ou UptimeRobot para
            disparar o bot a cada 1 hora.
          </p>
        </div>
      </Card>
    </main>
  );
}
