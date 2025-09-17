package com.sharemechat.service;

import com.sharemechat.config.BillingProperties;
import com.sharemechat.constants.Constants;
import com.sharemechat.entity.*;
import com.sharemechat.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

@Service
public class StreamService {

    private static final Logger log = LoggerFactory.getLogger(StreamService.class);

    private final StreamRecordRepository streamRecordRepository;
    private final UserRepository userRepository;
    private final ModelStatusService modelStatusService;
    private final TransactionRepository transactionRepository;
    private final BalanceRepository balanceRepository;
    private final ClientRepository clientRepository;
    private final ModelRepository modelRepository;
    private final PlatformTransactionRepository platformTransactionRepository;
    private final PlatformBalanceRepository platformBalanceRepository;
    private final BillingProperties billing;
    // locks por sesión para evitar dobles cierres concurrentes
    private final ConcurrentHashMap<Long, ReentrantLock> sessionLocks = new ConcurrentHashMap<>();


    public StreamService(StreamRecordRepository streamRecordRepository,
                         UserRepository userRepository,
                         ModelStatusService modelStatusService,
                         BalanceRepository balanceRepository,
                         TransactionRepository transactionRepository,
                         ClientRepository clientRepository,
                         ModelRepository modelRepository,
                         PlatformTransactionRepository platformTransactionRepository,
                         BillingProperties billing,
                         PlatformBalanceRepository platformBalanceRepository) {
        this.streamRecordRepository = streamRecordRepository;
        this.userRepository = userRepository;
        this.modelStatusService = modelStatusService;
        this.balanceRepository = balanceRepository;
        this.transactionRepository = transactionRepository;
        this.clientRepository = clientRepository;
        this.modelRepository = modelRepository;
        this.platformTransactionRepository = platformTransactionRepository;
        this.billing = billing;
        this.platformBalanceRepository = platformBalanceRepository;
    }

