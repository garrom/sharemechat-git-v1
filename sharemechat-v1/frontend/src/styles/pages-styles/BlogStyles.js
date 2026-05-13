// src/styles/pages-styles/BlogStyles.js
import styled from 'styled-components';
import { space } from '../core/tokens';

export const PageWrap = styled.div`
  min-height: calc(100vh - var(--bottom-nav-height));
  background: linear-gradient(180deg, #ffffff 0%, #f7f8f4 100%);
  padding: 28px 0 88px;
  box-sizing: border-box;

  @media (max-width: 768px) {
    padding-top: 16px;
    padding-bottom: calc(var(--bottom-nav-height) + 24px);
  }
`;

export const PageInner = styled.div`
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 ${space.lg};

  @media (max-width: 640px) {
    padding: 0 ${space.md};
  }
`;

export const HeroSection = styled.header`
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
  gap: 28px;
  align-items: stretch;
  margin-bottom: 34px;
  padding: 36px;
  border-radius: 32px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.06);

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    padding: 24px;
    gap: 20px;
  }
`;

export const HeroContent = styled.div`
  max-width: 720px;
`;

export const HeroKicker = styled.div`
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 10px;
`;

export const HeroTitle = styled.h1`
  margin: 0 0 12px;
  font-size: clamp(1.6rem, 2.6vw, 2.4rem);
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #0f172a;
`;

export const HeroLead = styled.p`
  margin: 0 0 10px;
  font-size: 1.02rem;
  color: #475569;
  line-height: 1.72;
`;

export const HeroTagline = styled.p`
  margin: 0;
  font-size: 0.94rem;
  color: #7c8a9a;
  line-height: 1.7;
`;

export const HeroAside = styled.div`
  position: relative;
  min-height: 260px;
  border-radius: 28px;
  background: #f7f8f4;
  border: 1px solid rgba(148, 163, 184, 0.14);
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
`;

export const HeroAsideInner = styled.div`
  position: absolute;
  inset: 18px;
  display: grid;
  gap: 14px;
`;

export const HeroAsideCard = styled.div`
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.14);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.05);

  &[data-large='true'] {
    position: relative;
    min-height: 148px;
  }
`;

export const HeroAsideCardTop = styled.div`
  position: absolute;
  left: 16px;
  right: 16px;
  top: 16px;
  height: 12px;
  border-radius: 999px;
  background: rgba(203, 213, 225, 0.82);
`;

export const HeroAsideCardBody = styled.div`
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 18px;
  top: 46px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 50% 28%, rgba(255,255,255,0.86) 0 15%, transparent 15.5%),
    radial-gradient(circle at 50% 68%, rgba(255,255,255,0.72) 0 24%, transparent 24.5%),
    linear-gradient(180deg, #dbe5ed 0%, #c5d3df 100%);
`;

export const HeroAsideRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
`;

export const HeroAsideMini = styled.div`
  position: relative;
  min-height: 88px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.12);
`;

export const HeroAsideMiniLine = styled.div`
  position: absolute;
  left: 14px;
  right: 14px;
  height: 10px;
  border-radius: 999px;
  background: rgba(203, 213, 225, 0.72);

  &:nth-child(1) {
    top: 18px;
  }

  &:nth-child(2) {
    top: 38px;
    width: 62%;
  }

  &:nth-child(3) {
    top: 58px;
    width: 42%;
  }
`;

export const FeaturedSection = styled.section`
  margin-bottom: 30px;
`;

export const FeaturedCard = styled.article`
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(300px, 0.92fr);
  gap: 28px;
  padding: 28px;
  border-radius: 30px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.06);

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    padding: 22px;
    gap: 20px;
  }
`;

export const FeaturedContent = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
`;

export const FeaturedVisual = styled.div`
  position: relative;
  min-height: 300px;
  border-radius: 26px;
  background: #f7f8f4;
  border: 1px solid rgba(148, 163, 184, 0.14);
  overflow: hidden;

  @media (max-width: 900px) {
    min-height: 220px;
  }
`;

