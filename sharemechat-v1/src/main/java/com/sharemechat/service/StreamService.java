package com.sharemechat.service;

import com.sharemechat.config.BillingProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.dto.StreamActiveAdminRowDto;
import com.sharemechat.dto.StreamAdminDetailDto;
import com.sharemechat.dto.StreamStatusEventDto;
import com.sharemechat.entity.*;
import com.sharemechat.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

@Service
public class StreamService {

    private static final Logger log = LoggerFactory.getLogger(StreamService.class);

    private final StreamRecordRepository streamRecordRepository;
    private final UserRepository userRepository;
    private final StatusService statusService;
    private final TransactionRepository transactionRepository;
    private final BalanceRepository balanceRepository;
    private final ClientRepository clientRepository;
    private final ModelRepository modelRepository;
    private final PlatformTransactionRepository platformTransactionRepository;
    private final PlatformBalanceRepository platformBalanceRepository;
    private final BillingProperties billing;
    private final ModelTierService modelTierService;
    private final TransactionService transactionService;
    private final StreamStatusEventRepository streamStatusEventRepository;

    private static final int ADMIN_ACTIVE_DEFAULT_LIMIT = 200;
    private static final int ADMIN_ACTIVE_MAX_LIMIT = 500;
    private static final int ADMIN_DETAIL_DEFAULT_EVENTS = 20;
    private static final int ADMIN_DETAIL_MAX_EVENTS = 100;
    private static final long ADMIN_STUCK_AFTER_SECONDS = 120L;

    // locks por sesión para evitar dobles cierres concurrentes
    private final ConcurrentHashMap<Long, ReentrantLock> sessionLocks = new ConcurrentHashMap<>();

    public StreamService(StreamRecordRepository streamRecordRepository,
                         UserRepository userRepository,
                         StatusService statusService,
                         BalanceRepository balanceRepository,
                         TransactionRepository transactionRepository,
                         ClientRepository clientRepository,
                         ModelRepository modelRepository,
                         PlatformTransactionRepository platformTransactionRepository,
                         BillingProperties billing,
                         ModelTierService modelTierService,
                         PlatformBalanceRepository platformBalanceRepository,
                         TransactionService transactionService,
                         StreamStatusEventRepository streamStatusEventRepository) {
        this.streamRecordRepository = streamRecordRepository;
        this.userRepository = userRepository;
        this.statusService = statusService;
        this.balanceRepository = balanceRepository;
        this.transactionRepository = transactionRepository;
        this.clientRepository = clientRepository;
        this.modelRepository = modelRepository;
        this.platformTransactionRepository = platformTransactionRepository;
        this.billing = billing;
        this.modelTierService = modelTierService;
        this.platformBalanceRepository = platformBalanceRepository;
        this.transactionService = transactionService;
        this.streamStatusEventRepository = streamStatusEventRepository;
    }

    /**
     * Inicia una sesión de streaming en el instante del match.
     * Crea StreamRecord(start_time=now, end_time=NULL) y marca a la modelo como BUSY.
     * Idempotente respecto al par (si ya hubiera una activa, devuelve esa).
     *
     * IMPORTANTE:
     *  - Si el cliente no tiene saldo suficiente, lanza IllegalStateException cuyo mensaje contiene
     *    la cadena "Saldo insuficiente", para que el MatchingHandler envíe "no-balance".
     *
     * confirmed_at:
     *  - Se crea como NULL. La sesión se confirmará explícitamente cuando el flujo esté estable.
     */
    @Transactional
    public StreamRecord startSession(Long clientId, Long modelId) {
        return startSession(clientId, modelId, Constants.StreamTypes.UNKNOWN);
    }