    /**
     * Inicia una sesión de streaming en el instante del match.
     * Crea StreamRecord(start_time=now, end_time=NULL) y marca a la modelo como BUSY.
     * Idempotente respecto al par (si ya hubiera una activa, devuelve esa).
     *
     * IMPORTANTE:
     *  - Si el cliente no tiene saldo suficiente, lanza IllegalStateException cuyo mensaje contiene
     *    la cadena "Saldo insuficiente", para que el MatchingHandler envíe "no-balance".
     */
    @Transactional
    public StreamRecord startSession(Long clientId, Long modelId) {
        // Si ya hay sesión activa para este par, reusar (idempotencia)
        Optional<StreamRecord> existing = streamRecordRepository
                .findTopByClient_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(clientId, modelId);
        if (existing.isPresent()) {
            StreamRecord sr = existing.get();
            log.info("startSession: ya existe sesión activa id={} para client={}, model={}", sr.getId(), clientId, modelId);
            modelStatusService.setBusy(modelId);
            modelStatusService.setActiveSession(clientId, modelId, sr.getId());
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

        // Validar saldo 1 - Leer el registro mutable del cliente
        Client clientEntity = clientRepository.findById(clientId)
                .orElseThrow(() -> new IllegalStateException("Cliente (tabla clients) no encontrado para userId=" + clientId));

        BigDecimal currentSaldo = clientEntity.getSaldoActual() != null ? clientEntity.getSaldoActual() : BigDecimal.ZERO;

        // Validar saldo 2 - Verificar consistencia con el último balance inmutable
        BigDecimal lastClientBalance = balanceRepository
                .findTopByUserIdOrderByTimestampDesc(clientId)
                .map(Balance::getBalance)
                .orElse(BigDecimal.ZERO);

        if (lastClientBalance.compareTo(currentSaldo) != 0) {
            throw new IllegalStateException(
                    "Inconsistencia: último balance del cliente (" + lastClientBalance + ") != clients.saldo_actual (" + currentSaldo + ")"
            );
        }

        // Validar saldo 3 - Bloquear inicio si saldo < tarifa por minuto (evita saldo=0)
        if (currentSaldo.compareTo(billing.getRatePerMinute()) < 0) {  // [NEW]
            // *** Mantener esta cadena "Saldo insuficiente" para que MatchingHandler pueda distinguir el motivo. ***
            log.warn("startSession: saldo insuficiente para iniciar. clientId={}, saldo={}, requeridoPorMin={}",
                    clientId, currentSaldo, billing.getRatePerMinute());        // [NEW]
            throw new IllegalStateException("Saldo insuficiente para iniciar el streaming.");
        }


        // Crear StreamRecord
        StreamRecord sr = new StreamRecord();
        sr.setClient(client);
        sr.setModel(model);
        sr.setStartTime(LocalDateTime.now());
        sr.setEndTime(null);

        StreamRecord saved = streamRecordRepository.save(sr);
        log.info("startSession: creada sesión id={} (client={}, model={})", saved.getId(), clientId, modelId);

        // Estado y lookup rápido (Redis)
        modelStatusService.setBusy(modelId);
        modelStatusService.setActiveSession(clientId, modelId, saved.getId());

        return saved;
    }

    /**
     * Finaliza la sesión activa para el par client-model (si existe), y liquida cobros/pagos.
     * Idempotente. Marca end_time=now y limpia claves auxiliares. Facturación atómica.
     */
    @Transactional
    public void endSession(Long clientId, Long modelId) {

        final BigDecimal RATE_PER_MINUTE = billing.getRatePerMinute(); // p.ej. 1.00
        final BigDecimal MODEL_SHARE     = billing.getModelShare();    // p.ej. 0.90


        // 1) Buscar la sesión activa (pista en cache y fallback a DB)
        Long sessionIdHint = modelStatusService.getActiveSession(clientId, modelId).orElse(null);

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

            // 3) Marcar fin
            LocalDateTime endTime = LocalDateTime.now();
            session.setEndTime(endTime);
            streamRecordRepository.save(session);
            log.info("endSession: cerrada sesión id={} (client={}, model={})", session.getId(), clientId, modelId);

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

            BigDecimal currentSaldo = clientEntity.getSaldoActual() != null ? clientEntity.getSaldoActual() : BigDecimal.ZERO;
            BigDecimal lastClientBalance = balanceRepository
                    .findTopByUserIdOrderByTimestampDesc(clientId)
                    .map(Balance::getBalance)
                    .orElse(BigDecimal.ZERO);

            // 6) Verificación de consistencia cliente
            if (lastClientBalance.compareTo(currentSaldo) != 0) {
                throw new IllegalStateException(
                        "Inconsistencia: último balance del cliente (" + lastClientBalance + ") != clients.saldo_actual (" + currentSaldo + ")"
                );
            }

            // 7) Coste por segundo (1 €/min => 1/60 €/s) con posible "cap" por saldo
            BigDecimal rawCost = RATE_PER_MINUTE
                    .multiply(BigDecimal.valueOf(seconds))
                    .divide(BigDecimal.valueOf(60), 6, java.math.RoundingMode.HALF_UP);

            BigDecimal cost = rawCost.setScale(2, java.math.RoundingMode.HALF_UP);

            if (cost.compareTo(BigDecimal.ZERO) > 0 && currentSaldo.compareTo(cost) < 0) {
                // Cap: ¿cuántos segundos puede pagar el cliente con su saldo?
                long secondsCap = currentSaldo
                        .multiply(BigDecimal.valueOf(60))
                        .divide(RATE_PER_MINUTE, 0, java.math.RoundingMode.FLOOR)
                        .longValue();

                seconds = Math.max(0L, secondsCap);

                // Recalcular métricas y coste con el cap
                hoursAsBigDecimal = BigDecimal.valueOf(seconds)
                        .divide(BigDecimal.valueOf(3600), 2, java.math.RoundingMode.HALF_UP);
                rawCost = RATE_PER_MINUTE
                        .multiply(BigDecimal.valueOf(seconds))
                        .divide(BigDecimal.valueOf(60), 6, java.math.RoundingMode.HALF_UP);
                cost = rawCost.setScale(2, java.math.RoundingMode.HALF_UP);
            }

            // Si no hay segundos o el coste es 0, no generamos apuntes
            if (seconds <= 0 || cost.compareTo(BigDecimal.ZERO) <= 0) {
                postEndStatusCleanup(clientId, modelId);
                log.info("endSession: sin cargos (0 s). Finalizado únicamente el registro de stream.");
                return;
            }

            // 8) Reparto (90/10 u otro) con redondeo a céntimo
            BigDecimal modelEarning    = cost.multiply(MODEL_SHARE).setScale(2, java.math.RoundingMode.HALF_UP);
            BigDecimal platformEarning = cost.subtract(modelEarning).setScale(2, java.math.RoundingMode.HALF_UP);

            // 9) ===== CLIENTE: transactions + balances + clients =====
            Transaction txClient = new Transaction();
            txClient.setUser(clientUser);
            txClient.setAmount(cost.negate()); // gasto
            txClient.setOperationType("STREAM_CHARGE");
            txClient.setStreamRecord(session);
            txClient.setDescription("Cargo por streaming de " + seconds + " segundos");
            Transaction savedTxClient = transactionRepository.save(txClient);

            BigDecimal newClientBalance = lastClientBalance.subtract(cost);
            Balance balClient = new Balance();
            balClient.setUserId(clientId);
            balClient.setTransactionId(savedTxClient.getId());
            balClient.setOperationType("STREAM_CHARGE");
            balClient.setAmount(cost.negate()); // negativo
            balClient.setBalance(newClientBalance);
            balClient.setDescription("Cargo por streaming de " + seconds + " segundos");
            balanceRepository.save(balClient);

            BigDecimal clientHours = clientEntity.getStreamingHours() != null ? clientEntity.getStreamingHours() : BigDecimal.ZERO;
            clientEntity.setSaldoActual(newClientBalance);
            clientEntity.setStreamingHours(clientHours.add(hoursAsBigDecimal));
            clientRepository.save(clientEntity);

            // 10) ===== MODELO: transactions + balances + models =====
            Transaction txModel = new Transaction();
            txModel.setUser(modelUser);
            txModel.setAmount(modelEarning); // ingreso
            txModel.setOperationType("STREAM_EARNING");
            txModel.setStreamRecord(session);
            txModel.setDescription("Ganancia por streaming de " + seconds + " segundos");
            Transaction savedTxModel = transactionRepository.save(txModel);

            BigDecimal lastModelBalance = balanceRepository
                    .findTopByUserIdOrderByTimestampDesc(modelId)
                    .map(Balance::getBalance)
                    .orElse(BigDecimal.ZERO);
            BigDecimal newModelBalance = lastModelBalance.add(modelEarning);

            Balance balModel = new Balance();
            balModel.setUserId(modelId);
            balModel.setTransactionId(savedTxModel.getId());
            balModel.setOperationType("STREAM_EARNING");
            balModel.setAmount(modelEarning); // positivo
            balModel.setBalance(newModelBalance);
            balModel.setDescription("Ganancia por streaming de " + seconds + " segundos");
            balanceRepository.save(balModel);

            Model modelEntity = modelRepository.findById(modelId).orElseGet(() -> {
                Model m = new Model();
                m.setUser(modelUser); // @MapsId
                m.setUserId(modelId);
                return m;
            });
            BigDecimal mSaldo = modelEntity.getSaldoActual() != null ? modelEntity.getSaldoActual() : BigDecimal.ZERO;
            BigDecimal mTotal = modelEntity.getTotalIngresos() != null ? modelEntity.getTotalIngresos() : BigDecimal.ZERO;
            BigDecimal mHours = modelEntity.getStreamingHours() != null ? modelEntity.getStreamingHours() : BigDecimal.ZERO;

            modelEntity.setSaldoActual(mSaldo.add(modelEarning));
            modelEntity.setTotalIngresos(mTotal.add(modelEarning));
            modelEntity.setStreamingHours(mHours.add(hoursAsBigDecimal));
            modelRepository.save(modelEntity);

            // 11) ===== PLATAFORMA: libro propio =====
            PlatformTransaction ptx = new PlatformTransaction();
            ptx.setAmount(platformEarning); // ingreso plataforma
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

            // 12) Limpieza de estado
            postEndStatusCleanup(clientId, modelId);

        } finally {
            lock.unlock();
            sessionLocks.remove(session.getId());
        }
    }


