package com.sharemechat.accountingaudit.job;

import com.sharemechat.accountingaudit.dto.AuditJobRequest;
import com.sharemechat.accountingaudit.dto.AuditJobResult;
import com.sharemechat.accountingaudit.entity.AccountingAnomaly;
import com.sharemechat.accountingaudit.entity.AuditRun;
import com.sharemechat.accountingaudit.repository.AccountingAnomalyRepository;
import com.sharemechat.accountingaudit.repository.AuditRunRepository;
import com.sharemechat.accountingaudit.repository.BalanceLedgerAuditRepository;
import com.sharemechat.repository.TransactionRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Component
public class AccountingAuditJobImpl implements AccountingAuditJob {

    private static final BigDecimal EPSILON = new BigDecimal("0.01");

    private final AuditRunRepository auditRunRepository;
    private final TransactionRepository transactionRepository;
    private final AccountingAnomalyRepository accountingAnomalyRepository;
    private final BalanceLedgerAuditRepository balanceLedgerAuditRepository;

    public AccountingAuditJobImpl(
            AuditRunRepository auditRunRepository,
            TransactionRepository transactionRepository,
            AccountingAnomalyRepository accountingAnomalyRepository,
            BalanceLedgerAuditRepository balanceLedgerAuditRepository
    ) {
        this.auditRunRepository = auditRunRepository;
        this.transactionRepository = transactionRepository;
        this.accountingAnomalyRepository = accountingAnomalyRepository;
        this.balanceLedgerAuditRepository = balanceLedgerAuditRepository;
    }

