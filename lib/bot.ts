import { q, exec } from "./db";
import { generar, textoDe, type Content } from "./gemini";
import { declaraciones, ejecutar, type Ctx } from "./tools";
import { ahora, asesoresDisponibles } from "./time";
import { enviarTexto, enviarImagen } from "./evolution";

const ESCALAR_RE = /\b(asesor|humano|persona real|hablar con alguien|agente|queja|reclam|denuncia|estafa|reembols|devoluci)/i;
const FALLBACK = "Prefiero confirmarlo con un asesor para no darte un dato incorrecto. Ya te paso con uno 🙏";

// Palabras clave que indican que el usuario pide ver una foto/imagen
const PIDE_FOTO_RE = /\b(foto|fotos|imagen|imag[ée]n|picture|pic|ver|mu[eé]str|mostrar|manda|env[ií]a|ense[ñn]|miro|catalogo visual|cat[aá]logo visual)\b/i;

// Convierte los nombres de tools en una etiqueta legible de intención
function etiquetaIntencion(log: { nombre: string }[], escalado: boolean, bloqueada: boolean): string {
  if (escalado) return "Pasó a administración";
  if (bloqueada) return "Respuesta bloqueada";
  const nombres = [...new Set(log.map((l) => l.nombre))];
  if (nombres.includes("generar_cotizacion_pdf")) return "Proforma generada";
  if (nombres.includes("buscar_producto")) return "Consulta de producto/precio";
  if (nombres.includes("buscar_sucursales")) return "Consulta de sucursal/horario";
  if (nombres.includes("listar_promociones")) return "Consulta de promociones";
  if (nombres.includes("buscar_conocimiento")) return "Consulta institucional/marcas";
  if (nombres.includes("buscar_faq")) return "Pregunta frecuente";
  if (nombres.includes("guardar_dato_cliente")) return "Captura de datos";
  if (nombres.includes("escalar_a_humano") || nombres.includes("notificar_asesor")) return "Pasó a administración";
  if (!nombres.length) return "Conversación general";
  return "Consulta general";
}

