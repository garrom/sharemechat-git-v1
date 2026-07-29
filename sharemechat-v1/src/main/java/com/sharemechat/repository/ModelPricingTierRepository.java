package com.sharemechat.repository;

import com.sharemechat.entity.ModelPricingTier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Repositorio de tramos vigentes de reparto y rango de precio
 * (ADR-052 + ADR-056). Las filas vigentes son las que tienen
 * {@code effective_to IS NULL}. Historicos preservados con
 * {@code effective_to} NOT NULL para auditoria.
 *
 * <p><b>ADR-056 (2026-07-29)</b>: introducido regimen dual via columna
 * {@code target_type} ('INDIVIDUAL' | 'MASTER'). Las firmas de metodos
 * legacy (sin parametro targetType) delegan en INDIVIDUAL para compat
 * hacia atras — todo el codigo pre-ADR-056 sigue funcionando.
 */
public interface ModelPricingTierRepository extends JpaRepository<ModelPricingTier, Long> {

    // ============================================================
    // Legacy queries (pre-ADR-056) — mantenidas por compat.
    // Implicitamente restringidas a target_type='INDIVIDUAL' en los
    // metodos default de abajo.
    // ============================================================

    /** Todas las filas vigentes (ambos regimenes), ordenadas ASC por umbral. */
    @Query("SELECT t FROM ModelPricingTier t " +
           "WHERE t.effectiveTo IS NULL " +
           "ORDER BY t.targetType, t.minBilledGrossEur30d ASC")
    List<ModelPricingTier> findAllCurrentAsc();

    // ============================================================
    // Queries ADR-056 con target_type.
    // ============================================================

    /** Filas vigentes de un regimen concreto, ordenadas ASC por umbral. */
    @Query("SELECT t FROM ModelPricingTier t " +
           "WHERE t.effectiveTo IS NULL " +
           "  AND t.targetType = :targetType " +
           "ORDER BY t.minBilledGrossEur30d ASC")
    List<ModelPricingTier> findAllCurrentByTargetTypeAsc(@Param("targetType") String targetType);

    /**
     * ADR-056: devuelve las filas vigentes del regimen indicado con
     * {@code min_billed_gross_eur_30d <= billedGross}, ordenadas DESC.
     * El primer elemento es el tramo aplicable.
     */
    @Query("SELECT t FROM ModelPricingTier t " +
           "WHERE t.effectiveTo IS NULL " +
           "  AND t.targetType = :targetType " +
           "  AND t.minBilledGrossEur30d <= :billedGross " +
           "ORDER BY t.minBilledGrossEur30d DESC")
    List<ModelPricingTier> findByTargetTypeAndBilledGrossAtLeastOrdered(
            @Param("targetType") String targetType,
            @Param("billedGross") BigDecimal billedGross);

    /**
     * ADR-056: devuelve el tramo vigente que aplica a una facturacion
     * bruta rolling 30d concreta bajo un regimen dado
     * ('INDIVIDUAL' | 'MASTER').
     */
    default Optional<ModelPricingTier> findCurrentByBilledGross(
            BigDecimal billedGross, String targetType) {
        List<ModelPricingTier> matches = findByTargetTypeAndBilledGrossAtLeastOrdered(
                targetType, billedGross);
        return matches.isEmpty() ? Optional.empty() : Optional.of(matches.get(0));
    }

    /**
     * Sobrecarga legacy que asume regimen INDIVIDUAL. Preserva compat
     * con todo el codigo pre-ADR-056. Nuevos callers deben usar la firma
     * de arriba pasando el targetType explicitamente.
     */
    default Optional<ModelPricingTier> findCurrentByBilledGross(BigDecimal billedGross) {
        return findCurrentByBilledGross(billedGross, "INDIVIDUAL");
    }

    /**
     * ADR-056: lookup por (tier_code, target_type). Sustituye al legacy
     * findFirstByTierCodeAndEffectiveToIsNull cuando el caller conoce
     * el regimen.
     */
    Optional<ModelPricingTier> findFirstByTierCodeAndTargetTypeAndEffectiveToIsNull(
            String tierCode, String targetType);

    /**
     * Sobrecarga legacy que asume INDIVIDUAL. Mantiene compat con
     * ModelTierService.computeAndUpsertSnapshot pre-ADR-056.
     */
    default Optional<ModelPricingTier> findFirstByTierCodeAndEffectiveToIsNull(String tierCode) {
        return findFirstByTierCodeAndTargetTypeAndEffectiveToIsNull(tierCode, "INDIVIDUAL");
    }
}
