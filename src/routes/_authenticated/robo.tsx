import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bot, LoaderCircle, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";

import { askRoboFn, type RoboTip } from "@/lib/robo.functions";
import { createPalpiteFn } from "@/lib/palpites.functions";
import { SiteHeader } from "@/components/site-header";
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

function RoboPage() {
  const ask = useServerFn(askRoboFn);
  const createPalpite = useServerFn(createPalpiteFn);
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

  function send(question: string) {
    const text = question.trim();
    if (!text || askMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    askMutation.mutate(text);
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="flex items-center gap-2 font-display text-4xl">
          <Bot className="h-8 w-8 text-primary" /> Pedir palpites ao robô
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Peça sugestões de entradas e salve as que gostar no seu histórico. Estimativas — aposte com responsabilidade.
        </p>

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
