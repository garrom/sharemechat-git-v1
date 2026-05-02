package com.sharemechat.accountingaudit.job;

import com.sharemechat.accountingaudit.dto.AuditJobRequest;
import com.sharemechat.accountingaudit.dto.AuditJobResult;
import com.sharemechat.accountingaudit.entity.AccountingAnomaly;
import com.sharemechat.accountingaudit.entity.AuditRun;
import com.sharemechat.accountingaudit.repository.AccountingAnomalyRepository;
import com.sharemechat.accountingaudit.repository.AuditRunRepository;
import com.sharemechat.accountingaudit.repository.BalanceLedgerAuditRepository;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.handler.MatchingHandler;
import com.sharemechat.handler.MessagesWsHandler;
import com.sharemechat.repository.StreamRecordRepository;
import com.sharemechat.repository.TransactionRepository;
import com.sharemechat.service.StatusService;
import com.sharemechat.service.StreamLockService;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Component
public class AccountingAuditJobImpl implements AccountingAuditJob {

    private static final BigDecimal EPSILON = new BigDecimal("0.01");

    private final AuditRunRepository auditRunRepository;
    private final TransactionRepository transactionRepository;
    private final AccountingAnomalyRepository accountingAnomalyRepository;
    private final BalanceLedgerAuditRepository balanceLedgerAuditRepository;
    private final StreamRecordRepository streamRecordRepository;
    private final MatchingHandler matchingHandler;
    private final MessagesWsHandler messagesWsHandler;
    private final StatusService statusService;
    private final StreamLockService streamLockService;

