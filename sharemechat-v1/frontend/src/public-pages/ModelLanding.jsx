import React from 'react';
import { useHistory } from 'react-router-dom';
import styled from 'styled-components';
import i18n from '../i18n';
import Seo from '../components/Seo';
import useAppModals from '../components/useAppModals';
import PublicNavbar from '../components/navbar/PublicNavbar';
import { ASSETS_BASE } from '../config/runtimeEnv';

// Landing publica de captacion de MODELOS (Opcion B). Entrada propia de
// registro: su CTA abre directo el flujo register-model (sin selector
// hombre/mujer). Copy cualitativo, SIN cifras (reparto/tramos/precio se
// explican de forma general). Foto diferenciadora servida desde el CDN de
// assets por entorno (ASSETS_BASE), prefijo /models.

const HERO_IMG = `${ASSETS_BASE}/models/chica-corazon.png`;

// Un unico styled wrapper con el CSS de la landing (patron de porte de
// una pieza HTML/CSS). Tema claro editorial (vino + oro), coherente con
// el resto de paginas publicas.
const Wrap = styled.div`
  --ground:#FBF7F2; --panel:#FFFFFF; --ink:#241019; --muted:#8B7B81;
  --line:#E8DCD4; --wine:#8E2A44; --wine-soft:#B65068; --gold:#B0803A;
  --plum:#3E2130; --ground-2:#F4EBE3; --on-plum:#F6ECE4;
  background:var(--ground); color:var(--ink);
  font-family:'Avenir Next','Segoe UI',system-ui,-apple-system,'Helvetica Neue',sans-serif;
  line-height:1.6; padding:0 0 60px;

  * { box-sizing:border-box; }
  .serif{ font-family:'Hoefler Text','Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif; }
  .sheet{ max-width:960px; margin:0 auto; padding:0 16px; }

  .hero{ padding:36px 0 8px; }
  .brandrow{ display:flex; justify-content:flex-end; margin-bottom:8px; }
  .chip{ display:inline-flex; align-items:center; gap:8px; font-size:.73rem; font-weight:700;
    letter-spacing:.03em; padding:7px 13px; border-radius:999px;
    background:color-mix(in srgb,var(--gold) 16%,transparent); color:var(--gold);
    border:1px solid color-mix(in srgb,var(--gold) 34%,transparent); }
  .dot{ width:6px; height:6px; border-radius:50%; background:var(--gold); }
  .herogrid{ display:grid; grid-template-columns:1.1fr .9fr; gap:30px; align-items:center; }
  h1{ font-size:clamp(1.9rem,5vw,2.8rem); line-height:1.08; margin:.1em 0 .26em; font-weight:600;
    letter-spacing:-.015em; text-wrap:balance; }
  h1 .big{ color:var(--wine); }
  .subhead{ font-size:clamp(.98rem,1.9vw,1.14rem); font-weight:600; line-height:1.5; margin:0 0 14px;
    color:var(--ink); text-wrap:balance; }
  .subhead b{ color:var(--wine); font-weight:600; }
  .lead{ font-size:clamp(.96rem,1.9vw,1.05rem); max-width:30em; opacity:.88; margin:0 0 24px; text-wrap:balance; }
  .lead b{ color:var(--wine); }
  .cta{ display:inline-flex; align-items:center; gap:10px; appearance:none; border:0;
    background:linear-gradient(90deg,var(--gold),#8E2A44); color:#fff; font-weight:700;
    padding:14px 28px; border-radius:999px; font-size:1rem; cursor:pointer; }
  .cta:hover{ filter:brightness(1.06); }
  .cta.small{ padding:12px 24px; font-size:.96rem; }

  .portrait{ position:relative; border-radius:12px; overflow:hidden; border:1px solid var(--line);
    aspect-ratio:3/3.7; box-shadow:0 18px 40px -22px rgba(40,10,25,.5); }
  .portrait img{ width:100%; height:100%; object-fit:cover; object-position:50% 20%; display:block; }
  .portrait::after{ content:""; position:absolute; inset:0;
    background:linear-gradient(180deg,transparent 55%,rgba(30,8,18,.42)); }
  .verified{ position:absolute; left:12px; bottom:12px; z-index:2; display:inline-flex; align-items:center;
    gap:7px; background:rgba(20,8,14,.6); backdrop-filter:blur(4px); color:#fff; font-size:.73rem;
    font-weight:600; padding:6px 11px; border-radius:999px; border:1px solid rgba(255,255,255,.18); }
  .verified svg{ width:14px; height:14px; color:var(--gold); }

  .rule{ height:1px; background:var(--line); border:0; margin:0; }
  .section{ padding:36px 0; }
  .section-label{ font-size:.7rem; letter-spacing:.2em; text-transform:uppercase; color:var(--muted);
    font-weight:700; margin:0 0 14px; }
  .kicker{ font-size:1.35rem; font-weight:600; letter-spacing:-.01em; margin:0 0 4px; }
  .sub{ color:var(--muted); font-size:.95rem; margin:0 0 24px; max-width:40em; }

  .grid{ display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:1px;
    background:var(--line); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
  .card{ background:var(--panel); padding:20px; display:flex; gap:13px; }
  .ic{ flex:none; width:30px; height:30px; color:var(--wine); }
  .card h4{ margin:2px 0 4px; font-size:1rem; font-weight:600; }
  .card p{ margin:0; color:var(--muted); font-size:.88rem; line-height:1.5; }

  .earn{ background:var(--ground-2); border:1px solid var(--line); border-radius:12px; padding:24px;
    display:flex; gap:18px; align-items:flex-start; }
  .earn .moon{ flex:none; color:var(--gold); width:38px; height:38px; }
  .earn h4{ margin:0 0 6px; font-size:1.16rem; font-weight:600; }
  .earn p{ margin:0; opacity:.92; }
  .earn b{ color:var(--wine); }

  .trust{ display:grid; grid-template-columns:repeat(2,1fr); gap:13px 28px; }
  .tline{ display:flex; gap:10px; align-items:flex-start; font-size:.92rem; }
  .tline svg{ flex:none; width:18px; height:18px; color:var(--gold); margin-top:3px; }

  .ctafinal{ background:linear-gradient(160deg,var(--plum),#241019); color:var(--on-plum);
    text-align:center; border-radius:14px; padding:36px 24px; margin-top:8px; }
  .ctafinal h2{ font-size:clamp(1.6rem,4vw,2.2rem); font-weight:600; margin:0 0 8px; color:var(--on-plum); }
  .ctafinal p{ color:color-mix(in srgb,var(--on-plum) 78%,transparent); margin:0 auto 22px; max-width:32em; }

  @media(max-width:640px){
    .herogrid{ grid-template-columns:1fr; gap:24px; }
    .trust{ grid-template-columns:1fr; }
  }
`;

