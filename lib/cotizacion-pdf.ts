import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface ItemCotizacion {
  codigo?: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
}

export interface CotizacionParams {
  numero: string;
  clienteNombre: string;
  clienteTelefono?: string;
  clienteCiudad?: string;
  items: ItemCotizacion[];
  observaciones?: string;
}

const AZUL   = rgb(0.145, 0.388, 0.922);
const OSCURO = rgb(0.059, 0.090, 0.165);
const GRIS   = rgb(0.282, 0.337, 0.412);
const BLANCO = rgb(1, 1, 1);
const BORDE  = rgb(0.886, 0.910, 0.941);
const FONDO  = rgb(0.973, 0.984, 0.992);

function dibujarEncabezado(page: any, fontBold: any, fontReg: any, numero: string, fecha: string, width: number): number {
  let y = page.getHeight() - 40;

  // Barra azul superior
  page.drawRectangle({ x: 40, y: y - 6, width: width - 80, height: 6, color: AZUL });
  y -= 26;

  // Nombre empresa
  page.drawText("LA REFORMA — Su Empresa Amiga", { x: 40, y, size: 20, font: fontBold, color: OSCURO });
  page.drawText("LUZUCAM S.A.S.  ·  RUC: 1191797444001  ·  Av. 18 de Noviembre e/ Mercadillo y Lourdes, Loja", {
    x: 40, y: y - 16, size: 7.5, font: fontReg, color: GRIS,
  });
  page.drawText("WhatsApp: +593 96 944 4795  ·  Sitio web: lareforma.ec", {
    x: 40, y: y - 27, size: 7.5, font: fontReg, color: GRIS,
  });

  // Badge cotización
  page.drawRectangle({ x: 390, y: y - 42, width: 165, height: 52, color: FONDO, borderColor: BORDE, borderWidth: 1 });
  page.drawText("PROFORMA / COTIZACIÓN", { x: 396, y: y - 10, size: 9, font: fontBold, color: AZUL });
  page.drawText(`N° ${numero}`, { x: 396, y: y - 24, size: 10, font: fontBold, color: OSCURO });
  page.drawText(`Fecha: ${fecha}`, { x: 396, y: y - 37, size: 8, font: fontReg, color: GRIS });

  return y - 52;
}

function dibujarCliente(page: any, fontBold: any, fontReg: any, params: CotizacionParams, y: number, width: number): number {
  page.drawRectangle({ x: 40, y: y - 52, width: width - 80, height: 52, color: FONDO, borderColor: BORDE, borderWidth: 1 });
  page.drawText("DATOS DEL CLIENTE", { x: 52, y: y - 14, size: 8, font: fontBold, color: AZUL });
  page.drawText(`Cliente: ${params.clienteNombre || "Consumidor Final"}`, { x: 52, y: y - 28, size: 10, font: fontBold, color: OSCURO });
  const sub = [params.clienteTelefono && `Tel: ${params.clienteTelefono}`, params.clienteCiudad && `Ciudad: ${params.clienteCiudad}`].filter(Boolean).join("  |  ");
  if (sub) page.drawText(sub, { x: 52, y: y - 42, size: 8, font: fontReg, color: GRIS });
  return y - 62;
}

function dibujarCabezaTabla(page: any, fontBold: any, y: number, width: number): number {
  page.drawRectangle({ x: 40, y: y - 22, width: width - 80, height: 22, color: OSCURO });
  page.drawText("CANT",       { x: 46, y: y - 15, size: 8, font: fontBold, color: BLANCO });
  page.drawText("DESCRIPCIÓN DEL PRODUCTO", { x: 88, y: y - 15, size: 8, font: fontBold, color: BLANCO });
  page.drawText("P. UNIT",    { x: 415, y: y - 15, size: 8, font: fontBold, color: BLANCO });
  page.drawText("TOTAL",      { x: 490, y: y - 15, size: 8, font: fontBold, color: BLANCO });
  return y - 22;
}

function dibujarTotales(page: any, fontBold: any, fontReg: any, subtotal: number, y: number): number {
  const iva = subtotal * 0.15;
  const total = subtotal + iva;

  // Caja totales
  page.drawRectangle({ x: 355, y: y - 76, width: 200, height: 76, color: FONDO, borderColor: BORDE, borderWidth: 1 });

  page.drawText("Subtotal:",  { x: 365, y: y - 18, size: 9, font: fontReg, color: GRIS });
  page.drawText(`$${subtotal.toFixed(2)}`, { x: 510, y: y - 18, size: 9, font: fontReg, color: OSCURO });

  page.drawText("IVA (15%):", { x: 365, y: y - 36, size: 9, font: fontReg, color: GRIS });
  page.drawText(`$${iva.toFixed(2)}`,      { x: 510, y: y - 36, size: 9, font: fontReg, color: OSCURO });

  page.drawLine({ start: { x: 365, y: y - 48 }, end: { x: 548, y: y - 48 }, color: BORDE, thickness: 0.8 });

  page.drawText("TOTAL USD:", { x: 365, y: y - 64, size: 12, font: fontBold, color: AZUL });
  page.drawText(`$${total.toFixed(2)}`, { x: 500, y: y - 64, size: 12, font: fontBold, color: AZUL });

  return y - 85;
}

