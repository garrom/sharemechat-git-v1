package com.sharemechat.repository;

import com.sharemechat.entity.ModelEarningTier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ModelEarningTierRepository extends JpaRepository<ModelEarningTier, Long> {

    /**
     * Devolvemos los tiers activos ordenados por min_billed_minutes ascendente.
     * Luego en el servicio elegiremos el que toque según los minutos del modelo.
     */
    List<ModelEarningTier> findByActiveTrueOrderByMinBilledMinutesAsc();
}
