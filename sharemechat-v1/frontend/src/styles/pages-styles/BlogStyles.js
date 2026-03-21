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
  font-size: clamp(2rem, 4vw, 3.4rem);
  line-height: 1.02;
  letter-spacing: -0.04em;
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
  font-size: 1.12rem;
  line-height: 1.25;
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