    public AccountingAuditJobImpl(
            AuditRunRepository auditRunRepository,
            TransactionRepository transactionRepository,
            AccountingAnomalyRepository accountingAnomalyRepository,
            BalanceLedgerAuditRepository balanceLedgerAuditRepository,
            StreamRecordRepository streamRecordRepository,
            MatchingHandler matchingHandler,
            MessagesWsHandler messagesWsHandler,
            StatusService statusService,
            StreamLockService streamLockService
    ) {
        this.auditRunRepository = auditRunRepository;
        this.transactionRepository = transactionRepository;
        this.accountingAnomalyRepository = accountingAnomalyRepository;
        this.balanceLedgerAuditRepository = balanceLedgerAuditRepository;
        this.streamRecordRepository = streamRecordRepository;
        this.matchingHandler = matchingHandler;
        this.messagesWsHandler = messagesWsHandler;
        this.statusService = statusService;
        this.streamLockService = streamLockService;
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

            if ("SELFTEST".equalsIgnoreCase(run.getScope())) {
                runSelfTest(run, now);
            } else if ("SESSION_INTEGRITY".equalsIgnoreCase(run.getScope())) {
                runSessionIntegrity(run, now);
            } else if ("RUNTIME_HEALTH".equalsIgnoreCase(run.getScope())) {
                runRuntimeHealth(run, now);
            } else {
                runDefaultAccountingChecks(run, now);
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

    private void runSelfTest(AuditRun run, Instant now) {
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
    }

    private void runDefaultAccountingChecks(AuditRun run, Instant now) {
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

        final List<Long> orphanPlatformTxIds =
                balanceLedgerAuditRepository.fetchPlatformTransactionIdsWithoutPlatformBalance();

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        run.setAnomaliesFound(run.getAnomaliesFound() + orphanPlatformTxIds.size());

        if (!run.isDryRun() && !orphanPlatformTxIds.isEmpty()) {
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

        // BFPM Fase 4B-a: cuatro checks contables sobre BONUS_GRANT / BONUS_FUNDING.
        // Lectura-only, mismas convenciones del job (EPSILON, AccountingAnomaly).
        runBfpmChecks(run, now);
    }

    /**
     * BFPM Fase 4B-a — checks contables sobre BONUS_GRANT / BONUS_FUNDING.
     * No introduce configuración nueva. No filtra por ventana temporal porque los
     * tipos BONUS_* no existían antes de Fase 4A: cualquier coincidencia es real.
     *
     * Tipos de anomalía emitidos:
     *   - BFPM_INVARIANT_BREACH         (CRITICAL): Σ BONUS_GRANT + Σ BONUS_FUNDING > EPSILON.
     *   - BFPM_BONUS_GRANT_WITHOUT_FUNDING (ERROR): BONUS_GRANT sin pareja BONUS_FUNDING.
     *   - BFPM_BONUS_FUNDING_WITHOUT_GRANT (ERROR): BONUS_FUNDING sin pareja BONUS_GRANT.
     *   - BFPM_TOTAL_PAGOS_MISMATCH     (WARNING): clients.total_pagos != Σ Transaction(INGRESO).
     */
    private void runBfpmChecks(AuditRun run, Instant now) {
        // Check 1: invariante global BFPM
        run.setChecksExecuted(run.getChecksExecuted() + 1);
        BalanceLedgerAuditRepository.BfpmInvariantRow inv =
                balanceLedgerAuditRepository.getBfpmInvariantSummary();
        BigDecimal delta = inv.getDelta() != null ? inv.getDelta() : BigDecimal.ZERO;

        if (delta.abs().compareTo(EPSILON) > 0) {
            run.setAnomaliesFound(run.getAnomaliesFound() + 1);
            if (!run.isDryRun()) {
                AccountingAnomaly a = new AccountingAnomaly();
                a.setAnomalyType("BFPM_INVARIANT_BREACH");
                a.setSeverity("CRITICAL");
                a.setExpectedValue(BigDecimal.ZERO);
                a.setActualValue(delta);
                a.setDeltaValue(delta);
                a.setDescription("Invariante BFPM rota. sumBonusGrant=" + inv.getSumBonusGrant()
                        + " sumBonusFunding=" + inv.getSumBonusFunding()
                        + " delta=" + delta);
                a.setStatus("OPEN");
                a.setDetectedAt(now);
                a.setCreatedAt(now);
                a.setAuditRunId(String.valueOf(run.getId()));
                accountingAnomalyRepository.save(a);
                run.setAnomaliesCreated(run.getAnomaliesCreated() + 1);
            }
        }

        // Check 2: BONUS_GRANT sin BONUS_FUNDING emparejado por descripción
        run.setChecksExecuted(run.getChecksExecuted() + 1);
        List<BalanceLedgerAuditRepository.BfpmBonusGrantOrphanRow> grantOrphans =
                balanceLedgerAuditRepository.findBonusGrantsWithoutFunding(200);
        run.setAnomaliesFound(run.getAnomaliesFound() + grantOrphans.size());

        if (!run.isDryRun() && !grantOrphans.isEmpty()) {
            List<AccountingAnomaly> anomalies = new ArrayList<>(grantOrphans.size());
            for (var row : grantOrphans) {
                AccountingAnomaly a = new AccountingAnomaly();
                a.setAnomalyType("BFPM_BONUS_GRANT_WITHOUT_FUNDING");
                a.setSeverity("ERROR");
                a.setUserId(row.getUserId());
                a.setTransactionId(row.getTransactionId());
                a.setActualValue(row.getAmount());
                a.setDescription("BONUS_GRANT sin BONUS_FUNDING emparejado. transaction_id="
                        + row.getTransactionId() + " amount=" + row.getAmount()
                        + " desc=" + row.getDescription());
                a.setStatus("OPEN");
                a.setDetectedAt(now);
                a.setCreatedAt(now);
                a.setAuditRunId(String.valueOf(run.getId()));
                anomalies.add(a);
            }
            accountingAnomalyRepository.saveAll(anomalies);
            run.setAnomaliesCreated(run.getAnomaliesCreated() + anomalies.size());
        }

        // Check 3: BONUS_FUNDING sin BONUS_GRANT emparejado por descripción (sentido inverso)
        run.setChecksExecuted(run.getChecksExecuted() + 1);
        List<BalanceLedgerAuditRepository.BfpmBonusFundingOrphanRow> fundingOrphans =
                balanceLedgerAuditRepository.findBonusFundingsWithoutGrant(200);
        run.setAnomaliesFound(run.getAnomaliesFound() + fundingOrphans.size());

        if (!run.isDryRun() && !fundingOrphans.isEmpty()) {
            List<AccountingAnomaly> anomalies = new ArrayList<>(fundingOrphans.size());
            for (var row : fundingOrphans) {
                AccountingAnomaly a = new AccountingAnomaly();
                a.setAnomalyType("BFPM_BONUS_FUNDING_WITHOUT_GRANT");
                a.setSeverity("ERROR");
                a.setPlatformTransactionId(row.getPlatformTransactionId());
                a.setActualValue(row.getAmount());
                a.setDescription("BONUS_FUNDING sin BONUS_GRANT emparejado. platform_transaction_id="
                        + row.getPlatformTransactionId() + " amount=" + row.getAmount()
                        + " desc=" + row.getDescription());
                a.setStatus("OPEN");
                a.setDetectedAt(now);
                a.setCreatedAt(now);
                a.setAuditRunId(String.valueOf(run.getId()));
                anomalies.add(a);
            }
            accountingAnomalyRepository.saveAll(anomalies);
            run.setAnomaliesCreated(run.getAnomaliesCreated() + anomalies.size());
        }

        // Check 4: clients.total_pagos vs Σ transactions(op=INGRESO)
        run.setChecksExecuted(run.getChecksExecuted() + 1);
        List<BalanceLedgerAuditRepository.TotalPagosMismatchRow> totalPagosMismatches =
                balanceLedgerAuditRepository.findClientsTotalPagosVsIngresoMismatch(200);
        run.setAnomaliesFound(run.getAnomaliesFound() + totalPagosMismatches.size());

        if (!run.isDryRun() && !totalPagosMismatches.isEmpty()) {
            List<AccountingAnomaly> anomalies = new ArrayList<>(totalPagosMismatches.size());
            for (var row : totalPagosMismatches) {
                AccountingAnomaly a = new AccountingAnomaly();
                a.setAnomalyType("BFPM_TOTAL_PAGOS_MISMATCH");
                a.setSeverity("WARNING");
                a.setUserId(row.getUserId());
                a.setExpectedValue(row.getSumIngreso());
                a.setActualValue(row.getTotalPagos());
                a.setDeltaValue(row.getDelta());
                a.setDescription("clients.total_pagos no coincide con SUM(transactions INGRESO). user_id="
                        + row.getUserId()
                        + " total_pagos=" + row.getTotalPagos()
                        + " sum_ingreso=" + row.getSumIngreso()
                        + " delta=" + row.getDelta());
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

    private void runSessionIntegrity(AuditRun run, Instant now) {
        run.setChecksExecuted(run.getChecksExecuted() + 1);
        for (var row : balanceLedgerAuditRepository.findClosedStreamsWithoutEndedEvent(200)) {
            createSessionIntegrityAnomaly(
                    run,
                    now,
                    "SI_CLOSED_WITHOUT_ENDED_EVENT",
                    "WARNING",
                    row,
                    "Stream cerrado sin evento ENDED."
            );
        }

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        for (var row : balanceLedgerAuditRepository.findConfirmedStreamsWithoutConfirmedEvent(200)) {
            createSessionIntegrityAnomaly(
                    run,
                    now,
                    "SI_CONFIRMED_WITHOUT_CONFIRMED_EVENT",
                    "WARNING",
                    row,
                    "Stream confirmado sin evento CONFIRMED."
            );
        }

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        for (var row : balanceLedgerAuditRepository.findConfirmEventWithoutConfirmedAt(200)) {
            createSessionIntegrityAnomaly(
                    run,
                    now,
                    "SI_CONFIRM_EVENT_WITHOUT_CONFIRMED_AT",
                    "ERROR",
                    row,
                    "Evento CONFIRMED presente pero confirmed_at ausente."
            );
        }

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        for (var row : balanceLedgerAuditRepository.findTerminalEventWithoutEndTime(200)) {
            createSessionIntegrityAnomaly(
                    run,
                    now,
                    "SI_TERMINAL_EVENT_WITHOUT_END_TIME",
                    "ERROR",
                    row,
                    "Evento terminal presente pero end_time ausente."
            );
        }

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        for (var row : balanceLedgerAuditRepository.findInvalidStreamTimestamps(200)) {
            String description = "Timestamps invalidos en stream. problemCode=" + row.getProblemCode()
                    + " streamId=" + row.getStreamRecordId()
                    + " clientId=" + row.getClientUserId()
                    + " modelId=" + row.getModelUserId();
            createAnomaly(
                    run,
                    now,
                    "SI_INVALID_STREAM_TIMESTAMPS",
                    "ERROR",
                    row.getClientUserId(),
                    row.getStreamRecordId(),
                    null,
                    description
            );
        }

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        for (var row : balanceLedgerAuditRepository.findMultipleActiveStreamsSameUser(200)) {
            String description = "Multiples streams activos para el mismo usuario. userId=" + row.getUserId()
                    + " role=" + row.getUserRole()
                    + " activeCount=" + row.getActiveCount();
            createAnomaly(
                    run,
                    now,
                    "SI_MULTIPLE_ACTIVE_STREAMS_SAME_USER",
                    "CRITICAL",
                    row.getUserId(),
                    null,
                    null,
                    description
            );
        }

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        for (var row : balanceLedgerAuditRepository.findClosedConfirmedStreamsWithoutStreamCharge(200)) {
            createSessionIntegrityAnomaly(
                    run,
                    now,
                    "SI_CLOSED_CONFIRMED_WITHOUT_STREAM_CHARGE",
                    "CRITICAL",
                    row,
                    "Stream confirmado y cerrado sin STREAM_CHARGE."
            );
        }

        run.setChecksExecuted(run.getChecksExecuted() + 1);
        for (var row : balanceLedgerAuditRepository.findClosedConfirmedStreamsWithoutStreamEarning(200)) {
            createSessionIntegrityAnomaly(
                    run,
                    now,
                    "SI_CLOSED_CONFIRMED_WITHOUT_STREAM_EARNING",
                    "CRITICAL",
                    row,
                    "Stream confirmado y cerrado sin STREAM_EARNING."
            );
        }
    }

    @SuppressWarnings("unchecked")
    private void runRuntimeHealth(AuditRun run, Instant now) {
        Map<String, Object> matching = matchingHandler.adminRuntimeSnapshot();
        Map<String, Object> messages = messagesWsHandler.adminRuntimeSnapshot();

        List<Map<String, Object>> pairs =
                (List<Map<String, Object>>) matching.getOrDefault("pairs", List.of());
        List<Map<String, Object>> waitingModels =
                (List<Map<String, Object>>) matching.getOrDefault("waitingModels", List.of());
        List<Map<String, Object>> waitingClients =
                (List<Map<String, Object>>) matching.getOrDefault("waitingClients", List.of());
        List<Map<String, Object>> activeCalls =
                (List<Map<String, Object>>) messages.getOrDefault("activeCalls", List.of());
        List<Object> ringingUsers =
                (List<Object>) messages.getOrDefault("ringingUsers", List.of());

        Map<Long, String> statuses = statusService.listCurrentStatuses();
        List<Map<String, Object>> redisSessions = statusService.listActiveSessionsSnapshot();
        List<Map<String, Object>> redisLocks = streamLockService.listCurrentLocks();

        Set<String> pairedSessionIds = new HashSet<>();
        Set<Long> pairedClientIds = new HashSet<>();
        Set<Long> pairedModelIds = new HashSet<>();

        for (Map<String, Object> pair : pairs) {
            Object sidA = pair.get("sessionIdA");
            Object sidB = pair.get("sessionIdB");
            if (sidA != null) pairedSessionIds.add(String.valueOf(sidA));
            if (sidB != null) pairedSessionIds.add(String.valueOf(sidB));

            Long clientId = toLong(pair.get("clientId"));
            Long modelId = toLong(pair.get("modelId"));
            if (clientId != null) pairedClientIds.add(clientId);
            if (modelId != null) pairedModelIds.add(modelId);
        }

        Set<Long> activeCallUserIds = new HashSet<>();
        Set<Long> activeCallModelIds = new HashSet<>();

        // CHECK 1: Pair RANDOM activo en memoria sin stream activo en DB
        run.setChecksExecuted(run.getChecksExecuted() + 1);
        for (Map<String, Object> pair : pairs) {
            Long clientId = toLong(pair.get("clientId"));
            Long modelId = toLong(pair.get("modelId"));
            if (clientId == null || modelId == null) continue;

            Optional<StreamRecord> sr = streamRecordRepository
                    .findTopByClient_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(clientId, modelId);

            if (sr.isEmpty()) {
                createAnomaly(run, now, "RH_ACTIVE_PAIR_WITHOUT_DB_STREAM", "CRITICAL",
                        clientId, null, null,
                        "Pair RANDOM activa en memoria sin stream_record activo. clientId=" + clientId + " modelId=" + modelId);
            }
        }

        // CHECK 2: Call activa en memoria sin stream CALLING activo en DB
        run.setChecksExecuted(run.getChecksExecuted() + 1);
        for (Map<String, Object> row : activeCalls) {
            Long clientId = toLong(row.get("clientId"));
            Long modelId = toLong(row.get("modelId"));
            if (clientId == null || modelId == null) continue;

            activeCallUserIds.add(clientId);
            activeCallUserIds.add(modelId);
            activeCallModelIds.add(modelId);

            Optional<StreamRecord> sr = streamRecordRepository
                    .findTopByClient_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(clientId, modelId);

            if (sr.isEmpty() || !"CALLING".equalsIgnoreCase(sr.get().getStreamType())) {
                createAnomaly(run, now, "RH_ACTIVE_CALL_WITHOUT_DB_STREAM", "CRITICAL",
                        clientId, null, null,
                        "Call activa en memoria sin stream CALLING activo. clientId=" + clientId + " modelId=" + modelId);
            }
        }

        // CHECK 3: Modelo AVAILABLE pero con trabajo activo
        run.setChecksExecuted(run.getChecksExecuted() + 1);
        for (String s : statusService.listAvailableModels()) {
            Long modelId = tryParseLong(s);
            if (modelId == null) continue;

            boolean hasRuntimeWork = pairedModelIds.contains(modelId) || activeCallModelIds.contains(modelId);
            boolean hasDbWork = streamRecordRepository.findByModel_IdAndEndTimeIsNull(modelId).stream().findAny().isPresent();

            if (hasRuntimeWork || hasDbWork) {
                createAnomaly(run, now, "RH_MODEL_AVAILABLE_WITH_ACTIVE_WORK", "WARNING",
                        modelId, null, null,
                        "Modelo marcada AVAILABLE pero con trabajo activo. modelId=" + modelId);
            }
        }

        // CHECK 4: Modelo BUSY pero sin trabajo activo
        run.setChecksExecuted(run.getChecksExecuted() + 1);
        for (Map.Entry<Long, String> e : statuses.entrySet()) {
            Long userId = e.getKey();
            String status = e.getValue();
            if (!"BUSY".equalsIgnoreCase(status)) continue;

            boolean hasRuntimeWork = pairedModelIds.contains(userId) || activeCallModelIds.contains(userId);
            boolean hasDbWork = streamRecordRepository.findByModel_IdAndEndTimeIsNull(userId).stream().findAny().isPresent();

            if (!hasRuntimeWork && !hasDbWork) {
                createAnomaly(run, now, "RH_MODEL_BUSY_WITHOUT_ACTIVE_WORK", "WARNING",
                        userId, null, null,
                        "Modelo marcada BUSY sin trabajo activo en runtime ni en DB. modelId=" + userId);
            }
        }

        // CHECK 5: Usuario en cola y a la vez emparejado
        run.setChecksExecuted(run.getChecksExecuted() + 1);
        List<Map<String, Object>> allQueued = new ArrayList<>();
        allQueued.addAll(waitingModels);
        allQueued.addAll(waitingClients);

        for (Map<String, Object> row : allQueued) {
            String sid = row.get("sessionId") != null ? String.valueOf(row.get("sessionId")) : null;
            if (sid != null && pairedSessionIds.contains(sid)) {
                Long userId = toLong(row.get("userId"));
                createAnomaly(run, now, "RH_QUEUE_MEMBER_ALREADY_PAIRED", "ERROR",
                        userId, null, null,
                        "Sesión presente en cola y en pairs a la vez. sessionId=" + sid + " userId=" + userId);
            }
        }

        // CHECK 6: Ringing colgado sobre usuario no online o ya en llamada
        run.setChecksExecuted(run.getChecksExecuted() + 1);
        Set<Long> onlineUsers = new HashSet<>();
        List<Map<String, Object>> onlineRows =
                (List<Map<String, Object>>) messages.getOrDefault("onlineUsers", List.of());
        for (Map<String, Object> row : onlineRows) {
            Long userId = toLong(row.get("userId"));
            if (userId != null) onlineUsers.add(userId);
        }

        for (Object o : ringingUsers) {
            Long userId = toLong(o);
            if (userId == null) continue;

            if (!onlineUsers.contains(userId) || activeCallUserIds.contains(userId)) {
                createAnomaly(run, now, "RH_RINGING_STALE", "WARNING",
                        userId, null, null,
                        "Usuario en ringing incoherente. userId=" + userId
                                + " online=" + onlineUsers.contains(userId)
                                + " activeCall=" + activeCallUserIds.contains(userId));
            }
        }

        // CHECK 7: Redis active session sin DB activa
        run.setChecksExecuted(run.getChecksExecuted() + 1);
        for (Map<String, Object> row : redisSessions) {
            Long clientId = toLong(row.get("clientId"));
            Long modelId = toLong(row.get("modelId"));
            Long streamId = toLong(row.get("streamRecordId"));

            Optional<StreamRecord> sr = streamRecordRepository
                    .findTopByClient_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(clientId, modelId);

            if (sr.isEmpty()) {
                createAnomaly(run, now, "RH_REDIS_ACTIVE_SESSION_WITHOUT_DB_STREAM", "CRITICAL",
                        clientId, streamId, null,
                        "Redis session:active sin stream_record activo. clientId=" + clientId + " modelId=" + modelId + " streamIdHint=" + streamId);
            }
        }

        // CHECK 8: Lock huérfano sin trabajo activo
        run.setChecksExecuted(run.getChecksExecuted() + 1);
        for (Map<String, Object> row : redisLocks) {
            String key = row.get("key") != null ? String.valueOf(row.get("key")) : null;
            if (key == null) continue;

            Long userId = extractUserIdFromLockKey(key);
            if (userId == null) continue;

            boolean hasRuntimeWork = pairedClientIds.contains(userId)
                    || pairedModelIds.contains(userId)
                    || activeCallUserIds.contains(userId);

            boolean hasDbWork = streamRecordRepository.findByClient_IdAndEndTimeIsNull(userId).stream().findAny().isPresent()
                    || streamRecordRepository.findByModel_IdAndEndTimeIsNull(userId).stream().findAny().isPresent();

            if (!hasRuntimeWork && !hasDbWork) {
                createAnomaly(run, now, "RH_LOCK_WITHOUT_ACTIVE_WORK", "WARNING",
                        userId, null, null,
                        "Lock de stream sin trabajo activo asociado. key=" + key + " ttlSec=" + row.get("ttlSec"));
            }
        }
    }

    private void createAnomaly(AuditRun run,
                               Instant now,
                               String type,
                               String severity,
                               Long userId,
                               Long streamRecordId,
                               Long transactionId,
                               String description) {
        run.setAnomaliesFound(run.getAnomaliesFound() + 1);

        if (run.isDryRun()) {
            return;
        }

        AccountingAnomaly a = new AccountingAnomaly();
        a.setAnomalyType(type);
        a.setSeverity(severity);
        a.setUserId(userId);
        a.setStreamRecordId(streamRecordId);
        a.setTransactionId(transactionId);
        a.setDescription(description);
        a.setStatus("OPEN");
        a.setDetectedAt(now);
        a.setCreatedAt(now);
        a.setAuditRunId(String.valueOf(run.getId()));

        accountingAnomalyRepository.save(a);
        run.setAnomaliesCreated(run.getAnomaliesCreated() + 1);
    }

    private void createSessionIntegrityAnomaly(AuditRun run,
                                               Instant now,
                                               String type,
                                               String severity,
                                               BalanceLedgerAuditRepository.StreamLifecycleRow row,
                                               String baseDescription) {
        String description = baseDescription
                + " streamId=" + row.getStreamRecordId()
                + " clientId=" + row.getClientUserId()
                + " modelId=" + row.getModelUserId()
                + " startTime=" + row.getStartTime()
                + " confirmedAt=" + row.getConfirmedAt()
                + " billableStart=" + row.getBillableStart()
                + " endTime=" + row.getEndTime();

        createAnomaly(
                run,
                now,
                type,
                severity,
                row.getClientUserId(),
                row.getStreamRecordId(),
                null,
                description
        );
    }

    private Long toLong(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(v));
        } catch (Exception ex) {
            return null;
        }
    }

    private Long tryParseLong(String v) {
        if (v == null || v.isBlank()) return null;
        try {
            return Long.parseLong(v);
        } catch (Exception ex) {
            return null;
        }
    }

    private Long extractUserIdFromLockKey(String key) {
        if (key == null) return null;
        int idx = key.lastIndexOf(':');
        if (idx < 0 || idx >= key.length() - 1) return null;
        try {
            return Long.parseLong(key.substring(idx + 1));
        } catch (Exception ex) {
            return null;
        }
    }
}