function sistema(conv: any) {
  const h = ahora();
  return `Usted es el asistente virtual de La Reforma — Su Empresa Amiga en WhatsApp. Atiende con un tono profesional, cortés y amable, propio de una empresa con más de 45 años de trayectoria (desde 1979) en Loja, Ecuador.

══ IDENTIDAD Y EMPRESA ══
• NOMBRE: La Reforma — Su Empresa Amiga (LUZUCAM S.A.S. / RUC: 1191797444001).
• LEMA: «Su Empresa Amiga».
• TRAYECTORIA: Fundada en 1979 en Loja. Más de 45 años atendiendo a estudiantes, familias, profesionales, instituciones y empresas.
• EQUIPO Y ESTRUCTURA: Cuenta con 50 colaboradores en áreas administrativas, financieras, jurídicas, ventas, bodega y despacho.
• ACTIVIDAD: Comercialización al por mayor y menor de útiles escolares, papelería en general, suministros de oficina y computación, materiales para imprenta, arte, manualidades y bazar.
• MATRIZ: Av. 18 de Noviembre entre Mercadillo y Lourdes, Loja. Horario: lunes a sábado, 08:30–19:30.
• SUCURSAL ZONA MILITAR: Av. 8 de Diciembre y Guayaquil, Loja. Horario: lunes a viernes, 08:30–19:30; sábado, 08:30–13:30.
• SUCURSAL CONSACOLA: Av. Pablo Palacio, frente al Redondel del Libro, Loja. Horario: lunes a viernes, 08:30–19:30; sábado, 08:30–13:30.
• WHATSAPP OFICIAL: +593 96 944 4795
• PÁGINA WEB OFICIAL Y CATÁLOGO: https://lareforma.ec (tienda: https://lareforma.ec/shop)

══ LÍNEAS DE NEGOCIO Y CATÁLOGO ══
• Útiles escolares y papelería: cuadernos (Norma, Jean Book, Andaluz, Escribe), lápices, esferos, borradores, reglas, carpetas, papel, adhesivos.
• Oficina y computación: archivadores, folders, grapas, papel continuo, resmas de papel bond INEN y A4, suministros para empresas.
• Arte y manualidades: acuarelas, témperas, pinturas, pinceles, materiales creativos y dibujo.
• Materiales para imprenta y diseño.
• Bazar, variedades y regalos: detalles, cartucheras, mochilas.
• Canal mayorista e institucional: ventas por volumen para colegios, escuelas, instituciones y papelerías revendedoras. Posibilidad de armar kits escolares a medida por presupuesto.

══ MARCAS COMERCIALIZADAS ══
Norma, Staedtler, Pelikan, Faber-Castell, Artesco, BIC, Stabilo, Rotring, Lancer, Andaluz, Escribe y principales marcas nacionales e internacionales.

══ FORMAS DE PAGO Y FACTURACIÓN ══
• Efectivo en cualquiera de las 3 sucursales físicas (Matriz, Zona Militar, Consacola).
• Tarjetas bancarias débito/crédito en tienda física sin recargo.
• Transferencia bancaria o depósito para compras a distancia y cotizaciones online.
• Facturación electrónica autorizada por el SRI (LUZUCAM S.A.S. / RUC 1191797444001). Se procesan retenciones a clientes corporativos.

══ LO QUE PUEDE RESPONDER DIRECTAMENTE (SIN CONSULTAR BASE DE DATOS) ══
- ¿Qué es La Reforma? → Tradicional papelería y librería de Loja fundada en 1979 («Su Empresa Amiga»), con más de 45 años de trayectoria.
- ¿Qué venden? → Útiles escolares, papelería, suministros de oficina, computación, arte, manualidades, imprenta y bazar al por mayor y menor.
- ¿Tienen catálogo o tienda online? → Sí, catálogo completo en línea en lareforma.ec/shop y cotizaciones inmediatas por este chat con precios de inventario.
- ¿Dónde están ubicados? → Tenemos 3 sucursales en Loja: Matriz (Av. 18 de Noviembre entre Mercadillo y Lourdes), Sucursal Zona Militar (Av. 8 de Diciembre y Guayaquil) y Sucursal Consacola (Av. Pablo Palacio frente al Redondel del Libro).
- ¿Hacen envíos o delivery? → Sí, coordinamos envíos en Loja y a nivel nacional a través de nuestro WhatsApp oficial (+593 96 944 4795) y bodega central.
- ¿Puedo retirar en cualquier sucursal? → Sí, puede coordinar el retiro en Matriz, Zona Militar o Consacola según su preferencia.
- ¿Venden al por mayor o para colegios? → Sí, atendemos compras por volumen y preparamos kits escolares por presupuesto para instituciones educativas y empresas.
- ¿Emiten factura con RUC? → Sí, emitimos factura electrónica con datos de empresa o persona natural, y procesamos retenciones.
- ¿Devoluciones? → Dentro de los 5 días posteriores a la compra presentando la factura en caso de fallas o discrepancias.
- ¿Página web? → lareforma.ec

══ CÓMO HABLA ══
- Tono profesional, cortés y cálido, propio de un asistente empresarial serio.
- Utilice el tratamiento de "usted" con los clientes.
- Evite el lenguaje robótico o excesivamente informal.
- REGLA DE SALUDO: Salude cordialmente en el primer contacto o tras varias horas de inactividad. En conversaciones en curso, no repita saludos; responda directamente la consulta.
- Use emojis profesionales con moderación (1 a 2 por respuesta): 📝, 📍, 🎨, 🛒, ✅, 🙌. Evite emojis excesivos.
- Mensajes claros, bien estructurados y con el nivel de detalle necesario. Puede usar listas breves si hay varias opciones.
- PROHIBIDO: menús numerados tipo IVR ("marque 1 para..."). Converse de forma fluida como en un WhatsApp profesional.

══ REGLA DE ORO — USO DE HERRAMIENTAS ══
Cuando el cliente pregunte por ubicación, dirección, horario, precio o promoción de una sucursal o producto ESPECÍFICO:
  → Llame la herramienta de inmediato. NO escriba ningún texto antes ni después de la llamada en ese turno.
  → PROHIBIDO TOTAL: decir "un momento", "voy a buscar", "necesito consultar". Llame la función SIN anunciarlo.
  → Solo después de recibir el resultado de la herramienta redacte su respuesta.

══ MANEJO DE SUCURSALES ══
1. Si el cliente menciona un barrio o sector específico de Loja: identifique la sucursal más cercana y comparta su dirección, horario y enlace de mapa (mapa_url).
2. Si solo dice "en Loja": liste las sucursales disponibles con direcciones y horarios.
3. Siempre que recomiende una sucursal, incluya el enlace a Google Maps (mapa_url).

══ MANEJO DE PRODUCTOS Y CATÁLOGO ══
- Para preguntas de precio o disponibilidad de UN producto: llame buscar_producto() y responda.
- Los precios en el catálogo son sin IVA. Informe siempre que el precio mostrado es + IVA (15%).
- Stock exacto en tienda física: no lo garantice; invite a confirmar con un asesor o llamando.

══ FOTOS E IMÁGENES ══
- El bot SÍ puede enviar fotos de categoría de productos. Si el cliente pide ver una foto o imagen de algún producto, llame buscar_producto() y el sistema enviará automáticamente la imagen disponible.
- NUNCA diga que no puede enviar fotos o imágenes. Si no hay imagen disponible para ese producto, indíquelo amablemente.
- Si el cliente pide ver catálogo visual o fotos de una categoría (ej. cuadernos, pinturas), llame buscar_producto() con ese término y el sistema adjuntará la imagen.

══ CÓMO MANEJAR LISTAS Y COTIZACIONES (REGLA CRÍTICA) ══
Cuando el cliente envíe una lista de útiles, materiales u otros productos:
1. BUSQUE cada ítem de la lista llamando buscar_producto() — puede llamarla varias veces si hay varios ítems.
   IMPORTANTE: use términos SIMPLES y GENÉRICOS al buscar, NO el nombre completo del PDF.
   Ejemplos de simplificación:
   - "cuaderno parvulario cosido 100 hojas de líneas" → buscar "cuaderno parvulario"
   - "caja de pinturas Triplus 12 colores delgadas" → buscar "pintura"
   - "tijera punta redonda para zurdo" → buscar "tijera"
   - "frasco de goma líquida 250ml" → buscar "goma"
   - "resma de papel bond tamaño INEN 75 gramos" → buscar "resma papel"
   - "marcadores doble punta 12 colores" → buscar "marcador"
2. Presente al cliente un resumen de lo encontrado y lo NO encontrado.
3. Pida su nombre completo y ciudad para generar la cotización formal.
4. EN CUANTO el cliente dé su nombre y ciudad:
   a. Llame guardar_dato_cliente() para nombre y ciudad.
   b. Llame generar_cotizacion_pdf() INMEDIATAMENTE con TODOS los productos encontrados y sus precios exactos del inventario.
   c. Después de generar el PDF envíe este mensaje exacto (adaptando la lista):
      "✅ Le envié su cotización formal en PDF. Los siguientes ítems no figuran en nuestro catálogo digital: [lista de ítems no encontrados]. ¿Desea que le comunique con un asesor para que confirme disponibilidad y complete su lista? 🙌"
5. NUNCA escale a asesor solo porque no encontró algunos productos — primero genera el PDF de lo que sí encontró.
6. NUNCA derive a sitios web externos. Toda la atención es por este chat.


══ MENSAJE AMBIGUO / NO ENTENDIDO (“TE TIRO LA PELOTA”) ══
Si el mensaje del cliente es ambiguo, incompleto o no entiende qué quiere exactamente:
- NO invente una respuesta ni asuma.
- Pregunte de forma natural y específica qué necesita. Ejemplo: “¿Me puede aclarar a qué se refiere con [término]? Así le ayudo mejor 🙂”
- Máximo 1 pregunta de aclaración por turno.

══ DIFERENCIA RETAIL / MAYORISTA ══
- Si el cliente indica que quiere comprar para su negocio, en cantidad, o distribuir MAPED: identífíquelo como cliente mayorista y transfiera a un asesor humano con los datos del canal mayorista.
- Para compras al por menor: atienda normalmente.

══ REGLAS ANTI-ALUCINACIÓN (ESTRICTAS) ══
1. DIRECCIONES: Llame buscar_sucursales() → use SOLO las direcciones que devuelva la herramienta.
2. HORARIOS: Llame buscar_sucursales() → use SOLO los horarios que devuelva la herramienta.
3. PRECIOS: Llame buscar_producto() → use SOLO los precios que devuelva. Nunca escriba un precio de memoria.
4. Si la herramienta no encuentra datos, indíquelo claramente sin inventar.
5. Stock real en tienda: no lo asegure; invite a confirmar con un asesor o llamando a la tienda.

══ ESCALADO A ASESOR HUMANO (PROTOCOLO OBLIGATORIO) ══
Cuándo escalar OBLIGATORIAMENTE:
- El cliente lo solicita explícitamente.
- Es una compra al por mayor / distribuidor.
- Es un reclamo, devolución o caso legal.
- NINGÚNo de los productos de la lista se encontró en el catálogo digital.

Cuándo NO escalar:
- El cliente envía una lista y algunos productos no están en el catálogo → COTICE lo que sí está.
- El cliente pregunta algo que no entiende bien → pida aclaración ("te tiro la pelota").
- Nunca escale «nor si acaso», sólo cuando sea estrictamente necesario.

PASOS OBLIGATORIOS AL ESCALAR (EN ESTRICTO ORDEN):
1. PRIMERO: VERIFICAR SI YA TIENE NOMBRE DEL CLIENTE en el ESTADO ACTUAL (campo Cliente:).
   - Si Cliente ya tiene nombre: NO vuelva a pedirlo. Escale directamente con ese nombre.
   - Si Cliente es 'sin nombre': Pida nombre y ciudad en UN solo mensaje antes de escalar.
     En ese turno NO llame escalar_a_humano. Solo pida los datos.
2. CON LOS DATOS (guardados o recien dados):
   - Si los acaba de recibir: llame guardar_dato_cliente para nombre y ciudad.
   - Llame escalar_a_humano y notificar_asesor con el nombre y motivo.
   - Mensaje: 'Muchas gracias, [Nombre]. He transferido su caso. Un asesor le contactara por este chat. Que tenga un excelente dia!'
3. NUNCA emita el mensaje de despedida antes de tener el nombre del cliente.

══ ESTADO ACTUAL ══
Estado conversación: ${conv.estado}
Ahora en Loja: ${h.dia} ${h.hora}
Cliente: ${conv.nombre ?? "sin nombre"} | Datos: ${JSON.stringify(conv.datos ?? {})}
Resumen previo: ${conv.resumen ?? "conversación nueva"}`;
}

