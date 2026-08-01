package com.sharemechat.service;

import com.sharemechat.dto.AcquisitionDTO;
import com.sharemechat.entity.UserAcquisition;
import com.sharemechat.repository.UserAcquisitionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Persiste la atribucion de origen first-touch (capa B, ADR-057) de un usuario
 * recien registrado.
 *
 * Se invoca desde los controllers DESPUES de que el alta haya commiteado (el
 * usuario ya existe, la FK a users(id) se cumple) y en transaccion propia
 * ({@code REQUIRES_NEW}). Es best-effort: cualquier fallo se traga y se loguea,
 * nunca rompe el registro ni afecta a la transaccion del alta.
 */
@Service
public class UserAcquisitionService {

    private static final Logger log = LoggerFactory.getLogger(UserAcquisitionService.class);

    private final UserAcquisitionRepository repository;

    public UserAcquisitionService(UserAcquisitionRepository repository) {
        this.repository = repository;
    }

    /**
     * Guarda la fila de atribucion para {@code userId}. No hace nada si no hay
     * userId, no hay datos, o todos los campos vienen en blanco. Idempotente a
     * nivel de PK: si ya existiera fila para ese usuario, la sobrescribe (save).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Long userId, AcquisitionDTO acq) {
        try {
            if (userId == null || acq == null) {
                return;
            }
            String source   = trim(acq.getUtmSource(), 128);
            String medium    = trim(acq.getUtmMedium(), 128);
            String campaign  = trim(acq.getUtmCampaign(), 191);
            String referrer  = trim(acq.getReferrerHost(), 191);
            String landing   = trim(acq.getLandingPath(), 512);

            if (source == null && medium == null && campaign == null
                    && referrer == null && landing == null) {
                return; // nada defendible que guardar
            }

            UserAcquisition ua = new UserAcquisition();
            ua.setUserId(userId);
            ua.setUtmSource(source);
            ua.setUtmMedium(medium);
            ua.setUtmCampaign(campaign);
            ua.setReferrerHost(referrer);
            ua.setLandingPath(landing);
            ua.setCreatedAt(LocalDateTime.now());
            repository.save(ua);

            log.info("USER_ACQUISITION saved userId={} source={} medium={} campaign={}",
                    userId, source, medium, campaign);
        } catch (Exception ex) {
            // Best-effort: la analitica nunca rompe el alta.
            log.warn("USER_ACQUISITION persist failed userId={} err={}", userId, ex.toString());
        }
    }

    /** Recorta espacios y limita longitud; devuelve null si queda vacio. */
    private static String trim(String value, int maxLen) {
        if (value == null) {
            return null;
        }
        String v = value.trim();
        if (v.isEmpty()) {
            return null;
        }
        return v.length() > maxLen ? v.substring(0, maxLen) : v;
    }
}
