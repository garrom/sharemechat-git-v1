import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useCallUi } from './CallUiContext';

/* CONTENEDORES BASE */
const FooterWrap = styled.footer`
  background: #0f0f0f;
  color: #d1d5db;
  padding: 40px 0 60px;
  text-align: center;
  font-size: 0.85rem;
  margin-top: auto;

  @media (max-width: 768px) {
    padding: 18px 0 calc(22px + var(--bottom-nav-height) + env(safe-area-inset-bottom));
  }
`;

const FooterInner = styled.div`
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 16px;
  box-sizing: border-box;
`;

/* LOGO DE MARCA */
const BrandTitle = styled.div`
  font-size: 1.4rem;
  font-weight: 800;
  color: #f9fafb;
  letter-spacing: 0.03em;

  @media (max-width: 768px) {
    font-size: 1.05rem;
    letter-spacing: 0.02em;
  }
`;

/* FILA SUBTÍTULO + TOGGLE (MÓVIL) */
const BrandSubRow = styled.div`
  margin-top: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

  @media (max-width: 768px) {
    margin-top: 4px;
    justify-content: center;
  }
`;

const BrandSub = styled.div`
  font-size: 0.75rem;
  opacity: 0.7;

  @media (max-width: 768px) {
    font-size: 0.7rem;
  }
`;

/* BOTÓN "MÁS" (SOLO MÓVIL, INLINE EN LA FILA DEL SUB) */
const MoreInline = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: inline-flex;
    align-items: center;
  }
`;

const MoreToggleBtn = styled.button`
  appearance: none;
  border: none;
  background: transparent;
  color: rgba(249, 250, 251, 0.88);
  border-radius: 999px;
  padding: 6px 8px;
  cursor: pointer;

  display: inline-flex;
  align-items: center;
  gap: 6px;

  font-weight: 400;
  font-size: 0.78rem;
  line-height: 1;

  &:hover {
    color: rgba(249, 250, 251, 1);
    background: rgba(255, 255, 255, 0.06);
  }

  &:active {
    transform: translateY(1px);
  }

  &:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.25);
    outline-offset: 2px;
  }
`;

/* CHEVRON SVG */
const ChevronIcon = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{display:'block'}}>
    <path d={open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* CONTENIDO DESPLEGABLE (MÓVIL) */
const MobileMorePanel = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: block;
    margin-top: 12px;

    max-height: ${p => (p.$open ? '520px' : '0px')};
    overflow: hidden;
    transition: max-height 220ms ease;
  }
`;

const MobileMoreInner = styled.div`
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
`;

/* LINKS HORIZONTALES (DESKTOP) */
const LinksRow = styled.div`
  margin-top: 22px;
  font-size: 0.83rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;

  a {
    color: #d1d5db;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  span.separator {
    opacity: 0.4;
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

/* LINKS EN MÓVIL (CON SEPARADORES, COMPACTO) */
const LinksRowMobile = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    font-size: 0.80rem;

    a {
      color: #d1d5db;
      text-decoration: none;
      font-weight: 600;
      opacity: 0.95;
      white-space: nowrap;
    }

    a:hover {
      text-decoration: underline;
    }

    span.separator {
      opacity: 0.4;
    }
  }
`;

/* INFO LEGAL */
const LegalText = styled.div`
  margin-top: 20px;
  font-size: 0.78rem;
  opacity: 0.7;
  line-height: 1.5;

  @media (max-width: 768px) {
    margin-top: 14px;
    font-size: 0.75rem;
    opacity: 0.78;
  }
`;

/* LEGAL SOLO DESKTOP (para evitar duplicado en móvil) */
const LegalDesktopOnly = styled(LegalText)`
  @media (max-width: 768px) {
    display: none;
  }
`;

export default function Footer() {
  const { inCall } = useCallUi();
  const year = useMemo(() => new Date().getFullYear(), []);
  const [open, setOpen] = useState(false);

  if (inCall) return null;

  return (
    <FooterWrap>
      <FooterInner>
        {/* MARCA */}
        <BrandTitle>SharemeChat®</BrandTitle>

        {/* SUB + "MÁS" INLINE (MÓVIL) */}
        <BrandSubRow>
          <BrandSub>SharemeChat Technologies</BrandSub>

          <MoreInline>
            <MoreToggleBtn
              type="button"
              onClick={() => setOpen(v => !v)}
              aria-expanded={open ? 'true' : 'false'}
              aria-controls="footer-more-panel"
              title={open ? 'Ocultar' : 'ver más'}
            >
              <span>Más</span>
              <ChevronIcon open={open} />
            </MoreToggleBtn>
          </MoreInline>
        </BrandSubRow>

        {/* DESKTOP: LINKS SIEMPRE VISIBLES */}
        <LinksRow>
          <a href="/">Acerca</a><span className="separator">|</span>
          <a href="/guide">Guía</a><span className="separator">|</span>
          <a href="/safety">Seguridad</a><span className="separator">|</span>
          <a href="/community">Normas</a><span className="separator">|</span>
          <a href="/terms">Terms</a><span className="separator">|</span>
          <a href="/privacy">Privacy</a><span className="separator">|</span>
          <a href="/cookies">Política de cookies</a><span className="separator">|</span>
          <a href="/cookies-settings">Configuración de cookies</a>
        </LinksRow>

        {/* DESKTOP: LEGAL (VISIBLE SOLO EN DESKTOP) */}
        <LegalDesktopOnly>
          help@sharemechat.com
          <br />
          © {year} Sharemechat™. All rights reserved.
        </LegalDesktopOnly>

        {/* MÓVIL: TODO (LINKS + LEGAL) DENTRO DE "MÁS" */}
        <MobileMorePanel id="footer-more-panel" $open={open}>
          <MobileMoreInner>
            <LinksRowMobile>
              <a href="/">Acerca</a><span className="separator">|</span>
              <a href="/blog">Blog</a><span className="separator">|</span>
              <a href="/guide">Guía</a><span className="separator">|</span>
              <a href="/safety">Seguridad</a><span className="separator">|</span>
              <a href="/community">Normas</a><span className="separator">|</span>
              <a href="/terms">Terms</a><span className="separator">|</span>
              <a href="/privacy">Privacy</a><span className="separator">|</span>
              <a href="/cookies">Cookies</a><span className="separator">|</span>
              <a href="/cookies-settings">Config. cookies</a>
            </LinksRowMobile>

            <LegalText>
              help@sharemechat.com
              <br />
              © {year} Sharemechat™. All rights reserved.
            </LegalText>
          </MobileMoreInner>
        </MobileMorePanel>
      </FooterInner>
    </FooterWrap>
  );
}
