package com.sharemechat.dto;

/**
 * Fase 2 i18n (2026-08-21): un idioma que el usuario habla (fila de
 * {@code user_languages}). Se usa tanto de ENTRADA (body de
 * {@code PUT /api/users/me/languages}) como de SALIDA (dentro de
 * {@code UserDTO.languages}).
 *
 * <p>El {@code langCode} se valida/normaliza en el servicio contra
 * {@link com.sharemechat.constants.SupportedChatLanguages}. Exactamente uno de
 * la lista debe tener {@code primary=true} (el idioma principal = destino de
 * traducción de chat + idioma principal del perfil público).
 */
public class UserLanguageDTO {

    private String langCode;
    private boolean primary;
    private String level; // opcional (p. ej. "native"); hoy informativo

    public UserLanguageDTO() {}

    public UserLanguageDTO(String langCode, boolean primary, String level) {
        this.langCode = langCode;
        this.primary = primary;
        this.level = level;
    }

    public String getLangCode() { return langCode; }
    public void setLangCode(String langCode) { this.langCode = langCode; }

    public boolean isPrimary() { return primary; }
    public void setPrimary(boolean primary) { this.primary = primary; }

    public String getLevel() { return level; }
    public void setLevel(String level) { this.level = level; }
}
