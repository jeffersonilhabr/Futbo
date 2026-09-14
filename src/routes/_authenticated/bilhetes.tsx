import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, LoaderCircle, Ticket, X } from "lucide-react";

import { listBilheteEntriesFn, setPalpiteStatusFn } from "@/lib/palpites.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/stat-tile";

export const Route = createFileRoute("/_authenticated/bilhetes")({
  head: () => ({
    meta: [
      { title: "Bilhetes abertos | Placar Analítico" },
      {
        name: "description",
        content:
          "Acompanhe seus bilhetes em aberto: cada entrada com mercado, odd estimada e o resultado real quando já saiu.",
      },
      { property: "og:title", content: "Bilhetes abertos" },
      {
        property: "og:description",
        content: "Veja entrada por entrada do bilhete: mercado, odd estimada e resultado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BilhetesPage,
});

type Status = "pendente" | "green" | "red";

type Entry = {
  id: string;
  team_name: string;
  market: string;
  rate: number | null;
  note: string | null;
  status: Status;
  created_at: string;
};

type Grupo = {
  chave: string;
  titulo: string;
  criadoEm: string;
  entradas: Entry[];
};

function parseTitulo(note: string | null) {
  const match = note?.match(/^\[BILHETE (.+?)\]\s*/);
  return {
    titulo: match?.[1]?.trim() || "Bilhete",
    justificativa: note ? note.replace(/^\[BILHETE .+?\]\s*/, "") : "",
  };
}

function agrupar(rows: Entry[]): Grupo[] {
  const map = new Map<string, Grupo>();
  for (const row of rows) {
    const { titulo } = parseTitulo(row.note);
    const dia = row.created_at.slice(0, 16);
    const chave = `${titulo}__${dia}`;
    const grupo = map.get(chave);
    if (grupo) grupo.entradas.push(row);
    else map.set(chave, { chave, titulo, criadoEm: row.created_at, entradas: [row] });
  }
  return [...map.values()];
}

const statusLabel: Record<Status, string> = {
  pendente: "Aguardando",
  green: "Green",
  red: "Red",
};

function BilhetesPage() {
  const listEntries = useServerFn(listBilheteEntriesFn);
  const setStatus = useServerFn(setPalpiteStatusFn);
  const qc = useQueryClient();
  const [aba, setAba] = useState<"abertos" | "encerrados">("abertos");

  const { data, isLoading, error } = useQuery({
    queryKey: ["bilhetes"],
    queryFn: () => listEntries({ data: {} } as never),
  });

  const mark = useMutation({
    mutationFn: (vars: { id: string; status: Status }) => setStatus({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bilhetes"] });
      qc.invalidateQueries({ queryKey: ["palpites"] });
    },
  });

  const grupos = agrupar((data ?? []) as Entry[]);
  const abertos = grupos.filter((g) => g.entradas.some((e) => e.status === "pendente"));
  const encerrados = grupos.filter((g) => g.entradas.every((e) => e.status !== "pendente"));
  const visiveis = aba === "abertos" ? abertos : encerrados;
  const ganhos = encerrados.filter((g) => g.entradas.every((e) => e.status === "green")).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-4xl sm:text-5xl">Bilhetes abertos</h1>
      <p className="mt-2 text-muted-foreground">
        Cada bilhete salvo pelo robô, entrada por entrada: mercado, odd estimada e o resultado
        real assim que você marcar.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatTile label="Em aberto" value={String(abertos.length)} tone="warn" />
        <StatTile label="Encerrados" value={String(encerrados.length)} />
        <StatTile label="Bilhetes batidos" value={String(ganhos)} tone="good" />
      </div>

      <div className="mt-6 flex gap-2">
        <Button
          variant={aba === "abertos" ? "default" : "outline"}
          size="sm"
          onClick={() => setAba("abertos")}
        >
          Em aberto ({abertos.length})
        </Button>
        <Button
          variant={aba === "encerrados" ? "default" : "outline"}
          size="sm"
          onClick={() => setAba("encerrados")}
        >
          Encerrados ({encerrados.length})
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {(error as Error).message}
        </p>
      )}

      {isLoading ? (
        <div className="mt-10 flex items-center justify-center gap-3 text-muted-foreground">
          <LoaderCircle className="h-5 w-5 animate-spin" /> Carregando bilhetes...
        </div>
      ) : visiveis.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">
          {aba === "abertos"
            ? "Nenhum bilhete em aberto. Monte um na tela “Pedir ao robô”."
            : "Nenhum bilhete encerrado ainda."}
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {visiveis.map((grupo) => {
            const oddTotal = grupo.entradas.reduce((acc, e) => acc * (e.rate || 1), 1);
            const greens = grupo.entradas.filter((e) => e.status === "green").length;
            const reds = grupo.entradas.filter((e) => e.status === "red").length;
            return (
              <section key={grupo.chave} className="panel p-5">
                <header className="flex flex-wrap items-center gap-3">
                  <Ticket className="h-5 w-5 text-primary" />
                  <h2 className="mr-auto text-2xl">{grupo.titulo}</h2>
                  <Badge variant="secondary">
                    Odd total ~{oddTotal.toFixed(2)}
                  </Badge>
                  <Badge variant="outline">
                    {greens} green · {reds} red · {grupo.entradas.length} entradas
                  </Badge>
                </header>
                <p className="mt-1 text-xs text-muted-foreground">
                  Criado em{" "}
                  {new Date(grupo.criadoEm).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>

                <ul className="mt-4 space-y-3">
                  {grupo.entradas.map((entrada) => {
                    const { justificativa } = parseTitulo(entrada.note);
                    return (
                      <li
                        key={entrada.id}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{entrada.team_name}</p>
                          <p className="text-sm text-primary">{entrada.market}</p>
                          {justificativa && (
                            <p className="mt-1 text-xs text-muted-foreground">{justificativa}</p>
                          )}
                        </div>
                        <Badge variant="secondary">
                          Odd est. {entrada.rate ? entrada.rate.toFixed(2) : "—"}
                        </Badge>
                        <Badge
                          variant={entrada.status === "pendente" ? "outline" : "default"}
                          style={
                            entrada.status === "pendente"
                              ? undefined
                              : {
                                  backgroundColor:
                                    entrada.status === "green"
                                      ? "var(--color-success)"
                                      : "var(--color-destructive)",
                                  color: "var(--color-primary-foreground)",
                                }
                          }
                        >
                          {statusLabel[entrada.status]}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Marcar green"
                            disabled={mark.isPending}
                            onClick={() =>
                              mark.mutate({
                                id: entrada.id,
                                status: entrada.status === "green" ? "pendente" : "green",
                              })
                            }
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Marcar red"
                            disabled={mark.isPending}
                            onClick={() =>
                              mark.mutate({
                                id: entrada.id,
                                status: entrada.status === "red" ? "pendente" : "red",
                              })
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
