// src/main/java/com/sharemechat/accountingaudit/repository/BalanceLedgerAuditRepository.java
package com.sharemechat.accountingaudit.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Repository
public class BalanceLedgerAuditRepository {

    @PersistenceContext
    private EntityManager em;

    public static class BalanceLedgerRow {
        private final Long userId;
        private final BigDecimal ledgerSum;
        private final BigDecimal lastBalance;

        public BalanceLedgerRow(Long userId, BigDecimal ledgerSum, BigDecimal lastBalance) {
            this.userId = userId;
            this.ledgerSum = ledgerSum;
            this.lastBalance = lastBalance;
        }

        public Long getUserId() {
            return userId;
        }

        public BigDecimal getLedgerSum() {
            return ledgerSum;
        }

        public BigDecimal getLastBalance() {
            return lastBalance;
        }
    }

    public static class StreamReconRow {
        private final Long streamRecordId;
        private final BigDecimal clientChargeAbs;
        private final BigDecimal modelEarning;
        private final BigDecimal platformMargin;
        private final BigDecimal delta;
        private final Long cntCharge;
        private final Long cntEarning;
        private final Long cntMargin;

        public StreamReconRow(
                Long streamRecordId,
                BigDecimal clientChargeAbs,
                BigDecimal modelEarning,
                BigDecimal platformMargin,
                BigDecimal delta,
                Long cntCharge,
                Long cntEarning,
                Long cntMargin
        ) {
            this.streamRecordId = streamRecordId;
            this.clientChargeAbs = clientChargeAbs;
            this.modelEarning = modelEarning;
            this.platformMargin = platformMargin;
            this.delta = delta;
            this.cntCharge = cntCharge;
            this.cntEarning = cntEarning;
            this.cntMargin = cntMargin;
        }

        public Long getStreamRecordId() {
            return streamRecordId;
        }

        public BigDecimal getClientChargeAbs() {
            return clientChargeAbs;
        }

        public BigDecimal getModelEarning() {
            return modelEarning;
        }

        public BigDecimal getPlatformMargin() {
            return platformMargin;
        }

        public BigDecimal getDelta() {
            return delta;
        }

        public Long getCntCharge() {
            return cntCharge;
        }

        public Long getCntEarning() {
            return cntEarning;
        }

        public Long getCntMargin() {
            return cntMargin;
        }
    }

    public static class StreamLifecycleRow {
        private final Long streamRecordId;
        private final Long clientUserId;
        private final Long modelUserId;
        private final LocalDateTime startTime;
        private final LocalDateTime confirmedAt;
        private final LocalDateTime billableStart;
        private final LocalDateTime endTime;

        public StreamLifecycleRow(
                Long streamRecordId,
                Long clientUserId,
                Long modelUserId,
                LocalDateTime startTime,
                LocalDateTime confirmedAt,
                LocalDateTime billableStart,
                LocalDateTime endTime
        ) {
            this.streamRecordId = streamRecordId;
            this.clientUserId = clientUserId;
            this.modelUserId = modelUserId;
            this.startTime = startTime;
            this.confirmedAt = confirmedAt;
            this.billableStart = billableStart;
            this.endTime = endTime;
        }

        public Long getStreamRecordId() {
            return streamRecordId;
        }

        public Long getClientUserId() {
            return clientUserId;
        }

        public Long getModelUserId() {
            return modelUserId;
        }

        public LocalDateTime getStartTime() {
            return startTime;
        }

        public LocalDateTime getConfirmedAt() {
            return confirmedAt;
        }

        public LocalDateTime getBillableStart() {
            return billableStart;
        }

        public LocalDateTime getEndTime() {
            return endTime;
        }
    }

    public static class InvalidStreamTimestampRow {
        private final Long streamRecordId;
        private final Long clientUserId;
        private final Long modelUserId;
        private final String problemCode;

        public InvalidStreamTimestampRow(Long streamRecordId, Long clientUserId, Long modelUserId, String problemCode) {
            this.streamRecordId = streamRecordId;
            this.clientUserId = clientUserId;
            this.modelUserId = modelUserId;
            this.problemCode = problemCode;
        }

