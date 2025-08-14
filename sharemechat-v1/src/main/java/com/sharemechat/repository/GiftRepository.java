package com.sharemechat.repository;

import com.sharemechat.entity.Gift;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GiftRepository extends JpaRepository<Gift, Long> {
    boolean existsByName(String name);
}
