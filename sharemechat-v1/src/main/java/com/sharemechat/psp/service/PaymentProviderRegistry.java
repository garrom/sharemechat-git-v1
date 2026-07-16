package com.sharemechat.psp.service;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * ADR-051 D1: registry de {@link PaymentProvider} activos en el contexto.
 * Spring inyecta automáticamente todos los beans que implementan la
 * interface. Resolución por {@code providerKey} case-insensitive.
 *
 * <p>Hoy solo NOWPayments está registrado; el día que aterrice Vendo /
 * CommerceGate / RocketGate, sus {@code XyzPaymentProvider} entran
 * automáticamente en esta lista sin cambio aquí.
 */
@Component
public class PaymentProviderRegistry {

    private final List<PaymentProvider> providers;

    public PaymentProviderRegistry(List<PaymentProvider> providers) {
        this.providers = providers;
    }

    /**
     * Busca el provider por su {@code providerKey} (case-insensitive).
     * Devuelve {@code Optional.empty()} si no hay ninguno registrado con
     * esa clave.
     */
    public Optional<PaymentProvider> find(String providerKey) {
        if (providerKey == null || providerKey.isBlank()) return Optional.empty();
        String key = providerKey.trim().toLowerCase(Locale.ROOT);
        return providers.stream()
                .filter(p -> key.equals(p.getProviderKey().toLowerCase(Locale.ROOT)))
                .findFirst();
    }
}
