// src/pages/blog/BlogContent.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  ArticleCardImage,
  ArticleBadge,
  ArticleTitle,
  ArticleMeta,
  ArticleExcerpt,
  Sidebar,
  SidebarTitle,
  SidebarSearchInput,
  SidebarCategoryList,
  SidebarCategoryBlock,
  SidebarCategoryHeader,
  SidebarCategoryName,
  SidebarCategoryCount,
  SidebarCategoryChevron,
  SidebarArticleList,
  SidebarArticleLink,
  CTABox,
  CTATitle,
  CTAText,
  CTAActions,
  EmptyState
} from '../../styles/pages-styles/BlogStyles';
import {
  upsertMeta,
  upsertCanonicalLink,
  upsertJsonLd,
  upsertLink,
  truncate,
} from './seoHelpers';

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

const getReadingMinutes = (htmlOrText) => {
  if (!htmlOrText) return 1;
  const text = String(htmlOrText).replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 225));
};

const BlogContent = ({
  mode = 'public',
  locale = 'es',
  onGoRegisterClient,
  onGoRegisterModel,
}) => {
  const isPublic = mode === 'public';
  const handleRegisterClient = () => { if (onGoRegisterClient) onGoRegisterClient(); };
  const handleRegisterModel = () => { if (onGoRegisterModel) onGoRegisterModel(); };

  // Chrome del blog internacionalizado via namespace 'blog'.
  // Paquete 5 (ADR-025): el locale del listado viene del path
  // (`/blog/{locale}`), pasado como prop por Blog.jsx. No depende de
  // i18n.language. El backend filtra articulos por (locale, status).
  const { t } = useTranslation();

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  // Debounce 250 ms entre el keystroke (query) y el filtrado real
  // (debouncedQuery). Evita recalcular el useMemo de filteredArticles
  // en cada tecla y reduce trabajo en listados grandes. Sub-pasada 3A
  // (hardening del buscador). Sin libreria externa: setTimeout + cleanup.
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query);
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  const toggleCategory = (cat) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const categoriesWithArticles = useMemo(() => {
    const map = new Map();
    articles.forEach((a) => {
      if (!a.category) return;
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category).push(a);
    });
    return Array.from(map.entries())
      .map(([cat, arts]) => ({
        name: cat,
        articles: arts.sort((x, y) => {
          const dx = x.publishedAt ? new Date(x.publishedAt).getTime() : 0;
          const dy = y.publishedAt ? new Date(y.publishedAt).getTime() : 0;
          return dy - dx;
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }, [articles]);

  const filteredArticles = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.brief || '').toLowerCase().includes(q)
    );
  }, [articles, debouncedQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    // Paquete 5 (ADR-025): locale viene como prop desde la URL
    // (`/blog/{locale}`), no de i18n.language. El componente se remonta
    // al navegar entre /blog/es y /blog/en porque las rutas son distintas.
    apiFetch(`/public/content/articles?size=50&locale=${encodeURIComponent(locale)}`)
      .then((data) => {
        if (cancelled) return;
        setArticles(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((e) => {
        if (cancelled) return;
        // No mostramos e.message al usuario porque puede contener
        // HTML del 502 de nginx o stack trace tecnico. Mensaje
        // generico amable, cualquiera que sea la causa del fallo.
        console.error('Blog listing fetch failed:', e);
        setError(t('blog:states.errorListing'));
        setArticles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SEO del listado /blog. Se dispara con cada cambio de articles (carga
  // inicial + futuros refrescos). Mismo patron que BlogArticleView.jsx
  // (C2/C3) pero con menos campos y JSON-LD Blog/blogPost en vez de
  // BlogPosting individual. Cleanup elimina hreflang y JSON-LD del
  // listado al desmontar; deja og:*/twitter:*/canonical/description para
  // que el siguiente useEffect SEO (detalle u otro listado) los sobreescriba.
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return undefined;
    }
    const baseUrl = window.location.origin;
    // Paquete 5 (ADR-025): URLs publicas siempre con locale en path.
    const blogUrl = `${baseUrl}/blog/${locale}`;
    const blogUrlEs = `${baseUrl}/blog/es`;
    const blogUrlEn = `${baseUrl}/blog/en`;
    const prevTitle = document.title;

    const title = locale === 'en'
      ? 'Blog · SharemeChat — 1-on-1 live video chat'
      : 'Blog · SharemeChat — Videochat 1 a 1 en directo';
    const description = locale === 'en'
      ? 'Articles, guides and product notes about 1-on-1 live video chat. Privacy, safety, payments and platform updates.'
      : 'Artículos, guías y notas de producto sobre videochat 1 a 1 en directo. Privacidad, seguridad, pagos y novedades de la plataforma.';

    document.title = title;
    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertCanonicalLink(blogUrl);

    // hreflang multilingue (paquete 5): es/en sin region + x-default al ES.
    upsertLink(
      'link[rel="alternate"][hreflang="es"]',
      { rel: 'alternate', hreflang: 'es', href: blogUrlEs }
    );
    upsertLink(
      'link[rel="alternate"][hreflang="en"]',
      { rel: 'alternate', hreflang: 'en', href: blogUrlEn }
    );
    upsertLink(
      'link[rel="alternate"][hreflang="x-default"]',
      { rel: 'alternate', hreflang: 'x-default', href: blogUrlEs }
    );

    // Open Graph
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: blogUrl });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'SharemeChat' });
    upsertMeta('meta[property="og:locale"]', {
      property: 'og:locale',
      content: locale === 'en' ? 'en_US' : 'es_ES',
    });
    upsertMeta('meta[property="og:image"]', {
      property: 'og:image',
      content: `${baseUrl}/logo192.png`,
    });

    // Twitter Card (summary porque el logo no es 1200x630 optimo para large)
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });

    // JSON-LD Blog. Solo emitir si hay articulos cargados (evita Blog vacio
    // durante el primer render mientras el fetch resuelve).
    if (articles.length > 0) {
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: t('blog:hero.kicker'),
        url: blogUrl,
        description,
        inLanguage: locale === 'en' ? 'en-US' : 'es-ES',
        publisher: {
          '@type': 'Organization',
          name: 'SharemeChat',
          logo: {
            '@type': 'ImageObject',
            url: `${baseUrl}/logo192.png`,
          },
        },
        blogPost: articles.map((a) => ({
          '@type': 'BlogPosting',
          headline: a.title,
          url: `${baseUrl}/blog/${locale}/${a.slug}`,
          ...(a.brief ? { description: truncate(a.brief, 160) } : {}),
          ...(a.publishedAt ? { datePublished: a.publishedAt } : {}),
          ...(a.heroImageUrl ? { image: a.heroImageUrl } : {}),
          ...(a.category ? { articleSection: a.category } : {}),
        })),
      };
      upsertJsonLd('blog-listing', jsonLd);
    }

    return () => {
      // Restaurar title baseline (C0) al salir del listado.
      document.title = 'SharemeChat — Videochat 1 a 1 en directo';

      // Eliminar hreflang del listado al desmontar / cambiar de articles.
      document.head
        .querySelectorAll('link[rel="alternate"][hreflang]')
        .forEach((el) => el.parentNode.removeChild(el));

      // Eliminar el JSON-LD del listado. El helper upsertJsonLd usa
      // data-jsonld-id, no getElementById, asi que limpiamos por ambos
      // selectores defensivamente.
      const ld =
        document.head.querySelector('script[data-jsonld-id="blog-listing"]') ||
        document.getElementById('blog-listing');
      if (ld && ld.parentNode) ld.parentNode.removeChild(ld);

      // No eliminamos og:*/twitter:*/canonical/description: los sobreescribira
      // el siguiente useEffect SEO (detalle de articulo u otro listado).
      // prevTitle se guarda como referencia pero no se restaura para no
      // chocar con el title del proximo componente que aplique SEO.
      void prevTitle;
    };
  }, [articles]);

  return (
    <PageWrap>
      <PageInner>
        <HeroSection>
          <HeroContent>
            <HeroKicker>{t('blog:hero.kicker')}</HeroKicker>
            <HeroTitle>{t('blog:hero.title')}</HeroTitle>
            <HeroLead>{t('blog:hero.lead')}</HeroLead>
            <HeroTagline>{t('blog:hero.tagline')}</HeroTagline>
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
            <SectionLabel>{t('blog:listing.sectionLabel')}</SectionLabel>
            {loading ? (
              <EmptyState>{t('blog:states.loadingListing')}</EmptyState>
            ) : error ? (
              <EmptyState>{error}</EmptyState>
            ) : articles.length === 0 ? (
              <EmptyState>{t('blog:states.empty')}</EmptyState>
            ) : filteredArticles.length === 0 ? (
              <EmptyState>{t('blog:states.noResults')}</EmptyState>
            ) : (
              <ArticlesGrid>
                {filteredArticles.map((a) => (
                  <ArticleCard
                    key={a.id}
                    as={Link}
                    to={`/blog/${locale}/${a.slug}`}
                  >
                    {a.heroImageUrl ? (
                      <ArticleCardImage>
                        <img src={a.heroImageUrl} alt={a.title || ''} loading="lazy" />
                      </ArticleCardImage>
                    ) : null}
                    {a.category ? <ArticleBadge>{a.category}</ArticleBadge> : null}
                    <ArticleTitle>{a.title}</ArticleTitle>
                    <ArticleMeta>
                      {a.locale ? a.locale.toUpperCase() : ''}
                      {a.publishedAt ? ` · ${fmtDate(a.publishedAt)}` : ''}
                      {` · ${getReadingMinutes(a.brief || '')} ${t('blog:card.readingTimeUnit')}`}
                    </ArticleMeta>
                    {a.brief ? <ArticleExcerpt>{truncate(a.brief, 200)}</ArticleExcerpt> : null}
                  </ArticleCard>
                ))}
              </ArticlesGrid>
            )}

            {isPublic && (
              <CTABox>
                <CTATitle>{t('blog:cta.title')}</CTATitle>
                <CTAText>{t('blog:cta.text')}</CTAText>
                <CTAActions>
                  <NavButton type="button" onClick={handleRegisterClient}>{t('blog:cta.registerClient')}</NavButton>
                  <NavButton type="button" onClick={handleRegisterModel}>{t('blog:cta.registerModel')}</NavButton>
                </CTAActions>
              </CTABox>
            )}
          </MainColumn>

          <Sidebar>
            <SidebarTitle>{t('blog:sidebar.searchHeading')}</SidebarTitle>
            <SidebarSearchInput
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('blog:sidebar.searchPlaceholder')}
              aria-label={t('blog:sidebar.searchAriaLabel')}
              maxLength={100}
            />

            {categoriesWithArticles.length > 0 ? (
              <>
                <SidebarTitle style={{ marginTop: 22 }}>{t('blog:sidebar.categoriesHeading')}</SidebarTitle>
                <SidebarCategoryList>
                  {categoriesWithArticles.map(({ name, articles: catArticles }) => {
                    const isExpanded = expandedCategories.has(name);
                    return (
                      <SidebarCategoryBlock key={name}>
                        <SidebarCategoryHeader
                          type="button"
                          $active={isExpanded}
                          onClick={() => toggleCategory(name)}
                          aria-expanded={isExpanded}
                        >
                          <SidebarCategoryName>{name}</SidebarCategoryName>
                          <SidebarCategoryCount>({catArticles.length})</SidebarCategoryCount>
                          <SidebarCategoryChevron $expanded={isExpanded}>▾</SidebarCategoryChevron>
                        </SidebarCategoryHeader>
                        {isExpanded ? (
                          <SidebarArticleList>
                            {catArticles.map((art) => (
                              <SidebarArticleLink
                                key={art.id}
                                as={Link}
                                to={`/blog/${locale}/${art.slug}`}
                              >
                                {art.title}
                              </SidebarArticleLink>
                            ))}
                          </SidebarArticleList>
                        ) : null}
                      </SidebarCategoryBlock>
                    );
                  })}
                </SidebarCategoryList>
              </>
            ) : null}
          </Sidebar>
        </ContentGrid>
      </PageInner>
    </PageWrap>
  );
};

export default BlogContent;
