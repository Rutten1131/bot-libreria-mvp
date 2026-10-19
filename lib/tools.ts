import { q, exec } from "./db";
import { ahora, asesoresDisponibles } from "./time";

export type Empresa = "santiago";
export type Ctx = { convId: number; contactoId: number; empresa: Empresa | null; escalar?: string };

const EMP = { type: "STRING", enum: ["santiago"], description: "Empresa. Omitir si no importa." };

export const declaraciones = [
  {
    name: "buscar_sucursales",
    description: "Busca sucursales de Santiago Papelería con dirección, teléfono y horario de atención. Úsala para CUALQUIER pregunta de ubicación u horario.",
    parameters: {
      type: "OBJECT",
      properties: {
        ciudad: { type: "STRING", description: "Ej. Loja" },
        nombre: { type: "STRING", description: "Parte del nombre o sector, ej. Matriz, Mega Santiago, UTPL" },
        empresa: EMP,
      },
    },
  },
  {
    name: "listar_promociones",
    description: "Lista las promociones y descuentos vigentes hoy.",
    parameters: { type: "OBJECT", properties: { empresa: EMP } },
  },
  {
    name: "buscar_producto",
    description: "Busca productos en el catálogo de Santiago Papelería por nombre, código o categoría y devuelve precio y disponibilidad.",
    parameters: {
      type: "OBJECT",
      properties: { texto: { type: "STRING", description: "Producto, código o categoría, ej. cuaderno, BIC, compás Maped, cartulina, mochila" }, empresa: EMP },
      required: ["texto"],
    },
  },
  {
    name: "buscar_conocimiento",
    description: "Consulta documentos oficiales de Santiago Papelería: información corporativa (historia, RUC, fundadores), líneas de negocio (Santiago Papelería, Mega Santiago, CREANDO, MAPED), sucursales, políticas de pago, devoluciones, delivery y servicios.",
    parameters: {
      type: "OBJECT",
      properties: {
        tema: {
          type: "STRING",
          enum: ["empresa", "marcas", "sucursales", "politicas_servicios"],
          description: "Tema a consultar: 'empresa' (historia, RUC, fundadores, estructura), 'marcas' (Santiago Papelería, Mega Santiago, CREANDO, MAPED, líneas comerciales), 'sucursales' (puntos de venta y direcciones), 'politicas_servicios' (pagos, devoluciones, delivery, ecommerce, facturación, mayorista).",
        },
      },
      required: ["tema"],
    },
  },
  {
    name: "buscar_faq",
    description: "Busca respuestas a preguntas frecuentes: pagos, factura, domicilio, empleo, devoluciones, contacto.",
    parameters: { type: "OBJECT", properties: { texto: { type: "STRING" } }, required: ["texto"] },
  },
  {
    name: "guardar_dato_cliente",
    description: "Guarda un dato que el cliente dijo con claridad (nombre, cédula, correo, ciudad) o la marca con la que habla (empresa).",
    parameters: {
      type: "OBJECT",
      properties: {
        campo: { type: "STRING", enum: ["nombre", "cedula", "correo", "ciudad", "empresa"] },
        valor: { type: "STRING" },
      },
      required: ["campo", "valor"],
    },
  },
  {
    name: "escalar_a_humano",
    description: "Pasa la conversación a un asesor humano. IMPORTANTE: antes de llamar esta herramienta debes tener el nombre del cliente y el motivo. Si no los tienes, pregúntalos primero con UN solo mensaje. Úsala cuando el cliente pide hablar con alguien, para cotizaciones, reclamos, domicilio o casos complejos.",
    parameters: { type: "OBJECT", properties: { motivo: { type: "STRING", description: "Motivo breve del escalado" } }, required: ["motivo"] },
  },
  {
    name: "notificar_asesor",
    description: "Envía un mensaje de WhatsApp al asesor humano con los datos del cliente que quiere ser atendido. Llámala justo después de escalar_a_humano, cuando ya tengas nombre del cliente y motivo confirmado.",
    parameters: {
      type: "OBJECT",
      properties: {
        nombre_cliente: { type: "STRING", description: "Nombre que el cliente dio" },
        motivo: { type: "STRING", description: "Motivo o razón por la que pide asesor" },
      },
      required: ["nombre_cliente", "motivo"],
    },
  },
  {
    name: "generar_cotizacion_pdf",
    description: "Genera una proforma/cotización formal en PDF con membrete corporativo de Santiago Papelería y la envía al WhatsApp del cliente. Úsala cuando el cliente solicita una cotización, presupuesto o lista de materiales y ya identificaste los productos y cantidades.",
    parameters: {
      type: "OBJECT",
      properties: {
        nombre_cliente: { type: "STRING", description: "Nombre del cliente o 'Consumidor Final'" },
        ciudad: { type: "STRING", description: "Ciudad del cliente si se conoce" },
        items: {
          type: "ARRAY",
          description: "Lista de productos cotizados con precios exactos del inventario",
          items: {
            type: "OBJECT",
            properties: {
              codigo: { type: "STRING", description: "Código del producto si se conoce" },
              nombre: { type: "STRING", description: "Nombre del producto exacto" },
              cantidad: { type: "NUMBER", description: "Cantidad solicitada (ej. 1, 2, 5)" },
              precioUnitario: { type: "NUMBER", description: "Precio unitario en dólares exacto del inventario" },
            },
            required: ["nombre", "cantidad", "precioUnitario"],
          },
        },
      },
      required: ["items"],
    },
  },
];

