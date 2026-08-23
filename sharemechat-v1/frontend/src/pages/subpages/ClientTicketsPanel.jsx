// ADR-054 T4.2: panel "Mis incidencias" del dashboard cliente.
// Listado maestro + botón "Nueva incidencia" (abre NewTicketModal) +
// drill-down por ticket con metadatos y hilo de conversación
// (reutiliza SupportChat.jsx dentro del detalle cuando la conversación
// asociada ya está en HUMAN_HANDLING).

import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../../i18n';
import { listMyTickets, getMyTicket } from '../../api/ticketsApi';
import NewTicketModal from '../support/NewTicketModal';
import SupportChat from '../support/SupportChat';
import { SupportChatProvider } from '../../components/support/SupportChatContext';
import { useSession } from '../../components/SessionProvider';

// Iter.5 (2026-08-02) — unificación de layout con DashboardMaster
// (maxWidth 1200 + margin 0 auto). Antes quedaba alineado a la izquierda
// con vacío grande a la derecha (feedback operador).
// 2026-08-23: tratamiento claro igual que la Estadística de la modelo —
// página gris #e9ebf2 + tarjeta redondeada #f5f6fa de dos tonos, fuente del
// sistema con numerales legibles.
const FONT_STACK = "-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const pageBox = { background: '#e9ebf2', padding: '22px 18px 64px', fontFamily: FONT_STACK, minHeight: '100%', boxSizing: 'border-box' };
const cardBox = { background: '#f5f6fa', border: '1px solid #e2e5ee', borderRadius: 16, padding: '20px 22px', maxWidth: 1180, margin: '0 auto' };
const cardBoxWide = { ...cardBox, maxWidth: 1400 };
const headerRow = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 12, marginBottom: 16, flexWrap: 'wrap',
};
const title = { fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 };
const subtitle = { fontSize: 13, color: '#64748b', marginTop: 4 };
const btn = (variant = 'primary', disabled = false) => ({
  padding: '8px 16px', borderRadius: 8, border: 'none',
  background: disabled ? '#cbd5e1' : variant === 'primary' ? '#2563eb' : '#e2e8f0',
  color: disabled ? '#64748b' : variant === 'primary' ? '#ffffff' : '#334155',
  fontSize: 13, fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
});
const tableWrap = { overflowX: 'auto', WebkitOverflowScrolling: 'touch' };
const table = {
  width: '100%', borderCollapse: 'collapse', fontSize: 13,
  background: '#fff', border: '1px solid #e1e4e8', borderRadius: 8, overflow: 'hidden',
};
const th = {
  textAlign: 'left', padding: '10px 12px', background: '#f4f6f9',
  color: '#3a4152', fontWeight: 600, borderBottom: '1px solid #e1e4e8',
};
const td = { padding: '10px 12px', borderBottom: '1px solid #eef1f4', color: '#18212f' };
const trClickable = { cursor: 'pointer' };
const empty = { padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 };
const errBox = {
  padding: 12, background: '#fef2f2', borderRadius: 8, color: '#b91c1c',
  border: '1px solid #fecaca', marginBottom: 12, fontSize: 13,
};
const flagPill = {
  display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: 10,
  fontWeight: 700, background: '#f59e0b', color: '#000', marginLeft: 6,
};

const statusPillStyle = (status) => {
  const map = {
    OPEN:                                { bg: '#dbeafe', fg: '#1e40af' },
    INVESTIGATING:                       { bg: '#fef3c7', fg: '#92400e' },
    RESOLVED_COMPENSATED_PENDING_CREDIT: { bg: '#fde68a', fg: '#78350f' },
    RESOLVED_COMPENSATED:                { bg: '#bbf7d0', fg: '#14532d' },
    RESOLVED_NO_COMPENSATION:            { bg: '#e5e7eb', fg: '#374151' },
    REJECTED_INVALID:                    { bg: '#fecaca', fg: '#7f1d1d' },
    ABANDONED:                           { bg: '#e5e7eb', fg: '#6b7280' },
  };
  const c = map[status] || { bg: '#e5e7eb', fg: '#374151' };
  return {
    display: 'inline-block', padding: '2px 8px', borderRadius: 999,
    fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg,
  };
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch { return iso; }
}

