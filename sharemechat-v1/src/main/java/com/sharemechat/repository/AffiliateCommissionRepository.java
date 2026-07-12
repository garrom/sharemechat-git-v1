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

    /**
     * ADR-049 Subpasada 5: idempotencia del hook al STREAM_CHARGE. Antes de
     * insertar una nueva fila, el service consulta si ya existe una para el
     * mismo triple (sourceType, sourceId, status). Uso: pasar
     * {@code sourceType='STREAM_CHARGE'}, {@code sourceId=streamRecordId}
     * y el status que se pretende insertar (PAYABLE / SKIPPED_NO_ACTIVITY).
     */
    Optional<AffiliateCommission> findBySourceTypeAndSourceIdAndStatus(String sourceType,
                                                                       Long sourceId,
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

    /**
     * ADR-049 Subpasada 5: suma de comisiones de un mes calendario UTC en
     * los estados indicados, para una modelo. Uso tipico: panel modelo
     * "comisiones PAYABLE del mes actual" (period_yyyymm = mes UTC actual,
     * statuses = List.of("PAYABLE")). Incluye REVERSED_CHARGEBACK cuando
     * proceda para netear en la subpasada 6 (payout).
     */
    @Query("SELECT COALESCE(SUM(c.commissionAmountCents), 0) "
            + "FROM AffiliateCommission c "
            + "WHERE c.referrerModelUserId = :referrerModelUserId "
            + "AND c.periodYyyymm = :periodYyyymm "
            + "AND c.status IN :statuses")
    long sumCommissionAmountByReferrerAndPeriodInStatuses(@Param("referrerModelUserId") Long referrerModelUserId,
                                                            @Param("periodYyyymm") Integer periodYyyymm,
                                                            @Param("statuses") Collection<String> statuses);
}
