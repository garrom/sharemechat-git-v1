package com.sharemechat.support.repository;

import com.sharemechat.support.entity.SupportConversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupportConversationRepository
        extends JpaRepository<SupportConversation, Long> {

    Optional<SupportConversation> findFirstByUserIdAndResolutionStatusOrderByIdDesc(
            Long userId, String resolutionStatus);

    List<SupportConversation> findAllByUserIdOrderByIdDesc(Long userId);
}