        public Long getStreamRecordId() {
            return streamRecordId;
        }

        public Long getClientUserId() {
            return clientUserId;
        }

        public Long getModelUserId() {
            return modelUserId;
        }

        public String getProblemCode() {
            return problemCode;
        }
    }

    public static class ActiveUserConflictRow {
        private final Long userId;
        private final String userRole;
        private final Long activeCount;

        public ActiveUserConflictRow(Long userId, String userRole, Long activeCount) {
            this.userId = userId;
            this.userRole = userRole;
            this.activeCount = activeCount;
        }

        public Long getUserId() {
            return userId;
        }

        public String getUserRole() {
            return userRole;
        }

        public Long getActiveCount() {
            return activeCount;
        }
    }

    @SuppressWarnings("unchecked")
    public List<BalanceLedgerRow> fetchLedgerSumAndLastBalanceByUser() {

        String sql = """
            SELECT
              lb.user_id AS userId,
              COALESCE(SUM(t.amount), 0) AS ledgerSum,
              lb.last_balance AS lastBalance
            FROM (
              SELECT b1.user_id, b1.balance AS last_balance
              FROM balances b1
              JOIN (
                SELECT user_id, MAX(`timestamp`) AS max_ts
                FROM balances
                GROUP BY user_id
              ) mx
                ON mx.user_id = b1.user_id
               AND mx.max_ts = b1.`timestamp`
              JOIN (
                SELECT user_id, `timestamp`, MAX(id) AS max_id
                FROM balances
                GROUP BY user_id, `timestamp`
              ) mid
                ON mid.user_id = b1.user_id
               AND mid.`timestamp` = b1.`timestamp`
               AND mid.max_id = b1.id
            ) lb
            LEFT JOIN transactions t
              ON t.user_id = lb.user_id
            GROUP BY lb.user_id, lb.last_balance
            """;

        List<Object[]> rows = em.createNativeQuery(sql).getResultList();

        List<BalanceLedgerRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            Long userId = r[0] != null ? ((Number) r[0]).longValue() : null;
            BigDecimal ledgerSum = (BigDecimal) r[1];
            BigDecimal lastBalance = (BigDecimal) r[2];
            out.add(new BalanceLedgerRow(userId, ledgerSum, lastBalance));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    public List<StreamReconRow> findStreamSettlementMismatches(int limit) {

        String sql = """
            SELECT
              sr.id AS stream_record_id,

              ROUND(ABS(COALESCE(ch.charge_sum, 0)), 2) AS client_charge_abs,
              ROUND(COALESCE(me.earning_sum, 0), 2)     AS model_earning,
              ROUND(COALESCE(pm.margin_sum, 0), 2)      AS platform_margin,

              ROUND(
                (ROUND(ABS(COALESCE(ch.charge_sum, 0)), 2)
                 - ROUND(COALESCE(me.earning_sum, 0), 2)
                 - ROUND(COALESCE(pm.margin_sum, 0), 2)
                ), 2
              ) AS delta,

              COALESCE(ch.cnt_charge, 0)  AS cnt_charge,
              COALESCE(me.cnt_earning, 0) AS cnt_earning,
              COALESCE(pm.cnt_margin, 0)  AS cnt_margin

            FROM stream_records sr

            LEFT JOIN (
              SELECT
                t.stream_record_id,
                SUM(t.amount) AS charge_sum,
                COUNT(*) AS cnt_charge
              FROM transactions t
              WHERE t.operation_type = 'STREAM_CHARGE'
                AND t.stream_record_id IS NOT NULL
              GROUP BY t.stream_record_id
            ) ch ON ch.stream_record_id = sr.id

            LEFT JOIN (
              SELECT
                t.stream_record_id,
                SUM(t.amount) AS earning_sum,
                COUNT(*) AS cnt_earning
              FROM transactions t
              WHERE t.operation_type = 'STREAM_EARNING'
                AND t.stream_record_id IS NOT NULL
              GROUP BY t.stream_record_id
            ) me ON me.stream_record_id = sr.id

            LEFT JOIN (
              SELECT
                pt.stream_record_id,
                SUM(pt.amount) AS margin_sum,
                COUNT(*) AS cnt_margin
              FROM platform_transactions pt
              WHERE pt.operation_type = 'STREAM_MARGIN'
                AND pt.stream_record_id IS NOT NULL
              GROUP BY pt.stream_record_id
            ) pm ON pm.stream_record_id = sr.id

            WHERE sr.end_time IS NOT NULL
              AND sr.confirmed_at IS NOT NULL
              AND (
                COALESCE(ch.cnt_charge,0) > 0
                OR COALESCE(me.cnt_earning,0) > 0
                OR COALESCE(pm.cnt_margin,0) > 0
              )
              AND (
                COALESCE(ch.cnt_charge,0) <> 1
                OR COALESCE(me.cnt_earning,0) <> 1
                OR COALESCE(pm.cnt_margin,0) <> 1
                OR ABS(
                  ROUND(ABS(COALESCE(ch.charge_sum, 0)), 2)
                  - ROUND(COALESCE(me.earning_sum, 0), 2)
                  - ROUND(COALESCE(pm.margin_sum, 0), 2)
                ) > 0.01
              )
            ORDER BY ABS(
              ROUND(ABS(COALESCE(ch.charge_sum, 0)), 2)
              - ROUND(COALESCE(me.earning_sum, 0), 2)
              - ROUND(COALESCE(pm.margin_sum, 0), 2)
            ) DESC
            LIMIT :limit
            """;

        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("limit", limit)
                .getResultList();

        List<StreamReconRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            Long streamId = r[0] != null ? ((Number) r[0]).longValue() : null;
            BigDecimal clientChargeAbs = (BigDecimal) r[1];
            BigDecimal modelEarning = (BigDecimal) r[2];
            BigDecimal platformMargin = (BigDecimal) r[3];
            BigDecimal delta = (BigDecimal) r[4];
            Long cntCharge = r[5] != null ? ((Number) r[5]).longValue() : 0L;
            Long cntEarning = r[6] != null ? ((Number) r[6]).longValue() : 0L;
            Long cntMargin = r[7] != null ? ((Number) r[7]).longValue() : 0L;

            out.add(new StreamReconRow(
                    streamId,
                    clientChargeAbs,
                    modelEarning,
                    platformMargin,
                    delta,
                    cntCharge,
                    cntEarning,
                    cntMargin
            ));
        }

        return out;
    }