const IconTag = () => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 12l-8 8-9-9V3h8z" /><circle cx="7.5" cy="7.5" r="1.4" /></svg>
);
const IconClock = () => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
const IconShield = () => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
);
const IconCard = () => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /><circle cx="16.5" cy="14" r="1.2" /></svg>
);
const IconHeart = () => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20.8 8.6a4.3 4.3 0 00-7-1.3L12 8.9l-1.8-1.6a4.3 4.3 0 10-5.9 6.2L12 21l7.7-7.5a4.3 4.3 0 001.1-4.9z" /></svg>
);
const IconTrend = () => (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" /></svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
);

const BENEFITS = [
  { key: 'price', Icon: IconTag },
  { key: 'hours', Icon: IconClock },
  { key: 'verified', Icon: IconShield },
  { key: 'payments', Icon: IconCard },
  { key: 'oneToOne', Icon: IconHeart },
  { key: 'tiers', Icon: IconTrend },
];

const TRUST_KEYS = ['age', 'gdpr', 'control', 'support'];

export default function ModelLanding() {
  const history = useHistory();
  const { openLoginModal } = useAppModals();
  const t = (k) => i18n.t(`modelLanding.${k}`);

  const openRegisterModel = () => openLoginModal({ initialView: 'register-model' });
  const goLogin = () => openLoginModal();
  const goBlog = () => history.push('/blog');
  const handleBrandClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    history.push('/');
  };

  return (
    <>
      <Seo pageKey="modelLanding" urlPath="/modelos" localeAware />
      <PublicNavbar
        activeTab={null}
        onBrandClick={handleBrandClick}
        onGoVideochat={goLogin}
        onGoFavorites={goLogin}
        onGoBlog={goBlog}
        onBuy={openRegisterModel}
        onLogin={goLogin}
        showLocaleSwitcher
        showBottomNav
      />

      <Wrap>
        <div className="sheet">
          {/* HERO */}
          <section className="hero">
            <div className="brandrow">
              <span className="chip"><span className="dot" />{t('hero.chip')}</span>
            </div>
            <div className="herogrid">
              <div>
                <h1 className="serif"><span className="big">{t('hero.titleAccent')}</span> {t('hero.titleRest')}</h1>
                <p className="subhead"><b>{t('hero.sub1a')}</b> {t('hero.sub1b')}<br />{t('hero.sub2a')} <b>{t('hero.sub2b')}</b></p>
                <p className="lead">{t('hero.leadA')} <b>{t('hero.leadB')}</b>.</p>
                <button type="button" className="cta" onClick={openRegisterModel}>
                  {t('hero.cta')}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </button>
              </div>
              <div className="portrait">
                <img src={HERO_IMG} alt={t('hero.imageAlt')} />
                <span className="verified">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M12 2l2.4 1.8 3 .1 1 2.8 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-1 2.8-3 .1L12 22l-2.4-1.8-3-.1-1-2.8L3.2 15.4l.9-2.9-.9-2.9 2.4-1.8 1-2.8 3-.1z" /><path d="M9 12l2 2 4-4" /></svg>
                  {t('hero.verified')}
                </span>
              </div>
            </div>
          </section>

          <hr className="rule" />

          {/* BENEFICIOS */}
          <section className="section">
            <p className="section-label">{t('benefits.label')}</p>
            <h2 className="kicker serif">{t('benefits.kicker')}</h2>
            <p className="sub">{t('benefits.sub')}</p>
            <div className="grid">
              {BENEFITS.map(({ key, Icon }) => (
                <div className="card" key={key}>
                  <Icon />
                  <div>
                    <h4>{t(`benefits.items.${key}.title`)}</h4>
                    <p>{t(`benefits.items.${key}.text`)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <hr className="rule" />

          {/* COBRAS POR TU TIEMPO */}
          <section className="section">
            <div className="earn">
              <svg className="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.3 9.2a2.7 2.7 0 012.7-1.6c1.6 0 2.6.9 2.6 2.1 0 2.6-5.2 1.9-5.2 4.6 0 1.2 1.1 2.1 2.6 2.1a2.7 2.7 0 002.7-1.6" /></svg>
              <div>
                <h4 className="serif">{t('earn.title')}</h4>
                <p>{t('earn.text')}</p>
              </div>
            </div>
          </section>

          <hr className="rule" />

          {/* GARANTIAS */}
          <section className="section">
            <p className="section-label">{t('trust.label')}</p>
            <div className="trust">
              {TRUST_KEYS.map((k) => (
                <div className="tline" key={k}>
                  <IconCheck />
                  <span>{t(`trust.lines.${k}`)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* CTA FINAL */}
          <section className="section">
            <div className="ctafinal">
              <h2 className="serif">{t('ctaFinal.title')}</h2>
              <p>{t('ctaFinal.text')}</p>
              <button type="button" className="cta small" onClick={openRegisterModel}>
                {t('ctaFinal.cta')}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
          </section>
        </div>
      </Wrap>
    </>
  );
}
