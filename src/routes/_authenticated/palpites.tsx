import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, LoaderCircle, Trash2, X, RotateCcw } from "lucide-react";

import {
  deletePalpiteFn,
  listPalpitesFn,
  setPalpiteStatusFn,
} from "@/lib/palpites.functions";
import { SiteHeader } from "@/components/site-header";
import { StatTile } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/palpites")({
  head: () => ({
    meta: [
      { title: "Meus palpites | Placar Analítico" },
      {
        name: "description",
        content:
          "Histórico dos palpites enviados, com filtro por data e marcação de green ou red para medir seu aproveitamento.",
      },
      { property: "og:title", content: "Histórico de palpites" },
      {
        property: "og:description",
        content: "Veja quais palpites deram certo, filtre por período e acompanhe sua taxa de acerto.",
      },
    ],
  }),
  component: PalpitesPage,
});

type Status = "pendente" | "green" | "red";

const statusLabel: Record<Status, string> = {
  pendente: "Pendente",
  green: "Acertou",
  red: "Errou",
};

function PalpitesPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<"todos" | Status>("todos");

  const list = useServerFn(listPalpitesFn);
  const setStatusFn = useServerFn(setPalpiteStatusFn);
  const removeFn = useServerFn(deletePalpiteFn);
  const qc = useQueryClient();

  const filters = {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(status !== "todos" ? { status } : {}),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["palpites", filters],
    queryFn: () => list({ data: filters }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["palpites"] });

  const mark = useMutation({
    mutationFn: (vars: { id: string; status: Status }) => setStatusFn({ data: vars }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: invalidate,
  });

  const rows = data ?? [];
  const greens = rows.filter((r) => r.status === "green").length;
  const reds = rows.filter((r) => r.status === "red").length;
  const pending = rows.filter((r) => r.status === "pendente").length;
  const settled = greens + reds;
  const hitRate = settled ? Math.round((greens / settled) * 1000) / 10 : 0;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 className="text-4xl sm:text-5xl">Meus palpites</h1>
        <p className="mt-2 text-muted-foreground">
          Histórico das análises enviadas. Marque cada palpite como acertou ou errou
          para acompanhar seu aproveitamento.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Aproveitamento"
            value={settled ? `${hitRate}%` : "—"}
            progress={hitRate}
            tone={hitRate >= 65 ? "good" : hitRate >= 45 ? "warn" : "bad"}
            hint={`${settled} palpites resolvidos`}
          />
          <StatTile label="Acertos" value={String(greens)} tone="good" />
          <StatTile label="Erros" value={String(reds)} tone="bad" />
          <StatTile label="Pendentes" value={String(pending)} tone="warn" />
        </div>

        <div className="panel mt-8 grid gap-3 p-4 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="from">De</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">Até</Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Situação</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "todos" | Status)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="green">Acertos</SelectItem>
                <SelectItem value="red">Erros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setFrom("");
                setTo("");
                setStatus("todos");
              }}
            >
              Limpar filtros
            </Button>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {(error as Error).message}
          </p>
        )}

        {isLoading ? (
          <div className="mt-10 flex items-center justify-center gap-3 text-muted-foreground">
            <LoaderCircle className="h-5 w-5 animate-spin" /> Carregando palpites...
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground">
            Nenhum palpite encontrado nesse período.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {rows.map((p) => (
              <div
                key={p.id}
                className="panel flex flex-wrap items-center gap-3 p-4"
              >
                {p.team_logo && (
                  <img src={p.team_logo} alt="" className="h-9 w-9" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {p.team_name} · {p.market}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Enviado em{" "}
                    {new Date(p.created_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                    {p.rate !== null && ` · taxa histórica ${p.rate}%`}
                    {p.sample ? ` · ${p.sample} jogos` : ""}
                    {p.match_date
                      ? ` · jogo em ${new Date(`${p.match_date}T12:00:00`).toLocaleDateString("pt-BR")}`
                      : ""}
                  </p>
                  {p.note && (
                    <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>
                  )}
                </div>
                <Badge
                  variant={p.status === "pendente" ? "outline" : "default"}
                  style={
                    p.status === "pendente"
                      ? undefined
                      : {
                          backgroundColor:
                            p.status === "green"
                              ? "var(--color-success)"
                              : "var(--color-destructive)",
                          color: "var(--color-primary-foreground)",
                        }
                  }
                >
                  {statusLabel[p.status as Status]}
                </Badge>
                <div className="flex gap-1">
                  {p.status !== "green" && (
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Marcar como acertou"
                      onClick={() => mark.mutate({ id: p.id, status: "green" })}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                  {p.status !== "red" && (
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Marcar como errou"
                      onClick={() => mark.mutate({ id: p.id, status: "red" })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {p.status !== "pendente" && (
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Voltar para pendente"
                      onClick={() => mark.mutate({ id: p.id, status: "pendente" })}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir palpite"
                    onClick={() => remove.mutate(p.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
