import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCallUi } from '../components/CallUiContext';
import {
  FooterWrap,
  FooterInner,
  LinksRow,
  Copyright,
} from '../styles/public-styles/FooterStyles';

// Footer global fino (2 lineas): fila de enlaces + copyright minimo.
// El detalle legal completo (razon social, registry code, direccion,
// email) vive en la pagina /legal, enlazada desde aqui. Se retiro el
// bloque legal repetido y el titulo/subline de marca para reducir la
// altura del footer en TODAS las paginas.
export default function Footer() {
  const { inCall } = useCallUi();
  const year = useMemo(() => new Date().getFullYear(), []);

  if (inCall) return null;

  return (
    <FooterWrap>
      <FooterInner>
        <LinksRow>
          <Link to="/faq">FAQ</Link>
          <span className="separator">|</span>

          <Link to="/safety">Safety</Link>
          <span className="separator">|</span>

          <Link to="/community-guidelines">Rules</Link>
          <span className="separator">|</span>

          {/* ADR-056 S5.b.5: enlace publico a captacion Master (Opcion A). */}
          <Link to="/for-studios">For studios</Link>
          <span className="separator">|</span>

          {/* Captacion publica de modelos (Opcion B). */}
          <Link to="/modelos">Models</Link>
          <span className="separator">|</span>

          {/* Legal es es-only por diseño: App.jsx redirige /en/legal -> /legal.
              Anchor absoluto a proposito (NO migrar a <Link>: bajo /en generaria
              /en/legal y forzaria esa redireccion con recarga). */}
          <a href="/legal">Legal</a>
          <span className="separator">|</span>

          <Link to="/cookies-settings">Cookie Settings</Link>
        </LinksRow>

        <Copyright>© {year} SharemeChat® · Shareme Technologies OÜ</Copyright>
      </FooterInner>
    </FooterWrap>
  );
}