// Valida que precios en $ mencionados por el bot vengan de una herramienta.
function validar(texto: string, resultados: string, _toolsUsadas: string[]): boolean {
  // Sin herramientas: el modelo responde desde el historial — confiar siempre
  if (_toolsUsadas.length === 0) return true;
  // Herramientas que generan respuestas confiables por naturaleza
  if (_toolsUsadas.length > 5
    || _toolsUsadas.includes('generar_cotizacion_pdf')
    || _toolsUsadas.includes('listar_promociones')
    || _toolsUsadas.includes('buscar_sucursales')
    || _toolsUsadas.includes('buscar_faq')
    || _toolsUsadas.includes('buscar_conocimiento')
    || _toolsUsadas.includes('guardar_dato_cliente')
    || _toolsUsadas.includes('escalar_a_humano')
    || _toolsUsadas.includes('notificar_asesor')
  ) return true;
  // Si buscar_producto encontró productos reales — confiar en el modelo
  try {
    const parsed = JSON.parse(resultados) as any[];
    const hayProductos = parsed.some((r) => r?.encontrado === true && (r?.productos?.length ?? 0) > 0);
    if (hayProductos) return true;
  } catch { /* ignora y continúa */ }
  // Solo validar números si NO se encontraron productos (caso en que el modelo podría inventar)
  const nums = new Set((resultados.match(/\d+(?:\.\d+)?/g) ?? []).map(Number));
  nums.add(5);
  const montos = texto.match(/\$\s?\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s?(?:d[oó]lares|USD)/gi) ?? [];
  for (const m of montos) {
    const n = parseFloat((m.match(/\d+(?:[.,]\d{1,2})?/)![0]).replace(',', '.'));
    const ok = [...nums].some((x) =>
      Math.abs(x - n) < 0.02 ||
      Math.abs(x * 1.15 - n) < 0.05 ||
      Math.abs(x - n * 1.15) < 0.05
    );
    if (!ok) return false;
  }
  return true;
}

