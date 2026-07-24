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
 * (ADR-052). Las filas vigentes son las que tienen
 * {@code effective_to IS NULL}. Historicos preservados con
 * {@code effective_to} NOT NULL para auditoria.
 */
public interface ModelPricingTierRepository extends JpaRepository<ModelPricingTier, Long> {

    /**
     * Devuelve las filas vigentes ordenadas ASC por umbral. Base para
     * resolver el tramo por facturacion bruta (buscar la fila con el
     * mayor umbral <= facturacion).
     */
    @Query("SELECT t FROM ModelPricingTier t " +
           "WHERE t.effectiveTo IS NULL " +
           "ORDER BY t.minBilledGrossEur30d ASC")
    List<ModelPricingTier> findAllCurrentAsc();

    /**
     * Devuelve el tramo vigente que aplica a una facturacion bruta rolling
     * 30d concreta. Busca la fila con el mayor {@code min_billed_gross_eur_30d}
     * <= {@code billedGross} entre las vigentes. Si no encuentra ninguna
     * (imposible en teoria porque T0 tiene umbral 0), devuelve empty.
     */
    @Query("SELECT t FROM ModelPricingTier t " +
           "WHERE t.effectiveTo IS NULL " +
           "  AND t.minBilledGrossEur30d <= :billedGross " +
           "ORDER BY t.minBilledGrossEur30d DESC")
    List<ModelPricingTier> findByBilledGrossAtLeastOrdered(
            @Param("billedGross") BigDecimal billedGross);

    default Optional<ModelPricingTier> findCurrentByBilledGross(BigDecimal billedGross) {
        List<ModelPricingTier> matches = findByBilledGrossAtLeastOrdered(billedGross);
        return matches.isEmpty() ? Optional.empty() : Optional.of(matches.get(0));
    }

    Optional<ModelPricingTier> findFirstByTierCodeAndEffectiveToIsNull(String tierCode);
}