    @Transactional
    public StreamRecord startSession(Long clientId, Long modelId, String streamType) {
        String normalizedStreamType = normalizeStreamType(streamType);
        // Si ya hay sesión activa para este par, reusar (idempotencia)
        Optional<StreamRecord> existing = streamRecordRepository
                .findTopByClient_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(clientId, modelId);
        if (existing.isPresent()) {
            StreamRecord sr = existing.get();
            if (Constants.StreamTypes.UNKNOWN.equals(normalizeStreamType(sr.getStreamType()))
                    && !Constants.StreamTypes.UNKNOWN.equals(normalizedStreamType)) {
                sr.setStreamType(normalizedStreamType);
                sr = streamRecordRepository.save(sr);
            }
            log.info("startSession: ya existe sesión activa id={} para client={}, model={}", sr.getId(), clientId, modelId);
            statusService.setBusy(modelId);
            statusService.setActiveSession(clientId, modelId, sr.getId());
            return sr;
        }

        // Cargar usuarios y validar roles
        User client = userRepository.findById(clientId)
                .orElseThrow(() -> new EntityNotFoundException("Cliente no encontrado: " + clientId));
        User model = userRepository.findById(modelId)
                .orElseThrow(() -> new EntityNotFoundException("Modelo no encontrado: " + modelId));

        if (!Constants.Roles.CLIENT.equals(client.getRole())) {
            throw new IllegalArgumentException("El usuario " + clientId + " no tiene rol CLIENT");
        }
        if (!Constants.Roles.MODEL.equals(model.getRole())) {
            throw new IllegalArgumentException("El usuario " + modelId + " no tiene rol MODEL");
        }

        // Saldo desde ledger (fuente de verdad)
        BigDecimal ledgerSaldo = balanceRepository
                .findTopByUserIdOrderByTimestampDesc(clientId)
                .map(Balance::getBalance)
                .orElse(BigDecimal.ZERO);

        // Bloquear inicio si ledgerSaldo < tarifa por minuto
        if (ledgerSaldo.compareTo(billing.getRatePerMinute()) < 0) {
            log.warn("startSession: saldo insuficiente para iniciar. clientId={}, saldo={}, requeridoPorMin={}",
                    clientId, ledgerSaldo, billing.getRatePerMinute());
            throw new IllegalStateException("Saldo insuficiente para iniciar el streaming.");
        }


        // Crear StreamRecord
        StreamRecord sr = new StreamRecord();
        sr.setClient(client);
        sr.setModel(model);
        sr.setStartTime(LocalDateTime.now());
        sr.setConfirmedAt(null);
        sr.setStreamType(normalizedStreamType);
        sr.setEndTime(null);

        StreamRecord saved = streamRecordRepository.save(sr);
        recordStreamEvent(saved.getId(), Constants.StreamEventTypes.CREATED, null, null);
        log.info("startSession: creada sesión id={} (client={}, model={}) confirmedAt=NULL", saved.getId(), clientId, modelId);

        // Estado y lookup rápido (Redis)
        statusService.setBusy(modelId);
        statusService.setActiveSession(clientId, modelId, saved.getId());

        return saved;
    }

    /**
     * Marca la sesión activa del par como confirmada (confirmed_at = now) si aún no lo estaba.
     * Es idempotente.
     */
    @Transactional
    public void confirmActiveSession(Long clientId, Long modelId) {

        // LOG: entrada + thread
        log.debug(
                "confirmActiveSession ENTER client={} model={} thread={}",
                clientId,
                modelId,
                Thread.currentThread().getName()
        );

        // LOG: stacktrace (activar solo si lo necesitas)
        // new Exception("confirmActiveSession trace").printStackTrace();

        Long sessionIdHint = statusService.getActiveSession(clientId, modelId).orElse(null);

        StreamRecord session = null;
        if (sessionIdHint != null) {
            session = streamRecordRepository.findById(sessionIdHint).orElse(null);
        }
        if (session == null) {
            session = streamRecordRepository
                    .findTopByClient_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(clientId, modelId)
                    .orElse(null);
        }

        if (session == null) {
            log.warn("confirmActiveSession EXIT (no-session) client={} model={} hint={}", clientId, modelId, sessionIdHint);
            return;
        }
        if (session.getEndTime() != null) {
            log.warn("confirmActiveSession EXIT (already-ended) sessionId={} client={} model={}", session.getId(), clientId, modelId);
            return;
        }
        if (session.getConfirmedAt() != null) {
            log.debug("confirmActiveSession EXIT (already-confirmed) sessionId={} client={} model={} confirmedAt={}",
                    session.getId(), clientId, modelId, session.getConfirmedAt());
            return;
        }

        session.setConfirmedAt(LocalDateTime.now());
        streamRecordRepository.save(session);
        recordStreamEvent(session.getId(), Constants.StreamEventTypes.CONFIRMED, null, null);

        log.info(
                "confirmActiveSession: confirmada sesión id={} (client={}, model={})",
                session.getId(),
                clientId,
                modelId
        );
    }


