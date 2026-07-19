import styled from 'styled-components';

// ============================================================
// EstadisticaStyles — 2026-07-19 rediseño Fase 1
//
// Tema oscuro coherente con el dashboard del modelo (fondo negro
// GlobalBlack) usando la paleta pastel introducida en el sidebar
// admin: primary #93b5e1, business #a3d4b3, control #f4c99b,
// hot #e5a4b9, purple #c4b5fd. Base slate: #0f172a (bg), #1e293b
// (cards), #334155 (borders).
//
// AffiliatePanelModel reutiliza este mismo lenguaje visual — ambos
// paneles quedan alineados sin trabajo adicional.
// ============================================================

// -------- Paleta local (para reutilizar dentro del fichero) --------
const c = {
  bg:            '#0f172a',
  card:          '#1e293b',
  cardAlt:       '#243244',
  border:        '#334155',
  borderSoft:    'rgba(148,163,184,0.14)',
  text:          '#e2e8f0',
  textSoft:      '#cbd5e1',
  textMuted:     '#94a3b8',
  textDim:       '#64748b',

  primary:       '#93b5e1',   // azul pastel — current tier
  business:      '#a3d4b3',   // verde pastel — minutos, ganancias
  control:       '#f4c99b',   // ámbar pastel — tarifas
  hot:           '#e5a4b9',   // rosa pastel — alertas, next tier
  purple:        '#c4b5fd',   // púrpura pastel — extras

  successBg:     'rgba(163,212,179,0.14)',
  successBorder: 'rgba(163,212,179,0.32)',
  errorBg:       'rgba(229,164,185,0.14)',
  errorBorder:   'rgba(229,164,185,0.38)',
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
    radial-gradient(1200px 400px at 10% -10%, ${rgba('#93b5e1', 0.08)}, transparent 60%),
    radial-gradient(900px 500px at 100% 0%, ${rgba('#c4b5fd', 0.06)}, transparent 55%),
    ${c.bg};

  color: ${c.text};
  overflow: auto;
  border-radius: 16px;
  border: 1px solid ${c.borderSoft};

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

  background: ${rgba('#93b5e1', 0.14)};
  border: 1px solid ${rgba('#93b5e1', 0.32)};
  color: ${c.primary};
  font-size: 18px;
`;

export const Title = styled.div`
  font-size: 20px;
  font-weight: 700;
  color: #f8fafc;
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

  background: ${rgba('#a3d4b3', 0.14)};
  color: ${c.business};
  border: 1px solid ${rgba('#a3d4b3', 0.32)};
`;

// Aviso permanente (payout).
export const PayoutNotice = styled.div`
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.5;
  max-width: 360px;

  background: ${rgba('#f4c99b', 0.1)};
  color: ${c.textSoft};
  border: 1px solid ${rgba('#f4c99b', 0.28)};

  b {
    color: ${c.control};
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
    background: ${rgba('#93b5e1', 0.06)};
  }

  &[data-active="true"] {
    background: ${rgba('#93b5e1', 0.14)};
    color: ${c.primary};
    box-shadow: inset 0 0 0 1px ${rgba('#93b5e1', 0.32)};
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
  color: ${c.hot};
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
  color: #f8fafc;
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
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  transition: border-color 0.15s ease, transform 0.15s ease;

  &:hover {
    border-color: ${({ $accent }) => rgba(accentColor($accent), 0.6)};
    border-left-color: ${({ $accent }) => accentColor($accent)};
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
  color: #f8fafc;
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
    color: #f8fafc;
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
  background: ${rgba('#334155', 0.6)};
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
  background: ${rgba('#93b5e1', 0.35)};
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
  color: ${c.business};
  border: 1px solid ${c.successBorder};
`;

// ============================================================
// Tabla (tiers + snapshots history)
// ============================================================
export const TableWrap = styled.div`
  border-radius: 12px;
  border: 1px solid ${c.border};
  background: ${c.card};
  overflow-x: auto;
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
    border-bottom: 1px solid ${rgba('#334155', 0.5)};
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
    background: ${rgba('#93b5e1', 0.06)};
  }

  tbody tr.is-expandable[aria-expanded="true"] {
    background: ${rgba('#93b5e1', 0.09)};
  }

  tbody tr.tier-detail td {
    background: ${rgba('#93b5e1', 0.04)};
    color: ${c.textSoft};
    padding: 12px 20px;
    font-size: 12px;
    line-height: 1.5;
    border-top: 1px dashed ${rgba('#93b5e1', 0.25)};
  }

  td.name,
  td.hist-tier {
    font-weight: 600;
    color: #f8fafc;
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
  border: 1px dashed ${c.border};
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: center;
  align-items: center;
`;

export const PlaceholderTitle = styled.div`
  font-size: 15px;
  font-weight: 700;
  color: #f8fafc;
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
