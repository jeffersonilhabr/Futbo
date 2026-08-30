import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, LoaderCircle, BarChart3 } from "lucide-react";

import { analyzeTeamFn, searchTeamsFn } from "@/lib/football.functions";
import type { TeamAnalysis, TeamHit } from "@/lib/football.types";
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
      <div className="mb-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 text-center lg:max-w-xl lg:text-left">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" /> Análise de apostas
          </p>
          <h1 className="mt-4 text-5xl sm:text-6xl">Placar Analítico</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground lg:mx-0">
            Digite o nome de um time para ler os últimos jogos e receber taxas claras de
            gols, escanteios, cartões e vitórias.
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <RobotMascot />
        </div>
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

function RobotMascot() {
  return (
    <div className="relative flex h-[280px] w-[280px] items-center justify-center overflow-visible">
      <div className="absolute inset-8 rounded-full bg-primary/20 blur-3xl" />
      <svg
        viewBox="0 0 320 280"
        className="relative h-full w-full drop-shadow-[0_0_55px_rgba(52,211,153,0.55)]"
        role="img"
        aria-label="Robô futurista segurando uma bola de futebol"
      >
        <defs>
          <linearGradient id="bot-shell" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#d9f99d" />
            <stop offset="26%" stopColor="#86efac" />
            <stop offset="72%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
          <linearGradient id="visor-glow" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#ecfeff" />
            <stop offset="40%" stopColor="#a7f3d0" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <linearGradient id="arm-glow" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#bbf7d0" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <radialGradient id="ball-astro" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#dbeafe" />
          </radialGradient>
        </defs>

        <g>
          <circle cx="160" cy="38" r="10" fill="#86efac" />
          <path d="M160 48V70" stroke="#86efac" strokeWidth="5" strokeLinecap="round"/>
          <circle cx="160" cy="80" r="18" fill="#0b1220" stroke="#86efac" strokeWidth="3"/>
          <circle cx="160" cy="80" r="10" fill="#a7f3d0" opacity="0.9"/>

          <path d="M86 112c0-31 25-56 56-56h36c31 0 56 25 56 56v46c0 40-33 73-73 73h-2c-40 0-73-33-73-73v-46Z" fill="#0b1220" stroke="#6ee7b7" strokeWidth="4"/>
          <path d="M102 118h116c22 0 39 17 39 39v17H63v-17c0-22 17-39 39-39Z" fill="url(#bot-shell)" opacity="0.95"/>

          <rect x="87" y="98" width="146" height="68" rx="22" fill="#07130d" stroke="#86efac" strokeWidth="3"/>
          <rect x="100" y="110" width="120" height="44" rx="16" fill="#07130d" stroke="url(#visor-glow)" strokeWidth="3"/>
          <path d="M116 132h88" stroke="url(#visor-glow)" strokeWidth="7" strokeLinecap="round"/>
          <circle cx="120" cy="132" r="6" fill="#dcfce7" />
          <circle cx="200" cy="132" r="6" fill="#dcfce7" />
          <path d="M132 152c11 8 19 12 28 12s17-4 28-12" stroke="#0f172a" strokeWidth="6" strokeLinecap="round" fill="none"/>

          <path d="M88 146c-22 10-32 29-36 48" stroke="url(#arm-glow)" strokeWidth="12" strokeLinecap="round" fill="none"/>
          <path d="M232 146c22 10 32 29 36 48" stroke="url(#arm-glow)" strokeWidth="12" strokeLinecap="round" fill="none"/>
          <path d="M70 192c-12 12-20 24-24 35" stroke="#86efac" strokeWidth="9" strokeLinecap="round"/>
          <path d="M250 192c12 12 20 24 24 35" stroke="#86efac" strokeWidth="9" strokeLinecap="round"/>

          <g>
            <circle cx="120" cy="177" r="12" fill="#0b1220" stroke="#86efac" strokeWidth="3"/>
            <circle cx="200" cy="177" r="12" fill="#0b1220" stroke="#86efac" strokeWidth="3"/>
            <rect x="111" y="190" width="98" height="20" rx="9" fill="#07130d" stroke="#86efac" strokeWidth="3"/>
            <circle cx="134" cy="200" r="7" fill="#4ade80" />
            <circle cx="177" cy="200" r="7" fill="#4ade80" />
          </g>

          <g transform="translate(250 128)">
            <circle cx="0" cy="0" r="30" fill="url(#ball-astro)" stroke="#0f172a" strokeWidth="4"/>
            <path d="M-14 -18L14 -18M-18 -6H18M-14 18L14 18M-18 6H18M-22 -12L-8 0L-22 12M22 -12L8 0L22 12" stroke="#0f172a" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
            <path d="M-8 -8L8 8M8 -8L-8 8" stroke="#0f172a" strokeWidth="2.5" opacity="0.7"/>
          </g>

          <circle cx="96" cy="105" r="8" fill="#86efac" opacity="0.85"/>
          <circle cx="224" cy="105" r="8" fill="#86efac" opacity="0.85"/>
        </g>
      </svg>
    </div>
  );
}
