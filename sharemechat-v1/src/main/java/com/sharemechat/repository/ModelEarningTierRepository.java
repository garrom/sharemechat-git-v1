package com.sharemechat.repository;

import com.sharemechat.entity.ModelEarningTier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ModelEarningTierRepository extends JpaRepository<ModelEarningTier, Long> {

    /**
     * Tiers activos ordenados por min_billed_minutes ascendente.
     * El servicio elige el tier aplicable según los minutos del modelo.
     */
    List<ModelEarningTier> findByActiveTrueOrderByMinBilledMinutesAsc();

    boolean existsByMinBilledMinutes(Integer minBilledMinutes);
}
