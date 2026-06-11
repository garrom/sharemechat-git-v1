// src/pages/blog/BlogArticleView.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_WIDTH,
  DEFAULT_OG_IMAGE_HEIGHT,
} from './seoHelpers';
import { BlogLocaleContext } from './BlogLocaleContext';

const VALID_LOCALES = ['es', 'en'];

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
  const { locale: localeFromPath, slug } = useParams();
  const locale = VALID_LOCALES.includes(localeFromPath) ? localeFromPath : 'es';
  const history = useHistory();

  // Chrome del detalle internacionalizado via namespace 'blog'.
  // Paquete 5 (ADR-025): el locale viene del path (`/blog/{locale}/{slug}`),
  // no de i18n.language. El componente se remonta al navegar entre locales.
  const { t } = useTranslation();

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
  const goBlog = useCallback(() => history.push(`/blog/${locale}`), [history, locale]);

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
    // Paquete 5 (ADR-025): el detalle se resuelve por (slug, locale) ambos
    // del path. El backend devuelve 404 si la combinacion no existe (el
    // componente lo maneja mostrando t('blog:states.notFound')).
    apiFetch(`/public/content/articles/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`)
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
        setError(t('blog:states.errorArticle'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Paquete 5 (ADR-025): related se calcula sobre el listado del MISMO
    // locale que el articulo actual (no se mezclan locales en related).
    apiFetch(`/public/content/articles?size=50&locale=${encodeURIComponent(locale)}`)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const handleCopyLink = async () => {
    if (!article || !article.slug) return;
    const url = `${window.location.origin}/blog/${locale}/${article.slug}`;
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
    document.title = `${t('blog:meta.retractedTitle')} | ${t('blog:meta.titleSuffix')}`;
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
  //  - og:image: si el articulo trae heroImageUrl propia, se usa esa;
  //    si no, cae en la card de marca 1200x630 (DEFAULT_OG_IMAGE).
  //    logo192 SOLO se usa en publisher.logo del JSON-LD.
  useEffect(() => {
    if (!article) return undefined;

    const baseUrl =
      typeof window !== 'undefined' && window.location && window.location.origin
        ? window.location.origin
        : '';
    const articleUrl = `${baseUrl}/blog/${article.locale}/${article.slug}`;
    const seoTitle = article.seoTitle || article.title || t('blog:meta.seoTitleFallback');
    const metaDescription =
      article.metaDescription || truncate(article.brief || '', 160);
    const inLanguage = mapLocaleToBcp47(article.locale);
    const ogLocale = mapLocaleToOg(article.locale);

    const prevTitle = document.title;
    document.title = `${seoTitle} | ${t('blog:meta.titleSuffix')}`;

    upsertMeta('meta[name="description"]', { name: 'description', content: metaDescription });
    upsertCanonicalLink(articleUrl);

    // Paquete 5 (ADR-025): hreflang multilingue real desde article.alternates.
    // Emitimos el del locale actual + uno por cada alternate publicado +
    // x-default apuntando al ES si existe (o al locale actual si no).
    upsertLink(
      `link[rel="alternate"][hreflang="${article.locale}"]`,
      { rel: 'alternate', hreflang: article.locale, href: articleUrl }
    );
    const alternates = Array.isArray(article.alternates) ? article.alternates : [];
    alternates.forEach((alt) => {
      if (!alt || !alt.locale || !alt.url) return;
      upsertLink(
        `link[rel="alternate"][hreflang="${alt.locale}"]`,
        { rel: 'alternate', hreflang: alt.locale, href: alt.url }
      );
    });
    const esAlternate = article.locale === 'es'
      ? articleUrl
      : (alternates.find((a) => a.locale === 'es')?.url || articleUrl);
    upsertLink(
      'link[rel="alternate"][hreflang="x-default"]',
      { rel: 'alternate', hreflang: 'x-default', href: esAlternate }
    );

    // Open Graph
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'article' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: seoTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: metaDescription });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: articleUrl });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'SharemeChat' });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: ogLocale });

    // og:image / twitter:image:
    //  - Si el articulo tiene heroImageUrl propia, se usa esa.
    //  - Si no, cae en la card de marca 1200x630 (no en logo192, que
    //    es cuadrado y de baja resolucion: las preview cards lo
    //    recortan o miniaturizan). logo192 sigue siendo correcto SOLO
    //    en publisher.logo del JSON-LD mas abajo.
    //  - og:image:width/height solo se emiten cuando usamos la card
    //    default (dimensiones conocidas: 1200x630). Para la hero del
    //    articulo no conocemos las dimensiones, los crawlers las
    //    inferiran al fetchear la imagen.
    const hasHeroImage = !!article.heroImageUrl;
    const ogImage = hasHeroImage ? article.heroImageUrl : DEFAULT_OG_IMAGE;
    upsertMeta('meta[property="og:image"]', {
      property: 'og:image',
      content: ogImage,
    });
    upsertMeta('meta[name="twitter:image"]', {
      name: 'twitter:image',
      content: ogImage,
    });
    if (hasHeroImage) {
      removeMeta('meta[property="og:image:width"]');
      removeMeta('meta[property="og:image:height"]');
    } else {
      upsertMeta('meta[property="og:image:width"]', {
        property: 'og:image:width',
        content: DEFAULT_OG_IMAGE_WIDTH,
      });
      upsertMeta('meta[property="og:image:height"]', {
        property: 'og:image:height',
        content: DEFAULT_OG_IMAGE_HEIGHT,
      });
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
    upsertMeta('meta[name="author"]', { name: 'author', content: t('blog:meta.author') });
    upsertMeta('meta[name="publisher"]', { name: 'publisher', content: t('blog:meta.publisher') });

    // Twitter: siempre summary_large_image, porque siempre hay imagen
    // 1200x630 disponible (la hero del articulo si existe, o la card
    // de marca por defecto).
    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: 'summary_large_image',
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
        name: t('blog:meta.author'),
      },
      publisher: {
        '@type': 'Organization',
        name: t('blog:meta.publisher'),
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
      removeMeta('meta[property="og:image:width"]');
      removeMeta('meta[property="og:image:height"]');
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

  // Paquete 5 (ADR-025): exponer locale actual + alternates al
  // LocaleSwitcher del navbar para que pueda saltar al slug equivalente
  // en el otro locale (en vez de tirar al usuario al listado raiz).
  const localeContextValue = {
    currentLocale: locale,
    currentSlug: article?.slug || slug,
    alternates: Array.isArray(article?.alternates) ? article.alternates : [],
  };

  return (
    <BlogLocaleContext.Provider value={localeContextValue}>
      <GlobalBlack />

      <PublicNavbar
        activeTab="blog"
        onBrandClick={goHome}
        onGoVideochat={goLogin}
        onGoFavorites={goLogin}
        onGoBlog={goBlog}
        onBuy={goLogin}
        onLogin={goLogin}
        showLocaleSwitcher={true}
        showBottomNav={true}
      />

      <PageWrap>
        <PageInner>
          <BackLink type="button" onClick={goBlog}>{t('blog:detail.backToBlog')}</BackLink>

          {loading ? (
            <EmptyState>{t('blog:states.loadingArticle')}</EmptyState>
          ) : retracted ? (
            <EmptyState>{t('blog:states.retracted')}</EmptyState>
          ) : error ? (
            <EmptyState>{error}</EmptyState>
          ) : !article ? (
            <EmptyState>{t('blog:states.notFound')}</EmptyState>
          ) : (
            <>
              <ArticleHero>
                {article.category ? (
                  <ArticleCategoryPill>{article.category}</ArticleCategoryPill>
                ) : null}
                <ArticleHeroTitle>{article.title}</ArticleHeroTitle>
                <ArticleMetaLine>
                  {article.locale ? article.locale.toUpperCase() : ''}
                  {article.publishedAt ? ` · ${t('blog:detail.publishedPrefix')} ${fmtDate(article.publishedAt)}` : ''}
                  {` · ${getReadingMinutes(article.htmlBody || '')} ${t('blog:card.readingTimeUnit')}`}
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

              {/*
                Botones de redes sociales retirados (2026-06-08): los 4
                ShareLink (X, Meta, Instagram, TikTok) iban a href="#" y
                no compartian la URL del articulo. Cuando se decida una
                estrategia social real (Twitter Web Intent, Facebook
                Sharer, etc.) se reintroducen con URLs validas. Se
                conserva el boton "Copiar enlace" que SI funciona via
                navigator.clipboard.writeText().
              */}
              <ShareRow>
                <ShareLabel>{t('blog:detail.shareTitle')}</ShareLabel>
                <ShareButtons>
                  <CopyLinkButton type="button" onClick={handleCopyLink}>
                    {copied ? t('blog:detail.copiedFeedback') : t('blog:detail.copyLink')}
                  </CopyLinkButton>
                </ShareButtons>
              </ShareRow>

              {(() => {
                const picks = pickRelated(relatedArticles, article, 3);
                if (picks.length === 0) return null;
                return (
                  <RelatedSection>
                    <RelatedHeading>{t('blog:detail.relatedTitle')}</RelatedHeading>
                    <RelatedGrid>
                      {picks.map((r) => (
                        <RelatedCard
                          key={r.id}
                          as={Link}
                          to={`/blog/${locale}/${r.slug}`}
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
              </ArticleFooterMeta>
            </>
          )}
        </PageInner>
      </PageWrap>
    </BlogLocaleContext.Provider>
  );
}
