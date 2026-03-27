package com.sharemechat.repository;

import com.sharemechat.entity.ConsentEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

public interface ConsentEventRepository extends JpaRepository<ConsentEvent, Long> {

    long deleteByTsBefore(java.time.Instant threshold);

    boolean existsByConsentIdAndEventType(String consentId, String eventType);

    @Modifying
    @Transactional
    @Query(value = """
    INSERT INTO consent_events
      (event_type, version, consent_id, user_id, user_agent, ip_hint, path, sig)
    VALUES
      (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    ON DUPLICATE KEY UPDATE
      id = id
    """, nativeQuery = true)
    int insertIdempotent(
            String eventType,
            String version,
            String consentId,
            Long userId,
            String userAgent,
            String ipHint,
            String path,
            String sig
    );

}