// ADR-054 D8 (2026-08-06): estados en los que el ticket ya no admite
// nueva actividad conversacional. El chat queda read-only.
const RESOLVED_LIKE_STATUSES = new Set([
  'RESOLVED_COMPENSATED_PENDING_CREDIT',
  'RESOLVED_COMPENSATED',
  'RESOLVED_NO_COMPENSATION',
  'REJECTED_INVALID',
  'ABANDONED',
]);

// Split view desktop 1:2 (ficha compacta izq, chat ancho der). En pantallas
// <900px se apila. minmax(0, 1fr) para que el chat pueda encoger sin
// desbordar el grid.
const splitGrid = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr)',
  gap: 16,
  alignItems: 'start',
};

// Detalle de un ticket. Layout split view (ADR-054 D8):
// - Izquierda: ficha (categoria, estado, compensacion, descripcion, notas,
//   timeline minimo).
// - Derecha: SupportChat scoped a la conversacion vinculada al ticket
//   (pinnedConversationId), con readOnly cuando el ticket esta cerrado.
function TicketDetail({ ticket, onBack }) {
  const { user } = useSession();
  const userName = user?.nickname || user?.name || '';
  const categoryLabel = i18n.t(`support.tickets.categories.${ticket.category}`, { defaultValue: ticket.category });
  const statusLabel = i18n.t(`support.tickets.statuses.${ticket.status}`, { defaultValue: ticket.status });
  const isResolved = RESOLVED_LIKE_STATUSES.has(ticket.status);

  const [isNarrow, setIsNarrow] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth < 900 : false
  );
  React.useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div style={pageBox}>
    <div style={cardBoxWide}>
      <div style={headerRow}>
        <div>
          <h2 style={title}>{i18n.t('support.tickets.detail.title', { id: ticket.id })}</h2>
          <div style={subtitle}>{formatDate(ticket.createdAt)}</div>
        </div>
        <button type="button" style={btn('secondary')} onClick={onBack}>
          {i18n.t('support.tickets.detail.back')}
        </button>
      </div>

      <div style={isNarrow ? { display: 'flex', flexDirection: 'column', gap: 16 } : splitGrid}>
        {/* IZQUIERDA — ficha del ticket */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: '#475569', fontSize: 13 }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase' }}>
                {i18n.t('support.tickets.detail.categoryLabel')}
              </div>
              <div style={{ marginTop: 2 }}>{categoryLabel}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase' }}>
                {i18n.t('support.tickets.detail.statusLabel')}
              </div>
              <div style={{ marginTop: 4 }}><span style={statusPillStyle(ticket.status)}>{statusLabel}</span></div>
            </div>
            {ticket.compensatedAmountEur && (
              <div>
                <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase' }}>
                  {i18n.t('support.tickets.detail.compensationLabel')}
                </div>
                <div style={{ marginTop: 2 }}>{ticket.compensatedAmountEur} €</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase' }}>
                {i18n.t('support.tickets.detail.descriptionLabel')}
              </div>
              <div style={{ marginTop: 6, background: '#f1f5f9', padding: 10, borderRadius: 6, color: '#334155', whiteSpace: 'pre-wrap', fontSize: 13 }}>
                {ticket.description}
              </div>
            </div>
            {ticket.resolutionNotes && (
              <div>
                <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase' }}>
                  {i18n.t('support.tickets.detail.resolutionNotesLabel')}
                </div>
                <div style={{ marginTop: 4, color: '#334155', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                  {ticket.resolutionNotes}
                </div>
              </div>
            )}
            {(ticket.verificationLastAt || ticket.resolvedAt) && (
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', marginBottom: 6 }}>
                  {i18n.t('support.tickets.detail.timelineLabel')}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>· {i18n.t('support.tickets.detail.timelineCreated')}: {formatDate(ticket.createdAt)}</div>
                  {ticket.verificationLastAt && (
                    <div>· {i18n.t('support.tickets.detail.timelineVerified')}: {formatDate(ticket.verificationLastAt)}</div>
                  )}
                  {ticket.resolvedAt && (
                    <div>· {i18n.t('support.tickets.detail.timelineResolved')}: {formatDate(ticket.resolvedAt)}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DERECHA — conversacion scoped al ticket */}
        <div>
          <h3 style={{ fontSize: 15, color: '#0f172a', margin: '0 0 8px 0' }}>
            {i18n.t('support.tickets.detail.conversationTitle')}
          </h3>
          {ticket.linkedConversationId ? (
            <div style={{ background: '#fff', borderRadius: 10, height: isNarrow ? 480 : 560, overflow: 'hidden' }}>
              <SupportChatProvider pinnedConversationId={ticket.linkedConversationId}>
                <SupportChat
                  pinnedConversationId={ticket.linkedConversationId}
                  readOnly={isResolved}
                  ticketContext={{ ticketId: ticket.id, userName }}
                />
              </SupportChatProvider>
            </div>
          ) : (
            <div style={empty}>{i18n.t('support.tickets.detail.conversationEmpty')}</div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

export default function ClientTicketsPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const list = await listMyTickets();
      setItems(Array.isArray(list) ? list : []);
    } catch (ex) {
      setErr((ex && ex.message) || i18n.t('support.tickets.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreated = async (created) => {
    setModalOpen(false);
    // El backend ya devuelve el ticket recien creado; navegamos al detalle
    // y refrescamos el listado por consistencia (por si algun campo
    // derivado cambia).
    try {
      const fresh = await getMyTicket(created.id);
      setSelected(fresh);
    } catch { setSelected(created); }
    load();
  };

  if (selected) {
    return <TicketDetail ticket={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div style={pageBox}>
    <div style={cardBox}>
      <div style={headerRow}>
        <div>
          <h2 style={title}>{i18n.t('support.tickets.title')}</h2>
          <div style={subtitle}>{i18n.t('support.tickets.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={btn('secondary', loading)} onClick={load} disabled={loading}>
            {loading ? i18n.t('support.tickets.loading') : i18n.t('support.tickets.refresh')}
          </button>
          <button type="button" style={btn('primary')} onClick={() => setModalOpen(true)}>
            {i18n.t('support.tickets.newButton')}
          </button>
        </div>
      </div>

      {err && <div style={errBox}>{err}</div>}

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>{i18n.t('support.tickets.listHeaders.id')}</th>
              <th style={th}>{i18n.t('support.tickets.listHeaders.category')}</th>
              <th style={th}>{i18n.t('support.tickets.listHeaders.status')}</th>
              <th style={th}>{i18n.t('support.tickets.listHeaders.description')}</th>
              <th style={th}>{i18n.t('support.tickets.listHeaders.createdAt')}</th>
              <th style={th}>{i18n.t('support.tickets.listHeaders.compensated')}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr><td colSpan={6} style={empty}>{i18n.t('support.tickets.empty')}</td></tr>
            )}
            {items.map(t => (
              <tr key={t.id} style={trClickable} onClick={() => setSelected(t)}>
                <td style={td}>#{t.id}</td>
                <td style={td}>{i18n.t(`support.tickets.categories.${t.category}`, { defaultValue: t.category })}</td>
                <td style={td}>
                  <span style={statusPillStyle(t.status)}>
                    {i18n.t(`support.tickets.statuses.${t.status}`, { defaultValue: t.status })}
                  </span>
                  {t.highHistoryFlag && <span style={flagPill} title="high history">FLAG</span>}
                </td>
                <td style={td} title={t.description}>
                  {t.description && t.description.length > 60
                    ? t.description.slice(0, 60) + '…'
                    : t.description}
                </td>
                <td style={td}>{formatDate(t.createdAt)}</td>
                <td style={td}>
                  {t.compensatedAmountEur ? `${t.compensatedAmountEur} €` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NewTicketModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
    </div>
  );
}
