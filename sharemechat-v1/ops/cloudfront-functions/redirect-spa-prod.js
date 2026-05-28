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

    // Reescritura SPA:
    // si no hay extensión de fichero, servir index.html
    if (!uri.includes('.')) {
        request.uri = '/index.html';
    }

    return request;
}