    /**
     * ACK industrial: marca confirmed_at cuando el frontend confirma que el WebRTC está realmente conectado.
     *
     * Reglas:
     * - Solo puede confirmar si el userId es el client o el model de ese stream_record.
     * - Si end_time no es NULL, no hace nada (sesión ya cerrada).
     * - Idempotente: si confirmed_at ya está, no cambia nada.
     */
    @Transactional
    public void ackMedia(Long streamRecordId, Long userId) {
        StreamRecord session = streamRecordRepository.findById(streamRecordId)
                .orElseThrow(() -> new EntityNotFoundException("StreamRecord no encontrado: " + streamRecordId));

        // Seguridad: solo client o model pueden confirmar
        Long clientId = session.getClient() != null ? session.getClient().getId() : null;
        Long modelId  = session.getModel()  != null ? session.getModel().getId()  : null;

        if (clientId == null || modelId == null) {
            throw new IllegalStateException("StreamRecord inválido (client/model NULL) id=" + streamRecordId);
        }

        if (!userId.equals(clientId) && !userId.equals(modelId)) {
            throw new IllegalArgumentException("No autorizado: userId=" + userId + " no pertenece a la sesión " + streamRecordId);
        }

        if (session.getEndTime() != null) {
            // ya cerrada -> ignorar (idempotencia)
            log.info("ackMedia: sesión {} ya cerrada, ignorando ACK (userId={})", streamRecordId, userId);
            return;
        }

        if (session.getConfirmedAt() != null) {
            // ya confirmada -> idempotente
            return;
        }

        session.setConfirmedAt(LocalDateTime.now());
        streamRecordRepository.save(session);
        recordStreamEvent(session.getId(), Constants.StreamEventTypes.CONFIRMED, null, null);

        log.info("ackMedia: confirmada sesión id={} por userId={} (client={}, model={})",
                session.getId(), userId, clientId, modelId);
    }


    /**
     * Finaliza la sesión activa para el par client-model (si existe), y liquida cobros/pagos.
     * Idempotente. Marca end_time=now y limpia claves auxiliares. Facturación atómica.
     *
     * confirmed_at:
     *  - Si confirmed_at es NULL, se cierra el stream sin cargos (aunque haya segundos) y se limpia estado.
     */
    @Transactional
    public void endSession(Long clientId, Long modelId) {
        endSession(clientId, modelId, null);
    }

