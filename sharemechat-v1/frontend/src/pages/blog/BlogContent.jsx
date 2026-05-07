// src/pages/blog/BlogContent.jsx
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { apiFetch } from '../../config/http';
import { NavButton } from '../../styles/ButtonStyles';
import {
  PageWrap,
  PageInner,
  HeroSection,
  HeroContent,
  HeroKicker,
  HeroTitle,
  HeroLead,
  HeroTagline,
  HeroAside,
  HeroAsideInner,
  HeroAsideCard,
  HeroAsideCardTop,
  HeroAsideCardBody,
  HeroAsideRow,
  HeroAsideMini,
  HeroAsideMiniLine,
  ContentGrid,
  MainColumn,
  SectionLabel,
  ArticlesGrid,
  ArticleCard,
  ArticleBadge,
  ArticleTitle,
  ArticleMeta,
  ArticleExcerpt,
  Sidebar,
  SidebarTitle,
  SidebarText,
  TagPills,
  TagPill,
  CTABox,
  CTATitle,
  CTAText,
  CTAActions,
  EmptyState
} from '../../styles/pages-styles/BlogStyles';

const fmtDate = (v) => {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString();
  } catch {
    return '';
  }
};

const truncate = (text, max = 200) => {
  if (!text) return '';
  const t = String(text);
  return t.length > max ? `${t.slice(0, max).trim()}…` : t;
};

const BlogContent = ({ mode = 'public', onGoRegisterClient, onGoRegisterModel }) => {
  const isPublic = mode === 'public';
  const history = useHistory();
  const handleRegisterClient = () => { if (onGoRegisterClient) onGoRegisterClient(); };
  const handleRegisterModel = () => { if (onGoRegisterModel) onGoRegisterModel(); };

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    apiFetch('/public/content/articles?size=20')
      .then((data) => {
        if (cancelled) return;
        setArticles(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || 'No se pudieron cargar los artículos');
        setArticles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const goToArticle = (slug) => {
    history.push(`/blog/${slug}`);
  };

  return (
    <PageWrap>
      <PageInner>
        <HeroSection>
          <HeroContent>
            <HeroKicker>SharemeChat Journal</HeroKicker>
            <HeroTitle>Articles, guidance and product notes around live one-to-one video chat.</HeroTitle>
            <HeroLead>
              This space is being shaped as a practical editorial layer for users and models who want clearer explanations, better context and useful insights around the platform.
            </HeroLead>
            <HeroTagline>
              Expect concise reading, calmer presentation and topics that stay close to the real product: privacy, etiquette, setup, payments, platform updates and the evolution of live online interaction.
            </HeroTagline>
          </HeroContent>

          <HeroAside aria-hidden="true">
            <HeroAsideInner>
              <HeroAsideCard data-large="true">
                <HeroAsideCardTop />
                <HeroAsideCardBody />
              </HeroAsideCard>

              <HeroAsideRow>
                <HeroAsideMini>
                  <HeroAsideMiniLine />
                  <HeroAsideMiniLine />
                  <HeroAsideMiniLine />
                </HeroAsideMini>
                <HeroAsideMini>
                  <HeroAsideMiniLine />
                  <HeroAsideMiniLine />
                  <HeroAsideMiniLine />
                </HeroAsideMini>
              </HeroAsideRow>
            </HeroAsideInner>
          </HeroAside>
        </HeroSection>

        <ContentGrid>
          <MainColumn>
            <SectionLabel>Latest articles</SectionLabel>
            {loading ? (
              <EmptyState>Cargando artículos…</EmptyState>
            ) : error ? (
              <EmptyState>No se pudo cargar el listado: {error}</EmptyState>
            ) : articles.length === 0 ? (
              <EmptyState>Aún no hay artículos publicados. Vuelve pronto.</EmptyState>
            ) : (
              <ArticlesGrid>
                {articles.map((a) => (
                  <ArticleCard
                    key={a.id}
                    onClick={() => goToArticle(a.slug)}
                    style={{ cursor: 'pointer' }}
                  >
                    {a.category ? <ArticleBadge>{a.category}</ArticleBadge> : null}
                    <ArticleTitle>{a.title}</ArticleTitle>
                    <ArticleMeta>
                      {a.locale ? a.locale.toUpperCase() : ''}
                      {a.publishedAt ? ` · ${fmtDate(a.publishedAt)}` : ''}
                    </ArticleMeta>
                    {a.brief ? <ArticleExcerpt>{truncate(a.brief, 200)}</ArticleExcerpt> : null}
                  </ArticleCard>
                ))}
              </ArticlesGrid>
            )}

            {isPublic && (
              <CTABox>
                <CTATitle>Explore the platform while the editorial section keeps growing.</CTATitle>
                <CTAText>
                  If you want a more direct sense of how the experience works, you can already enter as a user or prepare your profile as a model while new articles are being published.
                </CTAText>
                <CTAActions>
                  <NavButton type="button" onClick={handleRegisterClient}>Crear cuenta de usuario</NavButton>
                  <NavButton type="button" onClick={handleRegisterModel}>Registrarme como modelo</NavButton>
                </CTAActions>
              </CTABox>
            )}
          </MainColumn>

          <Sidebar>
            <SidebarTitle>What you will find here</SidebarTitle>
            <SidebarText>
              The goal is to publish short, practical reading that answers real questions without filler: payments, safety, model workflows, product updates and the broader shift toward live digital interaction.
            </SidebarText>
            <SidebarTitle>Planned topics</SidebarTitle>
            <TagPills>
              <TagPill>User guides</TagPill>
              <TagPill>Model advice</TagPill>
              <TagPill>Safety and privacy</TagPill>
              <TagPill>Product updates</TagPill>
              <TagPill>Monetization</TagPill>
            </TagPills>
            <SidebarText>
              The editorial section will expand gradually, following the real rhythm of the platform and focusing first on the topics users and models actually need.
            </SidebarText>
          </Sidebar>
        </ContentGrid>
      </PageInner>
    </PageWrap>
  );
};

export default BlogContent;
