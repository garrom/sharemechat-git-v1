// PerfilMaster.jsx — ADR-056 Fase S5.a.
// Página de perfil del Master: datos básicos editables + estado
// onboarding (email/KYC/contrato) informativo + link cambiar password.
// Datos de empresa (companyName/companyRegistrationNumber/companyCountry)
// son readonly por ahora — se editan en admin. Deuda futura: PATCH
// endpoint dedicado en /api/masters/me si conviene autoservicio.
import React, { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import masterApi from '../../api/masterApi';
import {
  StyledContainer,
  StyledMainContent,
  GlobalBlack,
} from '../../styles/pages-styles/VideochatStyles';
import {
  StyledNavbar,
  StyledBrand,
  NavText,
} from '../../styles/NavbarStyles';
import { NavButton } from '../../styles/ButtonStyles';
import {
  Hint,
  CenteredMain,
  OnboardingCard,
} from '../../styles/subpages/PerfilClientModelStyle';

const t = (k) => i18n.t(k);

const Section = { marginTop: 20, paddingTop: 16, borderTop: '1px solid #eee' };
const Label = { fontSize: '0.85rem', color: '#666', marginBottom: 4 };
const Input = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #ccc', fontSize: '0.95rem', color: '#000',
  boxSizing: 'border-box',
};
const InputRO = { ...Input, background: '#f5f5f5', color: '#555' };
const Field = { marginTop: 10 };
const StatusBadge = (color) => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 12,
  fontSize: '0.8rem', fontWeight: 600, background: color, color: '#fff',
});

export default function PerfilMaster() {
  const history = useHistory();
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ nickname: '', name: '', surname: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meDto, userDto] = await Promise.all([
        masterApi.getMe(),
        apiFetch('/users/me'),
      ]);
      setMe(meDto);
      setForm({
        nickname: userDto?.nickname || meDto?.nickname || '',
        name: userDto?.name || '',
        surname: userDto?.surname || '',
      });
    } catch (err) {
      setError(err?.data?.error || err?.message || t('common.networkError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (msg) setMsg('');
    if (error) setError('');
  };

  const handleSave = async () => {
    if (!me?.userId || saving) return;
    setSaving(true);
    setError('');
    setMsg('');
    try {
      await apiFetch(`/users/${me.userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: form.nickname || null,
          name: form.name || null,
          surname: form.surname || null,
        }),
      });
      setMsg(t('perfilMaster.status.saved'));
    } catch (err) {
      setError(err?.data?.message || err?.message || t('perfilMaster.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => history.push('/master');
  const handleChangePassword = () => history.push('/change-password');

  const kycBadge = (status) => {
    if (status === 'APPROVED') return <span style={StatusBadge('#0a7a2f')}>{t('perfilMaster.status.approved')}</span>;
    if (status === 'REJECTED') return <span style={StatusBadge('#b00020')}>{t('perfilMaster.status.rejected')}</span>;
    return <span style={StatusBadge('#b8860b')}>{t('perfilMaster.status.pending')}</span>;
  };
  const boolBadge = (b) => b
    ? <span style={StatusBadge('#0a7a2f')}>{t('perfilMaster.status.ok')}</span>
    : <span style={StatusBadge('#b8860b')}>{t('perfilMaster.status.pending')}</span>;

  return (
    <StyledContainer>
      <GlobalBlack />

      <StyledNavbar>
        <StyledBrand href="#" aria-label="SharemeChat" onClick={(e) => e.preventDefault()} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto' }}>
          <NavText>{t('perfilMaster.navTitle')}</NavText>
          <NavButton type="button" onClick={handleBack}>{t('perfilMaster.back')}</NavButton>
        </div>
      </StyledNavbar>

      <StyledMainContent data-tab="perfil-master">
        <CenteredMain>
          <OnboardingCard>
            <h3>{t('perfilMaster.title')}</h3>

            {loading && <p style={{ color: '#000' }}>{t('common.loading')}</p>}

            {error && <div role="alert" style={{ marginTop: 12, color: '#b00020' }}>{error}</div>}
            {msg && <div role="status" style={{ marginTop: 12, color: '#0a7a2f' }}>{msg}</div>}

            {!loading && me && (
              <>
                <div style={Section}>
                  <strong style={{ color: '#000' }}>{t('perfilMaster.sections.basic')}</strong>

                  <div style={Field}>
                    <div style={Label}>{t('perfilMaster.labels.email')}</div>
                    <input style={InputRO} value={me.email || ''} readOnly />
                  </div>

                  <div style={Field}>
                    <div style={Label}>{t('perfilMaster.labels.nickname')}</div>
                    <input style={Input} name="nickname" value={form.nickname} onChange={onChange} />
                  </div>

                  <div style={Field}>
                    <div style={Label}>{t('perfilMaster.labels.name')}</div>
                    <input style={Input} name="name" value={form.name} onChange={onChange} />
                  </div>

                  <div style={Field}>
                    <div style={Label}>{t('perfilMaster.labels.surname')}</div>
                    <input style={Input} name="surname" value={form.surname} onChange={onChange} />
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <NavButton type="button" onClick={handleSave} disabled={saving}>
                      {saving ? t('perfilMaster.actions.saving') : t('perfilMaster.actions.save')}
                    </NavButton>
                  </div>
                </div>

                <div style={Section}>
                  <strong style={{ color: '#000' }}>{t('perfilMaster.sections.company')}</strong>
                  <Hint style={{ color: '#666', fontSize: '0.85rem' }}>{t('perfilMaster.company.readOnlyHint')}</Hint>

                  <div style={Field}>
                    <div style={Label}>{t('perfilMaster.labels.companyName')}</div>
                    <input style={InputRO} value={me.companyName || t('perfilMaster.empty')} readOnly />
                  </div>

                  <div style={Field}>
                    <div style={Label}>{t('perfilMaster.labels.companyCountry')}</div>
                    <input style={InputRO} value={me.companyCountry || t('perfilMaster.empty')} readOnly />
                  </div>
                </div>

                <div style={Section}>
                  <strong style={{ color: '#000' }}>{t('perfilMaster.sections.onboarding')}</strong>

                  <div style={{ ...Field, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#000' }}>{t('perfilMaster.labels.emailVerified')}</span>
                    {boolBadge(me.emailVerified)}
                  </div>

                  <div style={{ ...Field, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#000' }}>{t('perfilMaster.labels.kyc')}</span>
                    {kycBadge(me.verificationStatus)}
                  </div>

                  <div style={{ ...Field, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#000' }}>{t('perfilMaster.labels.contract')}</span>
                    {boolBadge(me.contractAccepted)}
                  </div>
                </div>

                <div style={Section}>
                  <strong style={{ color: '#000' }}>{t('perfilMaster.sections.security')}</strong>
                  <div style={{ marginTop: 12 }}>
                    <NavButton type="button" onClick={handleChangePassword}>
                      {t('perfilMaster.actions.changePassword')}
                    </NavButton>
                  </div>
                </div>
              </>
            )}
          </OnboardingCard>
        </CenteredMain>
      </StyledMainContent>
    </StyledContainer>
  );
}
