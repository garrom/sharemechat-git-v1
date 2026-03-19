import React, { useMemo, useState } from 'react';
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
        <BrandTitle>SharemeChat®</BrandTitle>

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

          <a href="/faq">FAQ</a>
          <span className="separator">|</span>

          <a href="/safety">Safety</a>
          <span className="separator">|</span>

          <a href="/community-guidelines">Rules</a>
          <span className="separator">|</span>

          <a href="/legal">Legal</a>
          <span className="separator">|</span>

          <a href="/cookies-settings">Cookie Settings</a>
        </LinksRow>

        <LegalDesktopOnly>
          Shareme Technologies OÜ
          <br />
          Registry code: 17444422
          <br />
          Lõõtsa tn 5, 11415 Tallinn, Harju maakond, Estonia
          <br />
          contact@sharemechat.com
          <br />
          © {year} SharemeChat®. All rights reserved.
        </LegalDesktopOnly>

        <MobileMorePanel id="footer-more-panel" $open={open}>
          <MobileMoreInner>
            <LinksRowMobile>

              <a href="/faq">FAQ</a>
              <span className="separator">|</span>

              <a href="/safety">Safety</a>
              <span className="separator">|</span>

              <a href="/community-guidelines">Rules</a>
              <span className="separator">|</span>

              <a href="/legal">Legal</a>
              <span className="separator">|</span>

              <a href="/cookies-settings">Cookie Settings</a>
            </LinksRowMobile>

            <LegalText>
              Shareme Technologies OÜ
              <br />
              Registry code: 17444422
              <br />
              contact@sharemechat.com
              <br />
              © {year} SharemeChat®. All rights reserved.
            </LegalText>
          </MobileMoreInner>
        </MobileMorePanel>
      </FooterInner>
    </FooterWrap>
  );
}
