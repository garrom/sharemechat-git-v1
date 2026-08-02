package com.sharemechat.payout.service;

import com.sharemechat.entity.PayoutRequest;
import com.sharemechat.payout.entity.PayoutMethod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * ADR-056 Fase S6.b (2026-08-02): implementación por defecto de
 * {@link PayoutAdapter} que no llama a ningún vendor. Solo loguea el
 * intento y devuelve OK. Se usa mientras no exista adapter concreto
 * para el rail solicitado — el equipo procesa el payout manualmente
 * fuera de plataforma (patrón operativo actual hasta S6.c).
 *
 * <p>{@link #supports(String)} devuelve {@code true} para cualquier
 * rail — actúa de fallback cuando el {@link PayoutAdapterFactory} no
 * encuentra adapter específico. Los adapters concretos que se creen
 * en el futuro deben aparecer con {@code @Order} más alto que este
 * para tomar precedencia.
 */
@Component
@org.springframework.core.annotation.Order(Integer.MAX_VALUE)
public class NoopPayoutAdapter implements PayoutAdapter {

    private static final Logger log = LoggerFactory.getLogger(NoopPayoutAdapter.class);

    @Override
    public boolean supports(String rail) {
        return true;
    }

    @Override
    public PayoutAdapterResult send(PayoutRequest payoutRequest, PayoutMethod method) {
        String rail = method != null ? method.getRail() : "UNKNOWN";
        Long methodId = method != null ? method.getId() : null;
        Long userId = method != null ? method.getUserId() : null;
        log.info("[PAYOUT-NOOP] rail={} payoutRequestId={} userId={} payoutMethodId={} amount={} — sin adapter concreto, procesamiento manual",
                rail, payoutRequest.getId(), userId, methodId, payoutRequest.getAmount());
        return new PayoutAdapterResult(null, false);
    }
}
