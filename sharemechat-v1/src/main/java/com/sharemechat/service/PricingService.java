package com.sharemechat.service;

import com.sharemechat.constants.Constants;
import com.sharemechat.dto.ModelEconomicsDTO;
import com.sharemechat.entity.ModelPricingTier;
import com.sharemechat.entity.ModelTierDailySnapshot;
import com.sharemechat.entity.User;
import com.sharemechat.repository.ModelPricingTierRepository;
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
    private final ModelPricingTierRepository pricingTierRepository;
    private final ModelTierDailySnapshotRepository snapshotRepository;
    private final ModelTierService modelTierService;
    private final BigDecimal proStatusMinBilledGross;
    private final BigDecimal giftModelSharePct;

    public PricingService(UserRepository userRepository,
                          ModelPricingTierRepository pricingTierRepository,
                          ModelTierDailySnapshotRepository snapshotRepository,
                          ModelTierService modelTierService,
                          @Value("${billing.pro-status.min-billed-gross-eur-30d:1500}") BigDecimal proStatusMinBilledGross,
                          @Value("${gift.model-share:0.90}") BigDecimal giftModelShare) {
        this.userRepository = userRepository;
        this.pricingTierRepository = pricingTierRepository;
        this.snapshotRepository = snapshotRepository;
        this.modelTierService = modelTierService;
        this.proStatusMinBilledGross = proStatusMinBilledGross != null
                ? proStatusMinBilledGross
                : new BigDecimal("1500");
        // gift.model-share viene como fraccion (0.90) y se sirve al frontend
        // como porcentaje (90.00) para consistencia con modelSharePct.
        BigDecimal share = giftModelShare != null ? giftModelShare : new BigDecimal("0.90");
        this.giftModelSharePct = share.multiply(new BigDecimal("100"))
                .setScale(2, RoundingMode.HALF_UP);
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

        ModelEconomicsDTO dto = new ModelEconomicsDTO();
        dto.snapshotDate = snapshotDate;
        dto.chosenRateEurPerMin = user.getChosenRateEurPerMin();
        dto.proAcceptsTrial = Boolean.TRUE.equals(user.getProAcceptsTrial());
        dto.proStatusMinBilledGrossEur30d = proStatusMinBilledGross;
        dto.giftModelSharePct = giftModelSharePct;

        // Resolver tramo desde el snapshot (o fallback si no hay snapshot).
        ModelPricingTier tier = null;
        if (snap != null && snap.getPricingTierId() != null) {
            tier = pricingTierRepository.findById(snap.getPricingTierId()).orElse(null);
            dto.billedGrossEur30d = snap.getBilledGrossEur30d();
            dto.proStatusEligible = Boolean.TRUE.equals(snap.getProStatusActive());
        }
        if (tier == null) {
            // Fallback: T0 vigente si no hay snapshot todavia.
            // ADR-056: PricingService actual sirve /api/models/me/economics
            // (endpoint modelo autoservicio). Regimen fijo INDIVIDUAL — el
            // dashboard Master de S3/S5 tendra su propio servicio.
            List<ModelPricingTier> vigentes = pricingTierRepository
                    .findAllCurrentByTargetTypeAsc("INDIVIDUAL");
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
