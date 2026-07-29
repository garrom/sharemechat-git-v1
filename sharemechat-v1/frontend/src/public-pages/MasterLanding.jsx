import React from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../i18n';
import Seo from '../components/Seo';
import useAppModals from '../components/useAppModals';
import PublicNavbar from '../components/navbar/PublicNavbar';
import { FooterInner } from '../styles/public-styles/FooterStyles';

// ADR-056 Fase S5.b: landing publica /for-studios (Opcion A). Captacion
// dedicada del programa Master, alineada con estandar del sector
// (LiveJasmin "Become a Studio"). No toca el flujo cliente/modelo.
// Textos via i18n forStudios.*, SEO via seo.forStudios.

const Page = { background: '#ffffff', color: '#1f2937', padding: '32px 0 72px' };
const Container = { maxWidth: 1040, margin: '0 auto', padding: '0 16px' };

const Hero = { padding: '24px 0 12px' };
const HeroEyebrow = { color: '#7c3aed', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 };
const HeroTitle = { fontSize: '2.1rem', fontWeight: 700, margin: '0 0 14px', color: '#111827', lineHeight: 1.2 };
const HeroSubtitle = { fontSize: '1.05rem', lineHeight: 1.65, color: '#4b5563', margin: '0 0 24px', maxWidth: 780 };
const CtaRow = { display: 'flex', gap: 12, flexWrap: 'wrap' };
const BtnPrimary = { appearance: 'none', border: 0, background: '#7c3aed', color: '#fff', padding: '12px 22px', borderRadius: 999, cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 };
const BtnSecondary = { appearance: 'none', background: 'transparent', color: '#7c3aed', border: '1.5px solid #7c3aed', padding: '11px 22px', borderRadius: 999, cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 };

const Section = { padding: '36px 0' };
const SectionTitle = { fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: '0 0 20px' };
const SectionSubtitle = { fontSize: '0.98rem', color: '#4b5563', margin: '0 0 24px', lineHeight: 1.6 };

const StepsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 };
const StepCard = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px' };
const StepTitle = { fontSize: '1.05rem', fontWeight: 600, margin: '0 0 8px', color: '#111827' };
const StepText = { fontSize: '0.92rem', color: '#4b5563', margin: 0, lineHeight: 1.6 };

const TableWrap = { overflowX: 'auto' };
const Table = { width: '100%', borderCollapse: 'collapse', minWidth: 520 };
const Th = { textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: '#111827', background: '#f3f4f6', fontSize: '0.9rem', borderBottom: '1px solid #e5e7eb' };
const Td = { padding: '10px 12px', color: '#374151', fontSize: '0.92rem', borderBottom: '1px solid #f3f4f6' };
const TableNote = { fontSize: '0.85rem', color: '#6b7280', marginTop: 14, lineHeight: 1.6 };

const FaqItem = { padding: '16px 0', borderBottom: '1px solid #e5e7eb' };
const FaqQuestion = { fontSize: '1rem', fontWeight: 600, color: '#111827', margin: '0 0 6px' };
const FaqAnswer = { fontSize: '0.92rem', color: '#4b5563', margin: 0, lineHeight: 1.65 };

const CtaFinal = { background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 14, padding: '28px', textAlign: 'center', margin: '30px 0 0' };
const CtaFinalTitle = { fontSize: '1.3rem', fontWeight: 700, margin: '0 0 8px', color: '#4c1d95' };
const CtaFinalText = { fontSize: '0.95rem', color: '#5b21b6', margin: '0 0 20px', lineHeight: 1.6 };

