package com.sharemechat.repository;

import com.sharemechat.entity.PlatformTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformTransactionRepository extends JpaRepository<PlatformTransaction, Long> {
}
