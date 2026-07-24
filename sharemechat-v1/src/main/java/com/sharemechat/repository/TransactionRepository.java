package com.sharemechat.repository;

import com.sharemechat.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

    @Query("""
        SELECT t.id
        FROM Transaction t
        WHERE NOT EXISTS (
            SELECT 1
            FROM Balance b
            WHERE b.transactionId = t.id
        )
    """)
    List<Long> findTransactionIdsWithoutBalance();

    /**
     * ADR-052 §D6 (V39, 2026-07-25): suma la parte STREAM_CHARGE
     * (facturacion bruta cliente por sesion de pago) atribuida a la
     * modelo durante la ventana temporal indicada. STREAM_CHARGE se
     * persiste con {@code amount<0} en el ledger del cliente; la query
     * devuelve el valor positivo (bruto pagado por el cliente en esa
     * sesion).
     *
     * <p>Base para el snapshot diario que decide el tramo de reparto
     * (T0/T1/T2/T3) y el rango de precio elegible.
     */
    @Query("SELECT COALESCE(SUM(-t.amount), 0) FROM Transaction t " +
           "WHERE t.operationType = 'STREAM_CHARGE' " +
           "  AND t.streamRecord.model.id = :modelId " +
           "  AND t.timestamp >= :windowStart " +
           "  AND t.timestamp < :windowEnd")
    BigDecimal sumStreamChargeGrossForModelWindow(
            @Param("modelId") Long modelId,
            @Param("windowStart") LocalDateTime windowStart,
            @Param("windowEnd") LocalDateTime windowEnd);

    /**
     * ADR-052 §D6 + §D8 (V39, 2026-07-25): suma los TRIAL_EARNING de
     * la modelo (primer minuto trial pagado por la plataforma, €0.07/min
     * plano tras ADR-052). Cuenta hacia la facturacion bruta rolling 30d
     * porque es actividad economica generada por la modelo (aunque el
     * cliente no pague, la empresa lo absorbe como coste de adquisicion).
     * TRIAL_EARNING se persiste con {@code amount>0} en el ledger de la
     * modelo.
     */
    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t " +
           "WHERE t.operationType = 'TRIAL_EARNING' " +
           "  AND t.user.id = :modelId " +
           "  AND t.timestamp >= :windowStart " +
           "  AND t.timestamp < :windowEnd")
    BigDecimal sumTrialEarningsForModelWindow(
            @Param("modelId") Long modelId,
            @Param("windowStart") LocalDateTime windowStart,
            @Param("windowEnd") LocalDateTime windowEnd);

    /**
     * ADR-052 §D6: bruto agregado para el snapshot diario del regimen
     * nuevo. Suma STREAM_CHARGE (cliente paga por sesion) + TRIAL_EARNING
     * (primer minuto trial absorbido por empresa). Devuelve el valor en
     * EUR (positivo).
     */
    default BigDecimal sumGrossBillingForModelWindow(Long modelId,
                                                      LocalDateTime windowStart,
                                                      LocalDateTime windowEnd) {
        BigDecimal streamCharge = sumStreamChargeGrossForModelWindow(modelId, windowStart, windowEnd);
        BigDecimal trialEarning = sumTrialEarningsForModelWindow(modelId, windowStart, windowEnd);
        return (streamCharge != null ? streamCharge : java.math.BigDecimal.ZERO)
                .add(trialEarning != null ? trialEarning : java.math.BigDecimal.ZERO);
    }

    /**
     * Historial de transacciones del cliente (2026-07-19, Fase 1 vista
     * "Historial" del dashboard cliente). Filtro opcional por
     * {@code operationType}. Paginacion server-side ordenada por
     * {@code timestamp DESC}.
     * <p>Fase 1 llama SOLO con {@code operationType='INGRESO'} (recargas).
     * Fase 2 usa {@link #findClientTransactionsFiltered} con lista de
     * tipos + rango de fechas.
     */
    Page<Transaction> findByUser_IdAndOperationTypeOrderByTimestampDesc(
            Long userId, String operationType, Pageable pageable);

    Page<Transaction> findByUser_IdOrderByTimestampDesc(Long userId, Pageable pageable);

    /**
     * Fase 2 (2026-07-19): historial filtrado por lista de tipos +
     * rango de fechas opcional. Todos los params son opcionales:
     * <ul>
     *   <li>{@code types = null} -> no filtra por tipo (todos).</li>
     *   <li>{@code from = null}  -> sin cota inferior.</li>
     *   <li>{@code to = null}    -> sin cota superior.</li>
     * </ul>
     * <p>Rango semi-abierto {@code [from, to)} para evitar dependencia
     * de granularidad temporal (dia completo se pasa como
     * {@code from=00:00:00, to=+1dia 00:00:00}).
     */
    @Query("SELECT t FROM Transaction t "
            + "WHERE t.user.id = :userId "
            + "AND (:types IS NULL OR t.operationType IN :types) "
            + "AND (:from IS NULL OR t.timestamp >= :from) "
            + "AND (:to IS NULL OR t.timestamp < :to) "
            + "AND NOT (t.operationType = 'GIFT_SEND' AND t.amount = 0) "
            + "AND NOT (t.operationType = 'GIFT_EARNING' AND t.amount = 0) "
            + "ORDER BY t.timestamp DESC")
    Page<Transaction> findClientTransactionsFiltered(
            @Param("userId") Long userId,
            @Param("types") List<String> types,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            Pageable pageable);

    /**
     * Fase 3 (2026-07-19): variante sin paginacion para el export CSV.
     * Mismos filtros que {@link #findClientTransactionsFiltered}. El
     * caller aplica un LIMIT alto (10k) via {@code Pageable} en el
     * controller para prevenir OOM en cuentas con historial extremo;
     * los usuarios normales tienen decenas o centenas de filas.
     */
    @Query("SELECT t FROM Transaction t "
            + "WHERE t.user.id = :userId "
            + "AND (:types IS NULL OR t.operationType IN :types) "
            + "AND (:from IS NULL OR t.timestamp >= :from) "
            + "AND (:to IS NULL OR t.timestamp < :to) "
            + "AND NOT (t.operationType = 'GIFT_SEND' AND t.amount = 0) "
            + "AND NOT (t.operationType = 'GIFT_EARNING' AND t.amount = 0) "
            + "ORDER BY t.timestamp DESC")
    List<Transaction> findClientTransactionsForExport(
            @Param("userId") Long userId,
            @Param("types") List<String> types,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            Pageable pageable);
}