    @Transactional
    public void endSession(Long clientId, Long modelId, String endReason) {

        final BigDecimal RATE_PER_MINUTE = billing.getRatePerMinute(); // p.ej. 1.00

        // 1) Buscar la sesión activa (pista en cache y fallback a DB)
        Long sessionIdHint = statusService.getActiveSession(clientId, modelId).orElse(null);

        StreamRecord session = null;
        if (sessionIdHint != null) {
            session = streamRecordRepository.findById(sessionIdHint).orElse(null);
        }
        if (session == null) {
            session = streamRecordRepository
                    .findTopByClient_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(clientId, modelId)
                    .orElse(null);
        }

        if (session == null) {
            log.info("endSession: no hay sesión activa para client={}, model={}", clientId, modelId);
            return; // idempotente
        }

        // 2) Lock por sesión para evitar dobles cierres concurrentes
        ReentrantLock lock = sessionLocks.computeIfAbsent(session.getId(), k -> new ReentrantLock());
        if (!lock.tryLock()) {
            log.info("endSession: sesión {} ya está siendo cerrada por otro hilo", session.getId());
            return;
        }

        try {
            if (session.getEndTime() != null) {
                log.info("endSession: sesión {} ya estaba cerrada", session.getId());
                return; // idempotente
            }

            // === CALCULAR endTime PERO NO PERSISTIR AÚN ===
            LocalDateTime endTime = LocalDateTime.now();

            // 3.1) Si no está confirmada, aplicar FAILSAFE por duración
            long secondsSoFar = java.time.Duration.between(session.getStartTime(), endTime).getSeconds();
            if (secondsSoFar < 0) secondsSoFar = 0;

            // FAILSAFE DESACTIVADO: nunca auto-confirmamos.
            // Si confirmed_at es NULL, el flujo de más abajo cerrará sin cargos (aunque haya segundos).
            if (session.getConfirmedAt() == null && secondsSoFar >= 3) {
                log.warn(
                        "endSession: sesión {} >=3s pero NO confirmada -> se cerrará SIN cargos (duración={}s)",
                        session.getId(),
                        secondsSoFar
                );
            }


            // Si sigue sin confirmar (streams fantasma < 3s), cerrar sin cargos
            if (session.getConfirmedAt() == null) {
                session.setEndTime(endTime);
                streamRecordRepository.save(session);
                recordEndEvents(session.getId(), endReason);
                postEndStatusCleanup(clientId, modelId);
                log.info(
                        "endSession: sin cargos (stream no confirmado, duración={}s).",
                        secondsSoFar
                );
                return;
            }

            // 4) Duración en segundos (SIN ceil a minutos)
            long seconds = java.time.Duration.between(session.getStartTime(), endTime).getSeconds();
            if (seconds < 0) seconds = 0;

            // Horas (solo para métricas/estadística)
            BigDecimal hoursAsBigDecimal = BigDecimal.valueOf(seconds)
                    .divide(BigDecimal.valueOf(3600), 2, java.math.RoundingMode.HALF_UP);

            // 5) Cargar entidades base
            User clientUser = userRepository.findById(clientId)
                    .orElseThrow(() -> new EntityNotFoundException("Cliente no encontrado: " + clientId));
            User modelUser = userRepository.findById(modelId)
                    .orElseThrow(() -> new EntityNotFoundException("Modelo no encontrado: " + modelId));

            Client clientEntity = clientRepository.findById(clientId)
                    .orElseThrow(() -> new IllegalStateException("Cliente (tabla clients) no encontrado para userId=" + clientId));

            // 6) Saldo desde ledger (fuente de verdad)
            BigDecimal lastClientBalance = balanceRepository
                    .findTopByUserIdOrderByTimestampDesc(clientId)
                    .map(Balance::getBalance)
                    .orElse(BigDecimal.ZERO);


            // 7) Coste por segundo (1 €/min => 1/60 €/s)
            BigDecimal rawCost = RATE_PER_MINUTE
                    .multiply(BigDecimal.valueOf(seconds))
                    .divide(BigDecimal.valueOf(60), 6, java.math.RoundingMode.HALF_UP);

            BigDecimal cost = rawCost.setScale(2, java.math.RoundingMode.HALF_UP);

            if (cost.compareTo(BigDecimal.ZERO) > 0 && lastClientBalance.compareTo(cost) < 0) {
                long secondsCap = lastClientBalance
                        .multiply(BigDecimal.valueOf(60))
                        .divide(RATE_PER_MINUTE, 0, java.math.RoundingMode.FLOOR)
                        .longValue();

                seconds = Math.max(0L, secondsCap);

                hoursAsBigDecimal = BigDecimal.valueOf(seconds)
                        .divide(BigDecimal.valueOf(3600), 2, java.math.RoundingMode.HALF_UP);

                rawCost = RATE_PER_MINUTE
                        .multiply(BigDecimal.valueOf(seconds))
                        .divide(BigDecimal.valueOf(60), 6, java.math.RoundingMode.HALF_UP);

                cost = rawCost.setScale(2, java.math.RoundingMode.HALF_UP);
            }

            // 7.1) Si no hay segundos o coste, cerrar sin cargos
            if (seconds <= 0 || cost.compareTo(BigDecimal.ZERO) <= 0) {
                session.setEndTime(endTime);
                streamRecordRepository.save(session);
                recordEndEvents(session.getId(), endReason);
                postEndStatusCleanup(clientId, modelId);
                log.info("endSession: sin cargos (0 s). Finalizado únicamente el registro de stream.");
                return;
            }

            // 8) Reparto modelo / plataforma
            ModelEarningTier tier = null;
            try {
                tier = modelTierService.resolveEffectiveTierForPayout(modelId);
            } catch (Exception ex) {
                log.warn("endSession: error resolviendo tier para modelId={} -> {}", modelId, ex.getMessage());
            }

            BigDecimal modelEarning;

            if (tier == null) {
                modelEarning = BigDecimal.ZERO;
            } else {
                long secondsFirst = Math.min(seconds, 60L);
                long secondsNext  = Math.max(0L, seconds - 60L);

                BigDecimal earnFirst = BigDecimal.ZERO;
                BigDecimal earnNext  = BigDecimal.ZERO;

                if (secondsFirst > 0) {
                    earnFirst = tier.getFirstMinuteEarningPerMin()
                            .multiply(BigDecimal.valueOf(secondsFirst))
                            .divide(BigDecimal.valueOf(60), 6, java.math.RoundingMode.HALF_UP);
                }
                if (secondsNext > 0) {
                    earnNext = tier.getNextMinutesEarningPerMin()
                            .multiply(BigDecimal.valueOf(secondsNext))
                            .divide(BigDecimal.valueOf(60), 6, java.math.RoundingMode.HALF_UP);
                }

                modelEarning = earnFirst.add(earnNext)
                        .setScale(2, java.math.RoundingMode.HALF_UP);
            }

            BigDecimal platformEarning = cost.subtract(modelEarning)
                    .setScale(2, java.math.RoundingMode.HALF_UP);

            if (platformEarning.compareTo(BigDecimal.ZERO) < 0) {
                platformEarning = BigDecimal.ZERO;
                modelEarning = cost;
            }

            // 9) CLIENTE
            Transaction txClient = new Transaction();
            txClient.setUser(clientUser);
            txClient.setAmount(cost.negate());
            txClient.setOperationType("STREAM_CHARGE");
            txClient.setStreamRecord(session);
            txClient.setDescription("Cargo por streaming de " + seconds + " segundos");
            Transaction savedTxClient = transactionRepository.save(txClient);

            BigDecimal newClientBalance = lastClientBalance.subtract(cost);

            Balance balClient = new Balance();
            balClient.setUserId(clientId);
            balClient.setTransactionId(savedTxClient.getId());
            balClient.setOperationType("STREAM_CHARGE");
            balClient.setAmount(cost.negate());
            balClient.setBalance(newClientBalance);
            balClient.setDescription("Cargo por streaming de " + seconds + " segundos");
            balanceRepository.save(balClient);

            // cache/denormalizado: se actualiza, pero NO es fuente de verdad
            clientEntity.setSaldoActual(newClientBalance);
            clientEntity.setStreamingHours(
                    (clientEntity.getStreamingHours() != null ? clientEntity.getStreamingHours() : BigDecimal.ZERO)
                            .add(hoursAsBigDecimal)
            );
            clientRepository.save(clientEntity);

            // 10) MODELO
            Transaction txModel = new Transaction();
            txModel.setUser(modelUser);
            txModel.setAmount(modelEarning);
            txModel.setOperationType("STREAM_EARNING");
            txModel.setStreamRecord(session);
            txModel.setDescription("Ganancia por streaming de " + seconds + " segundos");
            Transaction savedTxModel = transactionRepository.save(txModel);

            BigDecimal lastModelBalance = balanceRepository
                    .findTopByUserIdOrderByTimestampDesc(modelId)
                    .map(Balance::getBalance)
                    .orElse(BigDecimal.ZERO);

            Balance balModel = new Balance();
            balModel.setUserId(modelId);
            balModel.setTransactionId(savedTxModel.getId());
            balModel.setOperationType("STREAM_EARNING");
            balModel.setAmount(modelEarning);
            balModel.setBalance(lastModelBalance.add(modelEarning));
            balModel.setDescription("Ganancia por streaming de " + seconds + " segundos");
            balanceRepository.save(balModel);

            Model modelEntity = modelRepository.findById(modelId).orElseGet(() -> {
                Model m = new Model();
                m.setUser(modelUser);
                m.setUserId(modelId);
                return m;
            });

            modelEntity.setSaldoActual(
                    (modelEntity.getSaldoActual() != null ? modelEntity.getSaldoActual() : BigDecimal.ZERO)
                            .add(modelEarning)
            );
            modelEntity.setTotalIngresos(
                    (modelEntity.getTotalIngresos() != null ? modelEntity.getTotalIngresos() : BigDecimal.ZERO)
                            .add(modelEarning)
            );
            modelEntity.setStreamingHours(
                    (modelEntity.getStreamingHours() != null ? modelEntity.getStreamingHours() : BigDecimal.ZERO)
                            .add(hoursAsBigDecimal)
            );
            modelRepository.save(modelEntity);

            // 11) PLATAFORMA
            PlatformTransaction ptx = new PlatformTransaction();
            ptx.setAmount(platformEarning);
            ptx.setOperationType("STREAM_MARGIN");
            ptx.setStreamRecord(session);
            ptx.setDescription("Margen plataforma por streaming de " + seconds + " segundos");
            PlatformTransaction savedPtx = platformTransactionRepository.save(ptx);

            BigDecimal lastPlatformBalance = platformBalanceRepository
                    .findTopByOrderByTimestampDesc()
                    .map(PlatformBalance::getBalance)
                    .orElse(BigDecimal.ZERO);

            PlatformBalance pbal = new PlatformBalance();
            pbal.setTransactionId(savedPtx.getId());
            pbal.setAmount(platformEarning);
            pbal.setBalance(lastPlatformBalance.add(platformEarning));
            pbal.setDescription("Margen plataforma por streaming de " + seconds + " segundos");
            platformBalanceRepository.save(pbal);

            // === AHORA SÍ: CERRAR STREAM ===
            session.setEndTime(endTime);
            streamRecordRepository.save(session);
            recordEndEvents(session.getId(), endReason);
            log.info("endSession: cerrada sesión id={} (client={}, model={})", session.getId(), clientId, modelId);

            // 12) Limpieza de estado
            postEndStatusCleanup(clientId, modelId);

        } finally {
            lock.unlock();
            sessionLocks.remove(session.getId());
        }
    }