export default function MasterLanding() {
  const history = useHistory();
  const { openLoginModal } = useAppModals();

  const t = (k) => i18n.t(`forStudios.${k}`);

  const openRegister = () => openLoginModal({ initialView: 'register-master' });
  const goTiers = () => {
    const el = document.getElementById('tiers');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const goHome = () => history.push('/');

  return (
    <>
      <Seo pageKey="forStudios" urlPath="/for-studios" localeAware />
      <PublicNavbar />
      <div style={Page}>
        <FooterInner>
          <div style={Container}>

            {/* HERO */}
            <section style={Hero}>
              <div style={HeroEyebrow}>{t('hero.eyebrow')}</div>
              <h1 style={HeroTitle}>{t('hero.title')}</h1>
              <p style={HeroSubtitle}>{t('hero.subtitle')}</p>
              <div style={CtaRow}>
                <button type="button" style={BtnPrimary} onClick={openRegister}>{t('hero.ctaPrimary')}</button>
                <button type="button" style={BtnSecondary} onClick={goTiers}>{t('hero.ctaSecondary')}</button>
              </div>
            </section>

            {/* COMO FUNCIONA */}
            <section style={Section}>
              <h2 style={SectionTitle}>{t('howItWorks.title')}</h2>
              <div style={StepsGrid}>
                {['step1', 'step2', 'step3'].map((k) => (
                  <div key={k} style={StepCard}>
                    <h3 style={StepTitle}>{t(`howItWorks.${k}.title`)}</h3>
                    <p style={StepText}>{t(`howItWorks.${k}.text`)}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* TIERS */}
            <section id="tiers" style={Section}>
              <h2 style={SectionTitle}>{t('tiers.title')}</h2>
              <p style={SectionSubtitle}>{t('tiers.subtitle')}</p>
              <div style={TableWrap}>
                <table style={Table}>
                  <thead>
                    <tr>
                      <th style={Th}>{t('tiers.colVolume')}</th>
                      <th style={Th}>{t('tiers.colIndividual')}</th>
                      <th style={Th}>{t('tiers.colMaster')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['t1', 't2', 't3', 't4'].map((k) => (
                      <tr key={k}>
                        <td style={Td}>{t(`tiers.rows.${k}.range`)}</td>
                        <td style={Td}>{t(`tiers.rows.${k}.individual`)}</td>
                        <td style={Td}>{t(`tiers.rows.${k}.master`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={TableNote}>{t('tiers.note')}</p>
            </section>

            {/* COMPARATIVA */}
            <section style={Section}>
              <h2 style={SectionTitle}>{t('compare.title')}</h2>
              <div style={TableWrap}>
                <table style={Table}>
                  <thead>
                    <tr>
                      <th style={Th}>{t('compare.colFeature')}</th>
                      <th style={Th}>{t('compare.colSharemechat')}</th>
                      <th style={Th}>{t('compare.colLivejasmin')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['fees', 'tiers', 'kyc', 'payouts', 'min'].map((k) => (
                      <tr key={k}>
                        <td style={Td}>{t(`compare.rows.${k}.feature`)}</td>
                        <td style={Td}>{t(`compare.rows.${k}.sharemechat`)}</td>
                        <td style={Td}>{t(`compare.rows.${k}.livejasmin`)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* FAQ */}
            <section style={Section}>
              <h2 style={SectionTitle}>{t('faq.title')}</h2>
              {['q1', 'q2', 'q3', 'q4', 'q5'].map((k) => (
                <div key={k} style={FaqItem}>
                  <h3 style={FaqQuestion}>{t(`faq.items.${k}.q`)}</h3>
                  <p style={FaqAnswer}>{t(`faq.items.${k}.a`)}</p>
                </div>
              ))}
            </section>

            {/* CTA FINAL */}
            <section>
              <div style={CtaFinal}>
                <h2 style={CtaFinalTitle}>{t('ctaFinal.title')}</h2>
                <p style={CtaFinalText}>{t('ctaFinal.subtitle')}</p>
                <div style={{ ...CtaRow, justifyContent: 'center' }}>
                  <button type="button" style={BtnPrimary} onClick={openRegister}>{t('ctaFinal.ctaPrimary')}</button>
                  <button type="button" style={BtnSecondary} onClick={goHome}>{t('ctaFinal.ctaSecondary')}</button>
                </div>
              </div>
            </section>

          </div>
        </FooterInner>
      </div>
    </>
  );
}
