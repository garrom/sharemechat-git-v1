package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Destinos de las notificaciones internas al equipo (buzones admin).
 *
 * <p>Mapeo desde {@code application-{env}.properties}:
 * <ul>
 *   <li>{@code notifications.admin.new-client-email}            -> {@link #newClientEmail}</li>
 *   <li>{@code notifications.admin.new-model-email}             -> {@link #newModelEmail}</li>
 *   <li>{@code notifications.admin.moderation-quota-alert-email} -> {@link #moderationQuotaAlertEmail}</li>
 * </ul>
 *
 * <p>Semantica del valor vacio (o property ausente): NO se envia
 * notificacion. Este es el default en TEST/AUDIT (evita spam al buzon
 * admin durante pruebas manuales). En PROD las properties se rellenan
 * con las direcciones reales (admin+clientes@sharemechat.com,
 * admin+modelos@sharemechat.com, admin+moderacion@sharemechat.com).
 *
 * <p>Introducido 2026-07-18 tras el primer registro real observado en
 * PROD (usuario id 37); extendido 2026-07-21 con
 * {@code moderationQuotaAlertEmail} en Bloque 5 Paso 3 (ADR-037).
 */
@Component
@ConfigurationProperties(prefix = "notifications.admin")
public class AdminNotificationProperties {

    private String newClientEmail;
    private String newModelEmail;
    private String moderationQuotaAlertEmail;

    public String getNewClientEmail() { return newClientEmail; }
    public void setNewClientEmail(String newClientEmail) {
        this.newClientEmail = trimOrNull(newClientEmail);
    }

    public String getNewModelEmail() { return newModelEmail; }
    public void setNewModelEmail(String newModelEmail) {
        this.newModelEmail = trimOrNull(newModelEmail);
    }

    public String getModerationQuotaAlertEmail() { return moderationQuotaAlertEmail; }
    public void setModerationQuotaAlertEmail(String moderationQuotaAlertEmail) {
        this.moderationQuotaAlertEmail = trimOrNull(moderationQuotaAlertEmail);
    }

    private static String trimOrNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
