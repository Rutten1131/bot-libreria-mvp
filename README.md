# Asistente de WhatsApp para La Reforma — Su Empresa Amiga (MVP)

Next.js + TypeScript + MySQL + Evolution API + Gemini + Inngest. Incluye el bot con catálogo completo, el CRM con gestión de inventario y un simulador de chat.

## Cómo funciona

```
WhatsApp -> Evolution -> POST /api/webhook  (valida, deduplica, guarda, encola, responde 200)
                                  |
                          Inngest (espera 3 s tras el último mensaje, 1 a la vez por chat)
                                  |
                          lib/bot.ts: contexto (datos + estado + resumen + últimos 14 msgs)
                                  -> Gemini con herramientas que leen la DB
                                  -> validación anti-alucinación -> respuesta por Evolution
                                  -> si hace falta: escalar a humano con resumen
CRM (/crm): ver chats, tomar el chat, devolverlo al asistente, ver cómo respondió el bot.
```

La memoria vive en la base de datos, no en el modelo: mensajes, datos del cliente en campos, estado, resumen rodante y trazas de cada respuesta.

## Puesta en marcha

1. `npm install`
2. Copia `.env.example` a `.env.local` y completa los datos. Usa credenciales nuevas (las que se pegaron en un chat ya no son seguras).
3. `npm run migrate` crea las tablas `bot_*` y carga los datos demo. Debe imprimir el conteo al final.
4. **Local:** en una terminal `npm run dev`; en otra `npm run inngest` (con `INNGEST_DEV=1` en `.env.local`). Abre http://localhost:3000/crm y pulsa "Probar con un cliente de prueba".
5. **Producción (Vercel):**
   - Sube el proyecto y carga las mismas variables en Vercel.
   - En Inngest Cloud crea una app, copia `INNGEST_EVENT_KEY` e `INNGEST_SIGNING_KEY` a Vercel y sincroniza la app con `https://TU-APP.vercel.app/api/inngest`.
   - Con `APP_URL` y `WEBHOOK_SECRET` definidos, corre `npm run webhook` para registrar el webhook en Evolution (evento MESSAGES_UPSERT).
   - Define `CRM_PASSWORD` para que el CRM pida clave.

## Decisiones clave

- El código manda, el modelo habla: estado, escalado y límites los decide el código.
- Precios, horarios y promos salen de la DB por herramientas; si una cifra u hora no vino de una herramienta ese turno, la respuesta se bloquea y se pasa a un asesor.
- Escalado automático por palabras clave (asesor, reclamo, devolución...), por dos búsquedas fallidas seguidas o por respuesta no verificable.
- Fuera de horario, el bot avisa el horario de asesores (configurable en la tabla `bot_config`).
- Audios e imágenes: responde que por ahora solo lee texto.

## Notas

- Datos de sucursales tomados de directorios públicos; promociones, productos y precios son inventados para la demo.
- Evolution con Baileys no es la API oficial de WhatsApp. Para producción real, migrar a la Cloud API oficial.
- Si tu Evolution es v1, el cuerpo de `sendText` cambia a `{ number, textMessage: { text } }` (ver `lib/evolution.ts`).
- El modelo se cambia con `GEMINI_MODEL`.