    // Metodo para gestionar los Gift
    @Transactional
    public Gift sendGiftDuringActiveStream(Long clientId, Long modelId, Long giftId) {
        // 1) localizar sesión activa
        StreamRecord session = streamRecordRepository
                .findTopByClient_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(clientId, modelId)
                .orElseThrow(() -> new IllegalStateException("No hay sesión de streaming activa entre el cliente y la modelo"));

        // 2) registrar gift (contabilidad + balances + plataforma)
        return transactionService.processGift(clientId, modelId, giftId, session.getId());
    }

    /**
     * Corte preventivo: si saldo_actual - coste_acumulado < cutoff, cerrar ya la sesión.
     * Devuelve true si ha cerrado; false si aún puede continuar.
     *
     * Se debe invocar periódicamente (p.ej. en cada "ping" desde el MatchingHandler).
     */
    @Transactional(readOnly = true)
    public boolean endIfBelowThreshold(Long clientId, Long modelId) {

        // 1) localizar sesión activa
        Long sessionIdHint = statusService.getActiveSession(clientId, modelId).orElse(null);
        StreamRecord session = null;

        if (sessionIdHint != null) {
            session = streamRecordRepository.findById(sessionIdHint).orElse(null);
        }
        if (session == null) {
            session = streamRecordRepository
                    .findTopByClient_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(clientId, modelId)
                    .orElse(null);
        }
        if (session == null) return false;
        if (session.getEndTime() != null) return false;

        // ⚠️ CLAVE INDUSTRIAL:
        // Si no está confirmada, NO hay consumo real
        if (session.getConfirmedAt() == null) {
            return false;
        }

        // 2) calcular coste SOLO desde confirmedAt
        long seconds = java.time.Duration
                .between(session.getConfirmedAt(), LocalDateTime.now())
                .getSeconds();
        if (seconds < 0) seconds = 0;

        BigDecimal costSoFar = billing.getRatePerMinute()
                .multiply(BigDecimal.valueOf(seconds))
                .divide(BigDecimal.valueOf(60), 6, java.math.RoundingMode.HALF_UP);

        // 3) saldo desde ledger
        BigDecimal ledgerSaldo = balanceRepository
                .findTopByUserIdOrderByTimestampDesc(clientId)
                .map(Balance::getBalance)
                .orElse(BigDecimal.ZERO);

        BigDecimal remaining = ledgerSaldo.subtract(costSoFar);

        // 4) solo evaluamos
        boolean below = remaining.compareTo(billing.getCutoffThresholdEur()) < 0;

        if (below) {
            log.info(
                    "endIfBelowThreshold: DETECTADO bajo saldo (sin cerrar). client={}, model={}, remaining={}, cutoff={}",
                    clientId,
                    modelId,
                    remaining,
                    billing.getCutoffThresholdEur()
            );
        }

        return below;
    }


