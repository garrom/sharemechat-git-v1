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

    // ============================================================
    // ADR-056: agregacion bruto por MASTER (display consolidado)
    // ============================================================
    // Suma sobre TODAS las modelos bajo umbrella del Master
    // (models.master_user_id = :masterId). Uso: dashboard consolidado
    // economico del Master (S5.a). NO se usa para determinar tramo:
    // tras la revision de D4 (2026-07-30) el motor calcula el % INDIVIDUAL
    // per modelo (alineado con sector LiveJasmin/Stripchat/BongaCams);
    // el Master recibe la suma de los pagos individuales sin bonus
    // por agregacion.

    /**
     * ADR-056 S3: STREAM_CHARGE bruto agregado del equipo de un Master.
     * Suma sobre todas las modelos con models.master_user_id = :masterId
     * en la ventana temporal. Devuelve valor positivo (bruto pagado por
     * clientes a cualquier modelo del Master).
     */
    @Query("SELECT COALESCE(SUM(-t.amount), 0) FROM Transaction t " +
           "WHERE t.operationType = 'STREAM_CHARGE' " +
           "  AND t.streamRecord.model.id IN (" +
           "      SELECT m.userId FROM Model m WHERE m.masterUserId = :masterId) " +
           "  AND t.timestamp >= :windowStart " +
           "  AND t.timestamp < :windowEnd")
    BigDecimal sumStreamChargeGrossForMasterWindow(
            @Param("masterId") Long masterId,
            @Param("windowStart") LocalDateTime windowStart,
            @Param("windowEnd") LocalDateTime windowEnd);

    /**
     * ADR-056 S3: TRIAL_EARNING agregado del equipo del Master. Suma
     * TRIAL_EARNING de todas las modelos bajo umbrella. Nota importante:
     * si el trial se atribuye al Master (D3 del ADR-056), el TRIAL_EARNING
     * fila puede tener user=master + attributed_model_user_id=modelo. La
     * query cubre ambos casos: legacy (t.user=modelo) y post-ADR-056
     * (t.attributed_model_user_id=modelo) usando OR sobre ambos campos.
     */
    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t " +
           "WHERE t.operationType = 'TRIAL_EARNING' " +
           "  AND (" +
           "      t.user.id IN (SELECT m.userId FROM Model m WHERE m.masterUserId = :masterId)" +
           "   OR t.attributedModelUserId IN (SELECT m.userId FROM Model m WHERE m.masterUserId = :masterId)" +
           "  ) " +
           "  AND t.timestamp >= :windowStart " +
           "  AND t.timestamp < :windowEnd")
    BigDecimal sumTrialEarningsForMasterWindow(
            @Param("masterId") Long masterId,
            @Param("windowStart") LocalDateTime windowStart,
            @Param("windowEnd") LocalDateTime windowEnd);

    /**
     * ADR-056 S3: bruto agregado del Master = suma STREAM_CHARGE +
     * TRIAL_EARNING de todas sus modelos bajo umbrella en la ventana.
     * Base para resolver el tier MASTER T1-T4.
     */
    default BigDecimal sumGrossBillingForMasterWindow(Long masterId,
                                                       LocalDateTime windowStart,
                                                       LocalDateTime windowEnd) {
        BigDecimal streamCharge = sumStreamChargeGrossForMasterWindow(masterId, windowStart, windowEnd);
        BigDecimal trialEarning = sumTrialEarningsForMasterWindow(masterId, windowStart, windowEnd);
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

    /**
     * ADR-056 Fase S5.a.3: historial del Master autenticado con filtros
     * opcionales. Las transacciones del Master siempre tienen
     * {@code t.user.id = masterId} (atribucion S3.rev via
     * StreamService/UserTrialService cuando la modelo tiene
     * master_user_id set). El campo {@code attributedModelUserId} del
     * DTO respuesta permite drill-down por modelo.
     *
     * <p>Filtros y semantica identicos a
     * {@link #findClientTransactionsFiltered}: se excluyen operaciones
     * de gift con amount=0 (residuo legacy) y se ordena descendente por
     * timestamp.
     */
    @Query("SELECT t FROM Transaction t "
            + "WHERE t.user.id = :masterId "
            + "AND (:types IS NULL OR t.operationType IN :types) "
            + "AND (:from IS NULL OR t.timestamp >= :from) "
            + "AND (:to IS NULL OR t.timestamp < :to) "
            + "AND NOT (t.operationType = 'GIFT_SEND' AND t.amount = 0) "
            + "AND NOT (t.operationType = 'GIFT_EARNING' AND t.amount = 0) "
            + "ORDER BY t.timestamp DESC")
    Page<Transaction> findMasterTransactionsFiltered(
            @Param("masterId") Long masterId,
            @Param("types") List<String> types,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            Pageable pageable);

    /**
     * ADR-056 Opcion D (2026-08-01): historial extendido para la MODELO
     * bajo Master. Devuelve las transacciones donde
     * {@code t.user.id = :modelId} (movimientos directos, ej. gifts
     * historicos pre-cambio 2026-08-01, retiros manuales) O donde
     * {@code t.attributedModelUserId = :modelId} (movimientos que ella
     * genero pero cuyo earning fue al Master tras la unificacion de
     * reparto a tramos). Permite transparencia total a la modelo sobre
     * lo que genera aunque el saldo lo cobre off-platform del Master.
     *
     * <p>Filtros y semantica identicos a
     * {@link #findClientTransactionsFiltered} / {@link #findMasterTransactionsFiltered}:
     * se excluyen gifts con amount=0 y se ordena descendente por timestamp.
     */
    @Query("SELECT t FROM Transaction t "
            + "WHERE (t.user.id = :modelId OR t.attributedModelUserId = :modelId) "
            + "AND (:types IS NULL OR t.operationType IN :types) "
            + "AND (:from IS NULL OR t.timestamp >= :from) "
            + "AND (:to IS NULL OR t.timestamp < :to) "
            + "AND NOT (t.operationType = 'GIFT_SEND' AND t.amount = 0) "
            + "AND NOT (t.operationType = 'GIFT_EARNING' AND t.amount = 0) "
            + "ORDER BY t.timestamp DESC")
    Page<Transaction> findModelTransactionsFiltered(
            @Param("modelId") Long modelId,
            @Param("types") List<String> types,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            Pageable pageable);

    /** Variante sin paginacion para export CSV modelo bajo Master. */
    @Query("SELECT t FROM Transaction t "
            + "WHERE (t.user.id = :modelId OR t.attributedModelUserId = :modelId) "
            + "AND (:types IS NULL OR t.operationType IN :types) "
            + "AND (:from IS NULL OR t.timestamp >= :from) "
            + "AND (:to IS NULL OR t.timestamp < :to) "
            + "AND NOT (t.operationType = 'GIFT_SEND' AND t.amount = 0) "
            + "AND NOT (t.operationType = 'GIFT_EARNING' AND t.amount = 0) "
            + "ORDER BY t.timestamp DESC")
    List<Transaction> findModelTransactionsForExport(
            @Param("modelId") Long modelId,
            @Param("types") List<String> types,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            Pageable pageable);

    /**
     * ADR-056 Opcion D iter.2 (2026-08-02): sumatorio bruto de earnings
     * atribuidas a la modelo (STREAM_EARNING + GIFT_EARNING). Sirve al
     * endpoint /models/me/master-info para calcular accumulatedNetPactado
     * = grossAttributed * internalSharePct/100. Ignora gifts con amount=0.
     */
    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t "
            + "WHERE t.attributedModelUserId = :modelId "
            + "  AND t.operationType IN ('STREAM_EARNING', 'GIFT_EARNING') "
            + "  AND NOT (t.operationType = 'GIFT_EARNING' AND t.amount = 0)")
    BigDecimal sumAttributedGrossEarnings(@Param("modelId") Long modelId);

    /**
     * ADR-056 iter.6 (2026-08-02): top modelos del Master por facturación
     * bruta en una ventana temporal, ordenadas DESC. Se agrupa por
     * attributedModelUserId (que la StreamService/UserTrialService setea al
     * atribuir la ganancia al Master). Cada fila:
     *   [0] modelUserId (Long)
     *   [1] totalGross (BigDecimal)
     *   [2] lastActivityAt (LocalDateTime)
     * El controller resuelve nickname en batch via UserRepository.
     */
    @Query("SELECT t.attributedModelUserId, "
            + "       COALESCE(SUM(t.amount), 0), "
            + "       MAX(t.timestamp) "
            + "  FROM Transaction t "
            + " WHERE t.user.id = :masterId "
            + "   AND t.attributedModelUserId IS NOT NULL "
            + "   AND t.operationType IN ('STREAM_EARNING', 'GIFT_EARNING') "
            + "   AND NOT (t.operationType = 'GIFT_EARNING' AND t.amount = 0) "
            + "   AND t.timestamp >= :from "
            + "   AND t.timestamp < :to "
            + " GROUP BY t.attributedModelUserId "
            + " ORDER BY SUM(t.amount) DESC")
    List<Object[]> findTopAttributedModelsInWindow(@Param("masterId") Long masterId,
                                                   @Param("from") LocalDateTime from,
                                                   @Param("to") LocalDateTime to,
                                                   Pageable pageable);
}
