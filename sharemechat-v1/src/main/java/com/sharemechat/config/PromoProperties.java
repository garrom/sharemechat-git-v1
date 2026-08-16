package com.sharemechat.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;

/**
 * Config de la promo de bienvenida "100 primeros clientes" (bono financiado
 * por plataforma, BFPM ADR-012). Se resuelve por variables de entorno:
 *
 *  - product.promo.welcome.enabled    -> PRODUCT_PROMO_WELCOME_ENABLED    (default false)
 *  - product.promo.welcome.cap        -> PRODUCT_PROMO_WELCOME_CAP        (default 100)
 *  - product.promo.welcome.amount-eur -> PRODUCT_PROMO_WELCOME_AMOUNT_EUR (default 10.00)
 *  - product.promo.welcome.promo-key  -> PRODUCT_PROMO_WELCOME_PROMO_KEY  (default WELCOME_100)
 *
 * Defaults seguros: con enabled=false (default) el sistema se comporta
 * exactamente igual que antes de existir la promo. El operador la enciende
 * cuando abre las recargas.
 */
@Configuration
@ConfigurationProperties(prefix = "product.promo.welcome")
public class PromoProperties {

    private boolean enabled = false;
    private int cap = 100;
    private BigDecimal amountEur = new BigDecimal("10.00");
    private String promoKey = "WELCOME_100";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getCap() {
        return cap;
    }

    public void setCap(int cap) {
        this.cap = cap;
    }

    public BigDecimal getAmountEur() {
        return amountEur;
    }

    public void setAmountEur(BigDecimal amountEur) {
        this.amountEur = amountEur;
    }

    public String getPromoKey() {
        return promoKey;
    }

    public void setPromoKey(String promoKey) {
        this.promoKey = promoKey == null || promoKey.isBlank() ? "WELCOME_100" : promoKey;
    }
}