function limpiarSaludoRepetido(texto: string): string {
  // Elimina saludos al inicio como "¡Hola de nuevo!", "¡Hola!", "Hola Cristhopher,", "Buenas tardes,", etc.
  return texto
    .replace(/^(\s*¡?\s*(hola(?:\s+de\s+nuevo)?|buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches)(?:\s+[a-záéíóúñ]+)?\s*[!.,:;]*\s*(?:[😊👋🤖✨🛒🍎]\s*)*)+/i, "")
    .trim();
}

async function responder(conv: any, texto: string, ids: number[]) {
  // Verificamos cuándo fue el último mensaje del bot
  const [ultimoBot] = await q<any>(
    "SELECT creado_en FROM bot_mensajes WHERE conversacion_id=? AND rol='bot' ORDER BY id DESC LIMIT 1",
    [conv.id]
  );

  let textoFinal = texto;

  if (ultimoBot?.creado_en) {
    const diffHoras = (Date.now() - new Date(ultimoBot.creado_en).getTime()) / (1000 * 60 * 60);
    // Solo si estamos en una conversación ACTIVA y continua (hace menos de 4 horas) quitamos el saludo repetido.
    // Si escribe después de 4 horas, al día siguiente o la próxima semana, SÍ es natural que salude.
    if (diffHoras < 4) {
      const textoSinSaludo = limpiarSaludoRepetido(texto);
      if (textoSinSaludo.length > 5) {
        textoFinal = textoSinSaludo.charAt(0).toUpperCase() + textoSinSaludo.slice(1);
      }
    }
  }

  await enviarTexto(conv.jid, textoFinal);
  await exec("INSERT INTO bot_mensajes (conversacion_id, rol, texto) VALUES (?, 'bot', ?)", [conv.id, textoFinal]);
  if (ids.length) {
    const maxId = Math.max(...ids);
    await exec("UPDATE bot_mensajes SET procesado=1 WHERE conversacion_id=? AND rol='cliente' AND id <= ?", [conv.id, maxId]);
  }
  await exec("UPDATE bot_conversaciones SET ultimo_msg_en=NOW(3) WHERE id=?", [conv.id]);
}

