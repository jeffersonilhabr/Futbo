import type { TeamAnalysis } from "@/lib/football.types";
import { StatTile } from "@/components/stat-tile";
import { Badge } from "@/components/ui/badge";

const rateTone = (v: number) => (v >= 65 ? "good" : v >= 45 ? "warn" : "bad");

function BetLine({
  market,
  rate,
  detail,
}: {
  market: string;
  rate: number | null;
  detail: string;
}) {
  const value = rate ?? 0;
  const label =
    rate === null
      ? "Sem dados"
      : value >= 70
        ? "Forte"
        : value >= 55
          ? "Moderado"
          : "Evitar";
  return (
    <div className="flex items-center gap-4 border-b border-border/60 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{market}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="w-28">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{
              width: `${value}%`,
              backgroundColor:
                value >= 70
                  ? "var(--color-success)"
                  : value >= 55
                    ? "var(--color-warning)"
                    : "var(--color-destructive)",
            }}
          />
        </div>
      </div>
      <p className="w-16 text-right font-display text-xl">
        {rate === null ? "—" : `${rate}%`}
      </p>
      <Badge variant="outline" className="hidden w-24 justify-center sm:flex">
        {label}
      </Badge>
    </div>
  );
}

export function TeamAnalysisView({ data }: { data: TeamAnalysis }) {
  const { team } = data;

  return (
    <section className="space-y-8">
      <header className="panel flex flex-wrap items-center gap-4 p-5">
        {team.logo && (
          <img src={team.logo} alt={`Escudo do ${team.name}`} className="h-14 w-14" />
        )}
        <div className="flex-1">
          <h2 className="text-3xl">{team.name}</h2>
          <p className="text-sm text-muted-foreground">
            {team.country ?? "—"} · amostra de {data.sample} jogos finalizados
          </p>
        </div>
        <div className="flex gap-1.5">
          {data.form.map((r, i) => (
            <span
              key={i}
              className="flex h-9 w-9 items-center justify-center rounded-md font-display text-lg"
              style={{
                backgroundColor:
                  r === "W"
                    ? "var(--color-success)"
                    : r === "D"
                      ? "var(--color-muted)"
                      : "var(--color-destructive)",
                color:
                  r === "D" ? "var(--color-foreground)" : "var(--color-primary-foreground)",
              }}
            >
              {r === "W" ? "V" : r === "D" ? "E" : "D"}
            </span>
          ))}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Taxa de vitórias"
          value={`${data.winRate}%`}
          tone={rateTone(data.winRate)}
          progress={data.winRate}
          hint={`${data.wins}V ${data.draws}E ${data.losses}D`}
        />
        <StatTile
          label="Média de gols (partida)"
          value={String(data.avgGoalsTotal)}
          hint={`${data.avgGoalsFor} marcados · ${data.avgGoalsAgainst} sofridos`}
        />
        <StatTile
          label="Média de escanteios (partida)"
          value={data.avgCornersTotal !== null ? String(data.avgCornersTotal) : "—"}
          hint={
            data.avgCorners !== null
              ? `${data.avgCorners} do próprio time`
              : "Estatística indisponível"
          }
        />
        <StatTile
          label="Média de cartões (partida)"
          value={data.avgCardsTotal !== null ? String(data.avgCardsTotal) : "—"}
          tone="warn"
          hint={
            data.avgCards !== null
              ? `${data.avgCards} do próprio time`
              : "Estatística indisponível"
          }
        />
      </div>

      <div className="panel p-5">
        <h3 className="text-2xl">Mercados sugeridos</h3>
        <p className="mb-2 text-sm text-muted-foreground">
          Porcentagem de acerto se você tivesse apostado nesse mercado em todos os
          jogos da amostra.
        </p>
        <BetLine
          market="Vitória do time"
          rate={data.winRate}
          detail={`${data.wins} de ${data.sample} jogos`}
        />
        <BetLine
          market="Mais de 1.5 gols"
          rate={data.over15}
          detail="Total de gols na partida"
        />
        <BetLine
          market="Mais de 2.5 gols"
          rate={data.over25}
          detail="Total de gols na partida"
        />
        <BetLine
          market="Mais de 3.5 gols"
          rate={data.over35}
          detail="Total de gols na partida"
        />
        <BetLine market="Ambas marcam" rate={data.btts} detail="Os dois times marcaram" />
        <BetLine
          market="Time marca gol"
          rate={data.scoredRate}
          detail="Marcou ao menos 1 gol"
        />
        <BetLine
          market="Mais de 8.5 escanteios"
          rate={data.cornersOver85}
          detail={`Base de ${data.statsSample} jogos com estatísticas`}
        />
        <BetLine
          market="Mais de 9.5 escanteios"
          rate={data.cornersOver95}
          detail={`Base de ${data.statsSample} jogos com estatísticas`}
        />
        <BetLine
          market="Mais de 3.5 cartões"
          rate={data.cardsOver35}
          detail="Amarelos + vermelhos das duas equipes"
        />
        <BetLine
          market="Mais de 4.5 cartões"
          rate={data.cardsOver45}
          detail="Amarelos + vermelhos das duas equipes"
        />
      </div>

      <div className="panel overflow-x-auto p-5">
        <h3 className="mb-3 text-2xl">Últimos jogos</h3>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2 text-left">Data</th>
              <th className="py-2 text-left">Adversário</th>
              <th className="py-2 text-left">Competição</th>
              <th className="py-2 text-center">Placar</th>
              <th className="py-2 text-center">Escanteios</th>
              <th className="py-2 text-center">Cartões</th>
            </tr>
          </thead>
          <tbody>
            {data.matches.map((m) => (
              <tr key={m.fixtureId} className="border-t border-border/60">
                <td className="py-2">
                  {new Date(m.date).toLocaleDateString("pt-BR")}
                </td>
                <td className="py-2">
                  {m.home ? "vs " : "@ "}
                  {m.opponent}
                </td>
                <td className="py-2 text-muted-foreground">{m.league}</td>
                <td className="py-2 text-center font-semibold">
                  {m.goalsFor}-{m.goalsAgainst}
                </td>
                <td className="py-2 text-center">{m.cornersTotal ?? "—"}</td>
                <td className="py-2 text-center">{m.cardsTotal ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Estatísticas históricas não garantem resultados futuros. Aposte com
        responsabilidade — proibido para menores de 18 anos.
      </p>
    </section>
  );
}
