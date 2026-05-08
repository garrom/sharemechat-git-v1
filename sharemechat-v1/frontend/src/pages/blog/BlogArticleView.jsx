// src/pages/blog/BlogArticleView.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
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
  ArticleBriefBox,
  ArticleBody,
  ArticleFooterMeta,
  BackLink,
  EmptyState,
  TagPills,
  TagPill,
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

// SEO helpers (Frente 2). Mantienen meta tags y JSON-LD sincronizados
// con el articulo cargado. Sin react-helmet-async para no introducir una
// dependencia nueva incompatible con React 17 — se manipula directamente
// document.head con useEffect. Cleanup defensivo en cada efecto.

const upsertMeta = (selector, attrs) => {
  if (typeof document === 'undefined') return null;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => {
    if (v == null || v === '') {
      el.removeAttribute(k);
    } else {
      el.setAttribute(k, v);
    }
  });
  return el;
};

const upsertCanonicalLink = (href) => {
  if (typeof document === 'undefined') return null;
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  return el;
};

const upsertJsonLd = (id, jsonObj) => {
  if (typeof document === 'undefined') return null;
  let el = document.head.querySelector(`script[type="application/ld+json"][data-jsonld-id="${id}"]`);
  if (!el) {
    el = document.createElement('script');
    el.setAttribute('type', 'application/ld+json');
    el.setAttribute('data-jsonld-id', id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(jsonObj);
  return el;
};

const truncate = (text, max) => {
  if (!text) return '';
  const t = String(text).trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
};

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
        setError(e?.message || 'Artículo no disponible');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

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
    const inLanguage = article.locale ? `${article.locale}-ES` : 'es-ES';

    const prevTitle = document.title;
    document.title = `${seoTitle} | SharemeChat`;

    upsertMeta('meta[name="description"]', { name: 'description', content: metaDescription });
    upsertCanonicalLink(articleUrl);

    // Open Graph
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'article' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: seoTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: metaDescription });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: articleUrl });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'SharemeChat' });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'es_ES' });
    // TODO: emitir <meta property="og:image"> cuando el DTO incluya
    // article.heroImageUrl. Mientras tanto, ausente intencionadamente.

    // Twitter
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seoTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: metaDescription });

    // JSON-LD Article (schema.org)
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: seoTitle,
      description: metaDescription,
      url: articleUrl,
      datePublished: article.publishedAt || undefined,
      dateModified: article.updatedAt || article.publishedAt || undefined,
      inLanguage,
      author: {
        '@type': 'Organization',
        name: 'Equipo SharemeChat',
      },
      publisher: {
        '@type': 'Organization',
        name: 'SharemeChat',
        url: baseUrl,
      },
    };
    if (article.heroImageUrl) {
      jsonLd.image = article.heroImageUrl;
    }
    upsertJsonLd('blog-article', jsonLd);

    return () => {
      // Restaurar el title al desmontar para no contaminar otras paginas
      // del SPA. Los meta tags se sobreescriben en el siguiente render
      // (no se eliminan para evitar parpadeos durante navegacion).
      document.title = prevTitle;
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
                </ArticleMetaLine>
                {article.brief ? <ArticleBriefBox>{article.brief}</ArticleBriefBox> : null}
              </ArticleHero>

              {/* htmlBody ya viene sanitizado por el backend (jsoup allowlist) */}
              <ArticleBody
                dangerouslySetInnerHTML={{ __html: article.htmlBody || '' }}
              />

              <ArticleFooterMeta>
                {keywords.length > 0 ? (
                  <TagPills>
                    {keywords.map((k) => <TagPill key={k}>{k}</TagPill>)}
                  </TagPills>
                ) : null}
                {article.disclosureRequired ? (
                  <span>Contenido elaborado con asistencia de IA.</span>
                ) : null}
              </ArticleFooterMeta>
            </>
          )}
        </PageInner>
      </PageWrap>
    </>
  );
}
