import React, { useEffect, useState } from 'react';
import {
  CardsGrid,
  FinanceItem,
  FinanceList,
  NoteCard,
  SectionTitle,
  StatCard,
  StyledError,
} from '../../styles/AdminStyles';

const AdminFinancePanel = () => {
  const [topModels, setTopModels] = useState([]);
  const [topClients, setTopClients] = useState([]);
  const [financeSummary, setFinanceSummary] = useState(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState('');

  useEffect(() => {
    (async () => {
      setFinanceLoading(true);
      setFinanceError('');
      try {
        const [mRes, cRes, sRes] = await Promise.all([
          fetch('/api/admin/finance/top-models?limit=10', { credentials: 'include' }),
          fetch('/api/admin/finance/top-clients?limit=10', { credentials: 'include' }),
          fetch('/api/admin/finance/summary', { credentials: 'include' }),
        ]);
        if (!mRes.ok || !cRes.ok || !sRes.ok) throw new Error('Error al cargar análisis financieros');
        const [m, c, s] = await Promise.all([mRes.json(), cRes.json(), sRes.json()]);
        setTopModels(Array.isArray(m) ? m : []);
        setTopClients(Array.isArray(c) ? c : []);
        setFinanceSummary(s || null);
      } catch (e) {
        setFinanceError(e.message || 'Error al cargar análisis financieros');
      } finally {
        setFinanceLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <SectionTitle>Análisis financieros</SectionTitle>
      {financeError && <StyledError>{financeError}</StyledError>}

      <CardsGrid>
        <StatCard>
          <div className="label">Ganancias brutas (facturación total)</div>
          <div className="value">{financeLoading ? '…' : financeSummary?.grossBillingEUR ?? '—'}</div>
          <div className="meta">Sin descontar participación de modelos.</div>
        </StatCard>

        <StatCard>
          <div className="label">Ganancias netas (plataforma)</div>
          <div className="value">{financeLoading ? '…' : financeSummary?.netProfitEUR ?? '—'}</div>
          <div className="meta">Descontado lo que se lleva la modelo.</div>
        </StatCard>

        <StatCard>
          <div className="label">% beneficio / facturación</div>
          <div className="value">{financeLoading ? '…' : financeSummary?.profitPercent ?? '—'}</div>
          <div className="meta">(neto / bruto) × 100</div>
        </StatCard>

        <StatCard>
          <div className="label">Top 10 modelos por ingresos</div>
          <FinanceList>
            {(financeLoading ? [] : topModels).map((it, i) => (
              <FinanceItem key={i}>
                {it.nickname || it.name || it.email || `Modelo #${it.modelId}`} — <strong>{it.totalEarningsEUR}</strong>
              </FinanceItem>
            ))}
            {!financeLoading && topModels.length === 0 && <div>Sin datos.</div>}
          </FinanceList>
        </StatCard>

        <StatCard>
          <div className="label">Top 10 clientes por pagos</div>
          <FinanceList>
            {(financeLoading ? [] : topClients).map((it, i) => (
              <FinanceItem key={i}>
                {it.nickname || it.name || it.email || `Cliente #${it.clientId}`} — <strong>{it.totalPagosEUR}</strong>
              </FinanceItem>
            ))}
            {!financeLoading && topClients.length === 0 && <div>Sin datos.</div>}
          </FinanceList>
        </StatCard>

        <NoteCard $muted>
          <div className="label">Nota</div>
          <div className="meta">
            Pendiente: Separar ganacia Streaming y Regalos; mostrar nº usuarios modelo/cliente y nº clientes/modelos
          </div>
        </NoteCard>

        {Array.from({ length: 6 }).map((_, i) => (
          <NoteCard key={i}>
            <div className="label">KPI futura</div>
            <div className="value">—</div>
          </NoteCard>
        ))}
      </CardsGrid>
    </div>
  );
};

export default AdminFinancePanel;