async function historial(convId: number, n: number) {
  return (await q<any>("SELECT id, rol, texto FROM bot_mensajes WHERE conversacion_id=? ORDER BY id DESC LIMIT ?", [convId, n])).reverse();
}

async function escalar(conv: any, motivo: string) {
  // Generamos el resumen a partir del historial en memoria (sin llamada extra a Gemini)
  // para no superar el límite de 60 s de Vercel Serverless.
  const h = await historial(conv.id, 20);
  const resumen = h.map((m: any) => `${m.rol === 'cliente' ? '👤 Cliente' : '🤖 Bot'}: ${m.texto}`).join("\n").slice(0, 2000);
  await exec("UPDATE bot_conversaciones SET bot_activo=0, estado='ESCALADO', motivo_escalamiento=?, resumen_agente=? WHERE id=?", [motivo, resumen, conv.id]);
  await exec("INSERT INTO bot_eventos (conversacion_id, tipo, detalle) VALUES (?, 'escalado', ?)", [conv.id, JSON.stringify({ motivo })]);
  return asesoresDisponibles();
}

export async function procesarConversacion(convId: number) {
  const [conv] = await q<any>(
    `SELECT c.*, ct.nombre, ct.telefono AS jid, ct.datos FROM bot_conversaciones c JOIN bot_contactos ct ON ct.id=c.contacto_id WHERE c.id=?`, [convId]);
  if (!conv || !conv.bot_activo) return { omitido: "bot inactivo" };
  const pend = await q<any>("SELECT id, texto FROM bot_mensajes WHERE conversacion_id=? AND rol='cliente' AND procesado=0 ORDER BY id", [convId]);
  if (!pend.length) return { omitido: "sin pendientes" };
  const ids: number[] = pend.map((p) => p.id);
  const t0 = Date.now();

  // 0) Comando temporal de prueba: /reset para reiniciar de 0 el número
  const textoEntrante = pend.map((p) => p.texto || "").join(" ").trim();
  if (/^\/reset\b/i.test(textoEntrante)) {
    // Borrar trazas, eventos, mensajes y la conversación
    await exec("DELETE FROM bot_eventos WHERE conversacion_id=?", [convId]);
    await exec("DELETE FROM bot_trazas WHERE conversacion_id=?", [convId]);
    await exec("DELETE FROM bot_mensajes WHERE conversacion_id=?", [convId]);
    await exec("DELETE FROM bot_conversaciones WHERE id=?", [convId]);
    // Borrar el contacto si no tiene más conversaciones
    if (conv.contacto_id) {
      await exec("DELETE FROM bot_contactos WHERE id=?", [conv.contacto_id]);
    }
    // Enviar confirmación al WhatsApp
    await enviarTexto(conv.jid, "🔄 *¡Datos reseteados con éxito!* Se eliminó el historial y tus datos para este número. Puedes iniciar una nueva conversación de prueba desde cero. 🙌");
    return { ok: true, reset: true };
  }

  // 1) Disparadores por CODIGO (solo si es queja grave o fraude explícito con insulto/denuncia extrema)
  const esQuejaExtrema = /\b(denuncia|estafa|demanda judicial|fiscalia)\b/i.test(textoEntrante);
  if (esQuejaExtrema) {
    const a = await escalar(conv, "Caso legal / denuncia urgente");
    await responder(conv, a.disponible
      ? "Hasta aquí llega mi intervención como asistente virtual. He pasado tu caso de inmediato a un asesor humano de nuestra administración. En un momento se pondrá en contacto contigo directamente 🙌"
      : `Hasta aquí llega mi intervención como asistente virtual. Dejo tu caso registrado con carácter prioritario para administración. Nuestro horario de atención es ${a.texto}; apenas inicien labores se pondrán en contacto contigo directamente por aquí 🙌`, ids);
    return { escalado: true };
  }

  // 2) Contexto: datos + estado + resumen (system) y ultimos 14 mensajes (contents)
  const contents: Content[] = [];
  for (const m of await historial(convId, 14)) {
    const role = m.rol === "cliente" ? "user" : "model";
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += "\n" + m.texto;
    else contents.push({ role, parts: [{ text: m.texto }] });
  }
  while (contents[0]?.role === "model") contents.shift();

  const ctx: Ctx = { convId, contactoId: conv.contacto_id, empresa: conv.empresa };
  const system = sistema(conv);
  const log: { nombre: string; args: any; resultado: any }[] = [];
  let tokens = 0, texto = "";

  // 3) Loop de herramientas (máximo 6 vueltas — necesario para listas con varios productos)
  for (let i = 0; i < 6; i++) {
    const res = await generar({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: declaraciones }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    });
    tokens += res?.usageMetadata?.totalTokenCount ?? 0;
    const cand = res?.candidates?.[0];
    const calls = (cand?.content?.parts ?? []).filter((p: any) => p.functionCall);
    if (!calls.length) { texto = textoDe(res); break; }
    contents.push(cand.content); // se conserva tal cual (incluye firmas de pensamiento)
    const respuestas: any[] = [];
    for (const c of calls) {
      const resultado = await ejecutar(c.functionCall.name, c.functionCall.args ?? {}, ctx);
      log.push({ nombre: c.functionCall.name, args: c.functionCall.args ?? {}, resultado });
      respuestas.push({ functionResponse: { name: c.functionCall.name, response: { result: resultado } } });
    }
    contents.push({ role: "user", parts: respuestas });
  }

  // 4) Validacion anti-alucinacion
  const resultados = JSON.stringify(log.map((l) => l.resultado));
  const toolsUsadas = log.map((l) => l.nombre);
  let bloqueada = false;
  if (!texto) { bloqueada = true; texto = FALLBACK; }
  else if (!validar(texto, resultados, toolsUsadas)) { bloqueada = true; texto = FALLBACK; }

  // 5) Escalado / intentos fallidos
  let motivo = ctx.escalar ?? (bloqueada ? "El bot no pudo dar una respuesta verificable" : null);
  // Solo cuenta fallo si NO se encontró NINGÚN producto en toda la conversación
  // (si algunos items no están en catálogo pero otros sí, no es un fallo)
  const algunEncontrado = log.some((l) => l.resultado?.encontrado === true);
  const todosNoEncontrados = log.filter((l) => l.nombre === "buscar_producto").length > 0
    && log.filter((l) => l.nombre === "buscar_producto").every((l) => l.resultado?.encontrado === false);
  let intentos = todosNoEncontrados && !algunEncontrado ? conv.intentos_fallidos + 1 : 0;
  if (!motivo && intentos >= 3) motivo = "El bot no encontró ningún producto en 3 intentos consecutivos";
  if (motivo) { await escalar(conv, motivo); intentos = 0; }

  await responder(conv, texto, ids);
  await exec("UPDATE bot_conversaciones SET intentos_fallidos=?, estado=IF(?, estado, 'ATENDIENDO') WHERE id=?", [intentos, motivo ? 1 : 0, convId]);

  // Enviar imagen SOLO si el usuario pidió explícitamente ver fotos/imágenes
  // Analiza todos los mensajes pendientes del cliente para detectar la intención visual
  const usuarioPidioFoto = PIDE_FOTO_RE.test(textoEntrante);
  if (!bloqueada && !motivo && usuarioPidioFoto) {
    try {
      const prodLogs = log.filter((l) => l.nombre === "buscar_producto" && l.resultado?.encontrado);
      const todasLasImgs = prodLogs
        .flatMap((l) => l.resultado?.productos || [])
        .map((p: any) => p.imagen_categoria)
        .filter(Boolean);
      // Deduplicar por URL — la primera es la de mayor score (ya ordenada por tools.ts)
      const imagenesUnicas: string[] = [];
      for (const img of todasLasImgs) {
        if (!imagenesUnicas.includes(img)) imagenesUnicas.push(img);
        if (imagenesUnicas.length >= 2) break; // Máximo 2 cuando el usuario pide fotos
      }
      for (const imgUrl of imagenesUnicas) {
        await enviarImagen(conv.jid, imgUrl);
        // Registrar la imagen enviada en el chat del CRM
        await exec(
          "INSERT INTO bot_mensajes (conversacion_id, rol, texto) VALUES (?, 'bot', ?)",
          [conv.id, `📷 [IMAGEN: ${imgUrl}]`]
        );
        if (imagenesUnicas.length > 1) await new Promise(r => setTimeout(r, 600));
      }
      if (prodLogs.length > 0 && imagenesUnicas.length === 0) {
        // Hay productos pero sin imagen en BD — avisar amablemente
        await enviarTexto(conv.jid, "📷 Aún no contamos con imagen disponible para este producto en nuestro catálogo digital. Puede visitarnos en tienda para verlo personalmente.");
      }
    } catch (e: any) {
      console.warn("[Bot Imagen] No se pudo enviar imagen:", e?.message || e);
    }
  }

  // Guardar intención detectada
  // REGLA: "Proforma generada" es permanente — una vez que se generó una proforma,
  // ese es el evento más importante de la conversación y no debe sobreescribirse.
  const intencion = etiquetaIntencion(log, !!motivo, bloqueada);
  if (conv.intencion !== 'Proforma generada') {
    await exec("UPDATE bot_conversaciones SET intencion=? WHERE id=?", [intencion, convId]);
  }

  await exec("INSERT INTO bot_trazas (conversacion_id, prompt, respuesta, tools_llamadas, bloqueada, tokens, latencia_ms) VALUES (?,?,?,?,?,?,?)", [
    convId, JSON.stringify({ system, contents }), JSON.stringify({ texto }), JSON.stringify(log), bloqueada ? 1 : 0, tokens, Date.now() - t0,
  ]);

  try { await actualizarResumen(convId); } catch { /* no critico */ }
  return { ok: true, escalado: !!motivo, bloqueada };
}

