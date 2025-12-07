import React from 'react';
import styled from 'styled-components';

/* CONTENEDORES BASE */
const FooterWrap = styled.footer`
  background: #0f0f0f;
  color: #d1d5db;
  padding: 40px 0 60px;
  text-align: center;
  font-size: 0.85rem;
  margin-top: auto;
`;

const FooterBlock = styled.div`
  margin-top: ${({ mt }) => mt || "24px"};
`;

/* LOGO DE MARCA */
const BrandTitle = styled.div`
  font-size: 1.4rem;
  font-weight: 800;
  color: #f9fafb;
  letter-spacing: 0.03em;
`;

const BrandSub = styled.div`
  margin-top: 6px;
  font-size: 0.75rem;
  opacity: 0.7;
`;

/* LINKS HORIZONTALES */
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
`;

/* INFO LEGAL */
const LegalText = styled.div`
  margin-top: 20px;
  font-size: 0.78rem;
  opacity: 0.7;
  line-height: 1.5;
`;

/* STORE BUTTONS */
const StoreRow = styled.div`
  margin-top: 22px;
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
`;

const StoreBtn = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  background: #1f2937;
  border: 1px solid #374151;
  color: #f9fafb;
  font-size: 0.82rem;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    background: #374151;
  }
`;

/* ICONOS SOCIALES */
const SocialRow = styled.div`
  margin-top: 26px;
  display: flex;
  justify-content: center;
  gap: 16px;

  a {
    width: 38px;
    height: 38px;
    background: #1f2937;
    border-radius: 50%;
    display:flex;
    align-items:center;
    justify-content:center;
    color:#f9fafb;
    font-size: 1.1rem;
    text-decoration:none;
  }

  a:hover {
    background: #374151;
  }
`;

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <FooterWrap>
      {/* LOGO */}
      <BrandTitle>SharemeChat®</BrandTitle>
      <BrandSub>SharemeChat Technologies</BrandSub>

      {/* LINKS */}
      <LinksRow>
        <a href="/">Acerca</a><span className="separator">|</span>
        <a href="/blog">Blog</a><span className="separator">|</span>
        <a href="/guide">Guía</a><span className="separator">|</span>
        <a href="/safety">Seguridad</a><span className="separator">|</span>
        <a href="/community">Normas</a><span className="separator">|</span>
        <a href="/terms">Terms</a><span className="separator">|</span>
        <a href="/privacy">Privacy</a><span className="separator">|</span>
        <a href="/cookies">Política de cookies</a><span className="separator">|</span>
        <a href="/cookies-settings">Configuración de cookies</a>
      </LinksRow>

      {/* INFO LEGAL */}
      <LegalText>
        help@sharemechat.com
        <br />
        © {year} SharemeChat™. All rights reserved.
      </LegalText>

      {/* APPS */}

      {/* REDES */}
    </FooterWrap>
  );
}
