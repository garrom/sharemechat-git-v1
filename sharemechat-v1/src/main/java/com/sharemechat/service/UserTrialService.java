package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.entity.*;
import com.sharemechat.repository.*;
import jakarta.persistence.EntityNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
public class UserTrialService {

    private static final Logger log = LoggerFactory.getLogger(UserTrialService.class);

    /**
     * Máximo segundos por sesión trial a nivel contable (≈ 1 minuto).
     * Se usa para capar los segundos que se pagan a la modelo.
     */
    private static final long TRIAL_MAX_SECONDS_PER_SESSION = 60L;

    /**
     * Corte "duro" de comunicación para sesiones trial.
     * A partir de estos segundos, se fuerza el cierre de la sesión trial
     * desde handleTrialPingAndMaybeEnd (MatchingHandler).
     *
     * Lo dejamos por debajo de 60 para tener colchón frente a retrasos de ping.
     */
    private static final long TRIAL_HARD_CUTOFF_SECONDS = 50L;


    /**
     * Número de sesiones trial por pack de prueba.
     * Cada pack son 3 modelos × ~50s ≈ 3 minutos de prueba.
     */
    private static final int TRIAL_MAX_SLOTS_PER_USER = 3;


    private final UserTrialStreamRepository userTrialStreamRepository;
    private final UserRepository userRepository;
    private final ModelRepository modelRepository;
    private final ModelTierService modelTierService;
    private final TransactionRepository transactionRepository;
    private final BalanceRepository balanceRepository;
    private final PlatformTransactionRepository platformTransactionRepository;
    private final PlatformBalanceRepository platformBalanceRepository;

    public UserTrialService(UserTrialStreamRepository userTrialStreamRepository,
                            UserRepository userRepository,
                            ModelRepository modelRepository,
                            ModelTierService modelTierService,
                            TransactionRepository transactionRepository,
                            BalanceRepository balanceRepository,
                            PlatformTransactionRepository platformTransactionRepository,
                            PlatformBalanceRepository platformBalanceRepository) {

        this.userTrialStreamRepository = userTrialStreamRepository;
        this.userRepository = userRepository;
        this.modelRepository = modelRepository;
        this.modelTierService = modelTierService;
        this.transactionRepository = transactionRepository;
        this.balanceRepository = balanceRepository;
        this.platformTransactionRepository = platformTransactionRepository;
        this.platformBalanceRepository = platformBalanceRepository;
    }

