import styled from 'styled-components';

// ============================================================
// EstadisticaStyles — 2026-07-19 rediseño Fase 1 iter.2
//
// Tema CLARO con acentos pastel para el panel de Estadísticas del
// modelo. Contrasta con el navbar negro (GlobalBlack) del dashboard
// creando una zona "documental" clara donde vive el contenido —
// mismo patrón que las apps financieras (Revolut, Wise, Stripe
// dashboard).
//
// Paleta pastel mantiene continuidad con sidebar admin: primary
// #93b5e1, business #a3d4b3, control #f4c99b, hot #e5a4b9, purple
// #c4b5fd. Sobre fondo claro se usan tanto las variantes pastel
// (para fondos/bordes suaves) como versiones más saturadas para
// texto/iconos que necesitan contraste sobre blanco.
//
// AffiliatePanelModel reutiliza este mismo lenguaje visual — ambos
// paneles quedan alineados sin trabajo adicional.
// ============================================================

// -------- Paleta local (para reutilizar dentro del fichero) --------
const c = {
  bg:            '#f1f5f9',   // slate 100 — fondo Wrap
  bgAlt:         '#e2e8f0',   // slate 200 — accent zones
  card:          '#ffffff',   // blanco puro — cards
  cardAlt:       '#f8fafc',   // slate 50 — thead tabla
  border:        '#e2e8f0',   // slate 200 — bordes card
  borderSoft:    'rgba(15,23,42,0.06)',
  text:          '#0f172a',   // slate 900 — texto principal
  textSoft:      '#334155',   // slate 700 — texto secundario
  textMuted:     '#64748b',   // slate 500 — labels, meta
  textDim:       '#94a3b8',   // slate 400 — hints

  primary:       '#93b5e1',   // azul pastel — fondos/bordes
  primaryText:   '#2563eb',   // azul saturado — texto/icono sobre blanco
  business:      '#a3d4b3',   // verde pastel — fondos
  businessText:  '#059669',   // verde saturado — texto
  control:       '#f4c99b',   // ámbar pastel — fondos
  controlText:   '#d97706',   // ámbar saturado — texto
  hot:           '#e5a4b9',   // rosa pastel — fondos
  hotText:       '#e11d48',   // rosa saturado — texto
  purple:        '#c4b5fd',   // púrpura pastel — fondos
  purpleText:    '#7c3aed',   // púrpura saturado — texto

  successBg:     'rgba(163,212,179,0.20)',
  successBorder: 'rgba(163,212,179,0.55)',
  errorBg:       'rgba(229,164,185,0.16)',
  errorBorder:   'rgba(229,164,185,0.55)',
};

// Utilidad: rgb() del hex para overlays translúcidos.
const rgba = (hex, a) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// Mapeo del prop $accent de MiniCard → color pastel.
const accentColor = (name) => {
  switch (name) {
    case 'blue':   return c.primary;
    case 'green':  return c.business;
    case 'amber':  return c.control;
    case 'purple': return c.purple;
    case 'pink':   return c.hot;
    default:       return c.textMuted;
  }
};

// ============================================================
// Wrap — contenedor raíz del panel
// ============================================================
export const Wrap = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding: 20px 22px 32px;
  display: flex;
  flex-direction: column;
  gap: 18px;

  background:
    radial-gradient(1000px 400px at 5% -10%, ${rgba('#93b5e1', 0.14)}, transparent 55%),
    radial-gradient(800px 500px at 100% 0%, ${rgba('#c4b5fd', 0.12)}, transparent 50%),
    ${c.bg};

  color: ${c.text};
  overflow: auto;
  border-radius: 16px;
  border: 1px solid ${c.borderSoft};
  box-shadow: 0 2px 20px rgba(15,23,42,0.06);

  @media (max-width: 768px) {
    padding: 14px 14px 28px;
    border-radius: 12px;
  }
`;

// ============================================================
// TopBar — cabecera con icono, título y controles a la derecha
// ============================================================
export const TopBar = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
`;

export const TopLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
`;

export const TopIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  background: ${rgba('#93b5e1', 0.20)};
  border: 1px solid ${rgba('#93b5e1', 0.45)};
  color: ${c.primaryText};
  font-size: 18px;
`;

