package com.sharemechat.support.repository;

import com.sharemechat.support.entity.BackofficeAgentProfileGrant;
import com.sharemechat.support.entity.BackofficeAgentProfileGrantId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BackofficeAgentProfileGrantRepository
        extends JpaRepository<BackofficeAgentProfileGrant, BackofficeAgentProfileGrantId> {

    Optional<BackofficeAgentProfileGrant> findByUserIdAndProfileId(Long userId, Long profileId);

    List<BackofficeAgentProfileGrant> findAllByUserIdAndActiveTrue(Long userId);

    List<BackofficeAgentProfileGrant> findAllByProfileIdAndActiveTrue(Long profileId);
}
