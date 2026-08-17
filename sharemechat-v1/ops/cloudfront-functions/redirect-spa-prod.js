function handler(event) {
    var request = event.request;
    var uri = request.uri || "/";

    // www -> apex (ADR-015): cualquier request a www.sharemechat.com se redirige al apex
    if (request.headers.host && request.headers.host.value === 'www.sharemechat.com') {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { location: { value: 'https://sharemechat.com' + uri } }
        };
    }

    // 301 de las 5 URLs legacy .html (servidas hoy por sharemechat-landing-prod)
    // a las rutas canonicas del SPA. Preserva SEO juice y backlinks externos
    // (Segpay docs, indexaciones de Google, etc.) tras el switch del origin.
    // cookie-settings.html (singular del landing legacy) -> /cookies-settings
    // (plural en App.jsx del SPA).
    var legacyRedirects = {
        '/legal.html':                '/legal',
        '/faq.html':                  '/faq',
        '/safety.html':               '/safety',
        '/community-guidelines.html': '/community-guidelines',
        '/cookie-settings.html':      '/cookies-settings'
    };
    if (legacyRedirects[uri]) {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { location: { value: legacyRedirects[uri] } }
        };
    }

    // Dejar pasar backend y assets/rutas estáticas reales
    if (
        uri.startsWith('/api/') ||
        uri.startsWith('/match') ||
        uri.startsWith('/messages') ||
        uri.startsWith('/uploads/') ||
        uri.startsWith('/assets/') ||
        uri.startsWith('/static/') ||
        uri.startsWith('/.well-known/acme-challenge/') ||
        uri === '/favicon.ico' ||
        uri === '/robots.txt'
    ) {
        return request;
    }

    // Landings publicas de captacion con pre-render (Fix 2 SEO, 2026-08-17):
    // sirven su propio HTML con og:/title/canonical correctos desde
    // s3://.../<path>/index.html, para que los scrapers sociales (WhatsApp,
    // Facebook, Twitter — que NO ejecutan JS) muestren la tarjeta correcta al
    // compartir el enlace, en vez del meta del shell home. Match EXACTO (no
    // prefijo) para no capturar sub-rutas inexistentes. Misma degradacion que
    // el blog: si el objeto no existe, S3 (OAC) 403 -> CER -> 200 + /index.html
    // (shell SPA, CSR). Ver seo-edge-function-analysis-2026-06-21.md.
    var prerenderedLandings = {
        '/modelos': 1,
        '/en/modelos': 1,
        '/for-studios': 1,
        '/en/for-studios': 1
    };

    // Reescritura SPA:
    // - /blog/* (paths con pre-render selectivo): anadir /index.html como sufijo.
    //   Permite servir HTML especificos por articulo y listing desde
    //   s3://sharemechat-frontend-prod/blog/<path>/index.html.
    //   Si el objeto no existe, S3 (OAC) devuelve 403 y la distribucion lo
    //   convierte a 200 + /index.html (Custom Error Response) -> shell SPA.
    // - Landings de captacion pre-renderizadas (arriba): mismo sufijo /index.html.
    // - Resto de paths sin extension: shell SPA en /index.html como hasta hoy.
    if (!uri.includes('.')) {
        var trimmed = uri.replace(/\/$/, '');
        if (uri === '/blog' || uri.startsWith('/blog/')) {
            request.uri = trimmed + '/index.html';
        } else if (prerenderedLandings[trimmed]) {
            request.uri = trimmed + '/index.html';
        } else {
            request.uri = '/index.html';
        }
    }

    return request;
}
