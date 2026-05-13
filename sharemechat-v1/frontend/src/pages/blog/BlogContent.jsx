// src/pages/blog/BlogContent.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

const BlogContent = ({ mode = 'public', onGoRegisterClient, onGoRegisterModel }) => {
  const isPublic = mode === 'public';
  const handleRegisterClient = () => { if (onGoRegisterClient) onGoRegisterClient(); };
  const handleRegisterModel = () => { if (onGoRegisterModel) onGoRegisterModel(); };

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(new Set());

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
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) =>
      (a.title || '').toLowerCase().includes(q) ||
      (a.brief || '').toLowerCase().includes(q)
    );
  }, [articles, query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    apiFetch('/public/content/articles?size=50')
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
        setError('No se pudo cargar el blog. Vuelve a intentarlo en unos minutos.');
        setArticles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
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
    const blogUrl = `${baseUrl}/blog`;
    const prevTitle = document.title;

    const title = 'Blog · SharemeChat — Videochat 1 a 1 en directo';
    const description =
      'Artículos, guías y notas de producto sobre videochat 1 a 1 en directo. Privacidad, seguridad, pagos y novedades de la plataforma.';

    document.title = title;
    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertCanonicalLink(blogUrl);

    // hreflang alternates (mismo patron que el detalle: hoy solo es-ES)
    upsertLink(
      'link[rel="alternate"][hreflang="es-ES"]',
      { rel: 'alternate', hreflang: 'es-ES', href: blogUrl }
    );
    upsertLink(
      'link[rel="alternate"][hreflang="x-default"]',
      { rel: 'alternate', hreflang: 'x-default', href: blogUrl }
    );

    // Open Graph
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: blogUrl });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'SharemeChat' });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'es_ES' });
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
        name: 'SharemeChat Journal',
        url: blogUrl,
        description,
        inLanguage: 'es-ES',
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
          url: `${baseUrl}/blog/${a.slug}`,
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
            <HeroKicker>SharemeChat Journal</HeroKicker>
            <HeroTitle>Artículos, guías y notas de producto sobre videochat 1 a 1 en directo.</HeroTitle>
            <HeroLead>
              Este espacio se está construyendo como una capa editorial práctica para usuarios y modelos que buscan explicaciones claras, mejor contexto y perspectivas útiles sobre la plataforma.
            </HeroLead>
            <HeroTagline>
              Lecturas concisas, presentación calmada y temas pegados al producto real: privacidad, etiqueta, configuración, pagos, novedades de la plataforma y la evolución de la interacción en directo.
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
            <SectionLabel>Últimos artículos</SectionLabel>
            {loading ? (
              <EmptyState>Cargando artículos…</EmptyState>
            ) : error ? (
              <EmptyState>{error}</EmptyState>
            ) : articles.length === 0 ? (
              <EmptyState>Aún no hay artículos publicados. Vuelve pronto.</EmptyState>
            ) : filteredArticles.length === 0 ? (
              <EmptyState>No hay artículos que coincidan con la búsqueda.</EmptyState>
            ) : (
              <ArticlesGrid>
                {filteredArticles.map((a) => (
                  <ArticleCard
                    key={a.id}
                    as={Link}
                    to={`/blog/${a.slug}`}
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
                      {` · ${getReadingMinutes(a.brief || '')} min`}
                    </ArticleMeta>
                    {a.brief ? <ArticleExcerpt>{truncate(a.brief, 200)}</ArticleExcerpt> : null}
                  </ArticleCard>
                ))}
              </ArticlesGrid>
            )}

            {isPublic && (
              <CTABox>
                <CTATitle>Explora la plataforma mientras la sección editorial sigue creciendo.</CTATitle>
                <CTAText>
                  Si quieres entender de forma más directa cómo funciona la experiencia, puedes entrar como usuario o preparar tu perfil como modelo mientras se publican nuevos artículos.
                </CTAText>
                <CTAActions>
                  <NavButton type="button" onClick={handleRegisterClient}>Crear cuenta de usuario</NavButton>
                  <NavButton type="button" onClick={handleRegisterModel}>Registrarme como modelo</NavButton>
                </CTAActions>
              </CTABox>
            )}
          </MainColumn>

          <Sidebar>
            <SidebarTitle>Buscar</SidebarTitle>
            <SidebarSearchInput
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en el blog..."
              aria-label="Buscar artículos"
            />

            {categoriesWithArticles.length > 0 ? (
              <>
                <SidebarTitle style={{ marginTop: 22 }}>Categorías</SidebarTitle>
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
                                to={`/blog/${art.slug}`}
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
