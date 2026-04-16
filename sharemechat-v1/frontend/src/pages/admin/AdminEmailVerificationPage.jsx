import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';

const cardStyle = {
  width: '100%',
  maxWidth: 560,
  background: '#fff',
  border: '1px solid #d9e2f2',
  borderRadius: 18,
  padding: '28px 26px',
  boxShadow: '0 18px 40px rgba(15, 24, 38, 0.08)',
};

const AdminEmailVerificationPage = () => {
  const t = (key, options) => i18n.t(key, options);
  const [state, setState] = useState({ loading: true, ok: false, status: 'loading' });

  const token = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('token') || '';
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!token) {
        setState({ loading: false, ok: false, status: 'tokenMissing' });
        return;
      }

      try {
        const response = await apiFetch(`/email-verification/confirm?token=${encodeURIComponent(token)}`);
        if (!cancelled) {
          const ok = Boolean(response?.ok);
          setState({
            loading: false,
            ok,
            status: ok ? 'success' : 'error',
          });
        }
      } catch {
        if (!cancelled) {
          setState({ loading: false, ok: false, status: 'error' });
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const message = state.loading
    ? t('admin.verification.loading')
    : t(`admin.verification.${state.status}`);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: 'linear-gradient(180deg, #eef3ff 0%, #f9fbff 100%)' }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#16324f' }}>{t('admin.verification.pageTitle')}</div>
        <div style={{ marginTop: 10, color: '#5f6b7a', fontSize: 14, lineHeight: 1.6 }}>
          {t('admin.verification.pageSubtitle')}
        </div>
        <div style={{
          marginTop: 18,
          padding: '14px 16px',
          borderRadius: 14,
          border: `1px solid ${state.ok ? '#bfe9ca' : '#f1c4bf'}`,
          background: state.ok ? '#ecfbf0' : '#fff1f0',
          color: state.ok ? '#166534' : '#b42318',
          lineHeight: 1.55,
        }}>
          {message}
        </div>
        <div style={{ marginTop: 18, fontSize: 13 }}>
          <Link to="/login" style={{ color: '#0f4aa8', fontWeight: 700, textDecoration: 'none' }}>
            {t('admin.verification.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminEmailVerificationPage;