    @Override
    @Transactional
    public AuditJobResult execute(AuditJobRequest request) {

        Instant start = Instant.now();

        AuditRun run = new AuditRun();
        run.setJobName("ACCOUNTING_AUDIT");
        run.setTrigger(request.getTrigger() != null ? request.getTrigger() : "MANUAL");
        run.setRequestedByUserId(request.getRequestedByUserId());

        run.setFromTs(request.getFromTs());
        run.setToTs(request.getToTs());
        run.setScope(request.getScope() != null ? request.getScope() : "DEFAULT");
        run.setDryRun(request.isDryRun());

        run.setStatus("RUNNING");
        run.setStartedAt(start);

        run.setChecksExecuted(0);
        run.setAnomaliesFound(0);
        run.setAnomaliesCreated(0);
        run.setAnomaliesUpdated(0);

        run = auditRunRepository.save(run);

        try {
            final Instant now = Instant.now();

            // ==========================================
            // SELFTEST: fuerza 1 anomalía sintética (auto-resuelta)
            // ==========================================
            if ("SELFTEST".equalsIgnoreCase(run.getScope())) {

                run.setChecksExecuted(run.getChecksExecuted() + 1);
                run.setAnomaliesFound(run.getAnomaliesFound() + 1);

                if (!run.isDryRun()) {
                    AccountingAnomaly a = new AccountingAnomaly();
                    a.setAnomalyType("SELFTEST");
                    a.setSeverity("INFO");
                    a.setDescription("Self-test anomaly to validate accounting audit pipeline.");

                    a.setStatus("RESOLVED");
                    a.setResolutionNote("Selftest auto-resolved");
                    a.setResolvedAt(now);

                    a.setDetectedAt(now);
                    a.setCreatedAt(now);
                    a.setAuditRunId(String.valueOf(run.getId()));

                    accountingAnomalyRepository.save(a);
                    run.setAnomaliesCreated(run.getAnomaliesCreated() + 1);
                }

            } else {

                // ==========================================
                // CHECK #1: Transactions sin Balance
                // ==========================================
                final List<Long> orphanTxIds = transactionRepository.findTransactionIdsWithoutBalance();

                run.setChecksExecuted(run.getChecksExecuted() + 1);
                run.setAnomaliesFound(run.getAnomaliesFound() + orphanTxIds.size());

                if (!run.isDryRun() && !orphanTxIds.isEmpty()) {

                    List<AccountingAnomaly> anomalies = new ArrayList<>(orphanTxIds.size());

                    for (Long txId : orphanTxIds) {
                        AccountingAnomaly a = new AccountingAnomaly();

                        a.setAnomalyType("TX_WITHOUT_BALANCE");
                        a.setSeverity("WARNING");
                        a.setTransactionId(txId);
                        a.setDescription("Transaction sin balance asociado. transaction_id=" + txId);

                        a.setStatus("OPEN");

                        a.setDetectedAt(now);
                        a.setCreatedAt(now);
                        a.setAuditRunId(String.valueOf(run.getId()));

                        anomalies.add(a);
                    }

                    accountingAnomalyRepository.saveAll(anomalies);
                    run.setAnomaliesCreated(run.getAnomaliesCreated() + anomalies.size());
                }

                // ==========================================
                // CHECK #2: Balance vs Ledger (por user)
                // last_balance debe == SUM(transactions.amount)
                // ==========================================
                final List<BalanceLedgerAuditRepository.BalanceLedgerRow> rows =
                        balanceLedgerAuditRepository.fetchLedgerSumAndLastBalanceByUser();

                int mismatches = 0;
                List<AccountingAnomaly> mismatchAnomalies = new ArrayList<>();

                for (var r : rows) {
                    Long userId = r.getUserId();
                    BigDecimal ledgerSum = r.getLedgerSum() != null ? r.getLedgerSum() : BigDecimal.ZERO;
                    BigDecimal lastBalance = r.getLastBalance() != null ? r.getLastBalance() : BigDecimal.ZERO;

                    BigDecimal delta = ledgerSum.subtract(lastBalance).abs();

                    if (delta.compareTo(EPSILON) > 0) {
                        mismatches++;

                        if (!run.isDryRun()) {
                            AccountingAnomaly a = new AccountingAnomaly();
                            a.setAnomalyType("BALANCE_LEDGER_MISMATCH");
                            a.setSeverity("CRITICAL");

                            a.setUserId(userId);

                            a.setExpectedValue(ledgerSum);
                            a.setActualValue(lastBalance);
                            a.setDeltaValue(ledgerSum.subtract(lastBalance));

                            a.setDescription("Mismatch balance vs ledger. user_id=" + userId
                                    + " ledgerSum=" + ledgerSum
                                    + " lastBalance=" + lastBalance);

                            a.setStatus("OPEN");
                            a.setDetectedAt(now);
                            a.setCreatedAt(now);
                            a.setAuditRunId(String.valueOf(run.getId()));

                            mismatchAnomalies.add(a);
                        }
                    }
                }

                run.setChecksExecuted(run.getChecksExecuted() + 1);
                run.setAnomaliesFound(run.getAnomaliesFound() + mismatches);

                if (!run.isDryRun() && !mismatchAnomalies.isEmpty()) {
                    accountingAnomalyRepository.saveAll(mismatchAnomalies);
                    run.setAnomaliesCreated(run.getAnomaliesCreated() + mismatchAnomalies.size());
                }
            }

            run.setStatus("SUCCESS");

        } catch (Exception ex) {

            run.setStatus("FAILED");
            run.setErrorMessage(ex.getMessage());

        } finally {

            Instant end = Instant.now();

            run.setFinishedAt(end);
            run.setExecutionMs(end.toEpochMilli() - start.toEpochMilli());

            auditRunRepository.save(run);
        }

        AuditJobResult result = new AuditJobResult();
        result.setAuditRunId(run.getId());
        result.setStatus(run.getStatus());
        result.setChecksExecuted(run.getChecksExecuted());
        result.setAnomaliesFound(run.getAnomaliesFound());
        result.setAnomaliesCreated(run.getAnomaliesCreated());
        result.setAnomaliesUpdated(run.getAnomaliesUpdated());
        result.setExecutionMs(run.getExecutionMs());

        return result;
    }
}
