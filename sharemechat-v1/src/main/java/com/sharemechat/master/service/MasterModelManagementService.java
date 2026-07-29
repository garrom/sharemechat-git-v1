package com.sharemechat.master.service;

import com.sharemechat.entity.Model;
import com.sharemechat.entity.User;
import com.sharemechat.master.dto.MasterModelViewDTO;
import com.sharemechat.master.entity.MasterModelSplit;
import com.sharemechat.master.repository.MasterModelSplitRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * ADR-056 D9/D10: gestion operativa modelos bajo umbrella del Master.
 * Todas las operaciones enforcean ownership (masterOwnsModel) y NO
 * exponen PII de las modelos al Master. Proyeccion via
 * {@link MasterModelViewDTO}.
 */
@Service
public class MasterModelManagementService {

    private static final Logger log = LoggerFactory.getLogger(MasterModelManagementService.class);

    private final ModelRepository modelRepository;
    private final UserRepository userRepository;
    private final MasterModelSplitRepository splitRepository;

    public MasterModelManagementService(ModelRepository modelRepository,
                                         UserRepository userRepository,
                                         MasterModelSplitRepository splitRepository) {
        this.modelRepository = modelRepository;
        this.userRepository = userRepository;
        this.splitRepository = splitRepository;
    }

    /** Lista modelos bajo umbrella del Master. Sin PII. */
    @Transactional(readOnly = true)
    public List<MasterModelViewDTO> listMyModels(Long masterUserId) {
        // Sin query dedicada — reutilizamos findAll + filter por
        // masterUserId. Aceptable en el volumen esperado (Master medio
        // tiene 5-15 modelos); para Master gigante deuda futura de
        // paginacion + query dedicada.
        List<Model> all = modelRepository.findAll();
        List<MasterModelViewDTO> out = new ArrayList<>();
        for (Model m : all) {
            if (masterUserId.equals(m.getMasterUserId())) {
                out.add(toView(m));
            }
        }
        out.sort(Comparator.comparing(MasterModelViewDTO::getModelUserId));
        return out;
    }

    /**
     * Detalle de una modelo. Guard ownership: 404 (via
     * IllegalArgumentException) si la modelo no pertenece al Master.
     */
    @Transactional(readOnly = true)
    public MasterModelViewDTO getMyModel(Long masterUserId, Long modelUserId) {
        Model m = modelRepository.findById(modelUserId).orElseThrow(
                () -> new IllegalArgumentException("Modelo no encontrada id=" + modelUserId));
        if (!masterUserId.equals(m.getMasterUserId())) {
            throw new IllegalArgumentException("Modelo no pertenece a este Master");
        }
        return toView(m);
    }

    /** Activa o desactiva la modelo bajo umbrella. */
    @Transactional
    public MasterModelViewDTO setActive(Long masterUserId, Long modelUserId, boolean active) {
        Model m = modelRepository.findById(modelUserId).orElseThrow(
                () -> new IllegalArgumentException("Modelo no encontrada id=" + modelUserId));
        if (!masterUserId.equals(m.getMasterUserId())) {
            throw new IllegalArgumentException("Modelo no pertenece a este Master");
        }
        User u = userRepository.findById(modelUserId).orElseThrow(
                () -> new IllegalStateException("User no encontrado id=" + modelUserId));
        u.setIsActive(active);
        userRepository.save(u);
        log.info("[MASTER-MGMT] setActive masterId={} modelId={} active={}",
                masterUserId, modelUserId, active);
        return toView(m);
    }

    /**
     * Registra el % pactado internamente Master ↔ modelo. Cierra la
     * vigencia anterior con {@code effective_to=now} y crea nueva fila
     * vigente. Preserva histórico completo.
     */
    @Transactional
    public MasterModelSplit setInternalShare(Long masterUserId, Long modelUserId,
                                              BigDecimal pct, String notes) {
        Model m = modelRepository.findById(modelUserId).orElseThrow(
                () -> new IllegalArgumentException("Modelo no encontrada id=" + modelUserId));
        if (!masterUserId.equals(m.getMasterUserId())) {
            throw new IllegalArgumentException("Modelo no pertenece a este Master");
        }
        if (pct == null || pct.signum() < 0
                || pct.compareTo(new BigDecimal("100")) > 0) {
            throw new IllegalArgumentException("internalSharePct fuera de rango [0,100]");
        }

        LocalDateTime now = LocalDateTime.now();
        // Cerrar vigencia previa si existe.
        splitRepository
                .findFirstByMasterUserIdAndModelUserIdAndEffectiveToIsNullOrderByIdDesc(
                        masterUserId, modelUserId)
                .ifPresent(prev -> {
                    prev.setEffectiveTo(now);
                    splitRepository.save(prev);
                });

        MasterModelSplit fresh = new MasterModelSplit();
        fresh.setMasterUserId(masterUserId);
        fresh.setModelUserId(modelUserId);
        fresh.setInternalSharePct(pct);
        fresh.setEffectiveFrom(now);
        fresh.setSetByMasterAt(now);
        if (notes != null && !notes.isBlank()) fresh.setNotes(notes.trim());
        MasterModelSplit saved = splitRepository.save(fresh);

        log.info("[MASTER-MGMT] setInternalShare masterId={} modelId={} pct={}",
                masterUserId, modelUserId, pct);
        return saved;
    }

    // ============================================================
    // Mapper Model → MasterModelViewDTO (sin PII).
    // ============================================================
    private MasterModelViewDTO toView(Model m) {
        MasterModelViewDTO v = new MasterModelViewDTO();
        v.setModelUserId(m.getUserId());
        v.setStreamingHours(m.getStreamingHours() != null ? m.getStreamingHours() : BigDecimal.ZERO);
        // Datos operativos del User (sin PII).
        userRepository.findById(m.getUserId()).ifPresent(u -> {
            v.setNickname(u.getNickname());
            v.setVerificationStatus(u.getVerificationStatus());
            v.setActive(Boolean.TRUE.equals(u.getIsActive()));
            v.setAccountStatus(u.getAccountStatus());
            v.setChosenRateEurPerMin(u.getChosenRateEurPerMin());
        });
        // % pactado vigente (informativo).
        Optional<MasterModelSplit> pact = splitRepository
                .findFirstByMasterUserIdAndModelUserIdAndEffectiveToIsNullOrderByIdDesc(
                        m.getMasterUserId(), m.getUserId());
        pact.ifPresent(p -> v.setInternalSharePctPactado(p.getInternalSharePct()));
        return v;
    }
}
