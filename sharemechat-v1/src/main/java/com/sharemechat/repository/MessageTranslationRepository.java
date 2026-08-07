package com.sharemechat.repository;

import com.sharemechat.entity.MessageTranslation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MessageTranslationRepository extends JpaRepository<MessageTranslation, Long> {

    Optional<MessageTranslation> findByMessageIdAndTargetLang(Long messageId, String targetLang);

    List<MessageTranslation> findByMessageIdIn(List<Long> messageIds);
}
