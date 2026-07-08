import React, { useState } from 'react';
import i18n from '../../../../i18n';
import { apiFetch } from '../../../../config/http';
import SupportModal from './SupportModal';
import SupportButton from './SupportButton';

// Frente B.3.2 (ADR-046). Confirmacion antes de resolver la conversacion.
// Sin confirm para Liberar (reversible); si para Resolver (final).

const SupportResolveConfirmModal = ({ conversationId, onClose, onResolved }) => {
  const t = (key, opts) => i18n.t(key, opts);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setSubmitting(true);
    setErr('');
    try {
      const conv = await apiFetch(`/admin/support/conversations/${conversationId}/resolve`, {
        method: 'POST',
      });
      if (typeof onResolved === 'function') onResolved(conv);
    } catch (e) {
      setErr(e?.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SupportModal
      title={t('admin.support.modal.resolve.title')}
      subtitle={t('admin.support.modal.resolve.warning')}
      width={460}
      onClose={onClose}
      actions={(
        <>
          <SupportButton variant="secondary" onClick={onClose} disabled={submitting}>
            {t('admin.support.modal.resolve.cancel')}
          </SupportButton>
          <SupportButton variant="success" onClick={submit} disabled={submitting}>
            {submitting
              ? t('admin.support.modal.resolve.submitting')
              : t('admin.support.modal.resolve.confirm')}
          </SupportButton>
        </>
      )}
    >
      {err ? <div style={{ color: '#b91c1c', fontSize: '0.85rem' }}>{err}</div> : null}
    </SupportModal>
  );
};

export default SupportResolveConfirmModal;
