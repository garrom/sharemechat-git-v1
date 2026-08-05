package com.sharemechat.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Collections;

/**
 * Verifica ID tokens de Google recibidos del frontend (Google Identity
 * Services) contra el JWKS publico de Google. Envuelve
 * {@link GoogleIdTokenVerifier} de la libreria oficial
 * {@code google-api-client}, que se encarga de cachear el JWKS y hacer
 * retry con backoff en caso de fallo transitorio.
 *
 * <p>Reglas de verificacion (segun doc oficial "Verify the Google ID token"):
 * <ul>
 *     <li>Firma valida contra las claves publicas RSA de Google
 *         (https://www.googleapis.com/oauth2/v3/certs).</li>
 *     <li>{@code iss} = {@code accounts.google.com} o {@code https://accounts.google.com}.</li>
 *     <li>{@code aud} = el CLIENT_ID de nuestra app en Google Cloud.</li>
 *     <li>{@code exp} en el futuro (no expirado).</li>
 * </ul>
 *
 * <p>Si el token es invalido, {@link #verify(String)} devuelve {@code null}.
 * El controller lo interpreta como 401.
 *
 * <p>Se instancia con lazy init: si el client id no esta configurado
 * (property vacia) el bean existe pero {@link #isConfigured()} devuelve
 * false, y el controller puede devolver 503 en vez de fallar al arrancar.
 */
@Service
public class GoogleIdTokenVerifierService {

    private static final Logger log = LoggerFactory.getLogger(GoogleIdTokenVerifierService.class);

    private final String clientId;
    private final GoogleIdTokenVerifier verifier;

    public GoogleIdTokenVerifierService(@Value("${auth.google.client-id:}") String clientId) {
        this.clientId = clientId != null ? clientId.trim() : "";
        if (this.clientId.isEmpty()) {
            log.warn("[AUTH-GOOGLE] auth.google.client-id vacio; endpoint /api/auth/google devolvera 503 hasta que se configure GOOGLE_OAUTH_CLIENT_ID.");
            this.verifier = null;
        } else {
            this.verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(), GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(this.clientId))
                    .build();
            log.info("[AUTH-GOOGLE] GoogleIdTokenVerifier configurado con clientId sufijo=***{}",
                    lastChars(this.clientId, 8));
        }
    }

    public boolean isConfigured() {
        return verifier != null;
    }

    /**
     * Verifica el ID token y devuelve el payload si es valido; null si no.
     * Nunca lanza excepciones al caller: si algo va mal (token roto, JWKS
     * inaccesible, tampering) lo loguea y devuelve null.
     */
    public GoogleIdToken.Payload verify(String idTokenString) {
        if (!isConfigured()) {
            log.warn("[AUTH-GOOGLE] verify() llamado sin verifier configurado; abortando.");
            return null;
        }
        if (!StringUtils.hasText(idTokenString)) {
            return null;
        }
        try {
            GoogleIdToken token = verifier.verify(idTokenString);
            if (token == null) {
                log.info("[AUTH-GOOGLE] ID token no valido (firma/iss/aud/exp).");
                return null;
            }
            GoogleIdToken.Payload payload = token.getPayload();
            String iss = payload.getIssuer();
            if (!"accounts.google.com".equals(iss) && !"https://accounts.google.com".equals(iss)) {
                log.warn("[AUTH-GOOGLE] iss inesperado: {}", iss);
                return null;
            }
            return payload;
        } catch (GeneralSecurityException | IOException ex) {
            log.error("[AUTH-GOOGLE] error verificando ID token: {}", ex.getMessage());
            return null;
        }
    }

    private static String lastChars(String s, int n) {
        if (s == null || s.length() <= n) return s;
        return s.substring(s.length() - n);
    }
}
