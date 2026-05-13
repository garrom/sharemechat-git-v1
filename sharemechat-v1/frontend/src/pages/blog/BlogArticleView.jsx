// src/pages/blog/BlogArticleView.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { apiFetch } from '../../config/http';
import { GlobalBlack } from '../../styles/public-styles/HomeStyles';
import PublicNavbar from '../../components/navbar/PublicNavbar';
import {
  PageWrap,
  PageInner,
  ArticleHero,
  ArticleCategoryPill,
  ArticleHeroTitle,
  ArticleMetaLine,
  ArticleHeroImage,
  ArticleBriefBox,
  ArticleBody,
  ArticleFooterMeta,
  ShareRow,
  ShareLabel,
  ShareButtons,
  ShareLink,
  CopyLinkButton,
  RelatedSection,
  RelatedHeading,
  RelatedGrid,
  RelatedCard,
  RelatedCardImage,
  RelatedCardBadge,
  RelatedCardTitle,
  BackLink,
  EmptyState,
  TagPills,
  TagPill,
} from '../../styles/pages-styles/BlogStyles';
import {
  upsertMeta,
  upsertCanonicalLink,
  upsertJsonLd,
  truncate,
  removeMeta,
  mapLocaleToBcp47,
  mapLocaleToOg,
  upsertLink,
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

const pickRelated = (allArticles, current, n = 3) => {
  if (!Array.isArray(allArticles) || allArticles.length === 0 || !current) {
    return [];
  }
  const currentSlug = current.slug;
  const currentCategory = current.category || null;

  const byPublishedDesc = (x, y) => {
    const dx = x.publishedAt ? new Date(x.publishedAt).getTime() : 0;
    const dy = y.publishedAt ? new Date(y.publishedAt).getTime() : 0;
    return dy - dx;
  };

  const pool = allArticles
    .filter((a) => a && a.slug && a.slug !== currentSlug)
    .filter((a) => !a.state || a.state === 'PUBLISHED');

  const byCategory = new Map();
  pool.forEach((a) => {
    const cat = a.category || '__nocat__';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(a);
  });
  byCategory.forEach((list) => list.sort(byPublishedDesc));

  const picked = [];
  const usedSlugs = new Set();

  byCategory.forEach((list, cat) => {
    if (cat === currentCategory) return;
    if (picked.length >= n) return;
    const candidate = list[0];
    if (candidate && !usedSlugs.has(candidate.slug)) {
      picked.push(candidate);
      usedSlugs.add(candidate.slug);
    }
  });

  if (picked.length < n) {
    const remaining = pool
      .filter((a) => !usedSlugs.has(a.slug))
      .sort(byPublishedDesc);
    for (const candidate of remaining) {
      if (picked.length >= n) break;
      picked.push(candidate);
      usedSlugs.add(candidate.slug);
    }
  }

  return picked.slice(0, n);
};

// keywords viene del backend como JSON string canonico (p.ej. '["a","b"]')
// o como string libre. Devolvemos un array siempre.
const parseKeywords = (raw) => {
  if (!raw) return [];
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
};

// SEO helpers (upsertMeta, upsertCanonicalLink, upsertJsonLd, truncate)
// viven en ./seoHelpers para reusarlos también desde BlogContent.jsx.

export default function BlogArticleView() {
  const { slug } = useParams();
  const history = useHistory();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // ADR-016: artículos retractados devuelven 410 Gone con tombstone JSON
  // {error:"retracted", slug, retracted_at}. El componente NO redirige y NO
  // muestra detalles: solo "Este artículo ya no está disponible." + noindex.
  const [retracted, setRetracted] = useState(false);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [copied, setCopied] = useState(false);

  const goLogin = useCallback(() => history.push('/login'), [history]);
  const goHome = useCallback((e) => {
    if (e) e.preventDefault();
    history.push('/');
  }, [history]);
  const goBlog = useCallback(() => history.push('/blog'), [history]);

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setError('slug ausente');
      setLoading(false);
      return () => {};
    }
    setLoading(true);
    setError('');
    setArticle(null);
    setRetracted(false);
    apiFetch(`/public/content/articles/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (cancelled) return;
        setArticle(data);
      })
      .catch((e) => {
        if (cancelled) return;
        // 410 Gone -> artículo retractado. apiFetch envuelve el error con
        // status y data parseados desde el body JSON del backend.
        if (e?.status === 410 || e?.data?.error === 'retracted') {
          setRetracted(true);
          setError('');
          return;
        }
        // Rama genérica: no mostramos e.message al usuario (puede ser
        // HTML del 502 de nginx o stack trace). Mensaje amable.
        console.error('Blog article fetch failed:', e);
        setError('No se pudo cargar el artículo. Vuelve a intentarlo en unos minutos.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  // Fetch del listado completo para calcular related en cliente.
  // Independiente del fetch del detalle: se dispara también con el cambio de slug
  // para refrescar related al navegar entre artículos.
  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setRelatedArticles([]);
      return () => {};
    }
    setRelatedArticles([]);
    apiFetch('/public/content/articles?size=50')
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setRelatedArticles(items);
      })
      .catch(() => {
        if (cancelled) return;
        setRelatedArticles([]);
      });
    return () => { cancelled = true; };
  }, [slug]);

  const handleCopyLink = async () => {
    if (!article || !article.slug) return;
    const url = `${window.location.origin}/blog/${article.slug}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const temp = document.createElement('textarea');
        temp.value = url;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Silenciar; el botón no cambia
    }
  };

  // Inyectar <meta name="robots" content="noindex"> mientras el artículo está
  // marcado como retractado, para reforzar la desindexación incluso si Google
  // ya tiene cacheada la URL.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!retracted) return undefined;
    const prevTitle = document.title;
    document.title = 'Artículo retirado | SharemeChat';
    upsertMeta('meta[name="robots"]', { name: 'robots', content: 'noindex' });
    return () => {
      document.title = prevTitle;
      const robots = document.head.querySelector('meta[name="robots"]');
      if (robots) robots.parentNode.removeChild(robots);
    };
  }, [retracted]);

  // Inyeccion de meta tags + JSON-LD en <head> al cargar el articulo.
  // Decisiones:
  //  - baseUrl = window.location.origin (siempre coincide con el host por el
  //    que el bot entro; ADR-015 garantiza apex unico canonico por entorno).
  //  - SharemeChat no tiene aun seoTitle/metaDescription dedicados a nivel de
  //    columna; usamos title como seoTitle y brief truncado como meta.
  //  - og:image se omite mientras no exista heroImageUrl en el DTO.
  useEffect(() => {
    if (!article) return undefined;

    const baseUrl =
      typeof window !== 'undefined' && window.location && window.location.origin
        ? window.location.origin
        : '';
    const articleUrl = `${baseUrl}/blog/${article.slug}`;
    const seoTitle = article.seoTitle || article.title || 'Artículo';
    const metaDescription =
      article.metaDescription || truncate(article.brief || '', 160);
    const inLanguage = mapLocaleToBcp47(article.locale);
    const ogLocale = mapLocaleToOg(article.locale);

    const prevTitle = document.title;
    document.title = `${seoTitle} | SharemeChat`;

    upsertMeta('meta[name="description"]', { name: 'description', content: metaDescription });
    upsertCanonicalLink(articleUrl);

    // hreflang alternates: hoy solo espanol; x-default apunta a la misma
    // URL. Cuando existan traducciones reales, anadir mas hreflang con
    // sus URLs alternas correspondientes.
    upsertLink(
      'link[rel="alternate"][hreflang="es-ES"]',
      { rel: 'alternate', hreflang: 'es-ES', href: articleUrl }
    );
    upsertLink(
      'link[rel="alternate"][hreflang="x-default"]',
      { rel: 'alternate', hreflang: 'x-default', href: articleUrl }
    );

    // Open Graph
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'article' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: seoTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: metaDescription });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: articleUrl });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'SharemeChat' });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: ogLocale });

    // og:image / twitter:image condicionales segun heroImageUrl.
    const hasHeroImage = !!article.heroImageUrl;
    if (hasHeroImage) {
      upsertMeta('meta[property="og:image"]', {
        property: 'og:image',
        content: article.heroImageUrl,
      });
      upsertMeta('meta[name="twitter:image"]', {
        name: 'twitter:image',
        content: article.heroImageUrl,
      });
    } else {
      removeMeta('meta[property="og:image"]');
      removeMeta('meta[name="twitter:image"]');
    }

    // article:* tags (Open Graph para articulos)
    if (article.publishedAt) {
      upsertMeta('meta[property="article:published_time"]', {
        property: 'article:published_time',
        content: article.publishedAt,
      });
    } else {
      removeMeta('meta[property="article:published_time"]');
    }

    if (article.updatedAt) {
      upsertMeta('meta[property="article:modified_time"]', {
        property: 'article:modified_time',
        content: article.updatedAt,
      });
    } else {
      removeMeta('meta[property="article:modified_time"]');
    }

    if (article.category) {
      upsertMeta('meta[property="article:section"]', {
        property: 'article:section',
        content: article.category,
      });
    } else {
      removeMeta('meta[property="article:section"]');
    }

    // article:tag: limpiar previos (cantidad variable entre articulos) y
    // emitir uno por keyword.
    document.head
      .querySelectorAll('meta[property="article:tag"]')
      .forEach((el) => el.parentNode.removeChild(el));

    const tagList = parseKeywords(article.keywords);
    tagList.forEach((tag) => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'article:tag');
      meta.setAttribute('content', tag);
      document.head.appendChild(meta);
    });

    // Autoria y publisher (meta tags estandar; tambien dentro del JSON-LD).
    upsertMeta('meta[name="author"]', { name: 'author', content: 'Equipo SharemeChat' });
    upsertMeta('meta[name="publisher"]', { name: 'publisher', content: 'SharemeChat' });

    // Twitter
    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: hasHeroImage ? 'summary_large_image' : 'summary',
    });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seoTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: metaDescription });

    // JSON-LD BlogPosting (schema.org). BlogPosting es subclase de Article
    // y Google lo prefiere para entradas de blog: habilita rich results
    // mas ricos y desambigua frente a paginas estaticas.
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: seoTitle,
      description: metaDescription,
      url: articleUrl,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': articleUrl,
      },
      datePublished: article.publishedAt || undefined,
      dateModified: article.updatedAt || article.publishedAt || undefined,
      inLanguage,
      ...(article.category ? { articleSection: article.category } : {}),
      ...(tagList.length > 0 ? { keywords: tagList.join(', ') } : {}),
      author: {
        '@type': 'Organization',
        name: 'Equipo SharemeChat',
      },
      publisher: {
        '@type': 'Organization',
        name: 'SharemeChat',
        url: baseUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/logo192.png`,
        },
      },
    };
    if (article.heroImageUrl) {
      jsonLd.image = article.heroImageUrl;
    }
    upsertJsonLd('blog-article', jsonLd);

    return () => {
      // Restaurar el title baseline al desmontar para no contaminar otras
      // paginas del SPA.
      document.title = prevTitle;
      // Limpieza ampliada de meta tags especificas del articulo. El resto
      // (og:title, og:description, twitter:title, etc.) se sobreescribe
      // en el siguiente render para evitar parpadeos durante navegacion.
      removeMeta('meta[property="og:image"]');
      removeMeta('meta[name="twitter:image"]');
      removeMeta('meta[property="article:published_time"]');
      removeMeta('meta[property="article:modified_time"]');
      removeMeta('meta[property="article:section"]');
      document.head
        .querySelectorAll('meta[property="article:tag"]')
        .forEach((el) => el.parentNode.removeChild(el));
      // Eliminar hreflang del articulo previo al desmontar/cambiar.
      // Selector robusto: si en el futuro se emiten mas de 2 hreflang
      // (uno por idioma), este cleanup los limpia todos sin necesidad de
      // mantener una lista. NO afecta a <link rel="canonical">.
      document.head
        .querySelectorAll('link[rel="alternate"][hreflang]')
        .forEach((el) => el.parentNode.removeChild(el));
    };
  }, [article]);

  const keywords = parseKeywords(article?.keywords);

  return (
    <>
      <GlobalBlack />

      <PublicNavbar
        activeTab="blog"
        onBrandClick={goHome}
        onGoVideochat={goLogin}
        onGoFavorites={goLogin}
        onGoBlog={goBlog}
        onBuy={goLogin}
        onLogin={goLogin}
        showLocaleSwitcher={false}
        showBottomNav={true}
      />

      <PageWrap>
        <PageInner>
          <BackLink type="button" onClick={goBlog}>← Volver al blog</BackLink>

          {loading ? (
            <EmptyState>Cargando artículo…</EmptyState>
          ) : retracted ? (
            <EmptyState>Este artículo ya no está disponible.</EmptyState>
          ) : error ? (
            <EmptyState>{error}</EmptyState>
          ) : !article ? (
            <EmptyState>Artículo no encontrado.</EmptyState>
          ) : (
            <>
              <ArticleHero>
                {article.category ? (
                  <ArticleCategoryPill>{article.category}</ArticleCategoryPill>
                ) : null}
                <ArticleHeroTitle>{article.title}</ArticleHeroTitle>
                <ArticleMetaLine>
                  {article.locale ? article.locale.toUpperCase() : ''}
                  {article.publishedAt ? ` · Publicado ${fmtDate(article.publishedAt)}` : ''}
                  {` · ${getReadingMinutes(article.htmlBody || '')} min`}
                </ArticleMetaLine>
                {article.heroImageUrl ? (
                  <ArticleHeroImage>
                    <img src={article.heroImageUrl} alt={article.title || ''} loading="lazy" />
                  </ArticleHeroImage>
                ) : null}
                {article.brief ? <ArticleBriefBox>{article.brief}</ArticleBriefBox> : null}
              </ArticleHero>

              {/* htmlBody ya viene sanitizado por el backend (jsoup allowlist) */}
              <ArticleBody
                dangerouslySetInnerHTML={{ __html: article.htmlBody || '' }}
              />

              <ShareRow>
                <ShareLabel>Compártelo</ShareLabel>
                <ShareButtons>
                  <ShareLink href="#" data-network="x" aria-label="SharemeChat en X" target="_blank" rel="noopener noreferrer">𝕏</ShareLink>
                  <ShareLink href="#" data-network="meta" aria-label="SharemeChat en Meta" target="_blank" rel="noopener noreferrer">f</ShareLink>
                  <ShareLink href="#" data-network="instagram" aria-label="SharemeChat en Instagram" target="_blank" rel="noopener noreferrer">IG</ShareLink>
                  <ShareLink href="#" data-network="tiktok" aria-label="SharemeChat en TikTok" target="_blank" rel="noopener noreferrer">TK</ShareLink>
                  <CopyLinkButton type="button" onClick={handleCopyLink}>
                    {copied ? '✓ Copiado' : 'Copiar enlace'}
                  </CopyLinkButton>
                </ShareButtons>
              </ShareRow>

              {(() => {
                const picks = pickRelated(relatedArticles, article, 3);
                if (picks.length === 0) return null;
                return (
                  <RelatedSection>
                    <RelatedHeading>Quizás te interese</RelatedHeading>
                    <RelatedGrid>
                      {picks.map((r) => (
                        <RelatedCard
                          key={r.id}
                          as={Link}
                          to={`/blog/${r.slug}`}
                        >
                          {r.heroImageUrl ? (
                            <RelatedCardImage>
                              <img src={r.heroImageUrl} alt={r.title || ''} loading="lazy" />
                            </RelatedCardImage>
                          ) : null}
                          {r.category ? <RelatedCardBadge>{r.category}</RelatedCardBadge> : null}
                          <RelatedCardTitle>{r.title}</RelatedCardTitle>
                        </RelatedCard>
                      ))}
                    </RelatedGrid>
                  </RelatedSection>
                );
              })()}

              <ArticleFooterMeta>
                {keywords.length > 0 ? (
                  <TagPills>
                    {keywords.map((k) => <TagPill key={k}>{k}</TagPill>)}
                  </TagPills>
                ) : null}
                {article.disclosureRequired ? (
                  <span>
                    Contenido elaborado con asistencia de IA.{' '}
                    <Link to="/legal?tab=ai-disclosure">Más información.</Link>
                  </span>
                ) : null}
              </ArticleFooterMeta>
            </>
          )}
        </PageInner>
      </PageWrap>
    </>
  );
}
