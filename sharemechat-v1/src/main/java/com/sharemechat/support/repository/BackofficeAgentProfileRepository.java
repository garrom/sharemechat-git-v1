package com.sharemechat.support.repository;

import com.sharemechat.support.entity.BackofficeAgentProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BackofficeAgentProfileRepository
        extends JpaRepository<BackofficeAgentProfile, Long> {

    Optional<BackofficeAgentProfile> findByDisplayName(String displayName);

    List<BackofficeAgentProfile> findAllByOrderByDisplayNameAsc();
}