    /**
     * Corte preventivo: si saldo_actual - coste_acumulado < cutoff, cerrar ya la sesión.
     * Devuelve true si ha cerrado; false si aún puede continuar.
     *
     * Se debe invocar periódicamente (p.ej. en cada "ping" desde el MatchingHandler).
     */
    @Transactional
    public boolean endIfBelowThreshold(Long clientId, Long modelId) {
        // 1) localizar sesión activa
        Long sessionIdHint = modelStatusService.getActiveSession(clientId, modelId).orElse(null);
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
            return false; // no hay nada que cortar
        }
        if (session.getEndTime() != null) {
            return false; // ya cerrada
        }

        // 2) calcular coste acumulado hasta ahora (por segundo, SIN ceil)
        long seconds = java.time.Duration.between(session.getStartTime(), LocalDateTime.now()).getSeconds();
        if (seconds < 0) seconds = 0;

        // coste con precisión intermedia (no redondeamos a 2 decimales aún)
        BigDecimal costSoFar = billing.getRatePerMinute()
                .multiply(BigDecimal.valueOf(seconds))
                .divide(BigDecimal.valueOf(60), 6, java.math.RoundingMode.HALF_UP);

        // 3) leer saldo_actual (mutable) del cliente (por si recargó durante el stream)
        Client clientEntity = clientRepository.findById(clientId).orElse(null);
        BigDecimal saldoActual = (clientEntity != null && clientEntity.getSaldoActual() != null)
                ? clientEntity.getSaldoActual()
                : BigDecimal.ZERO;

