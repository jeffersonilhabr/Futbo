import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bot, LoaderCircle, Send, Sparkles, Ticket, User } from "lucide-react";
import { toast } from "sonner";

import {
  askRoboFn,
  montarBilheteFn,
  type Bilhete,
  type RoboTip,
} from "@/lib/robo.functions";
import { createPalpiteFn } from "@/lib/palpites.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/robo")({
  head: () => ({
    meta: [
      { title: "Pedir palpites ao robô | Placar Analítico" },
      {
        name: "description",
        content:
          "Converse com o robô palpiteiro, peça sugestões de gols, escanteios e cartões e salve as entradas no seu histórico.",
      },
      { property: "og:title", content: "Pedir palpites ao robô" },
      {
        property: "og:description",
        content: "Chat com o robô palpiteiro para receber sugestões de apostas em segundos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoboPage,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  palpites?: RoboTip[];
};

const sugestoes = [
  "Me dá 3 palpites para os jogos do Brasileirão hoje",
  "Análise de escanteios para Flamengo x Palmeiras",
  "Palpites de cartões na Premier League",
];

const riscos = [
  { valor: "baixo" as const, rotulo: "Seguro" },
  { valor: "medio" as const, rotulo: "Equilibrado" },
  { valor: "alto" as const, rotulo: "Ousado" },
];

function BilheteCard({
  bilhete,
  onSalvar,
  salvando,
}: {
  bilhete: Bilhete;
  onSalvar: () => void;
  salvando: boolean;
}) {
  return (
    <div className="panel mt-4 space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-2xl">
          <Ticket className="h-5 w-5 text-primary" /> {bilhete.titulo}
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Risco: {bilhete.risco}</Badge>
          <Badge>Odd ~{bilhete.oddTotal.toFixed(2)}</Badge>
        </div>
      </div>

      <ol className="space-y-2">
        {bilhete.entradas.map((entrada, index) => (
          <li
            key={index}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2"
          >
            <span className="font-display text-lg text-muted-foreground">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{entrada.jogo}</p>
              <p className="text-sm text-primary">{entrada.mercado}</p>
              <p className="text-xs text-muted-foreground">{entrada.justificativa}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{entrada.probabilidade}%</p>
              <p className="text-xs text-muted-foreground">odd {entrada.oddEstimada.toFixed(2)}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        <p className="text-sm text-muted-foreground">
          Chance do bilhete inteiro: <strong>{bilhete.probabilidadeTotal}%</strong>
        </p>
        <Button onClick={onSalvar} disabled={salvando}>
          Salvar bilhete no histórico
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{bilhete.resumo}</p>
    </div>
  );
}

function RoboPage() {
  const ask = useServerFn(askRoboFn);
  const montarBilhete = useServerFn(montarBilheteFn);
  const createPalpite = useServerFn(createPalpiteFn);
  const [contexto, setContexto] = useState("");
  const [qtdEntradas, setQtdEntradas] = useState(3);
  const [risco, setRisco] = useState<"baixo" | "medio" | "alto">("medio");
  const [bilhete, setBilhete] = useState<Bilhete | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Opa! Sou o Robô Palpiteiro. Me diga o time, o campeonato ou o jogo e eu monto sugestões de gols, escanteios e cartões.",
      palpites: [],
    },
  ]);

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const history = [...messages, { role: "user" as const, content: question }]
        .filter((m) => m.content.trim().length > 0)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));
      return ask({ data: { messages: history } });
    },
    onSuccess: (answer) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer.resposta, palpites: answer.palpites },
      ]);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Não consegui responder agora. Tente novamente." },
      ]);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (tip: RoboTip) =>
      createPalpite({
        data: {
          teamName: tip.jogo,
          market: tip.mercado,
          rate: tip.confianca,
          note: `[ROBÔ] ${tip.justificativa}`.slice(0, 400),
        },
      }),
    onSuccess: () => toast.success("Palpite salvo no seu histórico"),
    onError: (error: Error) => toast.error(error.message),
  });

  const bilheteMutation = useMutation({
    mutationFn: async () =>
      montarBilhete({ data: { contexto: contexto.trim(), entradas: qtdEntradas, risco } }),
    onSuccess: (result) => setBilhete(result),
    onError: (error: Error) => toast.error(error.message),
  });

  const salvarBilheteMutation = useMutation({
    mutationFn: async (ticket: Bilhete) => {
      for (const entrada of ticket.entradas) {
        await createPalpite({
          data: {
            teamName: entrada.jogo,
            market: entrada.mercado,
            rate: entrada.oddEstimada,
            note: `[BILHETE ${ticket.titulo}] ${entrada.justificativa}`.slice(0, 400),
          },
        });
      }
    },
    onSuccess: () => toast.success("Bilhete salvo no seu histórico"),
    onError: (error: Error) => toast.error(error.message),
  });

  function send(question: string) {
    const text = question.trim();
    if (!text || askMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    askMutation.mutate(text);
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="flex items-center gap-2 font-display text-4xl">
          <Bot className="h-8 w-8 text-primary" /> Pedir palpites ao robô
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Peça sugestões de entradas e salve as que gostar no seu histórico. Estimativas — aposte com responsabilidade.
        </p>

        <section className="panel mt-6 space-y-4 p-5">
          <h2 className="flex items-center gap-2 font-display text-2xl">
            <Ticket className="h-5 w-5 text-primary" /> Montar bilhete
          </h2>
          <p className="text-sm text-muted-foreground">
            Diga os jogos ou campeonatos e o robô monta um bilhete com os mercados mais prováveis.
          </p>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (contexto.trim().length === 0 || bilheteMutation.isPending) return;
              bilheteMutation.mutate();
            }}
          >
            <Input
              value={contexto}
              onChange={(event) => setContexto(event.target.value)}
              placeholder="Ex.: jogos do Brasileirão hoje, foco em gols e escanteios"
            />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Entradas:</span>
              {[2, 3, 4, 5, 6].map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={qtdEntradas === n ? "default" : "outline"}
                  onClick={() => setQtdEntradas(n)}
                >
                  {n}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Perfil:</span>
              {riscos.map((r) => (
                <Button
                  key={r.valor}
                  type="button"
                  size="sm"
                  variant={risco === r.valor ? "default" : "outline"}
                  onClick={() => setRisco(r.valor)}
                >
                  {r.rotulo}
                </Button>
              ))}
            </div>

            <Button type="submit" disabled={bilheteMutation.isPending || contexto.trim().length === 0}>
              {bilheteMutation.isPending ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Montando bilhete...
                </>
              ) : (
                <>
                  <Ticket className="h-4 w-4" /> Montar bilhete
                </>
              )}
            </Button>
          </form>
        </section>

        {bilhete ? (
          <BilheteCard
            bilhete={bilhete}
            salvando={salvarBilheteMutation.isPending}
            onSalvar={() => salvarBilheteMutation.mutate(bilhete)}
          />
        ) : null}


        <div className="mt-6 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground"
                  : "mr-auto max-w-[95%] rounded-2xl border border-border/60 bg-card px-4 py-3"
              }
            >
              <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide opacity-70">
                {message.role === "user" ? (
                  <>
                    <User className="h-3 w-3" /> Você
                  </>
                ) : (
                  <>
                    <Bot className="h-3 w-3" /> Robô
                  </>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

              {message.palpites && message.palpites.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {message.palpites.map((tip, tipIndex) => (
                    <li
                      key={tipIndex}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{tip.jogo}</p>
                        <p className="text-sm text-primary">{tip.mercado}</p>
                        <p className="text-xs text-muted-foreground">{tip.justificativa}</p>
                      </div>
                      <Badge variant="secondary">{Math.round(tip.confianca)}%</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saveMutation.isPending}
                        onClick={() => saveMutation.mutate(tip)}
                      >
                        Salvar
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}

          {askMutation.isPending ? (
            <div className="mr-auto flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" /> O robô está analisando...
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {sugestoes.map((s) => (
            <Button key={s} variant="ghost" size="sm" onClick={() => send(s)}>
              <Sparkles className="h-3.5 w-3.5" /> {s}
            </Button>
          ))}
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ex.: palpites de escanteios para Real Madrid x Barcelona"
          />
          <Button type="submit" disabled={askMutation.isPending || input.trim().length === 0}>
            <Send className="h-4 w-4" /> Enviar
          </Button>
        </form>
      </main>
    </div>
  );
}
