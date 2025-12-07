// src/styles/pages-styles/BlogStyles.js
import styled from 'styled-components';
import { space, radius, shadow } from '../core/tokens';

export const PageWrap = styled.div`
  min-height: calc(100vh - var(--bottom-nav-height));
  background: #f8fafc;
  padding: 24px 0 80px;
  box-sizing: border-box;

  @media (max-width: 768px) {
    padding-top: 16px;
    padding-bottom: calc(var(--bottom-nav-height) + 16px);
  }
`;

export const PageInner = styled.div`
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 ${space.lg};

  @media (max-width: 640px) {
    padding: 0 ${space.md};
  }
`;

export const HeroKicker = styled.div`
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #64748b;
  margin-bottom: 6px;
`;

export const HeroTitle = styled.h1`
  margin: 0 0 8px;
  font-size: 1.8rem;
  line-height: 1.25;
  color: #0f172a;
`;

export const HeroLead = styled.p`
  margin: 0 0 6px;
  font-size: 0.98rem;
  color: #475569;
  line-height: 1.6;
`;

export const HeroTagline = styled.p`
  margin: 4px 0 24px;
  font-size: 0.9rem;
  color: #94a3b8;
`;

export const ArticlesGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  margin-top: 12px;
  margin-bottom: 24px;
`;

export const ArticleCard = styled.article`
  background: #ffffff;
  border-radius: ${radius.lg};
  border: 1px solid #e2e8f0;
  padding: 16px 18px;
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.04);
`;

export const ArticleBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: #fee2e2;
  color: #b91c1c;
  margin-bottom: 8px;
`;

export const ArticleTitle = styled.h2`
  margin: 0 0 4px;
  font-size: 1.05rem;
  color: #0f172a;
`;

export const ArticleMeta = styled.div`
  font-size: 0.78rem;
  color: #94a3b8;
  margin-bottom: 8px;
`;

export const ArticleExcerpt = styled.p`
  margin: 0;
  font-size: 0.9rem;
  color: #4b5563;
  line-height: 1.6;
`;

export const Sidebar = styled.aside`
  background: #fdf2ff;
  border-radius: ${radius.lg};
  border: 1px solid #f5d0fe;
  padding: 16px 18px;
  align-self: flex-start;
`;

export const SidebarTitle = styled.h3`
  margin: 0 0 8px;
  font-size: 0.95rem;
  color: #4c1d95;
`;

export const SidebarText = styled.p`
  margin: 0 0 8px;
  font-size: 0.86rem;
  color: #6b7280;
  line-height: 1.6;
`;

export const TagPills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 10px;
`;

export const TagPill = styled.span`
  padding: 4px 10px;
  font-size: 0.75rem;
  border-radius: 999px;
  background: #e0f2fe;
  color: #0369a1;
`;

export const CTABox = styled.div`
  margin-top: 8px;
  padding: 16px 18px;
  border-radius: ${radius.lg};
  background: #ecfdf5;
  border: 1px solid #bbf7d0;
`;

export const CTATitle = styled.h3`
  margin: 0 0 6px;
  font-size: 0.98rem;
  color: #065f46;
`;

export const CTAText = styled.p`
  margin: 0 0 4px;
  font-size: 0.88rem;
  color: #166534;
  line-height: 1.6;
`;
