package com.sharemechat.support.repository;

import com.sharemechat.support.entity.SupportBotPrompt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupportBotPromptRepository
        extends JpaRepository<SupportBotPrompt, Long> {

    Optional<SupportBotPrompt> findByCaseKey(String caseKey);

    List<SupportBotPrompt> findAllByActive(boolean active);

    boolean existsByCaseKey(String caseKey);
}
