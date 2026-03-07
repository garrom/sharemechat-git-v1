import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../config/http';
import {
  CardsGrid,
  FieldBlock,
  FinanceItem,
  FinanceList,
  InlinePanel,
  PanelRow,
  SectionTitle,
  SmallBtn,
  StatCard,
  StyledButton,
  StyledError,
  StyledInput,
} from '../../styles/AdminStyles';

const AdminFinancePanel = () => {
  const [topModels, setTopModels] = useState([]);
  const [topClients, setTopClients] = useState([]);
  const [financeSummary, setFinanceSummary] = useState(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState('');

  const [refundUserId, setRefundUserId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState('');
  const [refundSuccess, setRefundSuccess] = useState('');

  const loadFinanceData = useCallback(async () => {
    setFinanceLoading(true);
    setFinanceError('');
    try {
      const [m, c, s] = await Promise.all([
        apiFetch('/admin/finance/top-models?limit=10'),
        apiFetch('/admin/finance/top-clients?limit=10'),
        apiFetch('/admin/finance/summary'),
      ]);

      setTopModels(Array.isArray(m) ? m : []);
      setTopClients(Array.isArray(c) ? c : []);
      setFinanceSummary(s || null);
    } catch (e) {
      setFinanceError(e.message || 'Error al cargar análisis financieros');
    } finally {
      setFinanceLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const handleRefund = async () => {
    setRefundError('');
    setRefundSuccess('');

    const userId = Number(refundUserId);
    const amount = Number(refundAmount);

    if (!userId || userId <= 0) {
      setRefundError('User ID inválido');
      return;
    }

    if (!amount || amount <= 0) {
      setRefundError('Amount inválido');
      return;
    }

    if (!refundReason.trim()) {
      setRefundError('Reason es obligatoria');
      return;
    }

    setRefundLoading(true);
    try {
      const result = await apiFetch(`/admin/finance/refund/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          operationType: 'MANUAL_REFUND',
          description: refundReason.trim(),
        }),
      });

      setRefundSuccess(
        `Refund aplicado correctamente. User #${result.userId} · Amount ${result.amount} · New balance ${result.newBalance}`
      );

      setRefundUserId('');
      setRefundAmount('');
      setRefundReason('');

      await loadFinanceData();
    } catch (e) {
      setRefundError(e.message || 'Error aplicando refund manual');
    } finally {
      setRefundLoading(false);
    }
  };

  return (
    <div>
      <SectionTitle>Finance Ops</SectionTitle>
      {financeError && <StyledError>{financeError}</StyledError>}

      <CardsGrid>
        <StatCard>
          <div className="label">Ganancias brutas</div>
          <div className="value">{financeLoading ? '…' : financeSummary?.grossBillingEUR ?? '—'}</div>
          <div className="meta">Facturación total antes de reparto a modelos.</div>
        </StatCard>

        <StatCard>
          <div className="label">Ganancias netas plataforma</div>
          <div className="value">{financeLoading ? '…' : financeSummary?.netProfitEUR ?? '—'}</div>
          <div className="meta">Margen neto acumulado de la plataforma.</div>
        </StatCard>

        <StatCard>
          <div className="label">% beneficio / facturación</div>
          <div className="value">{financeLoading ? '…' : financeSummary?.profitPercent ?? '—'}</div>
          <div className="meta">Ratio neto sobre bruto.</div>
        </StatCard>
      </CardsGrid>

      <div style={{ marginTop: 16 }}>
        <CardsGrid>
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
        </CardsGrid>
      </div>

      <div style={{ marginTop: 18, width: '100%', maxWidth: 1200 }}>
        <InlinePanel>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Refund manual</div>
              <div style={{ fontSize: 13, color: '#6c757d', marginTop: 4 }}>
                Devuelve saldo directamente a un CLIENT mediante una operación ledger manual.
              </div>
            </div>

            <div>
              <SmallBtn type="button" onClick={loadFinanceData} disabled={financeLoading || refundLoading}>
                {financeLoading ? 'Actualizando...' : 'Refrescar panel'}
              </SmallBtn>
            </div>
          </div>

          <PanelRow>
            <FieldBlock>
              <label>User ID (CLIENT)</label>
              <StyledInput
                type="number"
                min="1"
                value={refundUserId}
                onChange={(e) => setRefundUserId(e.target.value)}
                placeholder="Ej: 68"
              />
            </FieldBlock>

            <FieldBlock>
              <label>Amount (€)</label>
              <StyledInput
                type="number"
                min="0.01"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="Ej: 3.00"
              />
            </FieldBlock>
          </PanelRow>

          <FieldBlock style={{ marginTop: 10 }}>
            <label>Reason</label>
            <StyledInput
              type="text"
              style={{ maxWidth: '100%' }}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Ej: Compensación manual por incidencia en stream"
            />
          </FieldBlock>

          {refundError && <StyledError style={{ marginTop: 10 }}>{refundError}</StyledError>}

          {refundSuccess && (
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 8,
                background: '#d4edda',
                color: '#155724',
                fontSize: 14,
              }}
            >
              {refundSuccess}
            </div>
          )}

          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StyledButton type="button" onClick={handleRefund} disabled={refundLoading}>
              {refundLoading ? 'Aplicando refund...' : 'Aplicar refund'}
            </StyledButton>

            <SmallBtn
              type="button"
              onClick={() => {
                setRefundUserId('');
                setRefundAmount('');
                setRefundReason('');
                setRefundError('');
                setRefundSuccess('');
              }}
              disabled={refundLoading}
            >
              Limpiar
            </SmallBtn>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: '#6c757d' }}>
            Notas:
            <br />
            - Solo aplica a usuarios con rol CLIENT.
            <br />
            - No modifica transacciones previas; crea una nueva transacción ledger de tipo MANUAL_REFUND.
            <br />
            - No incrementa totalPagos; solo devuelve saldo disponible.
          </div>
        </InlinePanel>
      </div>
    </div>
  );
};

export default AdminFinancePanel;