import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCallUi } from '../components/CallUiContext';
import {
  FooterWrap,
  FooterInner,
  BrandTitle,
  BrandSubRow,
  BrandSub,
  MoreInline,
  MoreToggleBtn,
  MobileMorePanel,
  MobileMoreInner,
  LinksRow,
  LinksRowMobile,
  LegalText,
  LegalDesktopOnly,
} from '../styles/public-styles/FooterStyles';

const ChevronIcon = ({ open }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    style={{ display: 'block' }}
  >
    <path
      d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Footer() {
  const { inCall } = useCallUi();
  const year = useMemo(() => new Date().getFullYear(), []);
  const [open, setOpen] = useState(false);

  if (inCall) return null;

  return (
    <FooterWrap>
      <FooterInner>
        <BrandTitle as={Link} to="/" aria-label="Go to Home" title="Home">SharemeChat®</BrandTitle>

        <BrandSubRow>
          <BrandSub>Shareme Technologies OÜ</BrandSub>

          <MoreInline>
            <MoreToggleBtn
              type="button"
              onClick={() => setOpen(v => !v)}
              aria-expanded={open ? 'true' : 'false'}
              aria-controls="footer-more-panel"
              title={open ? 'Hide' : 'More'}
            >
              <span>More</span>
              <ChevronIcon open={open} />
            </MoreToggleBtn>
          </MoreInline>
        </BrandSubRow>

        <LinksRow>

          <Link to="/faq">FAQ</Link>
          <span className="separator">|</span>

          <Link to="/safety">Safety</Link>
          <span className="separator">|</span>

          <Link to="/community-guidelines">Rules</Link>
          <span className="separator">|</span>

          {/* Legal es es-only por diseño: App.jsx redirige /en/legal -> /legal.
              Se deja como anchor absoluto a /legal a propósito (NO migrar a <Link>:
              bajo /en generaría /en/legal y forzaría esa redirección con recarga). */}
          <a href="/legal">Legal</a>
          <span className="separator">|</span>

          <Link to="/cookies-settings">Cookie Settings</Link>
        </LinksRow>

        <LegalDesktopOnly>
          Shareme Technologies OÜ
          <br />
          Registry code: 17444422
          <br />
          Lõõtsa tn 5, 11415 Tallinn, Harju maakond, Estonia
          <br />
          <a href="mailto:contact+web@sharemechat.com" style={{ color: 'inherit', textDecoration: 'underline' }}>contact@sharemechat.com</a>
          <br />
          © {year} SharemeChat®. All rights reserved.
        </LegalDesktopOnly>

        <MobileMorePanel id="footer-more-panel" $open={open}>
          <MobileMoreInner>
            <LinksRowMobile>

              <Link to="/faq">FAQ</Link>
              <span className="separator">|</span>

              <Link to="/safety">Safety</Link>
              <span className="separator">|</span>

              <Link to="/community-guidelines">Rules</Link>
              <span className="separator">|</span>

              {/* Legal es es-only por diseño (ver nota en la variante desktop):
                  anchor absoluto a /legal a propósito, NO migrar a <Link>. */}
              <a href="/legal">Legal</a>
              <span className="separator">|</span>

              <Link to="/cookies-settings">Cookie Settings</Link>
            </LinksRowMobile>

            <LegalText>
              Shareme Technologies OÜ
              <br />
              Registry code: 17444422
              <br />
              <a href="mailto:contact+web@sharemechat.com" style={{ color: 'inherit', textDecoration: 'underline' }}>contact@sharemechat.com</a>
              <br />
              © {year} SharemeChat®. All rights reserved.
            </LegalText>
          </MobileMoreInner>
        </MobileMorePanel>
      </FooterInner>
    </FooterWrap>
  );
}
