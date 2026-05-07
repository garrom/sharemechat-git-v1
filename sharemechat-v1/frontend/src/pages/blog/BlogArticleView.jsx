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

export default function BlogArticleView() {
  const { slug } = useParams();
  const history = useHistory();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    apiFetch(`/public/content/articles/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (cancelled) return;
        setArticle(data);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || 'Artículo no disponible');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

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
