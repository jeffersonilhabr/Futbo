import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type RoboTip = {
  jogo: string;
  mercado: string;
  confianca: number;
  justificativa: string;
};

export type RoboAnswer = {
  resposta: string;
  palpites: RoboTip[];
};

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

export const askRoboFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        messages: z.array(messageSchema).min(1).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<RoboAnswer> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      throw new Error("A IA não está configurada no projeto.");
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é o Robô Palpiteiro, um analista de apostas esportivas de futebol. " +
              "Responda sempre em português do Brasil, de forma direta e objetiva. " +
              "Quando o usuário pedir palpites, sugira de 1 a 4 entradas em mercados como " +
              "Over/Under gols, escanteios, cartões, dupla chance, ambas marcam ou resultado. " +
              "Baseie-se em contexto de forma recente, mando de campo e estilo das equipes citadas. " +
              "Sempre inclua uma confiança de 0 a 100 e uma justificativa curta. " +
              "Deixe claro que são estimativas e que apostas envolvem risco. " +
              "Se a conversa não pedir palpites, deixe 'palpites' como lista vazia.",
          },
          ...data.messages,
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "palpites_do_robo",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                resposta: { type: "string" },
                palpites: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      jogo: { type: "string" },
                      mercado: { type: "string" },
                      confianca: { type: "number" },
                      justificativa: { type: "string" },
                    },
                    required: ["jogo", "mercado", "confianca", "justificativa"],
                  },
                },
              },
              required: ["resposta", "palpites"],
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) {
        throw new Error("O robô recebeu muitos pedidos agora. Tente de novo em instantes.");
      }
      if (res.status === 402) {
        throw new Error("Os créditos de IA do projeto acabaram. Adicione créditos para continuar.");
      }
      throw new Error(`Falha ao consultar o robô (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";

    try {
      const parsed = JSON.parse(content) as RoboAnswer;
      const palpites = (Array.isArray(parsed.palpites) ? parsed.palpites : []).map((tip) => ({
        ...tip,
        // o modelo às vezes devolve 0-1, às vezes 0-100
        confianca: Math.max(0, Math.min(100, tip.confianca <= 1 ? tip.confianca * 100 : tip.confianca)),
      }));
      return { resposta: parsed.resposta ?? "", palpites };
    } catch {
      return { resposta: content || "O robô não conseguiu responder agora.", palpites: [] };
    }
  });
