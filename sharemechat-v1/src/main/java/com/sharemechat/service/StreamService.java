package com.sharemechat.service;

import com.sharemechat.entity.StreamRecord;
import com.sharemechat.entity.User;
import com.sharemechat.repository.StreamRecordRepository;
import com.sharemechat.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    // locks por sesión para evitar dobles cierres concurrentes
    private final ConcurrentHashMap<Long, ReentrantLock> sessionLocks = new ConcurrentHashMap<>();

    public StreamService(StreamRecordRepository streamRecordRepository,
                         UserRepository userRepository,
                         ModelStatusService modelStatusService) {
        this.streamRecordRepository = streamRecordRepository;
        this.userRepository = userRepository;
        this.modelStatusService = modelStatusService;
    }

    /**
     * Inicia una sesión de streaming en el instante del match.
     * Crea StreamRecord(start_time=now, end_time=NULL) y marca a la modelo como BUSY.
     * Idempotente respecto al par (si ya hubiera una activa, devuelve esa).
     */
    @Transactional
    public StreamRecord startSession(Long clientId, Long modelId, boolean isPremium) {
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

        User client = userRepository.findById(clientId)
                .orElseThrow(() -> new EntityNotFoundException("Cliente no encontrado: " + clientId));
        User model = userRepository.findById(modelId)
                .orElseThrow(() -> new EntityNotFoundException("Modelo no encontrado: " + modelId));

        if (!"CLIENT".equals(client.getRole())) {
            throw new IllegalArgumentException("El usuario " + clientId + " no tiene rol CLIENT");
        }
        if (!"MODEL".equals(model.getRole())) {
            throw new IllegalArgumentException("El usuario " + modelId + " no tiene rol MODEL");
        }

        StreamRecord sr = new StreamRecord();
        sr.setClient(client);
        sr.setModel(model);
        sr.setStartTime(LocalDateTime.now());
        sr.setEndTime(null);
        sr.setIsPremium(Boolean.TRUE.equals(client.getIsPremium()) || isPremium);

        StreamRecord saved = streamRecordRepository.save(sr);
        log.info("startSession: creada sesión id={} (client={}, model={})", saved.getId(), clientId, modelId);

        // Estado y lookup rápido en Redis
        modelStatusService.setBusy(modelId);
        modelStatusService.setActiveSession(clientId, modelId, saved.getId());

        return saved;
    }

    /**
     * Finaliza la sesión activa para el par client-model (si existe).
     * Idempotente. Marca end_time=now y limpia claves auxiliares.
     */
    @Transactional
    public void endSession(Long clientId, Long modelId) {
        // Primero intenta lookup en Redis para evitar una query
        Long sessionId = modelStatusService.getActiveSession(clientId, modelId).orElse(null);

        StreamRecord session;
        if (sessionId != null) {
            session = streamRecordRepository.findById(sessionId)
                    .orElse(null);
        } else {
            session = streamRecordRepository
                    .findTopByClient_IdAndModel_IdAndEndTimeIsNullOrderByStartTimeDesc(clientId, modelId)
                    .orElse(null);
        }

        if (session == null) {
            log.info("endSession: no hay sesión activa para client={}, model={}", clientId, modelId);
            return; // idempotente
        }

        // Lock por sesión
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

            session.setEndTime(LocalDateTime.now());
            streamRecordRepository.save(session);
            log.info("endSession: cerrada sesión id={} (client={}, model={})", session.getId(), clientId, modelId);

            // Limpieza en Redis
            modelStatusService.clearActiveSession(clientId, modelId);

            // Política simple: si la modelo no está OFFLINE, restaurar a AVAILABLE (quedará OFFLINE si no hay heartbeats)
            String status = modelStatusService.getStatus(modelId);
            if (status == null || "OFFLINE".equals(status)) {
                // nada
            } else {
                modelStatusService.setAvailable(modelId);
            }

        } finally {
            lock.unlock();
            sessionLocks.remove(session.getId());
        }
    }

    /**
     * Cierre por id (útil si ya conoces el sessionId).
     */
    @Transactional
    public void endSessionById(Long sessionId) {
        StreamRecord session = streamRecordRepository.findById(sessionId)
                .orElse(null);
        if (session == null) {
            log.info("endSessionById: sesión {} no encontrada", sessionId);
            return;
        }
        endSession(session.getClient().getId(), session.getModel().getId());
    }
}
