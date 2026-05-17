// src/pages/blog/BlogNotFound.jsx
//
// Pagina 404 del blog publico para locales no soportados (paquete 5
// extension, ADR-025).
//
// Se muestra cuando un visitante teclea `/blog/{algo}` o
// `/blog/{algo}/{slug}` donde `{algo}` no es ni `es` ni `en`. React
// Router v5 no matchea las rutas con constraint `(es|en)` y cae a este
// componente via las rutas catch-all definidas en `App.jsx`.
//
// Caracteristicas:
//   - HTTP 200 al servidor (SPA, sin forma trivial de devolver 404
//     real desde React Router). A Google le decimos 404 via meta robots
//     `noindex,follow` y title explicito "404 — Blog not found".
//   - Mensaje corto bilingue (ES + EN superpuestos para que ambos
//     publicos entiendan donde han caido) sin imagenes pesadas.
//   - Dos enlaces de salida: listado ES y listado EN.
//   - Reusa PublicNavbar para mantener coherencia visual con el resto
//     del blog.

import React, { useEffect } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { GlobalBlack } from '../../styles/public-styles/HomeStyles';
import PublicNavbar from '../../components/navbar/PublicNavbar';
import {
  PageWrap,
  PageInner,
  EmptyState,
} from '../../styles/pages-styles/BlogStyles';
import {
  upsertMeta,
  upsertCanonicalLink,
  removeMeta,
} from './seoHelpers';

export default function BlogNotFound() {
  const history = useHistory();

  const goHome = (e) => {
    if (e) e.preventDefault();
    history.push('/');
  };
  const goLogin = () => history.push('/login');

  // SEO de la 404 del blog: noindex,follow para que Google no la
  // indexe pero siga los enlaces de salida. Title explicito para
  // que aparezca "404 — Blog not found" en pestañas/historiales.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prevTitle = document.title;

    document.title = '404 — Blog not found | SharemeChat';
    upsertMeta('meta[name="robots"]', { name: 'robots', content: 'noindex,follow' });
    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: 'This section of the blog does not exist. Esta sección del blog no existe.',
    });
    // canonical = la URL actual; no hay otra version "buena" de esta
    // pagina, asi que canonical se autoreferencia para no enviar señal
    // contradictoria.
    if (typeof window !== 'undefined' && window.location) {
      upsertCanonicalLink(window.location.origin + window.location.pathname);
    }

    return () => {
      document.title = prevTitle;
      removeMeta('meta[name="robots"]');
    };
  }, []);

  return (
    <>
      <GlobalBlack />

      <PublicNavbar
        activeTab="blog"
        onBrandClick={goHome}
        onGoVideochat={goLogin}
        onGoFavorites={goLogin}
        onGoBlog={() => history.push('/blog/es')}
        onBuy={goLogin}
        onLogin={goLogin}
        showLocaleSwitcher={false}
        showBottomNav={true}
      />

      <PageWrap>
        <PageInner>
          <EmptyState>
            <h1 style={{ fontSize: '1.5rem', marginBottom: 16 }}>
              404 — Blog not found
            </h1>
            <p style={{ marginBottom: 8 }}>
              Esta sección del blog no existe.
            </p>
            <p style={{ marginBottom: 24 }}>
              This section of the blog does not exist.
            </p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Link
                to="/blog/es"
                style={{
                  textDecoration: 'underline',
                  fontWeight: 500,
                }}
              >
                Ir al blog en español →
              </Link>
              <Link
                to="/blog/en"
                style={{
                  textDecoration: 'underline',
                  fontWeight: 500,
                }}
              >
                Go to the English blog →
              </Link>
            </div>
          </EmptyState>
        </PageInner>
      </PageWrap>
    </>
  );
}