        BigDecimal remaining = saldoActual.subtract(costSoFar);

        // 4) si remaining < cutoff => cerrar
        if (remaining.compareTo(billing.getCutoffThresholdEur()) < 0) {
            log.info("endIfBelowThreshold: corte por umbral. clientId={}, modelId={}, remaining={}, cutoff={}",
                    clientId, modelId, remaining, billing.getCutoffThresholdEur());   // [FIX]
            endSession(clientId, modelId);
            return true;
        }

        return false;
    }

    /**
     * Devuelve true si hay una sesión de streaming ACTIVA (end_time = NULL)
     * entre el cliente y la modelo indicados.
     *
     * Usa primero la pista de ModelStatusService (cache/redis) y, si no existe,
     * consulta a la base de datos.
     */
    public boolean isPairActive(Long clientId, Long modelId) {
        // 1) Pista en caché: si hay sessionId en curso, ya es activo
        if (modelStatusService.getActiveSession(clientId, modelId).isPresent()) {
            return true;
        }
        // 2) Fallback a BD por si la caché no está poblada
        return streamRecordRepository
                .findTopByClient_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(clientId, modelId)
                .isPresent();
    }


    private void postEndStatusCleanup(Long clientId, Long modelId) {
        // Limpieza en Redis
        modelStatusService.clearActiveSession(clientId, modelId);

        // Política simple: si la modelo no está OFFLINE, restaurar a AVAILABLE
        String status = modelStatusService.getStatus(modelId);
        if (status == null || "OFFLINE".equals(status)) {
            // nada
        } else {
            modelStatusService.setAvailable(modelId);
        }
    }
}