    /**
     * Devuelve true si hay una sesión de streaming ACTIVA (end_time = NULL)
     * entre el cliente y la modelo indicados.
     */
    public boolean isPairActive(Long clientId, Long modelId) {
        if (statusService.getActiveSession(clientId, modelId).isPresent()) {
            return true;
        }
        return streamRecordRepository
                .findTopByClient_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(clientId, modelId)
                .isPresent();
    }

    private void postEndStatusCleanup(Long clientId, Long modelId) {
        // Limpieza en Redis
        statusService.clearActiveSession(clientId, modelId);

        // Política simple: si la modelo no está OFFLINE, restaurar a AVAILABLE
        String status = statusService.getStatus(modelId);
        if (status == null || "OFFLINE".equals(status)) {
            // nada
        } else {
            statusService.setAvailable(modelId);
        }
    }

    /**
     * Devuelve true si el userId (sea CLIENT o MODEL) está en alguna sesión activa (end_time NULL).
     */
    public boolean isUserInActiveStream(Long userId) {
        try {
            boolean asClient = !streamRecordRepository.findByClient_IdAndEndTimeIsNull(userId).isEmpty();
            if (asClient) return true;
            boolean asModel  = !streamRecordRepository.findByModel_IdAndEndTimeIsNull(userId).isEmpty();
            return asModel;
        } catch (Exception ignore) {
            return false;
        }
    }

