package com.sharemechat.repository;

import com.sharemechat.entity.ConsentEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;

public interface ConsentEventRepository extends JpaRepository<ConsentEvent, Long> {

    long deleteByTsBefore(Instant threshold);
}
