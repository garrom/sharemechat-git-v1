function handler(event) {
    var request = event.request;
    var uri = request.uri || "/";
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
    if (!uri.includes('.')) {
        request.uri = '/index.html';
    }
    return request;
}
