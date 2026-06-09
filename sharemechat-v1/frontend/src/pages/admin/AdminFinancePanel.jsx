import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../../i18n';
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

const AdminFinancePanel = ({
  canRefund = false,
  showSummary = true,
  showRefunds = true,
}) => {
  const t = (key, options) => i18n.t(key, options);
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
      const [models, clients, summary] = await Promise.all([
        apiFetch('/admin/finance/top-models?limit=10'),
        apiFetch('/admin/finance/top-clients?limit=10'),
        apiFetch('/admin/finance/summary'),
      ]);

      setTopModels(Array.isArray(models) ? models : []);
      setTopClients(Array.isArray(clients) ? clients : []);
      setFinanceSummary(summary || null);
    } catch (e) {
      setFinanceError(e.message || t('admin.finance.errors.load'));
    } finally {
      setFinanceLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const handleRefund = async () => {
    if (!canRefund) return;

    setRefundError('');
    setRefundSuccess('');

    const userId = Number(refundUserId);
    const amount = Number(refundAmount);

    if (!userId || userId <= 0) {
      setRefundError(t('admin.finance.errors.invalidUserId'));
      return;
    }

    if (!amount || amount <= 0) {
      setRefundError(t('admin.finance.errors.invalidAmount'));
      return;
    }

    if (!refundReason.trim()) {
      setRefundError(t('admin.finance.errors.reasonRequired'));
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
        t('admin.finance.refund.success', {
          userId: result.userId,
          amount: result.amount,
          balance: result.newBalance,
        })
      );

      setRefundUserId('');
      setRefundAmount('');
      setRefundReason('');

      await loadFinanceData();
    } catch (e) {
      setRefundError(e.message || t('admin.finance.errors.refundApply'));
    } finally {
      setRefundLoading(false);
    }
  };

  const sectionTitle = showSummary && showRefunds
    ? t('admin.finance.title.full')
    : showSummary
      ? t('admin.finance.title.summary')
      : t('admin.finance.title.adjustments');

  return (
    <div>
      <SectionTitle>{sectionTitle}</SectionTitle>
      {financeError && <StyledError>{financeError}</StyledError>}

      <div style={{ marginBottom: 16 }}>
        <SmallBtn type="button" onClick={loadFinanceData} disabled={financeLoading || refundLoading}>
          {financeLoading ? t('admin.common.status.refreshing') : t('admin.common.buttons.refresh')}
        </SmallBtn>
      </div>

      {showSummary && (
        <>
          <CardsGrid>
            <StatCard>
              <div className="label">{t('admin.finance.cards.grossBilling.label')}</div>
              <div className="value">{financeLoading ? '...' : financeSummary?.grossBillingEUR ?? '-'}</div>
              <div className="meta">{t('admin.finance.cards.grossBilling.meta')}</div>
            </StatCard>

            <StatCard>
              <div className="label">{t('admin.finance.cards.netProfit.label')}</div>
              <div className="value">{financeLoading ? '...' : financeSummary?.netProfitEUR ?? '-'}</div>
              <div className="meta">{t('admin.finance.cards.netProfit.meta')}</div>
            </StatCard>

            <StatCard>
              <div className="label">{t('admin.finance.cards.profitPercent.label')}</div>
              <div className="value">{financeLoading ? '...' : financeSummary?.profitPercent ?? '-'}</div>
              <div className="meta">{t('admin.finance.cards.profitPercent.meta')}</div>
            </StatCard>
          </CardsGrid>

          <div style={{ marginTop: 16 }}>
            <CardsGrid>
              <StatCard>
                <div className="label">{t('admin.finance.cards.topModels.label')}</div>
                <FinanceList>
                  {(financeLoading ? [] : topModels).map((item, index) => (
                    <FinanceItem key={index}>
                      {item.nickname || item.name || item.email || t('admin.finance.cards.topModels.fallback', { id: item.modelId })} - <strong>{item.totalEarningsEUR}</strong>
                    </FinanceItem>
                  ))}
                  {!financeLoading && topModels.length === 0 && <div>{t('admin.finance.empty')}</div>}
                </FinanceList>
              </StatCard>

              <StatCard>
                <div className="label">{t('admin.finance.cards.topClients.label')}</div>
                <FinanceList>
                  {(financeLoading ? [] : topClients).map((item, index) => (
                    <FinanceItem key={index}>
                      {item.nickname || item.name || item.email || t('admin.finance.cards.topClients.fallback', { id: item.clientId })} - <strong>{item.totalPagosEUR}</strong>
                    </FinanceItem>
                  ))}
                  {!financeLoading && topClients.length === 0 && <div>{t('admin.finance.empty')}</div>}
                </FinanceList>
              </StatCard>
            </CardsGrid>
          </div>
        </>
      )}

      {showRefunds && canRefund && (
        <div style={{ marginTop: 18, width: '100%', maxWidth: 1200 }}>
          <InlinePanel>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{t('admin.finance.refund.title')}</div>
                <div style={{ fontSize: 13, color: '#6c757d', marginTop: 4 }}>
                  {t('admin.finance.refund.description')}
                </div>
              </div>
            </div>

            <PanelRow>
              <FieldBlock>
                <label>{t('admin.finance.refund.fields.userId')}</label>
                <StyledInput
                  type="number"
                  min="1"
                  value={refundUserId}
                  onChange={(e) => setRefundUserId(e.target.value)}
                  placeholder={t('admin.finance.refund.fields.userIdPlaceholder')}
                />
              </FieldBlock>

              <FieldBlock>
                <label>{t('admin.finance.refund.fields.amount')}</label>
                <StyledInput
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={t('admin.finance.refund.fields.amountPlaceholder')}
                />
              </FieldBlock>
            </PanelRow>

            <FieldBlock style={{ marginTop: 10 }}>
              <label>{t('admin.finance.refund.fields.reason')}</label>
              <StyledInput
                type="text"
                style={{ maxWidth: '100%' }}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={t('admin.finance.refund.fields.reasonPlaceholder')}
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
                {refundLoading ? t('admin.finance.refund.buttons.applying') : t('admin.finance.refund.buttons.apply')}
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
                {t('admin.finance.refund.buttons.clear')}
              </SmallBtn>
            </div>

            <div style={{ marginTop: 12, fontSize: 12, color: '#6c757d' }}>
              {t('admin.finance.refund.notes.title')}
              <br />
              {t('admin.finance.refund.notes.appliesClient')}
              <br />
              {t('admin.finance.refund.notes.ledgerEntry')}
              <br />
              {t('admin.finance.refund.notes.balanceOnly')}
            </div>
          </InlinePanel>
        </div>
      )}
    </div>
  );
};

export default AdminFinancePanel;