    @Async
    public void endSessionAsync(Long clientId, Long modelId) {
        endSessionAsync(clientId, modelId, null);
    }

    @Async
    public void endSessionAsync(Long clientId, Long modelId, String endReason) {
        try {
            log.info("endSessionAsync: programado cierre async client={}, model={}, reason={}", clientId, modelId, endReason);
            endSession(clientId, modelId, endReason);
        } catch (Exception ex) {
            log.error(
                    "endSessionAsync: error cerrando sesión client={}, model={} -> {}",
                    clientId,
                    modelId,
                    ex.getMessage(),
                    ex
            );
        }
    }

    @Transactional(readOnly = true)
    public List<StreamActiveAdminRowDto> listActiveStreamsForAdmin(String q,
                                                                   Long minDurationSec,
                                                                   String streamType,
                                                                   String status,
                                                                   Integer limit) {
        String normalizedQuery = normalizeQuery(q);
        Long numericQueryId = tryParseLong(normalizedQuery);
        boolean queryIsNumeric = numericQueryId != null;
        Long normalizedMinDurationSec = minDurationSec != null && minDurationSec >= 0 ? minDurationSec : null;
        String normalizedStreamType = normalizeAdminStreamType(streamType);
        String normalizedStatus = normalizeAdminStatus(status);
        int safeLimit = normalizeLimit(limit, ADMIN_ACTIVE_DEFAULT_LIMIT, ADMIN_ACTIVE_MAX_LIMIT);

        List<StreamRecord> active = streamRecordRepository.findActiveForAdmin(
                normalizedQuery,
                numericQueryId,
                queryIsNumeric,
                normalizedMinDurationSec,
                normalizedStreamType,
                normalizedStatus,
                PageRequest.of(0, safeLimit)
        );

        LocalDateTime now = LocalDateTime.now();
        return active.stream()
                .map(sr -> mapStreamRecordToAdminRow(sr, now))
                .toList();
    }

    @Transactional(readOnly = true)
    public StreamAdminDetailDto getAdminStreamDetail(Long streamId, Integer limitEvents) {
        StreamRecord stream = streamRecordRepository.findAdminDetailById(streamId)
                .orElseThrow(() -> new EntityNotFoundException("StreamRecord no encontrado: " + streamId));

        int safeLimitEvents = normalizeLimit(limitEvents, ADMIN_DETAIL_DEFAULT_EVENTS, ADMIN_DETAIL_MAX_EVENTS);
        List<StreamStatusEventDto> events = streamStatusEventRepository
                .findByStreamRecordIdOrderByCreatedAtDesc(streamId, PageRequest.of(0, safeLimitEvents))
                .stream()
                .map(this::mapEventToDto)
                .toList();

        StreamAdminDetailDto detail = new StreamAdminDetailDto();
        detail.setStream(mapStreamRecordToAdminRow(stream, LocalDateTime.now()));
        detail.setEvents(events);
        return detail;
    }

    private void recordEndEvents(Long streamId, String endReason) {
        String specialEventType = mapSpecialEndEventType(endReason);
        if (specialEventType != null) {
            recordStreamEvent(streamId, specialEventType, endReason, null);
        }
        recordStreamEvent(streamId, Constants.StreamEventTypes.ENDED, endReason, null);
    }

    private void recordStreamEvent(Long streamId, String eventType, String reason, String metadataJsonOrNull) {
        if (streamId == null || eventType == null || eventType.isBlank()) {
            return;
        }
        if (Constants.StreamEventTypes.CONFIRMED.equals(eventType)
                && streamStatusEventRepository.existsByStreamRecordIdAndEventType(streamId, eventType)) {
            return;
        }

        StreamStatusEvent event = new StreamStatusEvent();
        event.setStreamRecordId(streamId);
        event.setEventType(eventType);
        event.setReason(normalizeReason(reason));
        event.setMetadata(normalizeMetadata(metadataJsonOrNull));
        if (Constants.StreamEventTypes.CONFIRMED.equals(eventType)) {
            streamStatusEventRepository.saveAndFlush(event);
        } else {
            streamStatusEventRepository.save(event);
        }
    }

