package com.sharemechat.service;

import com.sharemechat.entity.ModelEarningTier;
import com.sharemechat.entity.StreamRecord;
import com.sharemechat.repository.ModelEarningTierRepository;
import com.sharemechat.repository.StreamRecordRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class ModelTierService {

    private final ModelEarningTierRepository tierRepository;
    private final StreamRecordRepository streamRecordRepository;
    private final com.sharemechat.repository.UserTrialStreamRepository userTrialStreamRepository;

    /**
     * Ventana en días para calcular los minutos facturados de la modelo.
     * Por ahora lo fijamos en 30 días; más adelante lo podemos mover a config
     * (o incluso a una columna por tier si lo necesitas).
     */
    private static final int WINDOW_DAYS = 30;

    public ModelTierService(ModelEarningTierRepository tierRepository,
                            StreamRecordRepository streamRecordRepository,
                            com.sharemechat.repository.UserTrialStreamRepository userTrialStreamRepository) {
        this.tierRepository = tierRepository;
        this.streamRecordRepository = streamRecordRepository;
        this.userTrialStreamRepository = userTrialStreamRepository;
    }

    /**
     * Devuelve el tier que le corresponde a la modelo según sus minutos facturados
     * en la ventana (últimos WINDOW_DAYS días).
     *
     * Si no hay tiers configurados en BBDD, devuelve null.
     */
    public ModelEarningTier resolveTierForModel(Long modelId) {
        List<ModelEarningTier> tiers = tierRepository.findByActiveTrueOrderByMinBilledMinutesAsc();
        if (tiers.isEmpty()) {
            return null; // sin configuración, luego en StreamService decidiremos qué hacer
        }

        int billedMinutes = computeBilledMinutesForModel(modelId);

        // Elegimos el tier MÁS ALTO cuyo min_billed_minutes <= billedMinutes
        ModelEarningTier chosen = tiers.get(0);
        for (ModelEarningTier t : tiers) {
            if (t.getMinBilledMinutes() != null && t.getMinBilledMinutes() <= billedMinutes) {
                chosen = t;
            } else {
                // Como vienen ordenados ascendente, en cuanto no cumple, los siguientes tampoco
                break;
            }
        }
        return chosen;
    }

    /**
     * Calcula cuántos minutos facturados tiene la modelo en los últimos WINDOW_DAYS días,
     * sumando:
     *  - las duraciones de las sesiones cerradas (end_time != NULL) en StreamRecord
     *  - las duraciones de las sesiones trial cerradas en user_trial_streams
     *
     * Por ahora hacemos un floor( seconds / 60 ). Más adelante podemos ajustar
     * la regla (ceil, HALF_UP, etc.) si lo necesitas.
     */
    public int computeBilledMinutesForModel(Long modelId) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime since = now.minusDays(WINDOW_DAYS);

        long totalSeconds = 0L;

        // 1) Sesiones pagadas (StreamRecord)
        java.util.List<StreamRecord> records =
                streamRecordRepository.findByModel_IdAndEndTimeIsNotNullAndEndTimeAfter(modelId, since);

        for (StreamRecord r : records) {
            if (r.getStartTime() == null || r.getEndTime() == null) continue;
            long s = Duration.between(r.getStartTime(), r.getEndTime()).getSeconds();
            if (s > 0) totalSeconds += s;
        }

        // 2) Sesiones trial (UserTrialStream) de esta modelo
        java.util.List<com.sharemechat.entity.UserTrialStream> trialSessions =
                userTrialStreamRepository.findByModel_IdAndEndTimeIsNotNullAndEndTimeAfter(modelId, since);

        for (com.sharemechat.entity.UserTrialStream t : trialSessions) {
            if (t.getStartTime() == null || t.getEndTime() == null) continue;
            long s = Duration.between(t.getStartTime(), t.getEndTime()).getSeconds();
            if (s > 0) totalSeconds += s;
        }

        // floor: 119 s => 1 min; 120 s => 2 min
        long minutes = totalSeconds / 60L;
        if (minutes > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return (int) minutes;
    }


}
