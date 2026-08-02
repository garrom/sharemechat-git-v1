package com.sharemechat.payout.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * ADR-056 Fase S6.b (2026-08-02): resolución de {@link PayoutAdapter}
 * por rail. Spring inyecta la lista de adapters registrados en
 * contexto ordenados por {@code @Order}; el factory devuelve el primer
 * adapter que declara soporte para el rail solicitado.
 *
 * <p>{@link NoopPayoutAdapter} tiene {@code @Order(Integer.MAX_VALUE)}
 * y siempre queda al final; adapters concretos deben registrarse con
 * {@code @Order} más bajo para tomar precedencia.
 */
@Component
public class PayoutAdapterFactory {

    private static final Logger log = LoggerFactory.getLogger(PayoutAdapterFactory.class);

    private final List<PayoutAdapter> adapters;

    public PayoutAdapterFactory(List<PayoutAdapter> adapters) {
        this.adapters = adapters;
    }

    public PayoutAdapter resolve(String rail) {
        for (PayoutAdapter adapter : adapters) {
            if (adapter.supports(rail)) {
                if (log.isDebugEnabled()) {
                    log.debug("[PAYOUT-ADAPTER] resolved rail={} adapter={}",
                            rail, adapter.getClass().getSimpleName());
                }
                return adapter;
            }
        }
        // No debería suceder mientras NoopPayoutAdapter esté presente.
        throw new IllegalStateException("No PayoutAdapter registered for rail: " + rail);
    }
}
