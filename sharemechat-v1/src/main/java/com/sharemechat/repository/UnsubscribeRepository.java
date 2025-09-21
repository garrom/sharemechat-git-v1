package com.sharemechat.repository;

import com.sharemechat.entity.Unsubscribe;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UnsubscribeRepository extends JpaRepository<Unsubscribe, Long> {
    boolean existsByUserId(Long userId);
}
