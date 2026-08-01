package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ModelEconomicsDTO;
import com.sharemechat.entity.Model;
import com.sharemechat.entity.ModelPricingTier;
import com.sharemechat.entity.ModelTierDailySnapshot;
import com.sharemechat.entity.User;
import com.sharemechat.master.entity.Master;
import com.sharemechat.master.entity.MasterModelSplit;
import com.sharemechat.master.repository.MasterModelSplitRepository;
import com.sharemechat.master.repository.MasterRepository;
import com.sharemechat.repository.ModelPricingTierRepository;
import com.sharemechat.repository.ModelRepository;
import com.sharemechat.repository.ModelTierDailySnapshotRepository;
import com.sharemechat.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

/**
 * Servicio de reparto y precio autoservicio del ADR-052 §D2, §D3, §D9.
 * Fuente unica de verdad para el panel {@code /model/economics} y para
 * los endpoints {@code PUT /api/models/me/pricing} y
 * {@code PUT /api/models/me/pro-status}.
 *
 * <p>Semanticamente vive por encima de {@link ModelTierService}:
 * <ul>
 *   <li>ModelTierService produce y persiste el snapshot diario.</li>
 *   <li>PricingService lee el snapshot mas reciente + {@code users}
 *       para responder al frontend y para validar cambios de la modelo.</li>
 * </ul>
 */
@Service
public class PricingService {

    private static final Logger log = LoggerFactory.getLogger(PricingService.class);

    private final UserRepository userRepository;
    private final ModelRepository modelRepository;
    private final ModelPricingTierRepository pricingTierRepository;
    private final ModelTierDailySnapshotRepository snapshotRepository;
    private final ModelTierService modelTierService;
    // ADR-056 Opcion D (2026-08-01): resolver Master + split vigente
    // cuando la modelo tiene master_user_id (para servir DTO coherente
    // al frontend con vista bajo-Master).
    private final MasterModelSplitRepository masterModelSplitRepository;
    private final MasterRepository masterRepository;
    private final BigDecimal proStatusMinBilledGross;

    public PricingService(UserRepository userRepository,
                          ModelRepository modelRepository,
                          ModelPricingTierRepository pricingTierRepository,
                          ModelTierDailySnapshotRepository snapshotRepository,
                          ModelTierService modelTierService,
                          MasterModelSplitRepository masterModelSplitRepository,
                          MasterRepository masterRepository,
                          @Value("${billing.pro-status.min-billed-gross-eur-30d:1500}") BigDecimal proStatusMinBilledGross) {
        this.userRepository = userRepository;
        this.modelRepository = modelRepository;
        this.pricingTierRepository = pricingTierRepository;
        this.snapshotRepository = snapshotRepository;
        this.modelTierService = modelTierService;
        this.masterModelSplitRepository = masterModelSplitRepository;
        this.masterRepository = masterRepository;
        this.proStatusMinBilledGross = proStatusMinBilledGross != null
                ? proStatusMinBilledGross
                : new BigDecimal("1500");
    }

    /**
     * Payload agregado del panel {@code /model/economics}. Si no existe
     * snapshot de ayer, se calcula on-demand para que la modelo NUNCA
     * vea un estado vacio.
     */
    @Transactional
    public ModelEconomicsDTO getEconomics(Long modelId) {
        User user = userRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Modelo no encontrada: " + modelId));

        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            throw new IllegalStateException(
                    "El usuario " + modelId + " no tiene rol MODEL (rol actual: " + user.getRole() + ")");
        }

        LocalDate snapshotDate = LocalDate.now().minusDays(1);
        modelTierService.ensureSnapshotExists(modelId, snapshotDate);
        ModelTierDailySnapshot snap = snapshotRepository
                .findByModelIdAndSnapshotDate(modelId, snapshotDate)
                .orElse(null);

        // ADR-056 Opcion D (2026-08-01): detectar regimen segun
        // Model.master_user_id. INDIVIDUAL o MASTER cambia la tabla
        // model_pricing_tiers de la que resolvemos el tramo Y todos los
        // %reparto derivados. Antes se hardcodeaba INDIVIDUAL — bug que
        // servia al modelo bajo Master datos irrelevantes.
        Model modelEntity = modelRepository.findById(modelId).orElse(null);
        Long masterUserId = modelEntity != null ? modelEntity.getMasterUserId() : null;
        boolean underMaster = masterUserId != null;
        String targetType = underMaster ? "MASTER" : "INDIVIDUAL";

        ModelEconomicsDTO dto = new ModelEconomicsDTO();
        dto.snapshotDate = snapshotDate;
        dto.chosenRateEurPerMin = user.getChosenRateEurPerMin();
        dto.proAcceptsTrial = Boolean.TRUE.equals(user.getProAcceptsTrial());
        dto.proStatusMinBilledGrossEur30d = proStatusMinBilledGross;
        dto.underMaster = underMaster;

        // Resolver tramo desde el snapshot (o fallback si no hay snapshot).
        ModelPricingTier tier = null;
        if (snap != null && snap.getPricingTierId() != null) {
            tier = pricingTierRepository.findById(snap.getPricingTierId()).orElse(null);
            dto.billedGrossEur30d = snap.getBilledGrossEur30d();
            dto.proStatusEligible = Boolean.TRUE.equals(snap.getProStatusActive());
        }
        if (tier == null) {
            // Fallback: T0 vigente del regimen que aplica al user.
            List<ModelPricingTier> vigentes = pricingTierRepository
                    .findAllCurrentByTargetTypeAsc(targetType);
            tier = vigentes.isEmpty() ? null : vigentes.get(0);
            dto.billedGrossEur30d = BigDecimal.ZERO.setScale(2);
            dto.proStatusEligible = false;
        }

