// src/main/java/com/sharemechat/accountingaudit/job/AccountingAuditJobImpl.java
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
            final String scope = normalizeScope(run.getScope());

            if ("SELFTEST".equals(scope)) {
                executeSelftest(run, now);
            } else if ("SESSION_INTEGRITY".equals(scope)) {
                executeSessionIntegrityChecks(run, now);
            } else if ("FULL".equals(scope)) {
                executeAccountingChecks(run, now);
                executeSessionIntegrityChecks(run, now);
            } else {
                executeAccountingChecks(run, now);
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

    private String normalizeScope(String raw) {
        if (raw == null || raw.isBlank()) {
            return "DEFAULT";
        }

        String s = raw.trim().toUpperCase();
        return switch (s) {
            case "DEFAULT", "SELFTEST", "SESSION_INTEGRITY", "FULL" -> s;
            default -> "DEFAULT";
        };
    }

    private void executeSelftest(AuditRun run, Instant now) {
        run.setChecksExecuted(run.getChecksExecuted() + 1);
        run.setAnomaliesFound(run.getAnomaliesFound() + 1);

        if (!run.isDryRun()) {
            AccountingAnomaly a = new AccountingAnomaly();
            a.setAnomalyType("SELFTEST");
            a.setSeverity("INFO");
            a.setDescription("Self-test anomaly to validate audit pipeline.");
            a.setStatus("RESOLVED");
            a.setResolutionNote("Selftest auto-resolved");
            a.setResolvedAt(now);
            a.setDetectedAt(now);
            a.setCreatedAt(now);
            a.setAuditRunId(String.valueOf(run.getId()));

            accountingAnomalyRepository.save(a);
            run.setAnomaliesCreated(run.getAnomaliesCreated() + 1);
        }
    }

    private void executeAccountingChecks(AuditRun run, Instant now) {
        executeTransactionsWithoutBalance(run, now);
        executeBalanceVsLedger(run, now);
        executePlatformTransactionsWithoutPlatformBalance(run, now);
    }

    private void executeTransactionsWithoutBalance(AuditRun run, Instant now) {
        List<Long> orphanTxIds = transactionRepository.findTransactionIdsWithoutBalance();

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        run.setAnomaliesFound(run.getAnomaliesFound() + orphanTxIds.size());

        if (run.isDryRun() || orphanTxIds.isEmpty()) {
            return;
        }

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

    private void executeBalanceVsLedger(AuditRun run, Instant now) {
        List<BalanceLedgerAuditRepository.BalanceLedgerRow> rows =
                balanceLedgerAuditRepository.fetchLedgerSumAndLastBalanceByUser();

        int mismatches = 0;
        List<AccountingAnomaly> mismatchAnomalies = new ArrayList<>();

        for (BalanceLedgerAuditRepository.BalanceLedgerRow r : rows) {
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
                    a.setDescription(
                            "Mismatch balance vs ledger. user_id=" + userId
                                    + " ledgerSum=" + ledgerSum
                                    + " lastBalance=" + lastBalance
                    );
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

    private void executePlatformTransactionsWithoutPlatformBalance(AuditRun run, Instant now) {
        List<Long> orphanPlatformTxIds = balanceLedgerAuditRepository.fetchPlatformTransactionIdsWithoutPlatformBalance();

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        run.setAnomaliesFound(run.getAnomaliesFound() + orphanPlatformTxIds.size());

        if (run.isDryRun() || orphanPlatformTxIds.isEmpty()) {
            return;
        }

        List<AccountingAnomaly> anomalies = new ArrayList<>(orphanPlatformTxIds.size());

        for (Long ptId : orphanPlatformTxIds) {
            AccountingAnomaly a = new AccountingAnomaly();
            a.setAnomalyType("PLATFORM_TX_WITHOUT_PLATFORM_BALANCE");
            a.setSeverity("ERROR");
            a.setPlatformTransactionId(ptId);
            a.setDescription("Platform transaction sin platform_balance asociado. platform_transaction_id=" + ptId);
            a.setStatus("OPEN");
            a.setDetectedAt(now);
            a.setCreatedAt(now);
            a.setAuditRunId(String.valueOf(run.getId()));
            anomalies.add(a);
        }

        accountingAnomalyRepository.saveAll(anomalies);
        run.setAnomaliesCreated(run.getAnomaliesCreated() + anomalies.size());
    }

    private void executeSessionIntegrityChecks(AuditRun run, Instant now) {
        executeClosedStreamsWithoutEndedEvent(run, now);
        executeConfirmedStreamsWithoutConfirmedEvent(run, now);
        executeConfirmEventWithoutConfirmedAt(run, now);
        executeTerminalEventWithoutEndTime(run, now);
        executeInvalidStreamTimestamps(run, now);
        executeMultipleActiveStreamsSameUser(run, now);
        executeClosedConfirmedStreamsWithoutCharge(run, now);
        executeClosedConfirmedStreamsWithoutEarning(run, now);
    }

    private void executeClosedStreamsWithoutEndedEvent(AuditRun run, Instant now) {
        List<BalanceLedgerAuditRepository.StreamLifecycleRow> rows =
                balanceLedgerAuditRepository.findClosedStreamsWithoutEndedEvent(1000);

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        run.setAnomaliesFound(run.getAnomaliesFound() + rows.size());

        if (run.isDryRun() || rows.isEmpty()) {
            return;
        }

        List<AccountingAnomaly> anomalies = new ArrayList<>(rows.size());
        for (BalanceLedgerAuditRepository.StreamLifecycleRow row : rows) {
            AccountingAnomaly a = new AccountingAnomaly();
            a.setAnomalyType("SI_CLOSED_STREAM_WITHOUT_ENDED_EVENT");
            a.setSeverity("WARNING");
            a.setStreamRecordId(row.getStreamRecordId());
            a.setUserId(row.getClientUserId());
            a.setDescription(
                    "Stream cerrado sin evento ENDED. stream_record_id=" + row.getStreamRecordId()
                            + " client_id=" + row.getClientUserId()
                            + " model_id=" + row.getModelUserId()
            );
            a.setStatus("OPEN");
            a.setDetectedAt(now);
            a.setCreatedAt(now);
            a.setAuditRunId(String.valueOf(run.getId()));
            anomalies.add(a);
        }

        accountingAnomalyRepository.saveAll(anomalies);
        run.setAnomaliesCreated(run.getAnomaliesCreated() + anomalies.size());
    }

    private void executeConfirmedStreamsWithoutConfirmedEvent(AuditRun run, Instant now) {
        List<BalanceLedgerAuditRepository.StreamLifecycleRow> rows =
                balanceLedgerAuditRepository.findConfirmedStreamsWithoutConfirmedEvent(1000);

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        run.setAnomaliesFound(run.getAnomaliesFound() + rows.size());

        if (run.isDryRun() || rows.isEmpty()) {
            return;
        }

        List<AccountingAnomaly> anomalies = new ArrayList<>(rows.size());
        for (BalanceLedgerAuditRepository.StreamLifecycleRow row : rows) {
            AccountingAnomaly a = new AccountingAnomaly();
            a.setAnomalyType("SI_CONFIRMED_STREAM_WITHOUT_CONFIRMED_EVENT");
            a.setSeverity("ERROR");
            a.setStreamRecordId(row.getStreamRecordId());
            a.setUserId(row.getClientUserId());
            a.setDescription(
                    "Stream confirmado sin evento CONFIRMED. stream_record_id=" + row.getStreamRecordId()
                            + " client_id=" + row.getClientUserId()
                            + " model_id=" + row.getModelUserId()
            );
            a.setStatus("OPEN");
            a.setDetectedAt(now);
            a.setCreatedAt(now);
            a.setAuditRunId(String.valueOf(run.getId()));
            anomalies.add(a);
        }

        accountingAnomalyRepository.saveAll(anomalies);
        run.setAnomaliesCreated(run.getAnomaliesCreated() + anomalies.size());
    }

    private void executeConfirmEventWithoutConfirmedAt(AuditRun run, Instant now) {
        List<BalanceLedgerAuditRepository.StreamLifecycleRow> rows =
                balanceLedgerAuditRepository.findConfirmEventWithoutConfirmedAt(1000);

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        run.setAnomaliesFound(run.getAnomaliesFound() + rows.size());

        if (run.isDryRun() || rows.isEmpty()) {
            return;
        }

        List<AccountingAnomaly> anomalies = new ArrayList<>(rows.size());
        for (BalanceLedgerAuditRepository.StreamLifecycleRow row : rows) {
            AccountingAnomaly a = new AccountingAnomaly();
            a.setAnomalyType("SI_CONFIRM_EVENT_WITHOUT_CONFIRMED_AT");
            a.setSeverity("ERROR");
            a.setStreamRecordId(row.getStreamRecordId());
            a.setUserId(row.getClientUserId());
            a.setDescription(
                    "Existe evento CONFIRMED pero confirmed_at es NULL. stream_record_id=" + row.getStreamRecordId()
                            + " client_id=" + row.getClientUserId()
                            + " model_id=" + row.getModelUserId()
            );
            a.setStatus("OPEN");
            a.setDetectedAt(now);
            a.setCreatedAt(now);
            a.setAuditRunId(String.valueOf(run.getId()));
            anomalies.add(a);
        }

        accountingAnomalyRepository.saveAll(anomalies);
        run.setAnomaliesCreated(run.getAnomaliesCreated() + anomalies.size());
    }

    private void executeTerminalEventWithoutEndTime(AuditRun run, Instant now) {
        List<BalanceLedgerAuditRepository.StreamLifecycleRow> rows =
                balanceLedgerAuditRepository.findTerminalEventWithoutEndTime(1000);

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        run.setAnomaliesFound(run.getAnomaliesFound() + rows.size());

        if (run.isDryRun() || rows.isEmpty()) {
            return;
        }

        List<AccountingAnomaly> anomalies = new ArrayList<>(rows.size());
        for (BalanceLedgerAuditRepository.StreamLifecycleRow row : rows) {
            AccountingAnomaly a = new AccountingAnomaly();
            a.setAnomalyType("SI_TERMINAL_EVENT_WITHOUT_END_TIME");
            a.setSeverity("CRITICAL");
            a.setStreamRecordId(row.getStreamRecordId());
            a.setUserId(row.getClientUserId());
            a.setDescription(
                    "Existe evento terminal pero end_time es NULL. stream_record_id=" + row.getStreamRecordId()
                            + " client_id=" + row.getClientUserId()
                            + " model_id=" + row.getModelUserId()
            );
            a.setStatus("OPEN");
            a.setDetectedAt(now);
            a.setCreatedAt(now);
            a.setAuditRunId(String.valueOf(run.getId()));
            anomalies.add(a);
        }

        accountingAnomalyRepository.saveAll(anomalies);
        run.setAnomaliesCreated(run.getAnomaliesCreated() + anomalies.size());
    }

    private void executeInvalidStreamTimestamps(AuditRun run, Instant now) {
        List<BalanceLedgerAuditRepository.InvalidStreamTimestampRow> rows =
                balanceLedgerAuditRepository.findInvalidStreamTimestamps(1000);

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        run.setAnomaliesFound(run.getAnomaliesFound() + rows.size());

        if (run.isDryRun() || rows.isEmpty()) {
            return;
        }

        List<AccountingAnomaly> anomalies = new ArrayList<>(rows.size());
        for (BalanceLedgerAuditRepository.InvalidStreamTimestampRow row : rows) {
            AccountingAnomaly a = new AccountingAnomaly();
            a.setAnomalyType("SI_INVALID_STREAM_TIMESTAMPS");
            a.setSeverity("ERROR");
            a.setStreamRecordId(row.getStreamRecordId());
            a.setUserId(row.getClientUserId());
            a.setDescription(
                    "Timestamps invalidos en stream. stream_record_id=" + row.getStreamRecordId()
                            + " problem=" + row.getProblemCode()
                            + " client_id=" + row.getClientUserId()
                            + " model_id=" + row.getModelUserId()
            );
            a.setStatus("OPEN");
            a.setDetectedAt(now);
            a.setCreatedAt(now);
            a.setAuditRunId(String.valueOf(run.getId()));
            anomalies.add(a);
        }

        accountingAnomalyRepository.saveAll(anomalies);
        run.setAnomaliesCreated(run.getAnomaliesCreated() + anomalies.size());
    }

    private void executeMultipleActiveStreamsSameUser(AuditRun run, Instant now) {
        List<BalanceLedgerAuditRepository.ActiveUserConflictRow> rows =
                balanceLedgerAuditRepository.findMultipleActiveStreamsSameUser(1000);

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        run.setAnomaliesFound(run.getAnomaliesFound() + rows.size());

        if (run.isDryRun() || rows.isEmpty()) {
            return;
        }

        List<AccountingAnomaly> anomalies = new ArrayList<>(rows.size());
        for (BalanceLedgerAuditRepository.ActiveUserConflictRow row : rows) {
            AccountingAnomaly a = new AccountingAnomaly();
            a.setAnomalyType("SI_MULTIPLE_ACTIVE_STREAMS_SAME_USER");
            a.setSeverity("CRITICAL");
            a.setUserId(row.getUserId());
            a.setDescription(
                    "Usuario con multiples streams activos. user_id=" + row.getUserId()
                            + " user_role=" + row.getUserRole()
                            + " active_count=" + row.getActiveCount()
            );
            a.setStatus("OPEN");
            a.setDetectedAt(now);
            a.setCreatedAt(now);
            a.setAuditRunId(String.valueOf(run.getId()));
            anomalies.add(a);
        }

        accountingAnomalyRepository.saveAll(anomalies);
        run.setAnomaliesCreated(run.getAnomaliesCreated() + anomalies.size());
    }

    private void executeClosedConfirmedStreamsWithoutCharge(AuditRun run, Instant now) {
        List<BalanceLedgerAuditRepository.StreamLifecycleRow> rows =
                balanceLedgerAuditRepository.findClosedConfirmedStreamsWithoutStreamCharge(1000);

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        run.setAnomaliesFound(run.getAnomaliesFound() + rows.size());

        if (run.isDryRun() || rows.isEmpty()) {
            return;
        }

        List<AccountingAnomaly> anomalies = new ArrayList<>(rows.size());
        for (BalanceLedgerAuditRepository.StreamLifecycleRow row : rows) {
            AccountingAnomaly a = new AccountingAnomaly();
            a.setAnomalyType("SI_CLOSED_CONFIRMED_STREAM_WITHOUT_STREAM_CHARGE");
            a.setSeverity("CRITICAL");
            a.setStreamRecordId(row.getStreamRecordId());
            a.setUserId(row.getClientUserId());
            a.setDescription(
                    "Stream cerrado y confirmado sin STREAM_CHARGE. stream_record_id=" + row.getStreamRecordId()
                            + " client_id=" + row.getClientUserId()
                            + " model_id=" + row.getModelUserId()
            );
            a.setStatus("OPEN");
            a.setDetectedAt(now);
            a.setCreatedAt(now);
            a.setAuditRunId(String.valueOf(run.getId()));
            anomalies.add(a);
        }

        accountingAnomalyRepository.saveAll(anomalies);
        run.setAnomaliesCreated(run.getAnomaliesCreated() + anomalies.size());
    }

    private void executeClosedConfirmedStreamsWithoutEarning(AuditRun run, Instant now) {
        List<BalanceLedgerAuditRepository.StreamLifecycleRow> rows =
                balanceLedgerAuditRepository.findClosedConfirmedStreamsWithoutStreamEarning(1000);

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        run.setAnomaliesFound(run.getAnomaliesFound() + rows.size());

        if (run.isDryRun() || rows.isEmpty()) {
            return;
        }

        List<AccountingAnomaly> anomalies = new ArrayList<>(rows.size());
        for (BalanceLedgerAuditRepository.StreamLifecycleRow row : rows) {
            AccountingAnomaly a = new AccountingAnomaly();
            a.setAnomalyType("SI_CLOSED_CONFIRMED_STREAM_WITHOUT_STREAM_EARNING");
            a.setSeverity("CRITICAL");
            a.setStreamRecordId(row.getStreamRecordId());
            a.setUserId(row.getModelUserId());
            a.setDescription(
                    "Stream cerrado y confirmado sin STREAM_EARNING. stream_record_id=" + row.getStreamRecordId()
                            + " client_id=" + row.getClientUserId()
                            + " model_id=" + row.getModelUserId()
            );
            a.setStatus("OPEN");
            a.setDetectedAt(now);
            a.setCreatedAt(now);
            a.setAuditRunId(String.valueOf(run.getId()));
            anomalies.add(a);
        }

        accountingAnomalyRepository.saveAll(anomalies);
        run.setAnomaliesCreated(run.getAnomaliesCreated() + anomalies.size());
    }
}