// Palabras vacías del español que no aportan valor para búsqueda de productos
const STOPWORDS = new Set([
  "busco", "quiero", "necesito", "tengo", "tiene", "tienen", "para", "hijo",
  "hija", "mis", "los", "las", "una", "uno", "unos", "unas", "con", "que",
  "del", "como", "este", "esta", "ese", "esa", "por", "mas", "muy",
  "favor", "porfavor", "hola", "buenas", "ver", "dame", "ayuda", "ayudar",
  "puedes", "puede", "puedo", "gracias", "manda", "envia", "muestra",
]);

function palabras(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w))
    .slice(0, 6);
}


const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function puntuar(rows: any[], ws: string[], campos: string[], tope: number) {
  return rows
    .map((r) => ({ r, s: ws.reduce((a, w) => a + campos.reduce((b, c, i) => b + (norm(String(r[c] ?? "")).includes(w) ? (i === 0 ? 3 : 1) : 0), 0), 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, tope)
    .map((x) => x.r);
}

export async function ejecutar(nombre: string, a: any, ctx: Ctx): Promise<any> {
  try {
    const emp: Empresa | null = a?.empresa === "santiago" ? a.empresa : ctx.empresa;

    if (nombre === "buscar_sucursales") {
      const w: string[] = ["activa=1"], p: any[] = [];
      if (emp) { w.push("empresa=?"); p.push(emp); }
      if (a?.ciudad) { w.push("ciudad LIKE ?"); p.push(`%${a.ciudad}%`); }
      if (a?.nombre) { w.push("(nombre LIKE ? OR direccion LIKE ?)"); p.push(`%${a.nombre}%`, `%${a.nombre}%`); }
      const rows = await q<any>(`SELECT empresa, nombre, direccion, ciudad, telefono, horario FROM bot_sucursales WHERE ${w.join(" AND ")} LIMIT 8`, p);
      const conMapas = rows.map((r: any) => {
        const queryMaps = encodeURIComponent(`${r.nombre}, ${r.direccion}, ${r.ciudad}`);
        return {
          ...r,
          mapa_url: `https://maps.google.com/?q=${queryMaps}`,
        };
      });
      const h = ahora();
      return conMapas.length ? { encontrado: true, ahora: `${h.dia} ${h.hora}`, sucursales: conMapas } : { encontrado: false };
    }

    if (nombre === "listar_promociones") {
      const p: any[] = [];
      let f = "";
      if (emp) { f = "AND empresa IN (?, 'ambas')"; p.push(emp); }
      const rows = await q(
        `SELECT empresa, titulo, descripcion, DATE_FORMAT(hasta,'%d/%m/%Y') AS vigente_hasta FROM bot_promociones WHERE activa=1 AND CURDATE() BETWEEN desde AND hasta ${f}`, p);
      return rows.length ? { encontrado: true, promociones: rows } : { encontrado: false };
    }

    if (nombre === "buscar_producto") {
      const ws = palabras(String(a?.texto ?? ""));
      if (!ws.length) return { encontrado: false };
      const p: any[] = [];
      let f = "";
      if (emp) { f = "AND p.empresa IN (?, 'ambas')"; p.push(emp); }
      const cond = ws.map(() => "(p.nombre LIKE ? OR p.categoria LIKE ? OR p.descripcion LIKE ?)").join(" OR ");
      ws.forEach((w) => p.push(`%${w}%`, `%${w}%`, `%${w}%`));

      // La subquery de foto_especifica necesita sus propios parámetros ANTES de los de la query principal
      const etiqParams = ws.map((w) => `%${w}%`);

      const rows = await q<any>(
        `SELECT p.id AS producto_id, p.empresa, p.nombre, p.descripcion, p.categoria, p.precio, p.stock,
                c.url_imagen AS cat_imagen,
                (SELECT g.url_imagen FROM bot_categorias_galeria g
                 WHERE g.producto_id = p.id
                    OR (g.categoria = p.categoria AND g.etiquetas IS NOT NULL AND (${ws.map(() => "g.etiquetas LIKE ?").join(" OR ")}))
                 ORDER BY (g.producto_id = p.id) DESC, g.id DESC LIMIT 1) AS foto_especifica
         FROM bot_productos p
         LEFT JOIN bot_categorias_img c ON c.categoria = p.categoria
         WHERE p.activo=1 ${f} AND (${cond})
         LIMIT 30`,
        [...etiqParams, ...p]
      );

      const topRows = puntuar(rows, ws, ["nombre", "categoria", "descripcion"], 5);

      // Para cada producto encontrado, buscar la imagen de galería que MÁS etiquetas comparte
      // con las palabras de búsqueda (matching inteligente entre N fotos etiquetadas)
      const categorias = [...new Set(topRows.map((r: any) => r.categoria as string))];
      let galeriaMap: Record<string, { url: string; score: number }[]> = {};

      if (categorias.length > 0) {
        const placeholders = categorias.map(() => "?").join(",");
        const galeriaRows = await q<any>(
          `SELECT categoria, url_imagen, etiquetas, producto_id
           FROM bot_categorias_galeria
           WHERE categoria IN (${placeholders})
           ORDER BY id ASC`,
          categorias
        );

        for (const g of galeriaRows) {
          if (!galeriaMap[g.categoria]) galeriaMap[g.categoria] = [];
          const etiqs = norm(String(g.etiquetas || ""));
          // Puntaje: cuántas palabras de búsqueda aparecen en las etiquetas
          const score = ws.reduce((acc, w) => acc + (etiqs.includes(w) ? 2 : 0), 0)
            + (g.producto_id ? 1 : 0); // bonus si está vinculada a un producto específico
          galeriaMap[g.categoria].push({ url: g.url_imagen, score });
        }

        // Ordenar por score desc para cada categoría
        for (const cat of Object.keys(galeriaMap)) {
          galeriaMap[cat].sort((a, b) => b.score - a.score);
        }
      }

      const top = topRows.map((r: any) => {
        // Usar foto específica del producto primero, luego mejor match de galería por etiquetas
        const mejorGaleria = galeriaMap[r.categoria]?.[0];
        const fotoGaleria = mejorGaleria && mejorGaleria.score > 0
          ? mejorGaleria.url
          : (galeriaMap[r.categoria]?.[0]?.url ?? null); // fallback: primera foto de la categoría
        const imagenFinal = r.foto_especifica || fotoGaleria || r.cat_imagen || null;
        return {
          nombre: r.nombre,
          descripcion: r.descripcion,
          categoria: r.categoria,
          precio: r.precio,
          disponible: r.stock > 0,
          imagen_especifica: r.foto_especifica || null,
          imagen_categoria: imagenFinal,
        };
      });
      return top.length ? { encontrado: true, productos: top } : { encontrado: false };
    }


    if (nombre === "buscar_conocimiento") {
      const tema = String(a?.tema ?? "").toLowerCase().replace(/[^a-z_]/g, "");
      const { readFileSync, existsSync } = await import("fs");
      const { join } = await import("path");
      const archivo = join(process.cwd(), "knowledge", `${tema}.md`);
      if (existsSync(archivo)) {
        const contenido = readFileSync(archivo, "utf-8");
        return { encontrado: true, tema, contenido };
      }
      return { encontrado: false, mensaje: "Documento de conocimiento no encontrado" };
    }

    if (nombre === "buscar_faq") {
      const ws = palabras(String(a?.texto ?? ""));
      if (!ws.length) return { encontrado: false };
      const p: any[] = [];
      let f = "";
      if (emp) { f = "WHERE empresa IN (?, 'ambas')"; p.push(emp); }
      const rows = await q(`SELECT tema, pregunta, respuesta FROM bot_faqs ${f}`, p);
      const top = puntuar(rows, ws, ["tema", "pregunta", "respuesta"], 3);
      return top.length ? { encontrado: true, faqs: top } : { encontrado: false };
    }

    if (nombre === "guardar_dato_cliente") {
      const campo = String(a?.campo), valor = String(a?.valor ?? "").trim().slice(0, 120);
      if (!valor) return { ok: false };
      if (campo === "nombre") await exec("UPDATE bot_contactos SET nombre=? WHERE id=?", [valor, ctx.contactoId]);
      else if (campo === "empresa") {
        const e: Empresa = "santiago";
        await exec("UPDATE bot_conversaciones SET empresa=? WHERE id=?", [e, ctx.convId]);
        ctx.empresa = e;
      } else if (["cedula", "correo", "ciudad"].includes(campo)) {
        await exec(`UPDATE bot_contactos SET datos=JSON_SET(COALESCE(datos, JSON_OBJECT()), '$.${campo}', ?) WHERE id=?`, [valor, ctx.contactoId]);
      } else return { ok: false };
      await exec("INSERT INTO bot_eventos (conversacion_id, tipo, detalle) VALUES (?, 'dato_capturado', ?)", [ctx.convId, JSON.stringify({ campo })]);
      return { ok: true, guardado: campo };
    }

    if (nombre === "escalar_a_humano") {
      ctx.escalar = String(a?.motivo ?? "Sin motivo").slice(0, 250);
      const d = await asesoresDisponibles();
      return { ok: true, asesores_disponibles_ahora: d.disponible, horario_asesores: d.texto };
    }

    if (nombre === "notificar_asesor") {
      const { enviarTexto } = await import("./evolution");
      const nombreCliente = String(a?.nombre_cliente ?? "Sin nombre").trim();
      const motivo = String(a?.motivo ?? "Sin motivo").trim();
      const asesorNum = (process.env.ASESOR_PHONE || "593963410409").replace(/\D/g, "");
      const asesorJid = `${asesorNum}@s.whatsapp.net`;
      const msg = `🔔 *Nuevo cliente requiere atención*\n\n👤 *Nombre:* ${nombreCliente}\n📋 *Motivo:* ${motivo}\n\nPor favor comunícate con él por este mismo WhatsApp.`;
      try {
        await enviarTexto(asesorJid, msg);
        return { ok: true, notificado: true };
      } catch (err: any) {
        console.warn("[notificar_asesor] Error enviando a asesor:", err?.message);
        return { ok: false, error: err?.message };
      }
    }

    if (nombre === "generar_cotizacion_pdf") {
      const { generarPdfCotizacion } = await import("./cotizacion-pdf");
      const { enviarDocumento } = await import("./evolution");

      const items = (a?.items ?? []).map((it: any) => ({
        codigo: it.codigo || undefined,
        nombre: String(it.nombre ?? ""),
        cantidad: Number(it.cantidad ?? 1),
        precioUnitario: Number(it.precioUnitario ?? 0),
      })).filter((it: any) => it.nombre && it.precioUnitario > 0);

      if (!items.length) return { ok: false, error: "No hay items válidos para la cotización" };

      const numero = `COT-${Date.now().toString().slice(-6)}`;
      const pdfBuffer = await generarPdfCotizacion({
        numero,
        clienteNombre: String(a?.nombre_cliente ?? "Consumidor Final"),
        clienteTelefono: ctx.convId ? undefined : undefined,
        clienteCiudad: String(a?.ciudad ?? ""),
        items,
      });

      // Subir PDF a Bunny CDN
      const { BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_HOST, BUNNY_PULLZONE_URL } = process.env;
      if (!BUNNY_STORAGE_API_KEY || !BUNNY_STORAGE_ZONE) {
        return { ok: false, error: "Bunny CDN no configurado para PDFs" };
      }

      const fileName = `cotizaciones/${numero}.pdf`;
      const uploadRes = await fetch(
        `https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${fileName}`,
        {
          method: "PUT",
          headers: { AccessKey: BUNNY_STORAGE_API_KEY, "Content-Type": "application/pdf" },
          body: new Uint8Array(pdfBuffer),
        }
      );

      if (!uploadRes.ok) {
        return { ok: false, error: `Error subiendo PDF: ${await uploadRes.text()}` };
      }

      const pdfUrl = `${BUNNY_PULLZONE_URL}/${fileName}`;

      // Obtener JID del contacto para enviar
      const [conv] = await q<any>("SELECT c.telefono AS jid FROM bot_contactos c JOIN bot_conversaciones cv ON cv.contacto_id = c.id WHERE cv.id=?", [ctx.convId]);
      if (conv?.jid) {
        // Enviar el buffer base64 directamente — más confiable que URL con Evolution API
        await enviarDocumento(conv.jid, pdfBuffer, `Cotizacion-${numero}.pdf`, `📄 Aquí está su cotización ${numero} de Santiago Papelería`);
        // Registrar el PDF en el hilo de mensajes del CRM para visualización del asesor
        await exec(
          "INSERT INTO bot_mensajes (conversacion_id, rol, texto) VALUES (?, 'bot', ?)",
          [ctx.convId, `📄 [PDF: ${pdfUrl} | Cotizacion-${numero}.pdf | Total: $${(items.reduce((a: number, i: any) => a + i.cantidad * i.precioUnitario, 0) * 1.15).toFixed(2)}]`]
        );
      }

      const totalItems = items.reduce((a: number, i: any) => a + i.cantidad * i.precioUnitario, 0);
      const totalConIva = (totalItems * 1.15).toFixed(2);

      // Notificar automáticamente a César que se generó una proforma (posible venta)
      try {
        const { enviarTexto } = await import("./evolution");
        const asesorNum = (process.env.ASESOR_PHONE || "593963410409").replace(/\D/g, "");
        const asesorJid = `${asesorNum}@s.whatsapp.net`;
        const nombreCliente = String(a?.nombre_cliente ?? "Consumidor Final");
        const ciudadCliente = String(a?.ciudad ?? "");
        const msg = `🛒 *Nueva proforma generada — Paso a ventas*\n\n👤 *Cliente:* ${nombreCliente}${ciudadCliente ? ` — ${ciudadCliente}` : ""}\n💰 *Total c/IVA:* $${totalConIva}\n📄 *PDF:* ${pdfUrl}\n\n📌 El cliente recibió el PDF por WhatsApp. Comunícate para cerrar la venta.`;
        await enviarTexto(asesorJid, msg);
      } catch (err: any) {
        console.warn("[generar_cotizacion_pdf] No se pudo notificar a asesor:", err?.message);
      }

      // Registrar evento "paso_a_ventas" para el dashboard
      try {
        const nombreCliente = String(a?.nombre_cliente ?? "Consumidor Final");
        await exec(
          "INSERT INTO bot_eventos (conversacion_id, tipo, detalle) VALUES (?, 'paso_a_ventas', ?)",
          [ctx.convId, JSON.stringify({ numero, total_con_iva: totalConIva, cliente: nombreCliente })]
        );
      } catch (err: any) {
        console.warn("[generar_cotizacion_pdf] No se pudo registrar evento paso_a_ventas:", err?.message);
      }

      return {
        ok: true,
        numero,
        total_sin_iva: totalItems.toFixed(2),
        total_con_iva: totalConIva,
        pdf_url: pdfUrl,
      };
    }

    return { error: "herramienta desconocida" };
  } catch (e: any) {
    return { error: String(e?.message ?? e).slice(0, 200) };
  }
}
