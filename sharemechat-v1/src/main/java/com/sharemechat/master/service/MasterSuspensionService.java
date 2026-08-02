package com.sharemechat.master.service;

import com.sharemechat.entity.Model;
import com.sharemechat.master.entity.Master;
import com.sharemechat.master.entity.MasterModelSplit;
import com.sharemechat.master.repository.MasterModelSplitRepository;
import com.sharemechat.master.repository.MasterRepository;
import com.sharemechat.repository.ModelRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * ADR-056 Fase S7.b (2026-08-02): suspensión D11 del rol MASTER.
 *
 * <p>Semántica al suspender:
 * <ol>
 *   <li>Setea {@code masters.suspended_at/suspended_by_user_id/reason}.</li>
 *   <li>Libera las modelos: {@code Model.master_user_id = NULL} para
 *       todas las que estén bajo este Master. Su próximo login las
 *       detecta como INDIVIDUAL vía {@code PricingService.getEconomics}
 *       ya existente. Su historial atribuido
 *       ({@code Transaction.attributed_model_user_id}) queda intacto.</li>
 *   <li>Cierra los splits vigentes: {@code MasterModelSplit.effective_to
 *       = now} para los splits del Master con {@code effective_to IS NULL}.</li>
 * </ol>
 *
 * <p>Al reactivar: {@code suspended_at = NULL} + audit fields limpios.
 * Las modelos NO se re-asignan automáticamente (siguen como individuales).
 * Si el Master quiere volver a onboardearlas, debe re-invitar via
 * {@code POST /api/masters/me/models} — con su propio consentimiento
 * del modelo activando el nuevo split.
 */
@Service
public class MasterSuspensionService {

    private static final Logger log = LoggerFactory.getLogger(MasterSuspensionService.class);

    private final MasterRepository masterRepository;
    private final ModelRepository modelRepository;
    private final MasterModelSplitRepository masterModelSplitRepository;

    public MasterSuspensionService(MasterRepository masterRepository,
                                    ModelRepository modelRepository,
                                    MasterModelSplitRepository masterModelSplitRepository) {
        this.masterRepository = masterRepository;
        this.modelRepository = modelRepository;
        this.masterModelSplitRepository = masterModelSplitRepository;
    }

    @Transactional
    public Master suspend(Long masterUserId, Long adminUserId, String reason) {
        Master master = masterRepository.findByUserId(masterUserId)
                .orElseThrow(() -> new IllegalArgumentException("Master no encontrado: " + masterUserId));

        if (master.isSuspended()) {
            log.warn("[MASTER-SUSPEND] noop: masterId={} ya suspendido at={}",
                    masterUserId, master.getSuspendedAt());
            return master;
        }

        LocalDateTime now = LocalDateTime.now();
        master.setSuspendedAt(now);
        master.setSuspendedByUserId(adminUserId);
        master.setSuspensionReason(reason != null && !reason.isBlank() ? reason.trim() : null);
        masterRepository.save(master);

        List<Model> models = modelRepository.findAllByMasterUserIdOrderByUserIdAsc(masterUserId);
        int released = 0;
        for (Model m : models) {
            m.setMasterUserId(null);
            modelRepository.save(m);
            released++;
        }

        List<MasterModelSplit> vigentes = masterModelSplitRepository
                .findAllByMasterUserIdAndEffectiveToIsNullOrderByIdDesc(masterUserId);
        int closed = 0;
        for (MasterModelSplit split : vigentes) {
            split.setEffectiveTo(now);
            masterModelSplitRepository.save(split);
            closed++;
        }

        log.info("[MASTER-SUSPEND] masterId={} adminId={} reason='{}' modelsReleased={} splitsClosed={}",
                masterUserId, adminUserId, master.getSuspensionReason(), released, closed);
        return master;
    }

    @Transactional
    public Master reactivate(Long masterUserId, Long adminUserId) {
        Master master = masterRepository.findByUserId(masterUserId)
                .orElseThrow(() -> new IllegalArgumentException("Master no encontrado: " + masterUserId));

        if (!master.isSuspended()) {
            log.warn("[MASTER-REACTIVATE] noop: masterId={} no está suspendido", masterUserId);
            return master;
        }

        master.setSuspendedAt(null);
        master.setSuspendedByUserId(null);
        master.setSuspensionReason(null);
        masterRepository.save(master);

        log.info("[MASTER-REACTIVATE] masterId={} adminId={}", masterUserId, adminUserId);
        return master;
    }
}
