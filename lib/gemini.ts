const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type Content = { role: "user" | "model"; parts: any[] };

export async function generar(body: Record<string, any>) {
  let lastError: any;

  // ── Helper: Normalizar Schema para OpenAI / DeepSeek ──────────────────────
  function normSchema(s: any): any {
    if (!s || typeof s !== "object") return s;
    const out: any = {};
    if (s.type) out.type = String(s.type).toLowerCase();
    if (s.description) out.description = s.description;
    if (s.enum) out.enum = s.enum;
    if (s.properties) {
      out.properties = {};
      for (const [k, v] of Object.entries(s.properties)) out.properties[k] = normSchema(v);
    }
    if (s.required) out.required = s.required;
    if (s.items) out.items = normSchema(s.items);
    return out;
  }

  // ── Helper: Convertir contenido Gemini → formato Chat Completions ──────────
  function convertirMensajes(bodyData: any) {
    const messages: any[] = [];
    if (bodyData.systemInstruction?.parts?.[0]?.text) {
      messages.push({ role: "system", content: bodyData.systemInstruction.parts[0].text });
    }
    for (const c of bodyData.contents || []) {
      const isModel = c.role === "model" || c.role === "assistant";
      const isUser = c.role === "user";
      if (isModel) {
        const textParts = (c.parts ?? []).filter((p: any) => typeof p.text === "string" && !p.thought);
        const callParts = (c.parts ?? []).filter((p: any) => p.functionCall);
        if (callParts.length > 0) {
          messages.push({
            role: "assistant",
            content: null,
            tool_calls: callParts.map((p: any, i: number) => ({
              id: `call_${i}_${p.functionCall.name}`,
              type: "function",
              function: {
                name: p.functionCall.name,
                arguments: JSON.stringify(p.functionCall.args ?? {}),
              },
            })),
          });
        } else if (textParts.length > 0) {
          messages.push({ role: "assistant", content: textParts.map((p: any) => p.text).join("") });
        }
      } else if (isUser) {
        const textParts = (c.parts ?? []).filter((p: any) => typeof p.text === "string");
        const resParts = (c.parts ?? []).filter((p: any) => p.functionResponse);
        if (resParts.length > 0) {
          for (let i = 0; i < resParts.length; i++) {
            const fr = resParts[i].functionResponse;
            messages.push({
              role: "tool",
              tool_call_id: `call_${i}_${fr.name}`,
              content: JSON.stringify(fr.response?.result ?? fr.response ?? {}),
            });
          }
        } else if (textParts.length > 0) {
          messages.push({ role: "user", content: textParts.map((p: any) => p.text).join("") });
        }
      }
    }
    return messages;
  }

  const openAITools = (body.tools?.[0]?.functionDeclarations ?? []).map((fd: any) => ({
    type: "function",
    function: {
      name: fd.name,
      description: fd.description,
      parameters: normSchema(fd.parameters) ?? { type: "object", properties: {} },
    },
  }));

  // 1) ⚡ PRIORIDAD #1: DEEPSEEK DIRECTO (Ultra rápido, inteligente y económico)
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 18_000);
    try {
      const dsBody: any = {
        model: "deepseek-chat",
        messages: convertirMensajes(body),
        temperature: body.generationConfig?.temperature ?? 0.2,
        max_tokens: Math.min(body.generationConfig?.maxOutputTokens ?? 1500, 1500),
      };
      if (openAITools.length > 0) dsBody.tools = openAITools;

      const dsRes = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${deepseekKey}`,
        },
        body: JSON.stringify(dsBody),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      if (dsRes.ok) {
        const data = await dsRes.json();
        const msg = data.choices?.[0]?.message;
        if (msg?.tool_calls?.length) {
          return {
            candidates: [
              {
                content: {
                  role: "model",
                  parts: msg.tool_calls.map((tc: any) => ({
                    functionCall: {
                      name: tc.function.name,
                      args: (() => {
                        try { return JSON.parse(tc.function.arguments || "{}"); }
                        catch { return {}; }
                      })(),
                    },
                  })),
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: { totalTokenCount: data.usage?.total_tokens ?? 0 },
          };
        }
        // Si DeepSeek incluyó tool calls formateados en content (ej. DSML o etiquetas especiales)
        if (!msg?.tool_calls?.length && msg?.content && msg.content.includes("invoke name=")) {
          const regex = /<[|｜]{2}DSML[|｜]{2} invoke name="([^"]+)">([\s\S]*?)<\/[|｜]{2}DSML[|｜]{2} invoke>/g;
          const paramRegex = /<[|｜]{2}DSML[|｜]{2} parameter name="([^"]+)"[^>]*>([\s\S]*?)<\/[|｜]{2}DSML[|｜]{2} parameter>/g;
          const parsedCalls: any[] = [];
          let match;
          while ((match = regex.exec(msg.content)) !== null) {
            const funcName = match[1];
            const paramBlock = match[2];
            const args: Record<string, any> = {};
            let pMatch;
            while ((pMatch = paramRegex.exec(paramBlock)) !== null) {
              const pName = pMatch[1];
              let pVal: any = pMatch[2].trim();
              try { pVal = JSON.parse(pVal); } catch {}
              args[pName] = pVal;
            }
            parsedCalls.push({
              functionCall: { name: funcName, args },
            });
          }
          if (parsedCalls.length > 0) {
            return {
              candidates: [
                {
                  content: { role: "model", parts: parsedCalls },
                  finishReason: "STOP",
                },
              ],
              usageMetadata: { totalTokenCount: data.usage?.total_tokens ?? 0 },
            };
          }
        }

        // Si el contenido traía etiquetas DSML pero sin texto útil, limpiarlas
        let cleanText = msg?.content || "";
        cleanText = cleanText.replace(/<[|｜]{2}DSML[|｜]{2}[\s\S]*?<\/[|｜]{2}DSML[|｜]{2} calls>/g, "").trim();

        return {
          candidates: [
            {
              content: { parts: [{ text: cleanText }], role: "model" },
              finishReason: "STOP",
            },
          ],
          usageMetadata: { totalTokenCount: data.usage?.total_tokens ?? 0 },
        };
      }
      const errText = await dsRes.text();
      lastError = new Error(`DeepSeek ${dsRes.status}: ${errText}`);
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
    }
  }

  // 2) FALLBACK #2: GOOGLE GEMINI
  const geminiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_BACKUP,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6,
  ].filter(Boolean) as string[];

  const models = [
    process.env.GEMINI_MODEL || "gemini-flash-latest",
    "gemini-flash-latest",
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-flash-lite-latest",
  ];

  for (const apiKey of [...new Set(geminiKeys)]) {
    for (const model of [...new Set(models)]) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000); // 12s timeout por intento
      try {
        const r = await fetch(`${BASE}/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (r.ok) return await r.json();
        const errText = await r.text();
        lastError = new Error(`Gemini ${model} ${r.status}: ${errText}`);
        if (r.status === 429) break;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;
      }
    }
  }

  // 3) FALLBACK #3: OPENROUTER
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw lastError;

  try {
    const messages = convertirMensajes(body);
    const orBody: any = {
      model: "google/gemini-2.5-flash",
      messages,
      temperature: body.generationConfig?.temperature ?? 0.2,
      max_tokens: Math.min(body.generationConfig?.maxOutputTokens ?? 600, 600),
    };
    if (openAITools.length > 0) orBody.tools = openAITools;

    const orCtrl = new AbortController();
    const orTimer = setTimeout(() => orCtrl.abort(), 12_000);
    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openRouterKey}`,
        "HTTP-Referer": process.env.APP_URL || "https://santiago-papeleria.vercel.app",
        "X-Title": "La Reforma Bot MVP",
      },
      body: JSON.stringify(orBody),
      signal: orCtrl.signal,
    });
    clearTimeout(orTimer);

    if (orRes.ok) {
      const data = await orRes.json();
      const msg = data.choices?.[0]?.message;
      if (msg?.tool_calls?.length) {
        return {
          candidates: [
            {
              content: {
                role: "model",
                parts: msg.tool_calls.map((tc: any) => ({
                  functionCall: {
                    name: tc.function.name,
                    args: (() => {
                      try { return JSON.parse(tc.function.arguments || "{}"); }
                      catch { return {}; }
                    })(),
                  },
                })),
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: { totalTokenCount: data.usage?.total_tokens ?? 0 },
        };
      }
      return {
        candidates: [
          {
            content: { parts: [{ text: msg?.content || "" }], role: "model" },
            finishReason: "STOP",
          },
        ],
        usageMetadata: { totalTokenCount: data.usage?.total_tokens ?? 0 },
      };
    }
    const errText = await orRes.text();
    throw new Error(`OpenRouter ${orRes.status}: ${errText}`);
  } catch (err) {
    lastError = err;
  }

  throw lastError;
}

export function textoDe(res: any): string {
  const parts: any[] = res?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();
}
