package com.sharemechat.repository;

import com.sharemechat.entity.PayoutRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PayoutRequestRepository extends JpaRepository<PayoutRequest, Long> {

    List<PayoutRequest> findAllByOrderByCreatedAtDesc();

    List<PayoutRequest> findAllByStatusOrderByCreatedAtDesc(String status);

    List<PayoutRequest> findAllByModelUserIdOrderByCreatedAtDesc(Long modelUserId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT pr FROM PayoutRequest pr WHERE pr.id = :id")
    java.util.Optional<PayoutRequest> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);

}