    private StreamActiveAdminRowDto mapStreamRecordToAdminRow(StreamRecord sr, LocalDateTime now) {
        StreamActiveAdminRowDto dto = new StreamActiveAdminRowDto();
        dto.setStreamId(sr.getId());
        dto.setStreamType(normalizeStreamType(sr.getStreamType()));
        dto.setClientId(sr.getClient() != null ? sr.getClient().getId() : null);
        dto.setClientEmail(sr.getClient() != null ? sr.getClient().getEmail() : null);
        dto.setClientNickname(sr.getClient() != null ? sr.getClient().getNickname() : null);
        dto.setModelId(sr.getModel() != null ? sr.getModel().getId() : null);
        dto.setModelEmail(sr.getModel() != null ? sr.getModel().getEmail() : null);
        dto.setModelNickname(sr.getModel() != null ? sr.getModel().getNickname() : null);
        dto.setStartTime(sr.getStartTime());
        dto.setConfirmedAt(sr.getConfirmedAt());
        dto.setEndTime(sr.getEndTime());

        LocalDateTime durationUntil = sr.getEndTime() != null ? sr.getEndTime() : now;
        long durationSeconds = 0L;
        if (sr.getStartTime() != null && durationUntil != null) {
            durationSeconds = Duration.between(sr.getStartTime(), durationUntil).getSeconds();
            if (durationSeconds < 0) durationSeconds = 0L;
        }
        dto.setDurationSeconds(durationSeconds);

        String statusDerivado = deriveStatus(sr);
        dto.setStatusDerivado(statusDerivado);
        dto.setStuck("connecting".equals(statusDerivado) && durationSeconds > ADMIN_STUCK_AFTER_SECONDS);
        return dto;
    }

    private StreamStatusEventDto mapEventToDto(StreamStatusEvent event) {
        StreamStatusEventDto dto = new StreamStatusEventDto();
        dto.setId(event.getId());
        dto.setEventType(event.getEventType());
        dto.setReason(event.getReason());
        dto.setMetadata(event.getMetadata());
        dto.setCreatedAt(event.getCreatedAt());
        return dto;
    }

    private String deriveStatus(StreamRecord sr) {
        if (sr.getEndTime() != null) {
            return "closed";
        }
        if (sr.getConfirmedAt() == null) {
            return "connecting";
        }
        return "active";
    }

    private String normalizeStreamType(String streamType) {
        if (streamType == null || streamType.isBlank()) {
            return Constants.StreamTypes.UNKNOWN;
        }

        String normalized = streamType.trim().toUpperCase(Locale.ROOT);
        if (Constants.StreamTypes.RANDOM.equals(normalized)
                || Constants.StreamTypes.CALLING.equals(normalized)
                || Constants.StreamTypes.UNKNOWN.equals(normalized)) {
            return normalized;
        }
        return Constants.StreamTypes.UNKNOWN;
    }

    private String normalizeAdminStreamType(String streamType) {
        if (streamType == null || streamType.isBlank()) {
            return null;
        }

        String normalized = streamType.trim().toUpperCase(Locale.ROOT);
        if (Constants.StreamTypes.RANDOM.equals(normalized)
                || Constants.StreamTypes.CALLING.equals(normalized)
                || Constants.StreamTypes.UNKNOWN.equals(normalized)) {
            return normalized;
        }
        throw new IllegalArgumentException("streamType inválido");
    }

    private String normalizeAdminStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }

        String normalized = status.trim().toLowerCase(Locale.ROOT);
        if ("connecting".equals(normalized) || "active".equals(normalized)) {
            return normalized;
        }
        throw new IllegalArgumentException("status inválido");
    }

    private String normalizeQuery(String q) {
        if (q == null) return null;
        String trimmed = q.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Long tryParseLong(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private int normalizeLimit(Integer requested, int defaultValue, int maxValue) {
        if (requested == null) return defaultValue;
        if (requested < 1) return defaultValue;
        return Math.min(requested, maxValue);
    }

    private String mapSpecialEndEventType(String endReason) {
        if (endReason == null || endReason.isBlank()) {
            return null;
        }

        String normalized = endReason.trim().toUpperCase(Locale.ROOT);
        if ("LOW-BALANCE".equals(normalized) || "LOW_BALANCE".equals(normalized)) {
            return Constants.StreamEventTypes.CUT_LOW_BALANCE;
        }
        if ("DISCONNECT".equals(normalized) || "WS_CLOSED".equals(normalized)) {
            return Constants.StreamEventTypes.DISCONNECT;
        }
        if ("TIMEOUT".equals(normalized)) {
            return Constants.StreamEventTypes.TIMEOUT;
        }
        return null;
    }

    private String normalizeReason(String reason) {
        if (reason == null) return null;
        String trimmed = reason.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeMetadata(String metadataJsonOrNull) {
        if (metadataJsonOrNull == null) return null;
        String trimmed = metadataJsonOrNull.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

}
