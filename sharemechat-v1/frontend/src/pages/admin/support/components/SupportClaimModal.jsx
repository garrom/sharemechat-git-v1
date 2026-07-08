import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import i18n from '../../../../i18n';
import { apiFetch } from '../../../../config/http';
import SupportModal from './SupportModal';
import SupportButton from './SupportButton';

// Frente B.3.2 (ADR-046). Modal selector de profile al reclamar una conv.
// Consume GET /api/admin/support/profiles/mine. Siempre visible incluso con 1
// profile activa (decision del brief: fricción intencional + auditabilidad).

const ProfileCard = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 2px solid ${(p) => (p.$selected ? '#1e3a8a' : '#e5e7eb')};
  background: ${(p) => (p.$selected ? '#eff6ff' : '#fff')};
  cursor: pointer;
  text-align: left;
  transition: background 100ms ease, border-color 100ms ease;
  margin-bottom: 8px;

  &:hover { border-color: #93c5fd; }
`;

const LeftBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const NameLine = styled.div`
  font-weight: 700;
  font-size: 0.95rem;
  color: #0f172a;
`;

const CategoryChip = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 0.7rem;
  font-weight: 600;
  width: fit-content;
`;

const Badge = styled.span`
  background: #f1f5f9;
  color: #475569;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
`;

const EmptyState = styled.div`
  padding: 12px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 8px;
  color: #78350f;
  font-size: 0.88rem;
`;

const ErrorLine = styled.div`
  color: #b91c1c;
  font-size: 0.82rem;
  margin: 4px 0 8px;
`;

const SupportClaimModal = ({ conversationId, onClose, onClaimed }) => {
  const t = (key, opts) => i18n.t(key, opts);
  const [profiles, setProfiles] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch('/admin/support/profiles/mine')
      .then((data) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : [];
        setProfiles(arr);
        if (arr.length === 1) setSelectedId(arr[0].id);
        setErr('');
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e?.message || 'Error');
        setProfiles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const submit = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setErr('');
    try {
      const conv = await apiFetch(`/admin/support/conversations/${conversationId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: selectedId }),
      });
      if (typeof onClaimed === 'function') onClaimed(conv);
    } catch (e) {
      setErr(e?.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const isEmpty = profiles !== null && profiles.length === 0 && !loading;

  return (
    <SupportModal
      title={t('admin.support.modal.claim.title')}
      subtitle={t('admin.support.modal.claim.subtitle')}
      width={520}
      onClose={onClose}
      actions={(
        <>
          <SupportButton variant="secondary" onClick={onClose} disabled={submitting}>
            {t('admin.support.modal.claim.cancel')}
          </SupportButton>
          <SupportButton
            variant="primary"
            onClick={submit}
            disabled={submitting || !selectedId || isEmpty}
          >
            {submitting
              ? t('admin.support.modal.claim.submitting')
              : t('admin.support.modal.claim.confirm')}
          </SupportButton>
        </>
      )}
    >
      {loading ? (
        <div style={{ padding: 12, color: '#475569' }}>{t('admin.support.common.loading')}</div>
      ) : null}
      {err ? <ErrorLine>{err}</ErrorLine> : null}
      {isEmpty ? (
        <EmptyState>{t('admin.support.modal.claim.empty')}</EmptyState>
      ) : null}
      {!loading && !isEmpty && Array.isArray(profiles) ? (
        <div>
          {profiles.map((p) => (
            <ProfileCard
              key={p.id}
              type="button"
              $selected={selectedId === p.id}
              onClick={() => setSelectedId(p.id)}
            >
              <LeftBlock>
                <NameLine>{p.displayName}</NameLine>
                {p.category ? <CategoryChip>{p.category}</CategoryChip> : null}
              </LeftBlock>
              <Badge>
                {t('admin.support.modal.claim.activeConversations', {
                  count: Number(p.activeConversations) || 0,
                })}
              </Badge>
            </ProfileCard>
          ))}
        </div>
      ) : null}
    </SupportModal>
  );
};

export default SupportClaimModal;
