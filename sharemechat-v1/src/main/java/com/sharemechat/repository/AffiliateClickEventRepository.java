package com.sharemechat.repository;

import com.sharemechat.entity.AffiliateClickEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface AffiliateClickEventRepository extends JpaRepository<AffiliateClickEvent, Long> {

    long countByModelUserIdAndEventType(Long modelUserId, String eventType);

    long countByModelUserIdAndEventTypeAndCreatedAtAfter(Long modelUserId,
                                                          String eventType,
                                                          LocalDateTime after);

    long countByModelUserId(Long modelUserId);

    /**
     * ADR-049 Subpasada 2A: visitantes unicos estimados por {@code ip_hash}
     * (SHA-256 truncado a 16 chars hex, D15 GDPR). Filtra eventos {@code CLICK}
     * de la modelo y descarta filas con {@code ip_hash NULL} para no inflar
     * el estimador con clicks server-side sin IP conocida.
     */
    @Query("SELECT COUNT(DISTINCT e.ipHash) FROM AffiliateClickEvent e "
            + "WHERE e.modelUserId = :modelUserId "
            + "AND e.eventType = 'CLICK' "
            + "AND e.ipHash IS NOT NULL")
    long countUniqueVisitorsForModel(@Param("modelUserId") Long modelUserId);
}