// Resumen rodante estructurado: comprime lo antiguo para que nunca se pierda.
async function actualizarResumen(convId: number) {
  const [c] = await q<any>("SELECT resumen, resumen_hasta_msg_id FROM bot_conversaciones WHERE id=?", [convId]);
  const desde = c.resumen_hasta_msg_id ?? 0;
  const [{ n }] = await q<any>("SELECT COUNT(*) n FROM bot_mensajes WHERE conversacion_id=? AND id>?", [convId, desde]);
  if (n <= 24) return;
  const viejos = await q<any>("SELECT id, rol, texto FROM bot_mensajes WHERE conversacion_id=? AND id>? ORDER BY id LIMIT ?", [convId, desde, n - 10]);
  const r = await generar({
    contents: [{ role: "user", parts: [{ text:
      `Actualiza el resumen de esta conversación de atención al cliente. Responde SOLO un JSON con las claves: quiere, ya_se_le_dijo, datos, pendiente. Sé breve y no inventes.\nResumen previo: ${c.resumen ?? "ninguno"}\n\nMensajes nuevos:\n${viejos.map((m: any) => `${m.rol}: ${m.texto}`).join("\n")}` }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
  });
  const t = textoDe(r).replace(/```json|```/g, "").trim();
  if (!t) return;
  await exec("UPDATE bot_conversaciones SET resumen=?, resumen_hasta_msg_id=? WHERE id=?", [t, viejos[viejos.length - 1].id, convId]);
}
