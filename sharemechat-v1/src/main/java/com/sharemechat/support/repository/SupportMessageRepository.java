package com.sharemechat.support.repository;

import com.sharemechat.support.entity.SupportMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SupportMessageRepository
        extends JpaRepository<SupportMessage, Long> {

    List<SupportMessage> findByConversationIdOrderByIdAsc(Long conversationId);

    List<SupportMessage> findByConversationIdOrderByIdDesc(Long conversationId, Pageable pageable);

    // Frente B.3.1 (ADR-046): metricas para el listado admin.
    long countByConversationId(Long conversationId);

    SupportMessage findFirstByConversationIdOrderByIdDesc(Long conversationId);
}