    /**
     * Indica si el viewer (USER) puede iniciar una nueva sesión trial.
     *
     * Modelo de negocio:
     *  - Cada pack de prueba son 3 slots (~3 minutos = 3 × ~50s) con modelos distintas.
     *  - Primer pack (slots 1–3): sin restricción de tiempo.
     *  - Segundo pack (slots 4–6): requiere que haya pasado >= 1 hora desde el fin del pack anterior.
     *  - Tercer pack (slots 7–9): requiere >= 4 horas desde el pack anterior.
     *  - A partir del cuarto pack (slots 10–12, 13–15, ...): requiere >= 24 horas entre packs.
     *
     * Notas:
     *  - El límite se aplica SOLO al inicio de cada pack (slot 1 de cada pack).
     *  - Los slots 2 y 3 de un mismo pack no tienen cooldown adicional.
     *  - Si ya tiene una sesión trial ACTIVA, se permite (idempotencia).
     */
    @Transactional(readOnly = true)
    public boolean canStartTrial(Long viewerId) {
        User viewer = userRepository.findById(viewerId)
                .orElseThrow(() -> new EntityNotFoundException("Viewer (USER) no encontrado: " + viewerId));

        if (!Constants.Roles.USER.equals(viewer.getRole())) {
            return false;
        }

        // Si ya tiene una trial activa (cualquier modelo), permitimos (startTrialStream la reutilizará)
        Optional<UserTrialStream> active = userTrialStreamRepository
                .findTopByViewer_IdAndEndTimeIsNullOrderByStartTimeDesc(viewerId);
        if (active.isPresent()) {
            return true;
        }

        // Número de slots trial YA CERRADOS (en toda la vida del usuario)
        long closedSlots = userTrialStreamRepository.countByViewer_IdAndEndTimeIsNotNull(viewerId);

        long nextIndex = closedSlots + 1; // índice 1-based del siguiente slot que se quiere iniciar
        long slotsPerPack = TRIAL_MAX_SLOTS_PER_USER; // 3

        long packNumber      = (nextIndex - 1) / slotsPerPack; // 0,1,2,... (0 = primer pack)
        long indexWithinPack = (nextIndex - 1) % slotsPerPack; // 0,1,2 (0 = primer slot del pack)

        // Primer pack (slots 1–3): siempre permitido
        if (packNumber == 0) {
            return true;
        }

        // Slots 2 y 3 de un pack ya iniciado: sin cooldown adicional
        if (indexWithinPack != 0) {
            return true;
        }

        // Estamos empezando un NUEVO pack (packNumber >= 1 y indexWithinPack == 0).
        // Definimos las horas mínimas que deben haber pasado desde el fin del pack anterior.
        long requiredHours;
        if (packNumber == 1) {
            // Segundo pack (slots 4–6): esperar 1 hora desde el fin del pack 0
            requiredHours = 1L;
        } else if (packNumber == 2) {
            // Tercer pack (slots 7–9): esperar 4 horas desde el fin del pack 1
            requiredHours = 4L;
        } else {
            // A partir del cuarto pack: esperar 24 horas entre packs
            requiredHours = 24L;
        }

        // Obtenemos la última sesión trial CERRADA (end_time más reciente),
        // que en condiciones normales corresponderá al último slot del pack anterior.
        Optional<UserTrialStream> lastClosedOpt = userTrialStreamRepository
                .findTopByViewer_IdAndEndTimeIsNotNullOrderByEndTimeDesc(viewerId);

        if (lastClosedOpt.isEmpty()) {
            // Caso raro: no hay cerradas pero packNumber >= 1 → preferimos permitir antes que bloquear.
            return true;
        }

        LocalDateTime lastEnd = lastClosedOpt.get().getEndTime();
        if (lastEnd == null) {
            // Si por alguna razón no hay endTime, no aplicamos cooldown estricto.
            return true;
        }

        Duration sinceLast = Duration.between(lastEnd, LocalDateTime.now());
        if (sinceLast.isNegative()) {
            // Raro, reloj desincronizado; preferimos bloquear.
            return false;
        }

        return sinceLast.compareTo(Duration.ofHours(requiredHours)) >= 0;
    }


    /**
     * Inicia una sesión TRIAL entre un USER (viewer) y una MODEL.
     *
     * Reglas:
     *  - Solo se permite si el viewer tiene role=USER.
     *  - Máximo TRIAL_MAX_SLOTS_PER_USER sesiones trial cerradas (3).
     *  - Idempotente: si ya hay una sesión trial activa para ese par, la reutiliza.
     */
    @Transactional
    public UserTrialStream startTrialStream(Long viewerId, Long modelId) {
        User viewer = userRepository.findById(viewerId)
                .orElseThrow(() -> new EntityNotFoundException("Viewer (USER) no encontrado: " + viewerId));

        if (!Constants.Roles.USER.equals(viewer.getRole())) {
            throw new IllegalStateException("startTrialStream: viewerId=" + viewerId + " no tiene rol USER");
        }

        // 1) Si ya hay sesión trial ACTIVA para ese par, devolverla (idempotencia)
        Optional<UserTrialStream> existing = userTrialStreamRepository
                .findTopByViewer_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(viewerId, modelId);

        if (existing.isPresent()) {
            log.info("startTrialStream: ya existe trial activa id={} (viewerId={}, modelId={})",
                    existing.get().getId(), viewerId, modelId);
            return existing.get();
        }

        // 2) Lógica de límite de slots y cooldown entre packs
        //    Ahora se controla exclusivamente en canStartTrial(viewerId),
        //    que se invoca desde MatchingHandler antes de llamar a startTrialStream.
        //    Aquí no aplicamos restricciones adicionales.


        // 3) Crear la nueva sesión trial
        User modelUser = userRepository.findById(modelId)
                .orElseThrow(() -> new EntityNotFoundException("Modelo (user) no encontrado: " + modelId));

        UserTrialStream s = new UserTrialStream();
        s.setViewer(viewer);
        s.setModel(modelUser);
        s.setStartTime(LocalDateTime.now());
        s.setEndTime(null);
        s.setSeconds(null); // se rellenará al cerrar

        UserTrialStream saved = userTrialStreamRepository.save(s);

        log.info("startTrialStream: creada trial id={} (viewer USER={}, model={})",
                saved.getId(), viewerId, modelId);

        return saved;
    }

