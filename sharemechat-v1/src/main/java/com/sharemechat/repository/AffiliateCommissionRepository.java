package com.sharemechat.repository;

import com.sharemechat.entity.AffiliateCommission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AffiliateCommissionRepository extends JpaRepository<AffiliateCommission, Long> {

    Optional<AffiliateCommission> findByPaymentSessionIdAndStatus(Long paymentSessionId,
                                                                  String status);

    List<AffiliateCommission> findByReferrerModelUserIdAndPeriodYyyymm(Long referrerModelUserId,
                                                                        Integer periodYyyymm);

    List<AffiliateCommission> findByReferrerModelUserIdAndStatus(Long referrerModelUserId,
                                                                  String status);

    List<AffiliateCommission> findByClientUserId(Long clientUserId);
}