function dibujarCondiciones(page: any, fontBold: any, fontReg: any, y: number): number {
  page.drawText("CONDICIONES COMERCIALES:", { x: 40, y, size: 8, font: fontBold, color: OSCURO });
  const conds = [
    "• Precios válidos por 5 días calendario o hasta agotar existencias.",
    "• Entrega inmediata en tienda o envíos a nivel nacional.",
    "• Facturación electrónica — indique su cédula o RUC al pagar.",
    "• Formas de pago: Efectivo, tarjeta (sin recargo) o transferencia bancaria.",
  ];
  conds.forEach((c, i) => {
    page.drawText(c, { x: 40, y: y - 12 - i * 11, size: 7.5, font: fontReg, color: GRIS });
  });

  // Línea de firma
  const yFirma = y - 80;
  page.drawLine({ start: { x: 40, y: yFirma }, end: { x: 200, y: yFirma }, color: OSCURO, thickness: 0.8 });
  page.drawText("La Reforma — Su Empresa Amiga", { x: 40, y: yFirma - 12, size: 8, font: fontBold, color: OSCURO });
  page.drawText("Autorizado por", { x: 40, y: yFirma - 22, size: 7.5, font: fontReg, color: GRIS });

  return yFirma - 30;
}

function dibujarPie(page: any, fontReg: any, width: number) {
  page.drawText(
    "Generado automáticamente por el asistente virtual de La Reforma — Su Empresa Amiga  ·  Gracias por su preferencia.",
    { x: 40, y: 16, size: 6.5, font: fontReg, color: rgb(0.620, 0.690, 0.770) }
  );
}

export async function generarPdfCotizacion(params: CotizacionParams): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg  = await doc.embedFont(StandardFonts.Helvetica);

  const PAGE_W = 595, PAGE_H = 842;
  const FILA_H = 18;
  // Espacio mínimo reservado al final de página para totales + condiciones + firma + pie
  const RESERVA_FINAL = 210;
  const MARGEN_INF = 50;

  const fecha = new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = dibujarEncabezado(page, fontBold, fontReg, params.numero, fecha, PAGE_W);
  y -= 12;
  y = dibujarCliente(page, fontBold, fontReg, params, y, PAGE_W);
  y -= 10;
  y = dibujarCabezaTabla(page, fontBold, y, PAGE_W);

  let subtotal = 0;

  params.items.forEach((item, idx) => {
    // Si no hay espacio para la fila + reserva final → nueva página
    if (y - FILA_H < MARGEN_INF + RESERVA_FINAL) {
      dibujarPie(page, fontReg, PAGE_W);
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = dibujarEncabezado(page, fontBold, fontReg, params.numero, fecha, PAGE_W);
      y -= 12;
      y = dibujarCabezaTabla(page, fontBold, y, PAGE_W);
    }

    const rowColor = idx % 2 === 0 ? BLANCO : FONDO;
    const itemTotal = item.cantidad * item.precioUnitario;
    subtotal += itemTotal;

    page.drawRectangle({ x: 40, y: y - FILA_H, width: PAGE_W - 80, height: FILA_H, color: rowColor });
    page.drawLine({ start: { x: 40, y: y - FILA_H }, end: { x: PAGE_W - 40, y: y - FILA_H }, color: BORDE, thickness: 0.4 });

    page.drawText(String(item.cantidad), { x: 52, y: y - 12, size: 8, font: fontBold, color: OSCURO });

    const nombre = item.nombre.length > 58 ? item.nombre.substring(0, 58) + "…" : item.nombre;
    page.drawText(nombre, { x: 88, y: y - 12, size: 8, font: fontReg, color: OSCURO });

    // Alinear a la derecha manualmente
    const puText = `$${item.precioUnitario.toFixed(2)}`;
    const totText = `$${itemTotal.toFixed(2)}`;
    page.drawText(puText,  { x: 460 - puText.length * 4.5,  y: y - 12, size: 8, font: fontReg,  color: GRIS });
    page.drawText(totText, { x: 545 - totText.length * 5.2, y: y - 12, size: 8, font: fontBold, color: OSCURO });

    y -= FILA_H;
  });

  // Siempre hay espacio porque lo reservamos
  y -= 15;
  y = dibujarTotales(page, fontBold, fontReg, subtotal, y);
  y -= 15;
  dibujarCondiciones(page, fontBold, fontReg, y);
  dibujarPie(page, fontReg, PAGE_W);

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