export const Title = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: ${c.text};
  letter-spacing: 0.2px;
  line-height: 1.1;
`;

export const SubTitle = styled.div`
  margin-top: 4px;
  font-size: 13px;
  color: ${c.textMuted};
  line-height: 1.45;
`;

export const TopRight = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
  flex-wrap: wrap;
`;

// ============================================================
// Filtros de la cabecera
// ============================================================
export const Filters = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const FilterLabel = styled.span`
  color: ${c.textSoft};
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

export const Select = styled.select`
  height: 38px;
  border-radius: 10px;
  padding: 0 12px;

  border: 1px solid ${c.border};
  background: ${c.card};
  color: ${c.text};
  outline: none;
  font-size: 13px;
  font-weight: 600;

  &:hover {
    border-color: ${rgba('#93b5e1', 0.6)};
  }

  &:focus {
    box-shadow: 0 0 0 3px ${rgba('#93b5e1', 0.22)};
    border-color: ${c.primary};
  }

  option {
    background: ${c.card};
    color: ${c.text};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const ReloadBtn = styled.button`
  height: 38px;
  border-radius: 10px;
  padding: 0 16px;

  border: 1px solid ${rgba('#93b5e1', 0.4)};
  background: transparent;
  color: ${c.primary};
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover {
    background: ${rgba('#93b5e1', 0.1)};
    border-color: ${c.primary};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

// Pill informativa (nº de snapshots disponibles).
export const AvailabilityPill = styled.div`
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;

  background: ${rgba('#a3d4b3', 0.22)};
  color: ${c.businessText};
  border: 1px solid ${rgba('#a3d4b3', 0.55)};
`;

// Aviso permanente (payout).
export const PayoutNotice = styled.div`
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.5;
  max-width: 360px;

  background: ${rgba('#f4c99b', 0.18)};
  color: ${c.textSoft};
  border: 1px solid ${rgba('#f4c99b', 0.55)};

  b {
    color: ${c.controlText};
    font-weight: 700;
  }
`;

// ============================================================
// Tabs — Progress / History / Billing
// ============================================================
export const TabsBar = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  background: ${c.card};
  border: 1px solid ${c.border};
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
  align-self: flex-start;
  flex-wrap: wrap;
`;

export const TabButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: ${c.textMuted};
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.15s ease, color 0.15s ease;

  svg {
    font-size: 12px;
  }

  &:hover {
    color: ${c.textSoft};
    background: ${rgba('#93b5e1', 0.12)};
  }

  &[data-active="true"] {
    background: ${rgba('#93b5e1', 0.22)};
    color: ${c.primaryText};
    box-shadow: inset 0 0 0 1px ${rgba('#93b5e1', 0.55)};
  }
`;

// ============================================================
// Estado / errores
// ============================================================
export const StateLine = styled.div`
  padding: 14px 18px;
  border-radius: 10px;
  background: ${c.card};
  color: ${c.textMuted};
  border: 1px solid ${c.border};
  font-size: 13px;
`;

export const ErrorLine = styled.div`
  padding: 14px 18px;
  border-radius: 10px;
  background: ${c.errorBg};
  color: ${c.hotText};
  border: 1px solid ${c.errorBorder};
  font-size: 13px;
  font-weight: 500;
`;

// ============================================================
// Sección + cabecera de sección
// ============================================================
export const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const SectionHead = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const SectionTitle = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${c.text};
  letter-spacing: 0.1px;
`;

export const SectionHint = styled.div`
  font-size: 12px;
  color: ${c.textMuted};
  line-height: 1.5;
`;

// ============================================================
// Grid de mini-cards (KPIs)
// ============================================================
export const GridCards = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));

  @media (max-width: 480px) {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
`;

export const MiniCard = styled.div`
  padding: 14px 16px;
  border-radius: 12px;
  background: ${c.card};
  border: 1px solid ${c.border};
  border-left: 3px solid ${({ $accent }) => accentColor($accent)};
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: ${({ $accent }) => rgba(accentColor($accent), 0.7)};
    border-left-color: ${({ $accent }) => accentColor($accent)};
    box-shadow: 0 2px 8px rgba(15,23,42,0.08);
  }
