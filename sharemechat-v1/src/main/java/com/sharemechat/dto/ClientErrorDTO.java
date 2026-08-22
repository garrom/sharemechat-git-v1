package com.sharemechat.dto;

/**
 * Observabilidad #4: error del navegador reportado por el frontend
 * (ErrorBoundary + window.onerror / unhandledrejection). Todos los campos son
 * opcionales y no confiables (vienen del cliente); el controller los trunca y
 * sanea antes de loguear.
 */
public class ClientErrorDTO {

    private String message;
    private String source;
    private String stack;
    private String url;
    private String userAgent;
    private String appVersion;

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getStack() { return stack; }
    public void setStack(String stack) { this.stack = stack; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }

    public String getAppVersion() { return appVersion; }
    public void setAppVersion(String appVersion) { this.appVersion = appVersion; }
}
