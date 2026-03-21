import styled from 'styled-components';

export const FooterWrap = styled.footer`
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

export const FooterInner = styled.div`
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 16px;
  box-sizing: border-box;
`;

export const BrandTitle = styled.div`
  font-size: 1.4rem;
  font-weight: 800;
  color: #f9fafb;
  letter-spacing: 0.03em;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    font-size: 1.05rem;
    letter-spacing: 0.02em;
  }
`;

export const BrandSubRow = styled.div`
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

export const BrandSub = styled.div`
  font-size: 0.75rem;
  opacity: 0.7;

  @media (max-width: 768px) {
    font-size: 0.7rem;
  }
`;

export const MoreInline = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: inline-flex;
    align-items: center;
  }
`;

export const MoreToggleBtn = styled.button`
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

export const MobileMorePanel = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: block;
    margin-top: 12px;
    max-height: ${p => (p.$open ? '520px' : '0px')};
    overflow: hidden;
    transition: max-height 220ms ease;
  }
`;

export const MobileMoreInner = styled.div`
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
`;

export const LinksRow = styled.div`
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

export const LinksRowMobile = styled.div`
  display: none;

  @media (max-width: 768px) {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    font-size: 0.8rem;

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

export const LegalText = styled.div`
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

export const LegalDesktopOnly = styled(LegalText)`
  @media (max-width: 768px) {
    display: none;
  }
`;
