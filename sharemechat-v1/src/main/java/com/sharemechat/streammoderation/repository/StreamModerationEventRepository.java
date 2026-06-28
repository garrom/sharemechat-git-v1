package com.sharemechat.streammoderation.repository;

import com.sharemechat.streammoderation.entity.StreamModerationEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StreamModerationEventRepository
        extends JpaRepository<StreamModerationEvent, Long> {

    /**
     * Idempotencia primaria del webhook entrante: si el vendor reenvia
     * el mismo evento, se localiza la fila ya persistida sin crear
     * duplicado. Para verdicts sync con provider_event_id=NULL no
     * desduplica (cada NULL cuenta como distinto en la UK de MySQL).
     */
    Optional<StreamModerationEvent> findByProviderAndProviderEventId(
            String provider, String providerEventId);

    List<StreamModerationEvent> findByStreamModerationSessionIdOrderByReceivedAtDesc(
            Long streamModerationSessionId);

    /**
     * Frame timeline para el drill-down del compliance dashboard (Vista B).
     * Orden asc por id reproduce el orden cronologico de submission.
     */
    List<StreamModerationEvent> findByStreamModerationSessionIdOrderByIdAsc(
            Long streamModerationSessionId);
}
