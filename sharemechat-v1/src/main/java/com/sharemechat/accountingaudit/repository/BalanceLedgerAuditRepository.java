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
}
