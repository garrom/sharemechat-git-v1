package com.sharemechat.repository;

import com.sharemechat.entity.AffiliateClickEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;

public interface AffiliateClickEventRepository extends JpaRepository<AffiliateClickEvent, Long> {

    long countByModelUserIdAndEventType(Long modelUserId, String eventType);

    long countByModelUserIdAndEventTypeAndCreatedAtAfter(Long modelUserId,
                                                          String eventType,
                                                          LocalDateTime after);

    long countByModelUserId(Long modelUserId);
}
