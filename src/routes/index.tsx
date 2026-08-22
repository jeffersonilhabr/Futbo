import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, LoaderCircle, BarChart3 } from "lucide-react";

import { analyzeTeamFn, searchTeamsFn } from "@/lib/football.functions";
import type { TeamAnalysis, TeamHit } from "@/lib/football.server";
import { TeamAnalysisView } from "@/components/team-analysis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Placar Analítico | Estatísticas de apostas por time" },
      {
        name: "description",
        content:
          "Analise os últimos jogos de qualquer time e veja taxas de gols, escanteios, cartões e vitórias para embasar suas apostas.",
      },
      { property: "og:title", content: "Placar Analítico | Estatísticas para apostas" },
      {
        property: "og:description",
        content:
          "Busque um time e receba médias de gols, escanteios, cartões e porcentagem de acerto por mercado.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [query, setQuery] = useState("");
  const [last, setLast] = useState("10");
  const [teams, setTeams] = useState<TeamHit[] | null>(null);
  const [analysis, setAnalysis] = useState<TeamAnalysis | null>(null);

  const search = useServerFn(searchTeamsFn);
  const analyze = useServerFn(analyzeTeamFn);

  const searchMutation = useMutation({
    mutationFn: (q: string) => search({ data: { query: q } }),
    onSuccess: (result) => {
      setAnalysis(null);
      setTeams(result);
      if (result.length === 1) analyzeMutation.mutate(result[0]!.id);
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: (teamId: number) =>
      analyze({ data: { teamId, last: Number(last) } }),
    onSuccess: (result) => setAnalysis(result),
  });

  const error = searchMutation.error ?? analyzeMutation.error;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <div className="mb-10 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" /> Análise de apostas
        </p>
        <h1 className="mt-4 text-5xl sm:text-6xl">Placar Analítico</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Digite o nome de um time para ler os últimos jogos e receber taxas claras de
          gols, escanteios, cartões e vitórias.
        </p>
      </div>

      <form
        className="panel flex flex-col gap-3 p-4 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 2) searchMutation.mutate(query.trim());
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex: Flamengo, Palmeiras, Arsenal..."
          className="h-12 flex-1 text-base"
          aria-label="Nome do time"
        />
        <Select value={last} onValueChange={setLast}>
          <SelectTrigger className="h-12 sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">Últimos 5 jogos</SelectItem>
            <SelectItem value="10">Últimos 10 jogos</SelectItem>
            <SelectItem value="15">Últimos 15 jogos</SelectItem>
            <SelectItem value="20">Últimos 20 jogos</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" size="lg" className="h-12" disabled={searchMutation.isPending}>
          {searchMutation.isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Analisar
        </Button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
          {error.message}
        </p>
      )}

      {teams && teams.length === 0 && (
        <p className="mt-6 text-center text-muted-foreground">
          Nenhum time encontrado para “{query}”.
        </p>
      )}

      {teams && teams.length > 1 && (
        <div className="mt-6">
          <h2 className="mb-3 text-xl">Selecione o time</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => analyzeMutation.mutate(t.id)}
                className="panel flex items-center gap-3 p-3 text-left transition-colors hover:border-primary"
              >
                {t.logo && <img src={t.logo} alt="" className="h-8 w-8" />}
                <span>
                  <span className="block font-semibold">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t.country ?? "—"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {analyzeMutation.isPending && (
        <div className="mt-10 flex items-center justify-center gap-3 text-muted-foreground">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          Lendo os últimos jogos e estatísticas...
        </div>
      )}

      {analysis && !analyzeMutation.isPending && (
        <div className="mt-10">
          <TeamAnalysisView data={analysis} />
        </div>
      )}
    </main>
  );
}