`;

export const MiniLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${c.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

export const MiniValue = styled.div`
  font-size: 22px;
  font-weight: 700;
  color: ${c.text};
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  word-break: break-word;
`;

export const MiniMeta = styled.div`
  font-size: 11px;
  color: ${c.textMuted};
  line-height: 1.4;
`;

// ============================================================
// Progress hacia siguiente tier
// ============================================================
export const ProgressCard = styled.div`
  padding: 18px;
  border-radius: 14px;
  background: ${c.card};
  border: 1px solid ${c.border};
  box-shadow: 0 1px 3px rgba(15,23,42,0.05);
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

export const ProgressRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
`;

export const ProgressCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const KpiTitle = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${c.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
`;

export const KpiLine = styled.div`
  font-size: 13px;
  color: ${c.textSoft};
  line-height: 1.5;

  b {
    color: ${c.text};
    font-weight: 700;
  }
`;

// Barra de progreso.
export const BarWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

export const BarTrack = styled.div`
  position: relative;
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: ${c.bgAlt};
  overflow: hidden;
`;

export const BarFill = styled.div`
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: linear-gradient(90deg, ${c.business} 0%, ${c.primary} 100%);
  transition: width 0.35s ease;
`;

export const BarGlow = styled.div`
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  background: ${rgba('#93b5e1', 0.28)};
  filter: blur(6px);
  transition: width 0.35s ease;
  pointer-events: none;
`;

export const BarLegend = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: ${c.textMuted};
  font-weight: 500;
`;

export const SuccessPill = styled.div`
  align-self: flex-start;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: ${c.successBg};
  color: ${c.businessText};
  border: 1px solid ${c.successBorder};
`;

// ============================================================
// Tabla (tiers + snapshots history)
// ============================================================
export const TableWrap = styled.div`
  border-radius: 12px;
  border: 1px solid ${c.border};
  background: ${c.card};
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  color: ${c.text};

  thead {
    background: ${c.cardAlt};
  }

  thead th {
    padding: 10px 14px;
    text-align: left;
    font-weight: 600;
    color: ${c.textSoft};
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid ${c.border};
    white-space: nowrap;
  }

  tbody td {
    padding: 12px 14px;
    border-bottom: 1px solid ${c.border};
    color: ${c.text};
    vertical-align: middle;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr.is-expandable {
    cursor: pointer;
    transition: background 0.12s ease;
  }

  tbody tr.is-expandable:hover {
    background: ${rgba('#93b5e1', 0.10)};
  }

  tbody tr.is-expandable[aria-expanded="true"] {
    background: ${rgba('#93b5e1', 0.16)};
  }

  tbody tr.tier-detail td {
    background: ${rgba('#93b5e1', 0.06)};
    color: ${c.textSoft};
    padding: 12px 20px;
    font-size: 12px;
    line-height: 1.5;
    border-top: 1px dashed ${rgba('#93b5e1', 0.45)};
  }

  td.name,
  td.hist-tier {
    font-weight: 600;
    color: ${c.text};
  }

  td.hist-date {
    color: ${c.textMuted};
    font-variant-numeric: tabular-nums;
  }
`;

// ============================================================
// Placeholder (tab Billing "coming soon")
// ============================================================
export const Placeholder = styled.div`
  padding: 28px 22px;
  border-radius: 12px;
  background: ${c.card};
  border: 1px dashed ${c.borderSoft};
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: center;
  align-items: center;
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
`;

export const PlaceholderTitle = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: ${c.text};
`;

export const PlaceholderText = styled.div`
  font-size: 13px;
  color: ${c.textMuted};
  line-height: 1.55;
  max-width: 480px;
`;

// ============================================================
// Detalle expandido de tier
// ============================================================
export const TierNameCell = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`;

export const TierExpandIcon = styled.span`
  display: inline-flex;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  color: ${c.textMuted};
  font-size: 10px;
`;

export const TierDetailText = styled.div`
  color: ${c.textSoft};
`;