export const FeaturedVisualMain = styled.div`
  position: absolute;
  inset: 22px 34px 22px 34px;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.12);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
`;

export const FeaturedVisualCard = styled.div`
  position: absolute;
  width: 138px;
  height: 168px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.12);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.06);

  &[data-pos='left'] {
    left: 10px;
    bottom: 20px;
    transform: rotate(-8deg);
  }

  &[data-pos='right'] {
    right: 10px;
    top: 20px;
    transform: rotate(8deg);
  }

  @media (max-width: 900px) {
    width: 104px;
    height: 130px;
  }
`;

export const PlaceholderTop = styled.div`
  position: absolute;
  left: 16px;
  right: 16px;
  top: 16px;
  height: 12px;
  border-radius: 999px;
  background: rgba(203, 213, 225, 0.82);
`;

export const PlaceholderBody = styled.div`
  position: absolute;
  left: 18px;
  right: 18px;
  top: 44px;
  bottom: 18px;
  border-radius: 18px;
  background:
    radial-gradient(circle at 50% 28%, rgba(255,255,255,0.84) 0 15%, transparent 15.5%),
    radial-gradient(circle at 50% 68%, rgba(255,255,255,0.72) 0 25%, transparent 25.5%),
    linear-gradient(180deg, #d9e3eb 0%, #c4d1dd 100%);
`;

export const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 0.92fr);
  gap: 26px;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

export const MainColumn = styled.div`
  min-width: 0;
`;

export const SectionLabel = styled.div`
  margin: 0 0 12px;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #7c8a9a;
`;

export const ArticlesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 26px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

export const ArticleCard = styled.article`
  background: #ffffff;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  padding: 22px;
  box-shadow: 0 16px 44px rgba(15, 23, 42, 0.05);
  display: block;
  text-decoration: none;
  color: inherit;
`;

export const ArticleCardImage = styled.div`
  margin: -22px -22px 14px -22px;
  aspect-ratio: 4 / 3;
  width: calc(100% + 44px);
  overflow: hidden;
  border-radius: 24px 24px 0 0;
  background: #ECEEF3;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

export const ArticleBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 6px 11px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: #f7f8f4;
  color: #5b6777;
  margin-bottom: 12px;
`;

export const ArticleTitle = styled.h2`
  margin: 0 0 8px;
  font-size: 1.25rem;
  line-height: 1.3;
  font-weight: 700;
  color: #0f172a;
`;

export const FeaturedTitle = styled(ArticleTitle)`
  font-size: clamp(1.5rem, 2.6vw, 2.35rem);
  line-height: 1.08;
  letter-spacing: -0.03em;
`;

export const ArticleMeta = styled.div`
  font-size: 0.8rem;
  color: #8b98a8;
  margin-bottom: 10px;
`;

export const FeaturedMeta = styled(ArticleMeta)`
  font-size: 0.84rem;
`;

export const ArticleExcerpt = styled.p`
  margin: 0;
  font-size: 0.93rem;
  color: #526171;
  line-height: 1.68;
`;

export const FeaturedExcerpt = styled(ArticleExcerpt)`
  font-size: 1rem;
  max-width: 640px;
`;

export const Sidebar = styled.aside`
  background: rgba(247, 248, 244, 0.92);
  border-radius: 26px;
  border: 1px solid rgba(148, 163, 184, 0.14);
  padding: 22px;
  align-self: flex-start;

  @media (max-width: 960px) {
    order: 2;
  }
`;

export const SidebarTitle = styled.h3`
  margin: 0 0 10px;
  font-size: 0.98rem;
  color: #0f172a;
`;

export const SidebarText = styled.p`
  margin: 0 0 12px;
  font-size: 0.9rem;
  color: #5f6c7b;
  line-height: 1.68;
`;

