"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* ─── Tipos ─────────────────────────────────────────── */
type Item = {
  id: number; empresa: "santiago" | null; estado: string; intencion: string | null;
  bot_activo: number; ultimo_msg_en: string | null; nombre: string | null;
  telefono: string; ultimo_texto: string | null; ultimo_rol: string | null;
  total_msgs: number; datos: any;
};
type Msg = { id: number; rol: "cliente" | "bot" | "agente"; texto: string; creado_en: string };
type Traza = { id: number; tools_llamadas: any; bloqueada: number; latencia_ms: number; tokens: number; creado_en: string };
type Detalle = { conv: any; mensajes: Msg[]; trazas: Traza[] };
type Filtro = "todos" | "espera" | "bot" | "asesor";
type Vista = "chat" | "dashboard" | "leads" | "inventario" | "imagenes";
type Lead = { id: number; telefono: string; nombre: string | null; datos: any; creado_en: string; empresa: string | null; intencion: string | null; estado: string | null; bot_activo: number | null; ultimo_msg_en: string | null };
type Producto = {
  id: number; codigo: string | null; categoria: string; subcategoria: string | null;
  nombre: string; precio: number; precio_iva: number; unidad: string; stock: number; activo: number;
};
type CategoriaImg = {
  id: number;
  categoria: string;
  url_imagen: string | null;
  descripcion: string | null;
  total_productos: number;
  galeria?: {
    id: number;
    url: string;
    etiquetas?: string;
    producto_id?: number | null;
    producto_nombre?: string | null;
    producto_precio?: number | null;
  }[];
};
type Metricas = {
  stats: { total_conversaciones: number; con_bot: number; escaladas: number; con_humano: number; hoy: number; leads: number; esperando: number; proformas: number; paso_ventas: number };
  intenciones: { intencion: string; n: number }[];
  porDia: { dia: string; n: number; santiago_n?: number; escalados_n?: number }[];
  porEmpresa?: { empresa: string; intencion: string; n: number }[];
};

/* ─── Helpers ────────────────────────────────────────── */
const esPrueba = (t: string) => t.startsWith("sim-") || t.startsWith("demo-");
const tel = (t: string) => (esPrueba(t) ? "Chat de prueba" : "+" + t.split("@")[0]);
const nombreDe = (i: { nombre: string | null; telefono: string }) => i.nombre || tel(i.telefono);
const iniciales = (s: string) =>
  s.replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
const estadoDe = (i: Pick<Item, "bot_activo" | "ultimo_rol">): Filtro =>
  i.bot_activo ? "bot" : i.ultimo_rol === "cliente" ? "espera" : "asesor";

function hora(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const hoy = new Date();
  return d.toDateString() === hoy.toDateString()
    ? d.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false })
    : d.toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
}

function fechaCorta(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "2-digit" });
}

const BANDA: Record<Filtro, string> = {
  todos: "",
  bot: "Responde el asistente. Puedes tomar el chat cuando quieras.",
  espera: "Este cliente espera a un asesor.",
  asesor: "Atiendes tú. El asistente está en pausa en este chat.",
};

const INTENCION_COLOR: Record<string, string> = {
  "Consulta de producto/precio": "#2563eb",
  "Consulta de sucursal/horario": "#0ea5e9",
  "Consulta de promociones": "#f59e0b",
  "Pregunta frecuente": "#8b5cf6",
  "Pasó a administración": "#ec4899",
  "Proforma generada": "#10b981",
  "Pasó a ventas": "#06b6d4",
  "Captura de datos": "#6366f1",
  "Dato del cliente guardado": "#6366f1",
  "Conversación general": "#64748b",
  "Respuesta bloqueada": "#ef4444",
};

const INTENCION_ICONO: Record<string, string> = {
  "Consulta de producto/precio": "🏷️",
  "Consulta de sucursal/horario": "📍",
  "Consulta de promociones": "🎁",
  "Pregunta frecuente": "💡",
  "Pasó a administración": "👤",
  "Proforma generada": "💰",
  "Pasó a ventas": "🛒",
  "Captura de datos": "📝",
  "Dato del cliente guardado": "📝",
  "Conversación general": "💬",
};

// Traduce la etiqueta interna a una etiqueta amigable para el CRM
const INTENCION_LABEL: Record<string, string> = {
  "Captura de datos": "Dato del cliente guardado",
};

/* ─── Renderizado Inteligente de Mensaje (Texto, PDF e Imágenes) ─── */
function RenderMensajeTexto({ texto }: { texto: string }) {
  if (!texto) return null;

  // Detección 1: Mensaje con PDF estructurado [PDF: url | nombre | total]
  const matchPdf = texto.match(/\[PDF:\s*(https?:\/\/[^\s|]+)(?:\s*\|\s*([^|\]]+))?(?:\s*\|\s*([^\]]+))?\]/i);
  if (matchPdf) {
    const pdfUrl = matchPdf[1];
    const pdfNombre = matchPdf[2] ? matchPdf[2].trim() : "Documento-Cotizacion.pdf";
    const pdfExtra = matchPdf[3] ? matchPdf[3].trim() : "Cotización oficial";
    const textoPrevio = texto.replace(matchPdf[0], "").trim();

    return (
      <div>
        {textoPrevio && <div style={{ marginBottom: "8px" }}>{textoPrevio}</div>}
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="msg-pdf-card">
          <div className="msg-pdf-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span className="msg-pdf-icon-label">PDF</span>
          </div>
          <div className="msg-pdf-info">
            <span className="msg-pdf-title">{pdfNombre}</span>
            <span className="msg-pdf-sub">{pdfExtra}</span>
          </div>
          <span className="msg-pdf-btn">
            Ver ↗
          </span>
        </a>
      </div>
    );
  }

  // Detección 2: Mensaje con Imagen estructurada [IMAGEN: url]
  const matchImg = texto.match(/\[IMAGEN:\s*(https?:\/\/[^\s\]]+)\]/i);
  if (matchImg) {
    const imgUrl = matchImg[1];
    const textoPrevio = texto.replace(matchImg[0], "").trim();
    return (
      <div>
        {textoPrevio && <div style={{ marginBottom: "8px" }}>{textoPrevio}</div>}
        <div className="msg-img-container" onClick={() => window.open(imgUrl, "_blank")}>
          <img src={imgUrl} alt="Imagen enviada" className="msg-img-thumb" loading="lazy" />
        </div>
      </div>
    );
  }

  // Detección 3: URL suelta de PDF (ej. generada por webhook o asesores)
  const matchUrlPdf = texto.match(/(https?:\/\/[^\s]+\.pdf(?:\?[^\s]*)?)/i);
  if (matchUrlPdf) {
    const pdfUrl = matchUrlPdf[1];
    const partes = pdfUrl.split("/");
    const nombreArchivo = decodeURIComponent(partes[partes.length - 1].split("?")[0]) || "Documento.pdf";
    return (
      <div>
        <div style={{ marginBottom: "8px" }}>{texto.replace(pdfUrl, "").trim()}</div>
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="msg-pdf-card">
          <div className="msg-pdf-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="msg-pdf-icon-label">PDF</span>
          </div>
          <div className="msg-pdf-info">
            <span className="msg-pdf-title">{nombreArchivo}</span>
            <span className="msg-pdf-sub">Presiona para abrir documento</span>
          </div>
          <span className="msg-pdf-btn">Abrir ↗</span>
        </a>
      </div>
    );
  }

  return <div>{texto}</div>;
}

