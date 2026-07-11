package com.sharemechat.repository;

import com.sharemechat.entity.AffiliateCommission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
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

    /**
     * ADR-049 Subpasada 2A: suma de comisiones acumuladas por la modelo en
     * los estados indicados. Devuelve 0 si no hay filas (via COALESCE).
     * Uso tipico: pasar {@code List.of("ACCRUED","PAYABLE","PAID")} para el
     * total de comision viva en el panel modelo.
     */
    @Query("SELECT COALESCE(SUM(c.commissionAmountCents), 0) "
            + "FROM AffiliateCommission c "
            + "WHERE c.referrerModelUserId = :referrerModelUserId "
            + "AND c.status IN :statuses")
    long sumCommissionAmountByReferrerInStatuses(@Param("referrerModelUserId") Long referrerModelUserId,
                                                  @Param("statuses") Collection<String> statuses);
}