export const SidebarSearchInput = styled.input`
  width: 100%;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.92);
  font-size: 0.9rem;
  color: #1f2937;
  outline: none;
  transition: border-color 120ms;

  &:focus {
    border-color: #4338ca;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

export const SidebarCategoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const SidebarCategoryBlock = styled.div`
  display: flex;
  flex-direction: column;
`;

export const SidebarCategoryHeader = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.9rem;
  color: ${(p) => (p.$active ? '#4338ca' : '#475569')};
  font-weight: ${(p) => (p.$active ? 700 : 500)};
  cursor: pointer;
  transition: background 120ms, color 120ms;

  &:hover {
    background: rgba(67, 56, 202, 0.05);
    color: #4338ca;
  }
`;

export const SidebarCategoryName = styled.span`
  flex: 1;
`;

export const SidebarCategoryCount = styled.span`
  font-size: 0.78rem;
  color: #94a3b8;
  font-weight: 500;
`;

export const SidebarCategoryChevron = styled.span`
  display: inline-block;
  font-size: 0.7rem;
  color: #94a3b8;
  transition: transform 180ms;
  transform: ${(p) => (p.$expanded ? 'rotate(0deg)' : 'rotate(-90deg)')};
`;

export const SidebarArticleList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 12px;
  padding-left: 12px;
  border-left: 2px solid rgba(148, 163, 184, 0.18);
  margin-top: 4px;
  margin-bottom: 6px;
`;

export const SidebarArticleLink = styled.a`
  display: block;
  padding: 6px 10px;
  font-size: 0.85rem;
  color: #475569;
  text-decoration: none;
  line-height: 1.35;
  border-radius: 6px;
  transition: background 120ms, color 120ms;

  &:hover {
    background: rgba(67, 56, 202, 0.05);
    color: #4338ca;
  }
`;

export const TagPills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 14px;
`;

export const TagPill = styled.span`
  padding: 6px 11px;
  font-size: 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: #4f5d6c;
  border: 1px solid rgba(148, 163, 184, 0.14);
`;

export const CTABox = styled.div`
  margin-top: 8px;
  padding: 24px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.05);
`;

export const CTATitle = styled.h3`
  margin: 0 0 8px;
  font-size: 1.08rem;
  color: #0f172a;
`;

export const CTAText = styled.p`
  margin: 0 0 6px;
  font-size: 0.94rem;
  color: #526171;
  line-height: 1.68;
`;

export const CTAActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 14px;
`;

// ===== Fase 4A: vista de detalle del articulo (BlogArticleView) =====

export const ArticleHero = styled.header`
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 28px;
  padding: 32px;
  margin-bottom: 24px;

  @media (max-width: 720px) {
    padding: 22px;
  }
`;

export const ArticleCategoryPill = styled.span`
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: #eef2ff;
  color: #3730a3;
  margin-bottom: 12px;
`;

export const ArticleHeroTitle = styled.h1`
  margin: 0 0 12px;
  font-size: clamp(1.8rem, 3.4vw, 2.6rem);
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #0f172a;
`;

export const ArticleMetaLine = styled.div`
  font-size: 0.84rem;
  color: #64748b;
  margin: 0 0 8px;
`;

export const ArticleHeroImage = styled.div`
  margin: 16px 0 8px 0;
  aspect-ratio: 4 / 3;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  border-radius: 12px;
  background: #ECEEF3;
  box-shadow: 0 1px 3px rgba(14, 23, 51, 0.05);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

export const ArticleBriefBox = styled.p`
  margin: 12px 0 0;
  font-size: 1rem;
  color: #475569;
  line-height: 1.7;
`;