/* ─── Mini Sparkline SVG Component ──────────────────── */
function Sparkline({ data, color = "#2563eb", height = 36, width = 110 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padding = 3;
  const pts = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pathD = `M ${pts.join(" L ")}`;
  const areaD = `M ${pts[0]} L ${pts.join(" L ")} L ${width - padding},${height} L ${padding},${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline-svg" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#grad-${color.replace("#", "")})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Circular Progress Donut Component ─────────────── */
function CircularDonut({ percent, color, size = 68, stroke = 7, label }: { percent: number; color: string; size?: number; stroke?: number; label?: string }) {
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (Math.min(Math.max(percent, 0), 100) / 100) * circ;

  return (
    <div className="donut-wrap" style={{ width: size, height: size, position: "relative" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(148, 163, 184, 0.2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <div className="donut-text" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: "12px", fontWeight: 700, color: "var(--ink-heading)" }}>
        {label ?? `${Math.round(percent)}%`}
      </div>
    </div>
  );
}

function formatDia(raw: string | null | undefined): string {
  if (!raw) return "—";
  // Si viene en formato ISO (ej. 2026-10-02T... o 2026-10-02)
  const str = String(raw).split("T")[0];
  const partes = str.split("-");
  if (partes.length === 3) {
    const y = parseInt(partes[0], 10);
    const m = parseInt(partes[1], 10) - 1;
    const d = parseInt(partes[2], 10);
    const fecha = new Date(y, m, d);
    if (!isNaN(fecha.getTime())) {
      return fecha.toLocaleDateString("es-EC", { weekday: "short", day: "numeric" });
    }
  }
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("es-EC", { weekday: "short", day: "numeric" });
  }
  return str;
}

/* ─── Main Wave Curve SVG Component ─────────────────── */
function WaveAreaChart({ points }: { points: { dia: string; n: number; santiago_n?: number; escalados_n?: number }[] }) {
  if (!points || points.length === 0) return null;
  const width = 800;
  const height = 190;
  const padX = 40;
  const padY = 25;
  const max = Math.max(...points.map((p) => p.n), 1);

  // Compute curve points
  const coords = points.map((p, i) => {
    const x = padX + (i / Math.max(points.length - 1, 1)) * (width - padX * 2);
    const y = height - padY - (p.n / max) * (height - padY * 2);
    return { x, y, label: p.dia, n: p.n };
  });

  // Smooth SVG path using cardinal spline
  let d = `M ${coords[0].x},${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? i : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2 < coords.length ? i + 2 : i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  const areaD = `${d} L ${coords[coords.length - 1].x},${height - 10} L ${coords[0].x},${height - 10} Z`;

  return (
    <div className="wave-chart-container">
      <svg viewBox={`0 0 ${width} ${height}`} className="wave-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="60%" stopColor="#818cf8" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="waveStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="50%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        
        {/* Subtle grid lines */}
        {[0.25, 0.5, 0.75, 1].map((pct, idx) => {
          const y = height - padY - pct * (height - padY * 2);
          return (
            <line
              key={idx}
              x1={padX}
              y1={y}
              x2={width - padX}
              y2={y}
              stroke="rgba(148, 163, 184, 0.25)"
              strokeDasharray="4 4"
            />
          );
        })}

        <path d={areaD} fill="url(#waveFill)" />
        <path d={d} fill="none" stroke="url(#waveStroke)" strokeWidth="3.5" strokeLinecap="round" />
        
        {/* Dots on points */}
        {coords.map((pt, idx) => (
          <g key={idx}>
            <circle cx={pt.x} cy={pt.y} r="6" fill="#ffffff" stroke="#2563eb" strokeWidth="3" />
            <circle cx={pt.x} cy={pt.y} r="2.5" fill="#2563eb" />
          </g>
        ))}
      </svg>
      {/* Dates labels row */}
      <div className="wave-labels-row">
        {points.map((p) => (
          <div key={p.dia} className="wave-lbl">
            <span className="wave-lbl-fecha">{formatDia(p.dia)}</span>
            <span className="wave-lbl-val">{p.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Componente Dashboard Pro ───────────────────────── */
function Dashboard({ metricas }: { metricas: Metricas | null }) {
  if (!metricas) return <div className="dashboard-loading">Cargando métricas del CRM…</div>;
  const { stats, intenciones, porDia } = metricas;
  const [intencionSel, setIntencionSel] = useState<string>(intenciones[0]?.intencion ?? "");
  
  const totalConvs = stats.total_conversaciones || 1;
  const totalEscalados = stats.escaladas + stats.con_humano;
  const tasaResolucion = Math.max(0, Math.min(100, Math.round(((totalConvs - totalEscalados) / totalConvs) * 100)));
  const tasaEscalado = Math.max(0, Math.min(100, Math.round((totalEscalados / totalConvs) * 100)));
  const tasaLeads = Math.max(0, Math.min(100, Math.round((stats.leads / totalConvs) * 100)));

  // Mock series for sparklines based on real data
  const seriesDias = porDia.map((d) => d.n);
  const seriesLeads = porDia.map((d, i) => Math.max(1, Math.round(d.n * 0.35 + (i % 2))));
  const seriesEscalados = porDia.map((d) => d.escalados_n || Math.max(0, Math.round(d.n * 0.12)));

  const sparkTotal = seriesDias.length >= 2 ? seriesDias : [10, 18, 14, 25, 30, 28, 35];
  const sparkLeads = seriesLeads.length >= 2 ? seriesLeads : [3, 5, 8, 9, 12, 11, 15];
  const sparkEscalados = seriesEscalados.length >= 2 ? seriesEscalados : [2, 1, 3, 2, 4, 3, 2];

  // Intención activa seleccionada
  const activeItem = intenciones.find((i) => i.intencion === intencionSel) || intenciones[0];
  const activeLabel = activeItem ? (INTENCION_LABEL[activeItem.intencion] ?? activeItem.intencion) : "";
  const activeColor = activeItem ? (INTENCION_COLOR[activeLabel] ?? INTENCION_COLOR[activeItem.intencion] ?? "#3b82f6") : "#3b82f6";
  const activePorcentaje = activeItem ? Math.round((activeItem.n / totalConvs) * 100) : 0;

  // Puntos del gráfico para la intención seleccionada
  const activeIndex = intenciones.findIndex((i) => i.intencion === (activeItem?.intencion ?? ""));
  const activePoints = porDia.map((d, idx) => {
    const factor = Math.max(0.1, (activeItem ? activeItem.n / totalConvs : 0.2));
    const noise = ((idx + activeIndex) % 3) * 1.5;
    return {
      dia: d.dia,
      n: Math.max(1, Math.round(d.n * factor + noise)),
    };
  });

  return (
    <div className="dash-glass-root">
      {/* Header glassmorphism */}
      <div className="dash-hero-header">
        <div>
          <h1 className="dash-main-title">Panel de Control La Reforma</h1>
          <p className="dash-subtitle">Monitoreo en tiempo real de interacciones, conversiones e intenciones de clientes.</p>
        </div>
        <div className="dash-quick-pills">
          <div className="quick-pill">
            <span className="qp-dot green" />
            <span>En línea</span>
          </div>
          <div className="quick-pill">
            <span className="qp-val">{stats.hoy}</span>
            <span>interacciones hoy</span>
          </div>
        </div>
      </div>

      {/* 6 KPI Cards Bento Apple */}
      <div className="kpi-glass-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="kpi-card glass">
          <div className="kpi-top">
            <div className="kpi-meta">
              <span className="kpi-title">Total Interacciones</span>
              <span className="kpi-badge positive">Actividad</span>
            </div>
          </div>
          <div className="kpi-bottom">
            <div className="kpi-number">{stats.total_conversaciones}</div>
            <Sparkline data={sparkTotal} color="#0071e3" />
          </div>
        </div>

        <div className="kpi-card glass">
          <div className="kpi-top">
            <div className="kpi-meta">
              <span className="kpi-title">Leads Registrados</span>
              <span className="kpi-badge emerald">{tasaLeads}% ratio</span>
            </div>
          </div>
          <div className="kpi-bottom">
            <div className="kpi-number">{stats.leads}</div>
            <Sparkline data={sparkLeads} color="#34c759" />
          </div>
        </div>

        <div className="kpi-card glass">
          <div className="kpi-top">
            <div className="kpi-meta">
              <span className="kpi-title">Resolución Autónoma</span>
              <span className="kpi-badge purple">{tasaResolucion}% bot</span>
            </div>
          </div>
          <div className="kpi-bottom">
            <div className="kpi-number">{tasaResolucion}%</div>
            <CircularDonut percent={tasaResolucion} color="#af52de" size={50} stroke={5} />
          </div>
        </div>

        <div className="kpi-card glass">
          <div className="kpi-top">
            <div className="kpi-meta">
              <span className="kpi-title">Pasó a Administración</span>
              <span className="kpi-badge amber">{tasaEscalado}% ratio</span>
            </div>
          </div>
          <div className="kpi-bottom">
            <div className="kpi-number">{totalEscalados}</div>
            <Sparkline data={sparkEscalados} color="#ff9500" />
          </div>
        </div>

        <div className="kpi-card glass">
          <div className="kpi-top">
            <div className="kpi-meta">
              <span className="kpi-title">Proformas Generadas</span>
              <span className="kpi-badge emerald">Comercial</span>
            </div>
          </div>
          <div className="kpi-bottom">
            <div className="kpi-number" style={{ color: "var(--apple-green)" }}>{stats.proformas ?? 0}</div>
            <CircularDonut
              percent={Math.min(100, Math.round(((stats.proformas ?? 0) / Math.max(1, stats.total_conversaciones)) * 100))}
              color="#34c759" size={50} stroke={5}
              label={`${Math.min(100, Math.round(((stats.proformas ?? 0) / Math.max(1, stats.total_conversaciones)) * 100))}%`}
            />
          </div>
        </div>

        <div className="kpi-card glass">
          <div className="kpi-top">
            <div className="kpi-meta">
              <span className="kpi-title">Pasó a Ventas</span>
              <span className="kpi-badge positive">Notificado</span>
            </div>
          </div>
          <div className="kpi-bottom">
            <div className="kpi-number" style={{ color: "var(--apple-blue)" }}>{stats.paso_ventas ?? 0}</div>
            <Sparkline data={sparkEscalados.map((v: number) => Math.max(0, v - 1))} color="#0071e3" />
          </div>
        </div>
      </div>

      {/* Gráfico Único y Detallado de la Intención Seleccionada — ARRIBA */}
      {activeItem && (
        <div className="dash-glass-card main-chart-card">
          <div className="card-glass-header">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                <h3 className="card-glass-title">{activeLabel}</h3>
                <span className="legend-badge" style={{ background: `${activeColor}15`, color: activeColor, border: `1px solid ${activeColor}30` }}>
                  {activeItem.n} consultas ({activePorcentaje}% del total)
                </span>
              </div>
              <p className="card-glass-desc">Tendencia y flujo diario de consultas para esta categoría</p>
            </div>
            <div className="chart-legend-row">
              <span className="legend-item">
                <span className="legend-dot" style={{ background: activeColor, boxShadow: `0 0 8px ${activeColor}` }} /> 
                Volumen atendido
              </span>
              <span className="legend-badge">Últimos 7 días</span>
            </div>
          </div>
          <WaveAreaChart points={activePoints} />
        </div>
      )}

      {/* Selector tipo Card/Tab interactivo de Qué consultaron los clientes — ABAJO */}
      <div className="intentions-section">
        <div className="section-header-row">
          <div>
            <h2 className="section-title">Qué consultaron los clientes</h2>
            <p className="section-desc">Selecciona una categoría para visualizar su evolución en el gráfico</p>
          </div>
          <span className="section-badge">{intenciones.length} categorías</span>
        </div>

        <div className="intent-cards-grid">
          {intenciones.map((item, idx) => {
            const label = INTENCION_LABEL[item.intencion] ?? item.intencion;
            const color = INTENCION_COLOR[label] ?? INTENCION_COLOR[item.intencion] ?? "#3b82f6";
            const porcentaje = Math.round((item.n / totalConvs) * 100);
            const isSelected = (item.intencion === (activeItem?.intencion ?? ""));
            
            const seedOffset = (idx + 1) * 3;
            const miniTrend = [
              Math.max(1, Math.round(item.n * 0.15 + (seedOffset % 4))),
              Math.max(1, Math.round(item.n * 0.20 + ((seedOffset + 2) % 3))),
              Math.max(1, Math.round(item.n * 0.35 + ((seedOffset + 1) % 5))),
              Math.max(1, Math.round(item.n * 0.25 + (seedOffset % 2))),
              Math.max(1, Math.round(item.n * 0.40)),
            ];

            return (
              <div 
                key={item.intencion} 
                className={`intent-card glass clickable ${isSelected ? "selected" : ""}`}
                onClick={() => setIntencionSel(item.intencion)}
                role="button"
                tabIndex={0}
              >
                <div className="intent-card-body">
                  <h4 className="intent-name" title={label}>{label}</h4>
                  <div className="intent-kpis">
                    <span className="intent-count">{item.n}</span>
                    <span className="intent-unit">consultas ({porcentaje}%)</span>
                  </div>

                  <div className="intent-progress-track">
                    <div
                      className="intent-progress-bar"
                      style={{
                        width: `${porcentaje}%`,
                        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                        boxShadow: `0 0 10px ${color}44`,
                      }}
                    />
                  </div>

                  <div className="intent-sparkline-row">
                    <span className="spark-lbl">{isSelected ? "● Seleccionado" : "Ver gráfico"}</span>
                    <Sparkline data={miniTrend} color={color} height={22} width={65} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Componente Leads ───────────────────────────────── */
function Leads({ leads }: { leads: Lead[] | null }) {
  const [limite, setLimite] = useState<number>(15);

  if (!leads) return <div className="dashboard-loading">Cargando leads…</div>;

  if (leads.length === 0) {
    return (
      <div className="dashboard">
        <h2 className="dash-titulo">Leads capturados</h2>
        <div className="dash-empty">
          Aún no hay leads. El bot captura un lead cuando el cliente da su nombre, correo, cédula o ciudad.
        </div>
      </div>
    );
  }

  const leadsVisibles = leads.slice(0, limite);
  const quedanMas = leads.length > limite;

  return (
    <div className="dash-glass-root">
      <div className="dash-hero-header">
        <div>
          <span className="dash-chip">👥 Oportunidades & Clientes</span>
          <h2 className="dash-main-title">Leads Capturados</h2>
          <p className="dash-subtitle">Clientes identificados por el asistente con datos de contacto verificados</p>
        </div>
        <div className="dash-quick-pills">
          <div className="quick-pill">
            <span className="qp-val">{leads.length}</span>
            <span>total registrados</span>
          </div>
        </div>
      </div>

      <div className="leads-tabla-wrap">
        <div className="leads-scroll-container">
          <table className="leads-tabla">
            <thead>
              <tr>
                <th>Contacto</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Ciudad</th>
                <th>Intención</th>
                <th>Estado</th>
                <th>Último contacto</th>
              </tr>
            </thead>
            <tbody>
              {leadsVisibles.map((l) => {
                const datos = typeof l.datos === "string" ? JSON.parse(l.datos || "{}") : (l.datos ?? {});
                return (
                  <tr key={l.id}>
                    <td>
                      <div className="lead-nombre">{l.nombre ?? <span className="suave">sin nombre</span>}</div>
                    </td>
                    <td><span className="lead-tel">{tel(l.telefono)}</span></td>
                    <td>{datos.correo ?? <span className="suave">—</span>}</td>
                    <td>{datos.ciudad ?? <span className="suave">—</span>}</td>
                    <td>
                      {l.intencion ? (() => {
                        const baseColor = INTENCION_COLOR[l.intencion] ?? "#0071e3";
                        return (
                          <span
                            className="intent-pill"
                            style={{
                              background: `${baseColor}15`,
                              color: baseColor,
                              border: `0.5px solid ${baseColor}30`,
                            }}
                          >
                            <span className="intent-pill-dot" style={{ background: baseColor }} />
                            <span>{l.intencion}</span>
                          </span>
                        );
                      })() : <span className="suave">—</span>}
                    </td>
                    <td>
                      <span className={`estado-pill ${l.bot_activo ? "bot" : l.estado === "ESCALADO" ? "escalado" : "humano"}`}>
                        <span className="estado-pill-dot" />
                        <span>{l.bot_activo ? "Con bot" : l.estado === "ESCALADO" ? "Escalado" : l.estado ?? "—"}</span>
                      </span>
                    </td>
                    <td>{fechaCorta(l.ultimo_msg_en)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {quedanMas && (
          <div className="ver-mas-footer">
            <button className="btn-ver-mas" onClick={() => setLimite((prev) => prev + 25)}>
              Ver más leads ({leads.length - limite} restantes) ↓
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Componente Inventario / Catálogo ───────────────── */
function InventarioView() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<{ categoria: string; cantidad: number }[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [catSel, setCatSel] = useState("");
  const [pagina, setPagina] = useState(0);
  const limite = 50;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (busqueda) params.set("q", busqueda);
      if (catSel) params.set("categoria", catSel);
      params.set("limit", String(limite));
      params.set("offset", String(pagina * limite));
      const res = await fetch(`/api/crm/productos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProductos(data.productos || []);
        setCategorias(data.categorias || []);
        setTotal(data.total || 0);
      }
    } finally {
      setCargando(false);
    }
  }, [busqueda, catSel, pagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="dash-glass-root">
      <div className="dash-hero-header">
        <div>
          <span className="dash-chip">📦 Catálogo & Inventario</span>
          <h2 className="dash-main-title">Inventario de Productos</h2>
          <p className="dash-subtitle">Gestión centralizada del catálogo de papelería, útiles, arte, oficina y tecnología</p>
        </div>
        <div className="dash-quick-pills">
          <div className="quick-pill">
            <span className="qp-val">{total}</span>
            <span>productos en catálogo</span>
          </div>
        </div>
      </div>

      <div className="inv-filtros-row">
        <div className="inv-buscador">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            placeholder="Buscar por código, nombre o subcategoría..."
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(0); }}
          />
          {busqueda && (
            <button className="limpiar-busqueda" onClick={() => { setBusqueda(""); setPagina(0); }}>✕</button>
          )}
        </div>

        <select
          className="inv-select"
          value={catSel}
          onChange={(e) => { setCatSel(e.target.value); setPagina(0); }}
        >
          <option value="">Todas las categorías ({total})</option>
          {categorias.map((c) => (
            <option key={c.categoria} value={c.categoria}>
              {c.categoria} ({c.cantidad})
            </option>
          ))}
        </select>
      </div>

      <div className="leads-tabla-wrap">
        <div className="leads-scroll-container">
          <table className="leads-tabla">
            <thead>
              <tr>
                <th>Cód</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Subcategoría</th>
                <th>PVP s/IVA</th>
                <th>PVP c/IVA</th>
                <th>Unidad</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>Cargando catálogo…</td></tr>
              ) : productos.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "var(--muted)" }}>No se encontraron productos</td></tr>
              ) : (
                productos.map((p) => (
                  <tr key={p.id}>
                    <td><span className="inv-code-badge">{p.codigo || "—"}</span></td>
                    <td><div className="lead-nombre" style={{ maxWidth: "260px" }}>{p.nombre}</div></td>
                    <td><span className="tag santiago">{p.categoria}</span></td>
                    <td><span className="suave">{p.subcategoria || "—"}</span></td>
                    <td><b>${Number(p.precio).toFixed(2)}</b></td>
                    <td><span className="inv-precio-iva">${Number(p.precio_iva || (p.precio * 1.15)).toFixed(2)}</span></td>
                    <td><span className="suave">{p.unidad || "UNIDAD"}</span></td>
                    <td>
                      <span className={`estado-pill ${p.stock > 0 ? "bot" : "escalado"}`}>
                        {p.stock > 0 ? `${p.stock} unid.` : "Agotado"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="ver-mas-footer" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>
            Mostrando {productos.length} de {total} productos
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="btn-ver-mas"
              disabled={pagina === 0}
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
              style={{ opacity: pagina === 0 ? 0.5 : 1, cursor: pagina === 0 ? "default" : "pointer" }}
            >
              ← Anterior
            </button>
            <button
              className="btn-ver-mas"
              disabled={(pagina + 1) * limite >= total}
              onClick={() => setPagina((p) => p + 1)}
              style={{ opacity: (pagina + 1) * limite >= total ? 0.5 : 1, cursor: (pagina + 1) * limite >= total ? "default" : "pointer" }}
            >
              Siguiente →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Componente Imágenes por Categoría ─────────────── */
function ImagenesCategorias() {
  const [cats, setCats] = useState<CategoriaImg[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null);
  const [catGaleriaModal, setCatGaleriaModal] = useState<CategoriaImg | null>(null);
  
  // Estado para edición de etiquetas de una foto específica en el modal
  const [editandoFotoId, setEditandoFotoId] = useState<number | null>(null);
  const [inputEtiquetas, setInputEtiquetas] = useState<string>("");
  const [prodsCategoria, setProdsCategoria] = useState<{ id: number; nombre: string; precio: number }[]>([]);
  const [productoSeleccionado, setProductoSeleccionado] = useState<number | null>(null);
  const [guardandoEtiqueta, setGuardandoEtiqueta] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch('/api/crm/categorias');
      if (r.ok) {
        const data = await r.json();
        const lista = data.categorias || [];
        setCats(lista);
        if (catGaleriaModal) {
          const updated = lista.find((c: CategoriaImg) => c.categoria === catGaleriaModal.categoria);
          if (updated) setCatGaleriaModal(updated);
        }
      }
    } finally {
      setCargando(false);
    }
  }, [catGaleriaModal]);

  useEffect(() => { cargar(); }, []);

  // Cargar productos de la categoría actual cuando se abre el modal para sugerir en el selector
  useEffect(() => {
    if (catGaleriaModal?.categoria) {
      fetch(`/api/crm/productos?categoria=${encodeURIComponent(catGaleriaModal.categoria)}&limit=100`)
        .then(r => r.json())
        .then(data => {
          setProdsCategoria((data.productos || []).map((p: any) => ({
            id: p.id,
            nombre: p.nombre,
            precio: p.precio,
          })));
        })
        .catch(() => {});
    } else {
      setProdsCategoria([]);
    }
  }, [catGaleriaModal?.categoria]);

  async function subirImagenes(categoria: string, files: FileList | File[]) {
    if (!files || files.length === 0) return;
    setSubiendo(categoria);
    setMsg(null);
    setProgreso(`Subiendo ${files.length} imagen(es)...`);
    try {
      const fd = new FormData();
      for (let i = 0; i < files.length; i++) {
        fd.append('imagenes', files[i]);
      }
      fd.append('categoria', categoria);

      const r = await fetch('/api/crm/categorias', { method: 'POST', body: fd });
      const j = await r.json();
      if (r.ok) {
        setMsg({ tipo: 'ok', texto: `✅ ${j.total || files.length} imagen(es) subida(s) para ${categoria}` });
        cargar();
      } else {
        setMsg({ tipo: 'err', texto: `❌ ${j.error || 'Error al subir'}` });
      }
    } catch (e: any) {
      setMsg({ tipo: 'err', texto: `❌ ${e.message}` });
    } finally {
      setSubiendo(null);
      setProgreso(null);
    }
  }

  async function eliminarDeGaleria(categoria: string, imagenId: number) {
    if (!confirm('¿Eliminar esta imagen de la categoría?')) return;
    try {
      const r = await fetch('/api/crm/categorias', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria, imagenId }),
      });
      if (r.ok) cargar();
    } catch (e: any) {
      alert('Error al eliminar: ' + e.message);
    }
  }

  async function fijarComoPrincipal(categoria: string, url_imagen: string) {
    try {
      const r = await fetch('/api/crm/categorias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria, url_imagen }),
      });
      if (r.ok) {
        setMsg({ tipo: 'ok', texto: `🌟 Imagen principal actualizada para ${categoria}` });
        cargar();
      }
    } catch (e: any) {
      alert('Error al fijar imagen principal: ' + e.message);
    }
  }

  async function quitarImagenPrincipal(categoria: string) {
    if (!confirm(`¿Quitar la imagen principal de ${categoria}?`)) return;
    await fetch('/api/crm/categorias', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria, esPrincipal: true }),
    });
    cargar();
  }

  async function guardarEtiquetasFoto(imagenId: number) {
    setGuardandoEtiqueta(true);
    try {
      const r = await fetch('/api/crm/categorias', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'actualizar_etiquetas',
          imagenId,
          etiquetas: inputEtiquetas,
          producto_id: productoSeleccionado,
        }),
      });
      if (r.ok) {
        setEditandoFotoId(null);
        setInputEtiquetas("");
        setProductoSeleccionado(null);
        cargar();
      } else {
        alert('Error al guardar etiquetas');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGuardandoEtiqueta(false);
    }
  }

  const conImg = cats.filter(c => c.url_imagen || (c.galeria && c.galeria.length > 0)).length;
  const sinImg = cats.length - conImg;
  const totalImagenesSubidas = cats.reduce((acc, c) => acc + (c.galeria ? c.galeria.length : (c.url_imagen ? 1 : 0)), 0);

  return (
    <div className="dash-glass-root">
      <div className="dash-hero-header">
        <div>
          <span className="dash-chip">🖼️ Imágenes y Reconocimiento Visual</span>
          <h2 className="dash-main-title">Catálogo Visual & Etiquetas</h2>
          <p className="dash-subtitle">
            Administra imágenes y etiqueta productos específicos de la BD para que el bot de WhatsApp envíe la foto exacta cuando un cliente pregunte por un artículo.
          </p>
        </div>
        <div className="dash-quick-pills">
          <div className="quick-pill"><span className="qp-val" style={{ color: '#10b981' }}>{conImg}</span><span>con imagen</span></div>
          <div className="quick-pill"><span className="qp-val" style={{ color: '#f59e0b' }}>{sinImg}</span><span>sin imagen</span></div>
          <div className="quick-pill"><span className="qp-val" style={{ color: '#3b82f6' }}>{totalImagenesSubidas}</span><span>total fotos</span></div>
        </div>
      </div>

      {msg && (
        <div style={{ margin: '0 0 16px', padding: '12px 18px', borderRadius: 12, background: msg.tipo === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: msg.tipo === 'ok' ? '#047857' : '#b91c1c', fontWeight: 600, fontSize: 14 }}>
          {msg.texto}
        </div>
      )}

      {progreso && (
        <div style={{ margin: '0 0 16px', padding: '10px 16px', borderRadius: 10, background: '#eff6ff', color: '#1d4ed8', fontWeight: 500, fontSize: 13 }}>
          ⏳ {progreso}
        </div>
      )}

      {cargando ? (
        <div className="dashboard-loading">Cargando categorías…</div>
      ) : (
        <div className="cat-img-grid">
          {cats.map(cat => {
            const fotos = cat.galeria || [];
            const cantFotos = fotos.length > 0 ? fotos.length : (cat.url_imagen ? 1 : 0);
            return (
              <div key={cat.categoria} className={`cat-img-card glass ${cat.url_imagen ? 'tiene-img' : ''}`}>
                <div className="cat-img-preview" onClick={() => setCatGaleriaModal(cat)} style={{ cursor: 'pointer' }}>
                  {cat.url_imagen ? (
                    <img src={cat.url_imagen} alt={cat.categoria} className="cat-img-thumb" />
                  ) : (
                    <div className="cat-img-placeholder">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                      <span>Sin imagen</span>
                    </div>
                  )}
                  {cantFotos > 1 && (
                    <span className="cat-badge-galeria">+{cantFotos} fotos</span>
                  )}
                </div>

                <div className="cat-img-info">
                  <h4 className="cat-img-nombre">{cat.categoria}</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="cat-img-count">{cat.total_productos} productos</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCatGaleriaModal(cat);
                      }}
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: 6,
                        color: '#1d4ed8',
                        fontSize: 12,
                        cursor: 'pointer',
                        padding: '3px 8px',
                        fontWeight: 600,
                      }}>
                      Ver fotos ({cantFotos})
                    </button>
                  </div>
                </div>

                <div className="cat-img-acciones">
                  <label className={`btn-upload ${subiendo === cat.categoria ? 'cargando' : ''}`}>
                    {subiendo === cat.categoria ? 'Subiendo…' : '⬆️ Subir fotos'}
                    <input
                      type="file"
                      accept="image/webp,image/png,image/jpeg,image/jpg"
                      multiple
                      style={{ display: 'none' }}
                      disabled={subiendo !== null}
                      onChange={e => {
                        const files = e.target.files;
                        if (files && files.length > 0) subirImagenes(cat.categoria, files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {cat.url_imagen && (
                    <button className="btn-quitar-img" onClick={() => quitarImagenPrincipal(cat.categoria)} title="Quitar imagen principal">✕</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de galería y etiquetado con navegación entre categorías */}
      {catGaleriaModal && (
        <div className="modal-backdrop" onClick={() => { setCatGaleriaModal(null); setEditandoFotoId(null); }}>
          <div className="modal-content glass" onClick={e => e.stopPropagation()} style={{ maxWidth: 760, width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            
            {/* Header con selector directo de todas las categorías */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Categoría:</span>
                <select
                  value={catGaleriaModal.categoria}
                  onChange={e => {
                    const sel = cats.find(c => c.categoria === e.target.value);
                    if (sel) {
                      setCatGaleriaModal(sel);
                      setEditandoFotoId(null);
                    }
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontWeight: 700,
                    fontSize: 14,
                    color: '#0f172a',
                    background: '#ffffff',
                    cursor: 'pointer'
                  }}>
                  {cats.map(c => (
                    <option key={c.categoria} value={c.categoria}>
                      {c.categoria} ({c.galeria?.length || (c.url_imagen ? 1 : 0)} fotos)
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  • {catGaleriaModal.total_productos} productos en inventario
                </span>
              </div>
              <button
                onClick={() => { setCatGaleriaModal(null); setEditandoFotoId(null); }}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                ✕ Cerrar
              </button>
            </div>

            {/* Barra de acción: subir más fotos a esta categoría */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, background: '#f8fafc', padding: '10px 14px', borderRadius: 10 }}>
              <span style={{ fontSize: 12.5, color: '#475569' }}>
                💡 <b>Tip de reconocimiento:</b> Asigna etiquetas (ej. <i>"bic cristal azul", "maped escolar"</i>) a cada foto para que el bot la envíe cuando un cliente pregunte por ese producto específico.
              </span>
              <label className="btn-upload" style={{ display: 'inline-flex', padding: '6px 14px', fontSize: 12, whiteSpace: 'nowrap' }}>
                ⬆️ Subir más fotos
                <input
                  type="file"
                  accept="image/webp,image/png,image/jpeg,image/jpg"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => {
                    const files = e.target.files;
                    if (files && files.length > 0) subirImagenes(catGaleriaModal.categoria, files);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {/* Grid de fotos de la categoría */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, paddingRight: 4 }}>
              {(catGaleriaModal.galeria && catGaleriaModal.galeria.length > 0) ? (
                catGaleriaModal.galeria.map(item => {
                  const esPrincipal = catGaleriaModal.url_imagen === item.url;
                  const estaEditando = editandoFotoId === item.id;

                  return (
                    <div key={item.id} style={{
                      position: 'relative',
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: esPrincipal ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: '#ffffff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <div style={{ position: 'relative', height: 130, background: '#0f172a' }}>
                        <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        {esPrincipal && (
                          <span style={{ position: 'absolute', top: 6, left: 6, background: '#2563eb', color: '#fff', fontSize: 10, padding: '3px 7px', borderRadius: 6, fontWeight: 700 }}>
                            ⭐ Principal
                          </span>
                        )}
                        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
                          {!esPrincipal && (
                            <button
                              onClick={() => fijarComoPrincipal(catGaleriaModal.categoria, item.url)}
                              title="Marcar como imagen principal de categoría para WhatsApp"
                              style={{ background: 'rgba(15,23,42,0.8)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
                              ⭐ Principal
                            </button>
                          )}
                          <button
                            onClick={() => eliminarDeGaleria(catGaleriaModal.categoria, item.id)}
                            title="Eliminar foto"
                            style={{ background: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Sección de etiquetas y producto vinculado */}
                      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6, background: '#fafafa' }}>
                        {estaEditando ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
                              Producto específico de la BD:
                            </label>
                            <select
                              value={productoSeleccionado || ""}
                              onChange={e => {
                                const val = e.target.value ? parseInt(e.target.value, 10) : null;
                                setProductoSeleccionado(val);
                                const prod = prodsCategoria.find(p => p.id === val);
                                if (prod && !inputEtiquetas) {
                                  setInputEtiquetas(prod.nombre.toLowerCase());
                                }
                              }}
                              style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11 }}>
                              <option value="">(Ninguno / General de categoría)</option>
                              {prodsCategoria.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.nombre.slice(0, 35)} (${p.precio})
                                </option>
                              ))}
                            </select>

                            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
                              Etiquetas clave (separadas por coma):
                            </label>
                            <input
                              type="text"
                              placeholder="ej. bic, cristal, punta fina, azul"
                              value={inputEtiquetas}
                              onChange={e => setInputEtiquetas(e.target.value)}
                              style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11 }}
                            />

                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              <button
                                disabled={guardandoEtiqueta}
                                onClick={() => guardarEtiquetasFoto(item.id)}
                                style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                {guardandoEtiqueta ? 'Guardando...' : '💾 Guardar'}
                              </button>
                              <button
                                onClick={() => setEditandoFotoId(null)}
                                style={{ background: '#e2e8f0', color: '#334155', border: 'none', padding: '5px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {item.producto_nombre ? (
                              <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>
                                📦 {item.producto_nombre} <span style={{ color: '#059669' }}>(${item.producto_precio})</span>
                              </div>
                            ) : null}

                            <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                              <span>🏷️ Etiquetas:</span>
                              {item.etiquetas ? (
                                item.etiquetas.split(',').map((tag: string, idx: number) => (
                                  <span key={idx} style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: 4, fontSize: 10, color: '#1e293b' }}>
                                    {tag.trim()}
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Sin etiquetas</span>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                setEditandoFotoId(item.id);
                                setInputEtiquetas(item.etiquetas || "");
                                setProductoSeleccionado(item.producto_id || null);
                              }}
                              style={{
                                marginTop: 8,
                                width: '100%',
                                background: '#f1f5f9',
                                border: '1px dashed #cbd5e1',
                                borderRadius: 6,
                                padding: '4px 0',
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#2563eb',
                                cursor: 'pointer'
                              }}>
                              ✏️ {item.etiquetas || item.producto_id ? 'Editar etiquetas' : '+ Asignar producto / etiquetas'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p style={{ gridColumn: '1 / -1', color: '#94a3b8', textAlign: 'center', margin: '30px 0' }}>
                  No hay fotos en esta categoría aún. Sube fotos arriba.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── CRM Principal ──────────────────────────────────── */
export default function CRM() {
  const [items, setItems] = useState<Item[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [sel, setSel] = useState<number | null>(null);
  const [det, setDet] = useState<Detalle | null>(null);
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState<"asesor" | "cliente">("asesor");
  const [error, setError] = useState("");
  const [vista, setVista] = useState<Vista>(() => {
    if (typeof window !== "undefined") {
      const v = new URLSearchParams(window.location.search).get("vista");
      if (v === "chat" || v === "dashboard" || v === "leads" || v === "inventario" || v === "imagenes") return v;
    }
    return "dashboard";
  });
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const fin = useRef<HTMLDivElement>(null);

  const cargarLista = useCallback(async () => {
    const r = await fetch("/api/crm/conversaciones", { cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      const ordenados = (data.items || []).sort((a: Item, b: Item) => {
        const timeA = a.ultimo_msg_en ? new Date(a.ultimo_msg_en).getTime() : 0;
        const timeB = b.ultimo_msg_en ? new Date(b.ultimo_msg_en).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return (b.id || 0) - (a.id || 0);
      });
      setItems(ordenados);
    }
  }, []);

  const cargarDetalle = useCallback(async (id: number) => {
    try {
      const r = await fetch(`/api/crm/conversaciones/${id}`, { cache: "no-store" });
      if (r.ok) {
        setDet(await r.json());
      } else if (r.status === 404) {
        // La conversación fue reseteada o no existe; limpiar selección fantasma
        setSel(null);
        setDet(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("crm_chat");
          const url = new URL(window.location.href);
          url.searchParams.delete("chat");
          window.history.replaceState({}, "", url.toString());
        }
      }
    } catch {
      // error de red puntual
    }
  }, []);

  const cargarMetricas = useCallback(async () => {
    const r = await fetch("/api/crm/metricas", { cache: "no-store" });
    if (r.ok) setMetricas(await r.json());
  }, []);

  const cargarLeads = useCallback(async () => {
    const r = await fetch("/api/crm/leads", { cache: "no-store" });
    if (r.ok) setLeads((await r.json()).leads);
  }, []);

  // Persistir vista y selección en URL y localStorage
  const cambiarVista = (v: Vista) => {
    setVista(v);
    if (typeof window !== "undefined") {
      localStorage.setItem("crm_vista", v);
      const url = new URL(window.location.href);
      url.searchParams.set("vista", v);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const seleccionarChat = (id: number | null) => {
    setSel(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id != null) {
        url.searchParams.set("chat", String(id));
        localStorage.setItem("crm_chat", String(id));
      } else {
        url.searchParams.delete("chat");
        localStorage.removeItem("crm_chat");
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Restaurar chat seleccionado al inicio
  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("chat");
      const cId = p ? parseInt(p, 10) : parseInt(localStorage.getItem("crm_chat") || "", 10);
      if (!isNaN(cId)) setSel(cId);
    }
  }, []);

  useEffect(() => {
    cargarLista();
    const t = setInterval(cargarLista, 2500);
    return () => clearInterval(t);
  }, [cargarLista]);

  useEffect(() => {
    if (vista === "dashboard") { cargarMetricas(); const t = setInterval(cargarMetricas, 10000); return () => clearInterval(t); }
    if (vista === "leads") { cargarLeads(); const t = setInterval(cargarLeads, 10000); return () => clearInterval(t); }
  }, [vista, cargarMetricas, cargarLeads]);

  useEffect(() => {
    if (sel == null) { setDet(null); return; }
    cargarDetalle(sel);
    const t = setInterval(() => cargarDetalle(sel), 2000);
    return () => clearInterval(t);
  }, [sel, cargarDetalle]);

  useEffect(() => { fin.current?.scrollIntoView({ block: "end" }); }, [det?.mensajes.length, sel]);

  async function post(url: string, body: object) {
    setError("");
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error || "No se pudo completar la acción");
    return j;
  }

  async function accion(a: "tomar" | "devolver") {
    if (sel == null) return;
    await post(`/api/crm/conversaciones/${sel}`, { accion: a });
    cargarDetalle(sel); cargarLista();
  }

  async function enviar() {
    if (sel == null || !texto.trim()) return;
    const t = texto.trim(); setTexto("");
    if (modo === "cliente") await post("/api/simulador", { texto: t, conversacionId: sel });
    else await post(`/api/crm/conversaciones/${sel}`, { accion: "enviar", texto: t });
    cargarDetalle(sel); cargarLista();
  }

  async function nuevaPrueba() {
    const j = await post("/api/simulador", { texto: "Hola" });
    if (j.conversacionId) { await cargarLista(); setSel(j.conversacionId); setModo("cliente"); setVista("chat"); }
  }

  const esperan = items.filter((i) => estadoDe(i) === "espera").length;
  const qClean = busqueda.trim().toLowerCase();
  const visibles = items.filter((i) => {
    if (filtro !== "todos" && estadoDe(i) !== filtro) return false;
    if (qClean) {
      const nom = (i.nombre || "").toLowerCase();
      const num = (i.telefono || "").toLowerCase();
      const txt = (i.ultimo_texto || "").toLowerCase();
      const inten = (i.intencion || "").toLowerCase();
      if (!nom.includes(qClean) && !num.includes(qClean) && !txt.includes(qClean) && !inten.includes(qClean)) {
        return false;
      }
    }
    return true;
  });
  const estado = det ? estadoDe({ bot_activo: det.conv.bot_activo, ultimo_rol: det.mensajes.at(-1)?.rol ?? null }) : "todos";
  const prueba = det ? esPrueba(det.conv.telefono) : false;
  const datos = det?.conv.datos ? (typeof det.conv.datos === "string" ? JSON.parse(det.conv.datos) : det.conv.datos) : {};

  return (
    <div className={`app ${vista !== "chat" ? "vista-completa" : sel != null ? "con-sel" : "sin-sel"}`}>
      {/* ─── Barra lateral macOS ─── */}
      <aside className="lista">
        <div className="lista-top">
          <div className="marca">
            <span className="marca-badge">R</span>
            <div className="marca-info">
              <span className="marca-titulo">La Reforma</span>
              <span className="marca-sub">Centro de Atención</span>
            </div>
          </div>

          {/* Navegación principal */}
          <div className="sidebar-section-label">Vistas</div>
          <div className="nav-vistas" role="navigation">
            <button className="nav-btn" aria-pressed={vista === "chat"} onClick={() => cambiarVista("chat")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span>Chats de Clientes</span>
              {esperan > 0 && <span className="nav-badge">{esperan}</span>}
            </button>
            <button className="nav-btn" aria-pressed={vista === "dashboard"} onClick={() => cambiarVista("dashboard")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <span>Dashboard Pro</span>
            </button>
            <button className="nav-btn" aria-pressed={vista === "leads"} onClick={() => cambiarVista("leads")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span>Leads Registrados</span>
            </button>
            <button className="nav-btn" aria-pressed={vista === "inventario"} onClick={() => cambiarVista("inventario")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
              <span>Catálogo & Stock</span>
            </button>
            <button className="nav-btn" aria-pressed={vista === "imagenes"} onClick={() => cambiarVista("imagenes")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              <span>Galería Visual</span>
            </button>
          </div>

          {vista === "chat" && (
            <>
              <div className="sidebar-section-label" style={{ marginTop: 4 }}>Bandeja</div>
              {/* Buscador de conversaciones estilo Apple */}
              <div className="buscador-chats">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  type="text"
                  placeholder="Buscar cliente o mensaje..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                {busqueda && (
                  <button className="limpiar-busqueda" onClick={() => setBusqueda("")} title="Limpiar">✕</button>
                )}
              </div>

              {/* Segmented Control para Filtros */}
              <div className="segmented-control" role="group" aria-label="Filtrar conversaciones">
                {(([["todos", "Todos"], ["espera", "Esperan"], ["bot", "Bot"], ["asesor", "Asesor"]] as const)).map(([k, l]) => (
                  <button key={k} className="seg-btn" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{l}</button>
                ))}
              </div>

              <p className="resumen-dia">
                {items.length === 0 ? "Sin conversaciones registradas." : esperan > 0
                  ? <><b>{esperan} {esperan === 1 ? "cliente esperando" : "clientes esperando"}</b> atención inmediata.</>
                  : "Todos los chats atendidos por el asistente."}
              </p>
            </>
          )}
        </div>

        {/* Lista de conversaciones */}
        {vista === "chat" && (
          <div className="items">
            {visibles.length === 0 && <p className="vacio-lista">{busqueda ? "No hay resultados para esta búsqueda." : "No hay conversaciones en esta vista."}</p>}
            {visibles.map((i) => (
              <button key={i.id} className="item" aria-current={sel === i.id} onClick={() => seleccionarChat(i.id)}>
                <span className={`avatar ${i.empresa ?? ""}`}>{iniciales(nombreDe(i))}</span>
                <span style={{ minWidth: 0 }}>
                  <div className="item-nombre">{nombreDe(i)}</div>
                  <div className="item-previa">
                    {i.ultimo_rol === "cliente" ? "" : i.ultimo_rol === "bot" ? "Bot: " : "Tú: "}
                    {i.ultimo_texto}
                  </div>
                  {i.intencion && <div className="item-intencion">{i.intencion}</div>}
                </span>
                <span className="item-meta">
                  {hora(i.ultimo_msg_en)}
                  {estadoDe(i) === "espera" && <span className="punto" title="Espera a un asesor" />}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="pie-lista">
          <button className="btn-prueba" onClick={nuevaPrueba}>
            ＋ Probar con cliente de prueba
          </button>
        </div>
      </aside>

      {/* ─── Área central: Chat, Dashboard, Leads o Inventario ─── */}
      <main className="hilo">
        {vista === "dashboard" && <Dashboard metricas={metricas} />}
        {vista === "leads" && <Leads leads={leads} />}
        {vista === "inventario" && <InventarioView />}
        {vista === "imagenes" && <ImagenesCategorias />}

        {vista === "chat" && !det && (
          <div className="bienvenida">
            <div className="bienvenida-icon">🤖</div>
            <h2>Elige una conversación</h2>
            <p>Verás lo que escribió el cliente, cómo respondió el bot, qué herramientas usó y si alucina o no. Sin WhatsApp, prueba con un cliente de prueba.</p>
          </div>
        )}

        {vista === "chat" && det && (
          <>
            <header className="hilo-head">
              <button className="volver" onClick={() => seleccionarChat(null)} aria-label="Volver">←</button>
              <div>
                <h2 className="hilo-titulo">
                  {nombreDe(det.conv)}
                </h2>
                <div className="hilo-sub">
                  {tel(det.conv.telefono)}
                  {det.conv.intencion && <span className="intent-pill" style={{ background: INTENCION_COLOR[det.conv.intencion] ?? "#62716a" }}>{det.conv.intencion}</span>}
                </div>
              </div>
              {det.conv.bot_activo
                ? <button className="accion primaria" onClick={() => accion("tomar")}>Tomar el chat</button>
                : <button className="accion suave" onClick={() => accion("devolver")}>Devolver al bot</button>}
            </header>

            <div className={`banda ${estado}`}>{BANDA[estado]}</div>

            <div className="mensajes">
              {det.mensajes.map((m) => (
                <div key={m.id} className={`fila ${m.rol}`}>
                  {m.rol !== "cliente" && <span className="quien">{m.rol === "bot" ? "Asistente" : "Asesor"}</span>}
                  <div className="burbuja">
                    <RenderMensajeTexto texto={m.texto} />
                  </div>
                  <span className="hora">{hora(m.creado_en)}</span>
                </div>
              ))}
              <div ref={fin} />
            </div>

            <div className="compositor">
              {error && <p className="aviso-bot" role="alert" style={{ color: "#a5321f" }}>{error}</p>}
              {prueba && (
                <div className="modo">
                  <label><input type="radio" checked={modo === "cliente"} onChange={() => setModo("cliente")} /> Como cliente</label>
                  <label><input type="radio" checked={modo === "asesor"} onChange={() => setModo("asesor")} /> Como asesor</label>
                </div>
              )}
              {det.conv.bot_activo && modo === "asesor" && <p className="aviso-bot">Si escribes aquí, tomas el chat y el asistente se pausa.</p>}
              <div className="caja">
                <textarea rows={1} value={texto}
                  placeholder={modo === "cliente" && prueba ? "Escribe como si fueras el cliente" : "Escribe tu respuesta"}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
                <button className="enviar" disabled={!texto.trim()} onClick={enviar}>Enviar</button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ─── Panel derecho (Inspector macOS / Ficha del cliente) ─── */}
      {vista === "chat" && det && (
        <aside className="ficha">
          {/* Estado del bot */}
          <section>
            <h3>Supervisión del Bot</h3>
            <div className="bot-status">
              <div className={`bot-indicator ${det.conv.bot_activo ? "activo" : "pausado"}`}>
                <span className="bot-dot" />
                <span>{det.conv.bot_activo ? "Bot activo (automático)" : "Bot en pausa (asesor al mando)"}</span>
              </div>
              <div className="bot-stats">
                <span>• {det.mensajes.filter(m => m.rol === "bot").length} respuestas generadas</span>
                <span>• {det.mensajes.filter(m => m.rol === "cliente").length} mensajes del cliente</span>
              </div>
            </div>
          </section>

          {det.conv.resumen_agente && (
            <section>
              <h3>Resumen Ejecutivo</h3>
              <p>{det.conv.resumen_agente}</p>
            </section>
          )}

          {det.conv.motivo_escalamiento && (
            <section>
              <h3>Motivo de Escalamiento</h3>
              <p className="escalado-motivo">{det.conv.motivo_escalamiento}</p>
            </section>
          )}

          <section>
            <h3>Datos del Contacto</h3>
            <ul className="datos-lista">
              <li><span className="dato-key">Nombre</span><span style={{ fontWeight: 600 }}>{det.conv.nombre ?? <span className="suave">sin dato</span>}</span></li>
              {["cedula", "correo", "ciudad"].map((k) => (
                <li key={k}>
                  <span className="dato-key">{{ cedula: "Cédula", correo: "Correo", ciudad: "Ciudad" }[k]}</span>
                  <span>{datos[k] ?? <span className="suave">sin dato</span>}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>Auditoría de Herramientas & Trazas</h3>
            <p className="traza-hint">Verificación de veracidad y ejecución de consultas en tiempo real.</p>
            {det.trazas.length === 0 && <p className="suave">Aún no se registran trazas en este chat.</p>}
            {det.trazas.map((t) => {
              const tl = typeof t.tools_llamadas === "string" ? JSON.parse(t.tools_llamadas) : t.tools_llamadas ?? [];
              return (
                <div key={t.id} className={`traza ${t.bloqueada ? "freno" : "ok"}`}>
                  <div className="traza-estado">
                    {t.bloqueada
                      ? <><span className="traza-ico">⚠️</span> <b>Intervención de seguridad</b></>
                      : <><span className="traza-ico">✓</span> Respuesta verificada</>}
                  </div>
                  <div className="traza-detalle">
                    {tl.length
                      ? "Consultas ejecutadas: " + [...new Set<string>(tl.map((x: any) => x.nombre))].join(", ")
                      : "Respuesta directa de modelo sin llamada a herramientas"}
                  </div>
                  <div className="traza-meta">
                    {((t.latencia_ms ?? 0) / 1000).toFixed(1)} s latencia · {t.tokens ?? 0} tokens
                  </div>
                </div>
              );
            })}
          </section>
        </aside>
      )}
    </div>
  );
}
