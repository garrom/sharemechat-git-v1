package com.sharemechat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body de POST /api/auth/google. El frontend recibe el ID token de Google
 * Identity Services (via One Tap o el boton "Sign in with Google") y lo
 * envia al backend para verificacion server-side y emision de nuestros
 * propios JWT (access + refresh en cookies HttpOnly, mismo patron que
 * login clasico).
 *
 * <p>{@code idToken}: JWT firmado por Google (RS256). Verificado por
 * {@link com.sharemechat.service.GoogleIdTokenVerifierService}.
 *
 * <p>{@code intent}: hint del frontend sobre si el usuario esta intentando
 * login o registro. Solo relevante para decidir user_type en usuario nuevo:
 * <ul>
 *     <li>{@code login}: solo permite login de usuario existente (Google-
 *         linked o email collision con password verificado); si no existe,
 *         devuelve 404 y el usuario debe elegir registro.</li>
 *     <li>{@code register-client}: crea user nuevo con
 *         role=USER + user_type=FORM_CLIENT si no existe; si existe hace
 *         login (idempotente).</li>
 * </ul>
 *
 * <p>Fase 1 (soft-launch): solo intent=login y intent=register-client.
 * Fase 2+ podria anadir register-model.
 */
public class GoogleAuthRequestDTO {

    @NotBlank
    @Size(max = 4096)
    private String idToken;

    @NotBlank
    @Size(max = 32)
    private String intent;

    /** Idioma UI preferido del usuario (opcional, para setUiLocale al crear). */
    @Size(max = 5)
    private String locale;

    public String getIdToken() { return idToken; }
    public void setIdToken(String idToken) { this.idToken = idToken; }

    public String getIntent() { return intent; }
    public void setIntent(String intent) { this.intent = intent; }

    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }
}
