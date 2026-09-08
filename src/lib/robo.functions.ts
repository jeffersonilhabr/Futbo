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

export type BilheteEntrada = {
  jogo: string;
  mercado: string;
  probabilidade: number;
  oddEstimada: number;
  justificativa: string;
};

export type Bilhete = {
  titulo: string;
  entradas: BilheteEntrada[];
  oddTotal: number;
  probabilidadeTotal: number;
  risco: "baixo" | "medio" | "alto";
  resumo: string;
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

export const montarBilheteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        contexto: z.string().trim().min(1).max(600),
        entradas: z.number().int().min(2).max(8).default(3),
        risco: z.enum(["baixo", "medio", "alto"]).default("medio"),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Bilhete> => {
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
              "Você é o Robô Palpiteiro e monta bilhetes (múltiplas) de apostas de futebol. " +
              "Responda sempre em português do Brasil. " +
              "Monte exatamente o número de entradas pedido, escolhendo os mercados MAIS PROVÁVEIS " +
              "(gols over/under, escanteios, cartões, dupla chance, ambas marcam, resultado). " +
              "Para cada entrada informe probabilidade estimada (0-100) e odd estimada coerente " +
              "(odd ≈ 100/probabilidade). Perfil de risco baixo = probabilidades acima de 75%; " +
              "médio = 60-80%; alto = mercados de maior retorno. " +
              "oddTotal é a multiplicação das odds e probabilidadeTotal a multiplicação das probabilidades. " +
              "No resumo, diga que são estimativas e que apostas envolvem risco.",
          },
          {
            role: "user",
            content: `Monte um bilhete com ${data.entradas} entradas, perfil de risco ${data.risco}. Contexto: ${data.contexto}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "bilhete_do_robo",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                titulo: { type: "string" },
                resumo: { type: "string" },
                risco: { type: "string", enum: ["baixo", "medio", "alto"] },
                oddTotal: { type: "number" },
                probabilidadeTotal: { type: "number" },
                entradas: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      jogo: { type: "string" },
                      mercado: { type: "string" },
                      probabilidade: { type: "number" },
                      oddEstimada: { type: "number" },
                      justificativa: { type: "string" },
                    },
                    required: ["jogo", "mercado", "probabilidade", "oddEstimada", "justificativa"],
                  },
                },
              },
              required: ["titulo", "resumo", "risco", "oddTotal", "probabilidadeTotal", "entradas"],
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
      throw new Error(`Falha ao montar o bilhete (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";

    let parsed: Bilhete;
    try {
      parsed = JSON.parse(content) as Bilhete;
    } catch {
      throw new Error("O robô não conseguiu montar o bilhete agora. Tente novamente.");
    }

    const entradas = (Array.isArray(parsed.entradas) ? parsed.entradas : []).map((e) => {
      const probabilidade = Math.max(
        1,
        Math.min(99, e.probabilidade <= 1 ? e.probabilidade * 100 : e.probabilidade),
      );
      const oddEstimada =
        Number.isFinite(e.oddEstimada) && e.oddEstimada > 1
          ? Number(e.oddEstimada.toFixed(2))
          : Number((100 / probabilidade).toFixed(2));
      return { ...e, probabilidade: Math.round(probabilidade), oddEstimada };
    });

    const oddTotal = Number(entradas.reduce((acc, e) => acc * e.oddEstimada, 1).toFixed(2));
    const probabilidadeTotal = Number(
      (entradas.reduce((acc, e) => acc * (e.probabilidade / 100), 1) * 100).toFixed(1),
    );

    return {
      titulo: parsed.titulo || "Bilhete do robô",
      resumo: parsed.resumo || "",
      risco: parsed.risco ?? data.risco,
      entradas,
      oddTotal,
      probabilidadeTotal,
    };
  });
