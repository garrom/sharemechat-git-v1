import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../i18n';
import { FooterInner } from '../styles/public-styles/FooterStyles';
import Seo from '../components/Seo';
import { apiFetch } from '../config/http';

// Categorias Segpay-aligned (DEC-2 sub-paquete Complaints Opcion B).
// Deben coincidir con Constants.ComplaintCategories en backend.
const CATEGORIES = [
  'CSAM',
  'NON_CONSENSUAL',
  'MINOR_AT_RISK',
  'HATE_SYMBOLS',
  'COPYRIGHT',
  'ILLEGAL',
  'HARASSMENT',
  'IMPERSONATION',
  'FRAUD',
  'OTHER',
];

const PageWrap = { background: '#ffffff', color: '#1f2937', padding: '44px 0 72px' };
const HeroBlock = { maxWidth: '720px', margin: '0 auto' };
const Title = { margin: 0, fontSize: '1.55rem', fontWeight: 600, color: '#1f2937' };
const Intro = { marginTop: 12, marginBottom: 24, fontSize: '0.96rem', lineHeight: 1.7, color: '#4b5563' };
const Form = { display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720, margin: '0 auto' };
const Label = { fontSize: '0.9rem', fontWeight: 500, color: '#1f2937' };
const Input = {
  padding: '10px 12px', fontSize: '0.95rem', borderRadius: 8,
  border: '1px solid #d1d5db', background: '#fff', color: '#1f2937',
};
const Textarea = { ...Input, minHeight: 120, resize: 'vertical' };
const HelpText = { fontSize: '0.82rem', color: '#6b7280' };
const SubmitBtn = (busy) => ({
  padding: '12px 18px', fontSize: '0.95rem', fontWeight: 600,
  borderRadius: 999, border: '1px solid #1e3a8a',
  background: busy ? '#94a3b8' : '#1e3a8a', color: '#fff',
  cursor: busy ? 'not-allowed' : 'pointer',
});
const BackButton = {
  appearance: 'none', background: 'transparent', color: '#1e3a8a',
  border: '1px solid rgba(31,41,55,0.12)', borderRadius: 999,
  padding: '8px 14px', fontSize: '0.9rem', fontWeight: 500,
  cursor: 'pointer', marginBottom: 20,
};
const SuccessBox = {
  marginTop: 24, padding: '16px 18px', borderRadius: 12,
  background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46',
};
const ErrorBox = {
  marginTop: 16, padding: '12px 14px', borderRadius: 8,
  background: '#fef2f2', border: '1px solid #fecaca', color: '#7f1d1d',
};

export default function ComplaintForm() {
  const history = useHistory();
  const t = (key, opts) => i18n.t(key, opts);

  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [subjectEmail, setSubjectEmail] = useState('');
  const [subjectUrl, setSubjectUrl] = useState('');

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // { id, expectedResolutionAt }
  const [error, setError] = useState('');

  const handleBack = () => {
    if (window.history.length > 1) history.goBack();
    else history.push('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setDone(null);

    if (!category) {
      setError(t('complaint.public.errors.categoryRequired'));
      return;
    }
    if (!description.trim()) {
      setError(t('complaint.public.errors.descriptionRequired'));
      return;
    }

    setBusy(true);
    try {
      const body = {
        category,
        description: description.trim(),
        reporterEmail: reporterEmail.trim() || null,
        reporterName: reporterName.trim() || null,
        subjectEmail: subjectEmail.trim() || null,
        subjectUrl: subjectUrl.trim() || null,
      };
      const resp = await apiFetch('/public/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setDone(resp);
    } catch (err) {
      if (err && err.status === 429) {
        setError(t('complaint.public.errors.tooManyRequests'));
      } else if (err && err.status === 400) {
        setError(t('complaint.public.errors.badRequest'));
      } else {
        setError(t('complaint.public.errors.generic'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Seo pageKey="complaint" urlPath="/complaint" localeAware={false} />
      <div style={PageWrap}>
        <FooterInner>
          <div style={HeroBlock}>
            <button type="button" style={BackButton} onClick={handleBack}>← {t('common.back', { defaultValue: 'Back' })}</button>
            <h1 style={Title}>{t('complaint.public.title')}</h1>
            <p style={Intro}>{t('complaint.public.intro')}</p>

            {done && (
              <div style={SuccessBox}>
                <strong>{t('complaint.public.successTitle')}</strong>
                <div style={{ marginTop: 8 }}>
                  {t('complaint.public.successBody', { id: done.id })}
                </div>
              </div>
            )}

            {!done && (
              <form style={Form} onSubmit={handleSubmit}>
                <div>
                  <label style={Label}>{t('complaint.public.category')}</label>
                  <select
                    style={Input}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    <option value="">{t('complaint.public.categoryChoose')}</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{t(`complaint.public.categories.${c}`)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={Label}>{t('complaint.public.description')}</label>
                  <textarea
                    style={Textarea}
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('complaint.public.descriptionPlaceholder')}
                    required
                  />
                  <div style={HelpText}>{t('complaint.public.descriptionHelp')}</div>
                </div>

                <div>
                  <label style={Label}>{t('complaint.public.subjectUrl')}</label>
                  <input type="url" style={Input} maxLength={2000}
                    value={subjectUrl}
                    onChange={(e) => setSubjectUrl(e.target.value)}
                    placeholder="https://..." />
                  <div style={HelpText}>{t('complaint.public.subjectUrlHelp')}</div>
                </div>

                <div>
                  <label style={Label}>{t('complaint.public.subjectEmail')}</label>
                  <input type="email" style={Input} maxLength={255}
                    value={subjectEmail}
                    onChange={(e) => setSubjectEmail(e.target.value)}
                    placeholder="user@example.com" />
                </div>

                <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />

                <div>
                  <label style={Label}>{t('complaint.public.reporterEmail')}</label>
                  <input type="email" style={Input} maxLength={255}
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                    placeholder="you@example.com" />
                  <div style={HelpText}>{t('complaint.public.reporterEmailHelp')}</div>
                </div>

                <div>
                  <label style={Label}>{t('complaint.public.reporterName')}</label>
                  <input type="text" style={Input} maxLength={255}
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)} />
                </div>

                {error && <div style={ErrorBox}>{error}</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={busy} style={SubmitBtn(busy)}>
                    {busy ? t('complaint.public.submitting') : t('complaint.public.submit')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </FooterInner>
      </div>
    </>
  );
}