export const ArticleBody = styled.section`
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 28px;
  padding: 36px;
  font-size: 1.02rem;
  line-height: 1.78;
  color: #1f2937;

  @media (max-width: 720px) {
    padding: 22px;
    font-size: 0.98rem;
  }

  h2 {
    margin: 32px 0 12px;
    font-size: 1.45rem;
    line-height: 1.25;
    letter-spacing: -0.01em;
    color: #0f172a;
  }

  h3 {
    margin: 22px 0 10px;
    font-size: 1.18rem;
    line-height: 1.3;
    color: #1e293b;
  }

  p {
    margin: 0 0 14px;
  }

  ul, ol {
    margin: 0 0 16px;
    padding-left: 24px;
  }

  li {
    margin: 4px 0;
  }

  blockquote {
    margin: 18px 0;
    padding: 12px 18px;
    border-left: 4px solid #c7d2fe;
    background: #f8fafc;
    color: #334155;
    border-radius: 0 8px 8px 0;
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.92em;
    background: #f1f5f9;
    padding: 1px 5px;
    border-radius: 4px;
  }

  pre {
    background: #0f172a;
    color: #e2e8f0;
    padding: 14px 16px;
    border-radius: 10px;
    overflow-x: auto;
    font-size: 0.9rem;
    margin: 16px 0;
  }

  pre code {
    background: transparent;
    color: inherit;
    padding: 0;
  }

  a {
    color: #4338ca;
    text-decoration: underline;
  }

  a:hover { color: #312e81; }

  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 24px 0;
  }

  .callout {
    margin: 22px 0;
    padding: 18px 20px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #4338ca;
    border-radius: 0 12px 12px 0;
    color: #334155;
  }

  .callout > h2,
  .callout > h3 {
    margin-top: 0;
    margin-bottom: 8px;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4338ca;
  }

  .callout > p {
    margin-bottom: 12px;
  }

  .callout > p:last-child {
    margin-bottom: 0;
  }
`;

export const ArticleFooterMeta = styled.div`
  margin-top: 18px;
  padding: 14px 18px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  font-size: 0.82rem;
  color: #475569;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

export const ShareRow = styled.div`
  margin: 32px 0;
  padding: 20px 24px;
  background: rgba(248, 250, 252, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.14);
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
`;

export const ShareLabel = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
`;

export const ShareButtons = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

export const ShareLink = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: #475569;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 700;
  transition: background 120ms, color 120ms, border-color 120ms;

  &:hover {
    background: rgba(67, 56, 202, 0.05);
    border-color: #4338ca;
    color: #4338ca;
  }
`;

export const CopyLinkButton = styled.button`
  margin-left: 8px;
  padding: 8px 14px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: #475569;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms, color 120ms, border-color 120ms;

  &:hover {
    background: rgba(67, 56, 202, 0.05);
    border-color: #4338ca;
    color: #4338ca;
  }
`;

export const RelatedSection = styled.section`
  margin: 48px 0 24px;
`;

export const RelatedHeading = styled.h2`
  font-size: 1.15rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 16px;
`;

export const RelatedGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
`;

export const RelatedCard = styled.a`
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 16px;
  text-decoration: none;
  color: inherit;
  transition: transform 180ms, box-shadow 180ms, border-color 180ms;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(14, 23, 51, 0.06);
    border-color: rgba(67, 56, 202, 0.24);
  }
`;

export const RelatedCardImage = styled.div`
  margin: -16px -16px 12px;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 16px 16px 0 0;
  background: #ECEEF3;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

export const RelatedCardBadge = styled.span`
  display: inline-block;
  align-self: flex-start;
  padding: 4px 10px;
  background: rgba(67, 56, 202, 0.08);
  color: #4338ca;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 999px;
  margin-bottom: 8px;
`;

export const RelatedCardTitle = styled.h3`
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.3;
  color: #1f2937;
  margin: 0;
`;

export const BackLink = styled.button`
  background: none;
  border: none;
  color: #4338ca;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  margin-bottom: 16px;

  &:hover { color: #312e81; }
`;

export const EmptyState = styled.div`
  margin-top: 12px;
  padding: 22px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px dashed rgba(148, 163, 184, 0.3);
  font-size: 0.95rem;
  color: #64748b;
  text-align: center;
`;
