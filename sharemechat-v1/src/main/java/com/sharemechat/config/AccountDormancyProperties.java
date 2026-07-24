package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Politica de cuentas dormidas (2026-07-23): cualquier cuenta que no
 * registre actividad (login o refresh) durante {@code dormancyDays} se
 * marca dormant (is_active=false, dormant_since=NOW()). El login
 * posterior auto-reactiva la cuenta sin intervencion admin. Bans reales
 * siguen bloqueando.
 *
 * <p>Frente separado del programa de afiliacion (ver ADR-049 D4 revisado).
 * La cuenta dormant NO afecta al revshare — no es un requisito del
 * programa sino higiene general de cuenta.
 *
 * <p>Sobreescribible via env vars con Spring relaxed binding
 * ({@code ACCOUNT_DORMANCY_ENABLED}, etc.). {@code enabled=false} en un
 * entorno permite arrancar el job pero no ejecutar la marca (util para
 * pruebas o entornos donde no queremos limpieza automatica).
 */
@Component
@ConfigurationProperties(prefix = "account.dormancy")
public class AccountDormancyProperties {

    /** Kill-switch global del job. Default true. */
    private boolean enabled = true;

    /**
     * Dias sin actividad tras los cuales una cuenta se considera dormant.
     * Default 180 (6 meses) segun decision operador 2026-07-23.
     */
    private int dormancyDays = 180;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public int getDormancyDays() { return dormancyDays; }
    public void setDormancyDays(int dormancyDays) { this.dormancyDays = dormancyDays; }
}
