import React from 'react';
import { useHistory } from 'react-router-dom';
import i18n from '../i18n';
import Seo from '../components/Seo';
import useAppModals from '../components/useAppModals';
import PublicNavbar from '../components/navbar/PublicNavbar';
import { FooterInner } from '../styles/public-styles/FooterStyles';

// ADR-056 Fase S5.b (rev S5.b.7): landing publica /for-studios (Opcion A)
// alineada con patron sector opaco (LiveJasmin/Stripchat/Chaturbate/BongaCams).
// NO expone tabla de tramos, umbrales EUR ni comparativa nominal contra
// competidores: todo el detalle economico vive post-login en el Dashboard
// Master. Landing solo cualitativa + CTA registro.

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

const CardsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 };
const Card = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px' };
const CardTitle = { fontSize: '1.05rem', fontWeight: 600, margin: '0 0 8px', color: '#111827' };
const CardText = { fontSize: '0.92rem', color: '#4b5563', margin: 0, lineHeight: 1.6 };

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
  const goHowItWorks = () => {
    const el = document.getElementById('how-it-works');
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
                <button type="button" style={BtnSecondary} onClick={goHowItWorks}>{t('hero.ctaSecondary')}</button>
              </div>
            </section>

            {/* COMO FUNCIONA */}
            <section id="how-it-works" style={Section}>
              <h2 style={SectionTitle}>{t('howItWorks.title')}</h2>
              <div style={CardsGrid}>
                {['step1', 'step2', 'step3'].map((k) => (
                  <div key={k} style={Card}>
                    <h3 style={CardTitle}>{t(`howItWorks.${k}.title`)}</h3>
                    <p style={CardText}>{t(`howItWorks.${k}.text`)}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* BENEFITS (bullets cualitativos, sin cifras) */}
            <section style={Section}>
              <h2 style={SectionTitle}>{t('benefits.title')}</h2>
              <div style={CardsGrid}>
                {['b1', 'b2', 'b3', 'b4'].map((k) => (
                  <div key={k} style={Card}>
                    <h3 style={CardTitle}>{t(`benefits.items.${k}.title`)}</h3>
                    <p style={CardText}>{t(`benefits.items.${k}.text`)}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* FAQ (3 preguntas operativas neutras) */}
            <section style={Section}>
              <h2 style={SectionTitle}>{t('faq.title')}</h2>
              {['q1', 'q2', 'q3'].map((k) => (
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
