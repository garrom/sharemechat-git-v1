import React, { useEffect, useMemo, useRef, useState } from 'react';
import i18n from '../../../../i18n';
import { apiFetch } from '../../../../config/http';
import SupportModal from './SupportModal';
import SupportButton from './SupportButton';

// Frente B.3.2 · fix smoke manual (ADR-046). El operador introduce EMAIL,
// no userId numerico. Reusamos GET /admin/administration/users/search?q=<email>
// (que ya existe para el AdminAdministrationPanel) para resolver el userId
// antes del POST /admin/support/profiles/{id}/grants. Boton "Asignarme a mi"
// pre-rellena el email del admin actual (caso mas comun con un unico agente).

const inputStyle = {
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontSize: '0.88rem',
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.78rem',
  color: '#475569',
  fontWeight: 600,
  marginBottom: 4,
  marginTop: 10,
};

const previewBoxStyle = {
  marginTop: 10,
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #e2e8f0',
  background: '#f8fafc',
  fontSize: '0.82rem',
  color: '#0f172a',
};

const SEARCH_DEBOUNCE_MS = 300;

const GrantAddModal = ({ profileId, currentUserEmail, onClose, onGranted }) => {
  const t = (key, opts) => i18n.t(key, opts);
  const [email, setEmail] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [searchState, setSearchState] = useState('idle'); // idle | searching | resolved | not_found | error
  const [searchError, setSearchError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const searchTimerRef = useRef(null);
  const searchTokenRef = useRef(0);

  const normalizedEmail = useMemo(() => String(email || '').trim().toLowerCase(), [email]);
  const hasSelf = typeof currentUserEmail === 'string' && currentUserEmail.trim().length > 0;

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    if (!normalizedEmail) {
      setCandidate(null);
      setSearchState('idle');
      setSearchError('');
      return;
    }
    setSearchState('searching');
    setSearchError('');
    const token = ++searchTokenRef.current;
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await apiFetch(
          `/admin/administration/users/search?q=${encodeURIComponent(normalizedEmail)}&limit=5`
        );
        if (token !== searchTokenRef.current) return;
        const list = Array.isArray(results) ? results : [];
        const exact = list.find(
          (u) => String(u?.email || '').trim().toLowerCase() === normalizedEmail
        );
        if (exact) {
          setCandidate(exact);
          setSearchState('resolved');
        } else if (list.length === 0) {
          setCandidate(null);
          setSearchState('not_found');
        } else {
          // Sin match exacto pero hay resultados parciales. Tomamos el primero
          // solo como sugerencia visual, sin permitir submit hasta match exacto.
          setCandidate(list[0]);
          setSearchState('not_found');
        }
      } catch (e) {
        if (token !== searchTokenRef.current) return;
        setCandidate(null);
        setSearchState('error');
        setSearchError(e?.message || t('admin.support.grants.form.errorSearch'));
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [normalizedEmail]);

  const fillSelf = () => {
    if (hasSelf) setEmail(currentUserEmail);
  };

  const canSubmit = searchState === 'resolved' && candidate && Number.isFinite(candidate.userId);

  const submit = async () => {
    if (!canSubmit) {
      setErr(t('admin.support.grants.form.errorNoMatch'));
      return;
    }
    setSubmitting(true);
    setErr('');
    try {
      const grant = await apiFetch(`/admin/support/profiles/${profileId}/grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: candidate.userId }),
      });
      if (typeof onGranted === 'function') onGranted(grant);
    } catch (e) {
      setErr(e?.message || 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SupportModal
      title={t('admin.support.grants.add.title')}
      subtitle={t('admin.support.grants.add.subtitle')}
      width={480}
      onClose={onClose}
      actions={(
        <>
          <SupportButton variant="secondary" onClick={onClose} disabled={submitting}>
            {t('admin.support.grants.form.cancel')}
          </SupportButton>
          <SupportButton
            variant="primary"
            onClick={submit}
            disabled={submitting || !canSubmit}
          >
            {submitting
              ? t('admin.support.grants.form.submitting')
              : t('admin.support.grants.add.confirm')}
          </SupportButton>
        </>
      )}
    >
      {hasSelf ? (
        <div style={{ marginBottom: 6 }}>
          <SupportButton
            variant="secondary"
            onClick={fillSelf}
            disabled={submitting}
            title={currentUserEmail}
          >
            {t('admin.support.grants.form.assignSelf')}
          </SupportButton>
        </div>
      ) : null}

      <label style={labelStyle}>{t('admin.support.grants.form.emailLabel')}</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('admin.support.grants.form.emailPlaceholder')}
        style={inputStyle}
        autoFocus
        autoComplete="off"
        spellCheck={false}
      />

      {searchState === 'searching' ? (
        <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#64748b' }}>
          {t('admin.support.grants.form.searching')}
        </div>
      ) : null}

      {searchState === 'resolved' && candidate ? (
        <div style={previewBoxStyle}>
          <div style={{ fontWeight: 600 }}>{candidate.email}</div>
          <div style={{ color: '#475569', marginTop: 2 }}>
            {t('admin.support.grants.form.resolvedInfo', {
              userId: candidate.userId,
              nickname: candidate.nickname || '—',
            })}
          </div>
        </div>
      ) : null}

      {searchState === 'not_found' && normalizedEmail ? (
        <div style={{ marginTop: 6, fontSize: '0.82rem', color: '#b91c1c' }}>
          {t('admin.support.grants.form.notFound')}
        </div>
      ) : null}

      {searchState === 'error' ? (
        <div style={{ marginTop: 6, fontSize: '0.82rem', color: '#b91c1c' }}>
          {searchError || t('admin.support.grants.form.errorSearch')}
        </div>
      ) : null}

      {err ? (
        <div style={{ color: '#b91c1c', fontSize: '0.82rem', marginTop: 8 }}>{err}</div>
      ) : null}
    </SupportModal>
  );
};

export default GrantAddModal;