        if (tier != null) {
            dto.tierCode = tier.getTierCode();
            dto.tierMinBilledGrossEur30d = tier.getMinBilledGrossEur30d();
            dto.modelSharePct = tier.getModelSharePct();
            dto.rateMinEurPerMin = tier.getRateMinEurPerMin();
            dto.rateMaxEurPerMin = tier.getRateMaxEurPerMin();

            // Siguiente tramo (si existe) para mostrar objetivo en el panel.
            ModelPricingTier next = findNextTier(tier);
            if (next != null) {
                dto.nextTierCode = next.getTierCode();
                dto.nextTierMinBilledGrossEur30d = next.getMinBilledGrossEur30d();
            }
        }

        // ADR-056 revision 2026-08-01: los gifts aplican el mismo % del
        // tramo que streams (TransactionService.processGiftInternal). El
        // legacy giftModelSharePct pasa a ser identico a modelSharePct
        // para no romper consumidores (SessionHUD variant='model').
        dto.giftModelSharePct = dto.modelSharePct;

        // ADR-056 Opcion D: popular info Master si aplica.
        if (underMaster) {
            masterModelSplitRepository
                    .findFirstByMasterUserIdAndModelUserIdAndEffectiveToIsNullOrderByIdDesc(
                            masterUserId, modelId)
                    .map(MasterModelSplit::getInternalSharePct)
                    .ifPresent(pct -> dto.internalSharePct = pct);
            Master master = masterRepository.findByUserId(masterUserId).orElse(null);
            User masterUser = userRepository.findById(masterUserId).orElse(null);
            String displayName = master != null ? master.getCompanyName() : null;
            if ((displayName == null || displayName.isBlank()) && masterUser != null) {
                displayName = masterUser.getNickname();
            }
            if (displayName == null || displayName.isBlank()) {
                displayName = "tu estudio";
            }
            dto.masterDisplayName = displayName;
        }

        return dto;
    }

    /**
     * ADR-052 §D2: la modelo elige su tarifa dentro del rango vigente
     * de su tramo. El cambio es efectivo inmediatamente para el proximo
     * inicio de sesion.
     *
     * @throws IllegalArgumentException si la tarifa es null / negativa /
     *         fuera del rango [rateMin, rateMax] del tramo actual.
     */
    @Transactional
    public ModelEconomicsDTO updateChosenRate(Long modelId, BigDecimal newRate) {
        if (newRate == null) {
            throw new IllegalArgumentException("Tarifa requerida");
        }
        if (newRate.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Tarifa debe ser positiva");
        }

        ModelEconomicsDTO current = getEconomics(modelId);
        BigDecimal rateMin = current.rateMinEurPerMin != null ? current.rateMinEurPerMin : BigDecimal.ZERO;
        BigDecimal rateMax = current.rateMaxEurPerMin != null ? current.rateMaxEurPerMin : BigDecimal.ZERO;

        if (newRate.compareTo(rateMin) < 0 || newRate.compareTo(rateMax) > 0) {
            throw new IllegalArgumentException(String.format(
                    "Tarifa %s fuera de rango [%s, %s] del tramo %s",
                    newRate.setScale(2, RoundingMode.HALF_UP).toPlainString(),
                    rateMin.setScale(2, RoundingMode.HALF_UP).toPlainString(),
                    rateMax.setScale(2, RoundingMode.HALF_UP).toPlainString(),
                    current.tierCode));
        }

        // Persistir con la escala normalizada del schema (2 decimales).
        BigDecimal normalized = newRate.setScale(2, RoundingMode.HALF_UP);
        User user = userRepository.findById(modelId).orElseThrow();
        user.setChosenRateEurPerMin(normalized);
        userRepository.save(user);

        log.info("[PRICING] updateChosenRate modelId={} newRate={} tramo={} rango=[{}, {}]",
                modelId, normalized, current.tierCode, rateMin, rateMax);

        // Devolver dashboard actualizado
        current.chosenRateEurPerMin = normalized;
        return current;
    }

    /**
     * ADR-052 §D3: la modelo activa/desactiva la aceptacion de trials.
     * Solo tiene efecto operativo si Pro es elegible (facturacion bruta
     * rolling 30d cruza umbral). Por debajo del umbral el toggle es no-op
     * pero se persiste igualmente para no perder la preferencia si en el
     * futuro la modelo cruza el umbral.
     */
    @Transactional
    public ModelEconomicsDTO updateProAcceptsTrial(Long modelId, Boolean accepts) {
        if (accepts == null) {
            throw new IllegalArgumentException("Toggle requerido");
        }
        User user = userRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Modelo no encontrada: " + modelId));
        if (!Constants.Roles.MODEL.equals(user.getRole())) {
            throw new IllegalStateException(
                    "El usuario " + modelId + " no tiene rol MODEL");
        }

        user.setProAcceptsTrial(accepts);
        userRepository.save(user);

        log.info("[PRICING] updateProAcceptsTrial modelId={} accepts={}", modelId, accepts);

        return getEconomics(modelId);
    }

    private ModelPricingTier findNextTier(ModelPricingTier current) {
        if (current == null) return null;
        // ADR-056: findNextTier se usa en el dashboard economico del
        // endpoint modelo autoservicio, regimen INDIVIDUAL siempre.
        List<ModelPricingTier> vigentes = pricingTierRepository
                .findAllCurrentByTargetTypeAsc("INDIVIDUAL");
        for (ModelPricingTier t : vigentes) {
            if (t.getMinBilledGrossEur30d().compareTo(current.getMinBilledGrossEur30d()) > 0) {
                return t; // primer tramo por encima del actual
            }
        }
        return null;
    }
}
