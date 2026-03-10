package com.sharemechat.repository;

import com.sharemechat.entity.Unsubscribe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface UnsubscribeRepository extends JpaRepository<Unsubscribe, Long> {

    boolean existsByUserId(Long userId);

    List<Unsubscribe> findByForfeitAfterLessThanEqual(LocalDate date);

}