    /**
     * Cierra una sesión trial (si existe) para el par (viewerId, modelId).
     * Usado cuando:
     *  - El usuario pulsa NEXT.
     *  - Se cierra la conexión WS de uno de los dos.
     *
     * Versión básica (sin motivo explícito).
     */
    @Transactional
    public void endTrialStream(Long viewerId, Long modelId) {
        endTrialStream(viewerId, modelId, null);
    }

    /**
     * Cierra una sesión trial (si existe) para el par (viewerId, modelId),
     * permitiendo indicar un motivo de cierre (closeReason).
     */
    @Transactional
    public void endTrialStream(Long viewerId, Long modelId, String closeReason) {
        Optional<UserTrialStream> opt = userTrialStreamRepository
                .findTopByViewer_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(viewerId, modelId);

        if (opt.isEmpty()) {
            return; // idempotente
        }

        UserTrialStream session = opt.get();

        if (closeReason != null && !closeReason.isBlank()) {
            session.setCloseReason(closeReason);
        }

        LocalDateTime now = LocalDateTime.now();
        long seconds = Math.max(0, Duration.between(session.getStartTime(), now).getSeconds());

        closeTrialStreamAndSettle(session, seconds);
    }


    /**
     * Llamado periódicamente (desde MatchingHandler).
     *
     * - Si la sesión trial activa ha superado TRIAL_HARD_CUTOFF_SECONDS, la cierra
     *   y liquida el pago a la modelo + coste a plataforma.
     * - Marca el motivo de cierre como "TIMEOUT".
     *
     * Devuelve true si la sesión trial ha sido finalizada en esta llamada.
     */
    @Transactional
    public boolean endTrialIfTimeExceeded(Long viewerId, Long modelId) {
        Optional<UserTrialStream> opt = userTrialStreamRepository
                .findTopByViewer_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(viewerId, modelId);

        if (opt.isEmpty()) {
            return false;
        }

        UserTrialStream session = opt.get();
        LocalDateTime now = LocalDateTime.now();
        long seconds = Math.max(0, Duration.between(session.getStartTime(), now).getSeconds());

        // Corte "duro" de comunicación para trial (colchón respecto al minuto real)
        if (seconds < TRIAL_HARD_CUTOFF_SECONDS) {
            return false; // aún no ha llegado al corte duro
        }

        // Marcar motivo timeout antes de cerrar y contabilizar
        session.setCloseReason("TIMEOUT");

        closeTrialStreamAndSettle(session, seconds);
        return true;
    }



