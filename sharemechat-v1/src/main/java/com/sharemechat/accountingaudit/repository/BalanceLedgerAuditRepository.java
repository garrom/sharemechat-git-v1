package com.sharemechat.accountingaudit.repository;

import org.springframework.stereotype.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Repository
public class BalanceLedgerAuditRepository {

    @PersistenceContext
    private EntityManager em;

    // ============================================================
    // EXISTENTE: Balance vs Ledger (por usuario)
    // ============================================================
    public static class BalanceLedgerRow {
        private final Long userId;
        private final BigDecimal ledgerSum;
        private final BigDecimal lastBalance;

        public BalanceLedgerRow(Long userId, BigDecimal ledgerSum, BigDecimal lastBalance) {
            this.userId = userId;
            this.ledgerSum = ledgerSum;
            this.lastBalance = lastBalance;
        }

        public Long getUserId() { return userId; }
        public BigDecimal getLedgerSum() { return ledgerSum; }
        public BigDecimal getLastBalance() { return lastBalance; }
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

    // ============================================================
    // NUEVO: Reconciliación por StreamRecord (charge/earning/margin)
    // ============================================================
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

        public Long getStreamRecordId() { return streamRecordId; }
        public BigDecimal getClientChargeAbs() { return clientChargeAbs; }
        public BigDecimal getModelEarning() { return modelEarning; }
        public BigDecimal getPlatformMargin() { return platformMargin; }
        public BigDecimal getDelta() { return delta; }
        public Long getCntCharge() { return cntCharge; }
        public Long getCntEarning() { return cntEarning; }
        public Long getCntMargin() { return cntMargin; }
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

    // ============================================================
    // NUEVO: Plataforma - platform_transactions sin platform_balance
    // ============================================================
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
            if (r == null) continue;
            out.add(((Number) r).longValue());
        }
        return out;
    }
}