    @SuppressWarnings("unchecked")
    public List<Long> fetchPlatformTransactionIdsWithoutPlatformBalance() {

        String sql = """
            SELECT pt.id
            FROM platform_transactions pt
            LEFT JOIN platform_balances pb ON pb.transaction_id = pt.id
            WHERE pb.id IS NULL
            """;

        List<Object> rows = em.createNativeQuery(sql).getResultList();

        List<Long> out = new ArrayList<>(rows.size());
        for (Object r : rows) {
            if (r == null) {
                continue;
            }
            out.add(((Number) r).longValue());
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    public List<StreamLifecycleRow> findClosedStreamsWithoutEndedEvent(int limit) {
        String sql = """
            SELECT
              sr.id,
              sr.client_id,
              sr.model_id,
              sr.start_time,
              sr.confirmed_at,
              sr.billable_start,
              sr.end_time
            FROM stream_records sr
            WHERE sr.stream_type IN ('RANDOM', 'CALLING')
              AND sr.end_time IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM stream_status_events sse
                WHERE sse.stream_record_id = sr.id
                  AND sse.event_type = 'ENDED'
              )
            ORDER BY sr.id DESC
            LIMIT :limit
            """;

        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("limit", limit)
                .getResultList();

        return mapStreamLifecycleRows(rows);
    }

    @SuppressWarnings("unchecked")
    public List<StreamLifecycleRow> findConfirmedStreamsWithoutConfirmedEvent(int limit) {
        String sql = """
            SELECT
              sr.id,
              sr.client_id,
              sr.model_id,
              sr.start_time,
              sr.confirmed_at,
              sr.end_time
            FROM stream_records sr
            WHERE sr.stream_type IN ('RANDOM', 'CALLING')
              AND sr.confirmed_at IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM stream_status_events sse
                WHERE sse.stream_record_id = sr.id
                  AND sse.event_type = 'CONFIRMED'
              )
            ORDER BY sr.id DESC
            LIMIT :limit
            """;

        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("limit", limit)
                .getResultList();

        return mapStreamLifecycleRows(rows);
    }

    @SuppressWarnings("unchecked")
    public List<StreamLifecycleRow> findConfirmEventWithoutConfirmedAt(int limit) {
        String sql = """
            SELECT DISTINCT
              sr.id,
              sr.client_id,
              sr.model_id,
              sr.start_time,
              sr.confirmed_at,
              sr.end_time
            FROM stream_records sr
            JOIN stream_status_events sse
              ON sse.stream_record_id = sr.id
             AND sse.event_type = 'CONFIRMED'
            WHERE sr.stream_type IN ('RANDOM', 'CALLING')
              AND sr.confirmed_at IS NULL
            ORDER BY sr.id DESC
            LIMIT :limit
            """;

        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("limit", limit)
                .getResultList();

        return mapStreamLifecycleRows(rows);
    }

    @SuppressWarnings("unchecked")
    public List<StreamLifecycleRow> findTerminalEventWithoutEndTime(int limit) {
        String sql = """
            SELECT DISTINCT
              sr.id,
              sr.client_id,
              sr.model_id,
              sr.start_time,
              sr.confirmed_at,
              sr.end_time
            FROM stream_records sr
            JOIN stream_status_events sse
              ON sse.stream_record_id = sr.id
             AND sse.event_type IN ('ENDED', 'CUT_LOW_BALANCE', 'DISCONNECT', 'TIMEOUT')
            WHERE sr.stream_type IN ('RANDOM', 'CALLING')
              AND sr.end_time IS NULL
            ORDER BY sr.id DESC
            LIMIT :limit
            """;

        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("limit", limit)
                .getResultList();

        return mapStreamLifecycleRows(rows);
    }

    @SuppressWarnings("unchecked")
    public List<InvalidStreamTimestampRow> findInvalidStreamTimestamps(int limit) {
        String sql = """
            SELECT
              sr.id,
              sr.client_id,
              sr.model_id,
              CASE
                WHEN sr.confirmed_at IS NOT NULL AND sr.confirmed_at < sr.start_time THEN 'CONFIRMED_BEFORE_START'
                WHEN sr.end_time IS NOT NULL AND sr.end_time < sr.start_time THEN 'ENDED_BEFORE_START'
                WHEN sr.end_time IS NOT NULL AND sr.confirmed_at IS NOT NULL AND sr.end_time < sr.confirmed_at THEN 'ENDED_BEFORE_CONFIRMED'
                ELSE 'UNKNOWN'
              END AS problem_code
            FROM stream_records sr
            WHERE sr.stream_type IN ('RANDOM', 'CALLING')
              AND (
                (sr.confirmed_at IS NOT NULL AND sr.confirmed_at < sr.start_time)
                OR (sr.end_time IS NOT NULL AND sr.end_time < sr.start_time)
                OR (sr.end_time IS NOT NULL AND sr.confirmed_at IS NOT NULL AND sr.end_time < sr.confirmed_at)
              )
            ORDER BY sr.id DESC
            LIMIT :limit
            """;

        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("limit", limit)
                .getResultList();

        List<InvalidStreamTimestampRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            Long streamId = r[0] != null ? ((Number) r[0]).longValue() : null;
            Long clientId = r[1] != null ? ((Number) r[1]).longValue() : null;
            Long modelId = r[2] != null ? ((Number) r[2]).longValue() : null;
            String problemCode = r[3] != null ? String.valueOf(r[3]) : "UNKNOWN";
            out.add(new InvalidStreamTimestampRow(streamId, clientId, modelId, problemCode));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    public List<ActiveUserConflictRow> findMultipleActiveStreamsSameUser(int limit) {
        String sql = """
            SELECT user_id, user_role, active_count
            FROM (
              SELECT
                sr.client_id AS user_id,
                'CLIENT' AS user_role,
                COUNT(*) AS active_count
              FROM stream_records sr
              WHERE sr.stream_type IN ('RANDOM', 'CALLING')
                AND sr.end_time IS NULL
              GROUP BY sr.client_id
              HAVING COUNT(*) > 1

              UNION ALL

              SELECT
                sr.model_id AS user_id,
                'MODEL' AS user_role,
                COUNT(*) AS active_count
              FROM stream_records sr
              WHERE sr.stream_type IN ('RANDOM', 'CALLING')
                AND sr.end_time IS NULL
              GROUP BY sr.model_id
              HAVING COUNT(*) > 1
            ) x
            ORDER BY active_count DESC, user_id ASC
            LIMIT :limit
            """;

        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("limit", limit)
                .getResultList();

        List<ActiveUserConflictRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            Long userId = r[0] != null ? ((Number) r[0]).longValue() : null;
            String userRole = r[1] != null ? String.valueOf(r[1]) : null;
            Long activeCount = r[2] != null ? ((Number) r[2]).longValue() : 0L;
            out.add(new ActiveUserConflictRow(userId, userRole, activeCount));
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    public List<StreamLifecycleRow> findClosedConfirmedStreamsWithoutStreamCharge(int limit) {
        String sql = """
            SELECT
              sr.id,
              sr.client_id,
              sr.model_id,
              sr.start_time,
              sr.confirmed_at,
              sr.end_time
            FROM stream_records sr
            WHERE sr.stream_type IN ('RANDOM', 'CALLING')
              AND sr.confirmed_at IS NOT NULL
              AND sr.end_time IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM transactions t
                WHERE t.stream_record_id = sr.id
                  AND t.operation_type = 'STREAM_CHARGE'
              )
            ORDER BY sr.id DESC
            LIMIT :limit
            """;

        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("limit", limit)
                .getResultList();

        return mapStreamLifecycleRows(rows);
    }

    @SuppressWarnings("unchecked")
    public List<StreamLifecycleRow> findClosedConfirmedStreamsWithoutStreamEarning(int limit) {
        String sql = """
            SELECT
              sr.id,
              sr.client_id,
              sr.model_id,
              sr.start_time,
              sr.confirmed_at,
              sr.end_time
            FROM stream_records sr
            WHERE sr.stream_type IN ('RANDOM', 'CALLING')
              AND sr.confirmed_at IS NOT NULL
              AND sr.end_time IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM transactions t
                WHERE t.stream_record_id = sr.id
                  AND t.operation_type = 'STREAM_EARNING'
              )
            ORDER BY sr.id DESC
            LIMIT :limit
            """;

        List<Object[]> rows = em.createNativeQuery(sql)
                .setParameter("limit", limit)
                .getResultList();

        return mapStreamLifecycleRows(rows);
    }

    private List<StreamLifecycleRow> mapStreamLifecycleRows(List<Object[]> rows) {
        List<StreamLifecycleRow> out = new ArrayList<>(rows.size());

        for (Object[] r : rows) {
            Long streamId = r[0] != null ? ((Number) r[0]).longValue() : null;
            Long clientId = r[1] != null ? ((Number) r[1]).longValue() : null;
            Long modelId = r[2] != null ? ((Number) r[2]).longValue() : null;
            LocalDateTime startTime = toLocalDateTime(r[3]);
            LocalDateTime confirmedAt = toLocalDateTime(r[4]);
            LocalDateTime billableStart = toLocalDateTime(r[5]);
            LocalDateTime endTime = toLocalDateTime(r[6]);

            out.add(new StreamLifecycleRow(
                    streamId,
                    clientId,
                    modelId,
                    startTime,
                    confirmedAt,
                    billableStart,
                    endTime
            ));
        }

        return out;
    }

    private LocalDateTime toLocalDateTime(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Timestamp ts) {
            return ts.toLocalDateTime();
        }
        if (value instanceof LocalDateTime ldt) {
            return ldt;
        }
        return null;
    }
}