    /**
     * Cierra la sesión trial y realiza:
     *  - cálculo de segundos (cap a TRIAL_MAX_SECONDS_PER_SESSION)
     *  - cálculo de ganancia de la modelo usando el tier y first_minute_earning_per_min
     *  - Transaction + Balance para la MODELO
     *  - PlatformTransaction + PlatformBalance con coste negativo para la plataforma
     */
    private void closeTrialStreamAndSettle(UserTrialStream session, long rawSeconds) {
        Long viewerId = session.getViewer().getId();
        Long modelId  = session.getModel().getId();

        long seconds = Math.min(rawSeconds, TRIAL_MAX_SECONDS_PER_SESSION);
        if (seconds <= 0) {
            // Cerrar sin contabilidad si realmente no hubo tiempo
            session.setEndTime(LocalDateTime.now());
            session.setSeconds(0L);
            userTrialStreamRepository.save(session);
            log.info("closeTrialStreamAndSettle: trial sin segundos efectivos (id={}, viewerId={}, modelId={})",
                    session.getId(), viewerId, modelId);
            return;
        }

        // 1) Marcar fin y segundos efectivos
        LocalDateTime endTime = LocalDateTime.now();
        session.setEndTime(endTime);
        session.setSeconds(seconds);
        userTrialStreamRepository.save(session);

        // 2) Cargar MODELO y tier
        User modelUser = userRepository.findById(modelId)
                .orElseThrow(() -> new EntityNotFoundException("Modelo no encontrado: " + modelId));

        Model modelEntity = modelRepository.findById(modelId).orElseGet(() -> {
            Model m = new Model();
            m.setUser(modelUser);
            m.setUserId(modelId);
            return m;
        });

        ModelEarningTier tier = null;
        try {
            tier = modelTierService.resolveTierForModel(modelId);
        } catch (Exception ex) {
            log.warn("closeTrialStreamAndSettle: error resolviendo tier para modelId={} -> {}",
                    modelId, ex.getMessage());
        }

        if (tier == null) {
            throw new IllegalStateException(
                    "No se pudo resolver tier para la modelo " + modelId + " en sesión trial");
        }

        // 3) Ganancia de la modelo usando first_minute_earning_per_min
        BigDecimal perMin = tier.getFirstMinuteEarningPerMin();
        BigDecimal rawModelEarning = perMin
                .multiply(BigDecimal.valueOf(seconds))
                .divide(BigDecimal.valueOf(60), 6, java.math.RoundingMode.HALF_UP);

        BigDecimal modelEarning = rawModelEarning.setScale(2, java.math.RoundingMode.HALF_UP);

        if (modelEarning.compareTo(BigDecimal.ZERO) <= 0) {
            log.info("closeTrialStreamAndSettle: ganancia 0 para trial id={} (seconds={})",
                    session.getId(), seconds);
            return;
        }

        // 4) ===== MODELO: Transaction + Balance + models =====
        Transaction txModel = new Transaction();
        txModel.setUser(modelUser);
        txModel.setAmount(modelEarning);
        txModel.setOperationType("TRIAL_EARNING");
        txModel.setStreamRecord(null); // no se asocia a stream_records de pago normal
        txModel.setDescription("Ganancia trial de " + seconds + " segundos");
        Transaction savedTxModel = transactionRepository.save(txModel);

        BigDecimal lastModelBalance = balanceRepository
                .findTopByUserIdOrderByTimestampDesc(modelId)
                .map(Balance::getBalance)
                .orElse(BigDecimal.ZERO);
        BigDecimal newModelBalance = lastModelBalance.add(modelEarning);

        Balance balModel = new Balance();
        balModel.setUserId(modelId);
        balModel.setTransactionId(savedTxModel.getId());
        balModel.setOperationType("TRIAL_EARNING");
        balModel.setAmount(modelEarning);
        balModel.setBalance(newModelBalance);
        balModel.setDescription("Ganancia trial de " + seconds + " segundos");
        balanceRepository.save(balModel);

        // streaming_hours: añadimos el tiempo trial como horas (puedes cambiarlo si no quieres que cuente)
        BigDecimal mSaldo = modelEntity.getSaldoActual() != null ? modelEntity.getSaldoActual() : BigDecimal.ZERO;
        BigDecimal mTotal = modelEntity.getTotalIngresos() != null ? modelEntity.getTotalIngresos() : BigDecimal.ZERO;
        BigDecimal mHours = modelEntity.getStreamingHours() != null ? modelEntity.getStreamingHours() : BigDecimal.ZERO;
        BigDecimal hours  = BigDecimal.valueOf(seconds)
                .divide(BigDecimal.valueOf(3600), 2, java.math.RoundingMode.HALF_UP);

        modelEntity.setSaldoActual(mSaldo.add(modelEarning));
        modelEntity.setTotalIngresos(mTotal.add(modelEarning));
        modelEntity.setStreamingHours(mHours.add(hours));
        modelRepository.save(modelEntity);

        // 5) ===== PLATAFORMA: coste trial (negativo) =====
        BigDecimal platformCost = modelEarning.negate(); // sale dinero de la plataforma

        PlatformTransaction ptx = new PlatformTransaction();
        ptx.setAmount(platformCost);
        ptx.setOperationType("TRIAL_COST");
        ptx.setStreamRecord(null); // no asociado a stream_records normales
        ptx.setDescription("Coste plataforma por trial de " + seconds +
                " segundos (viewerId=" + viewerId + ", modelId=" + modelId + ")");
        PlatformTransaction savedPtx = platformTransactionRepository.save(ptx);

        BigDecimal lastPlatformBalance = platformBalanceRepository
                .findTopByOrderByTimestampDesc()
                .map(PlatformBalance::getBalance)
                .orElse(BigDecimal.ZERO);

        PlatformBalance pbal = new PlatformBalance();
        pbal.setTransactionId(savedPtx.getId());
        pbal.setAmount(platformCost);
        pbal.setBalance(lastPlatformBalance.add(platformCost));
        pbal.setDescription("Coste plataforma por trial de " + seconds + " segundos");
        platformBalanceRepository.save(pbal);

        log.info("closeTrialStreamAndSettle: trial cerrada id={} (viewerId={}, modelId={}, seconds={}, earningModel={}, costPlatform={})",
                session.getId(), viewerId, modelId, seconds, modelEarning, platformCost);
    }

}
