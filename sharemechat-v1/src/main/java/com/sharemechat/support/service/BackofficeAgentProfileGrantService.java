package com.sharemechat.support.service;

import com.sharemechat.support.entity.BackofficeAgentProfileGrant;
import com.sharemechat.support.exception.SupportNotFoundException;
import com.sharemechat.support.repository.BackofficeAgentProfileGrantRepository;
import com.sharemechat.support.repository.BackofficeAgentProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Grants N:N entre users backoffice y profiles. Sin borrado fisico: revoke
 * es active=false. Un mismo user puede tener grant a varias profiles y una
 * profile puede tener grant a varios users (turno rotativo). Ver ADR-046.
 */
@Service
public class BackofficeAgentProfileGrantService {

    private final BackofficeAgentProfileGrantRepository grantRepo;
    private final BackofficeAgentProfileRepository profileRepo;

    public BackofficeAgentProfileGrantService(
            BackofficeAgentProfileGrantRepository grantRepo,
            BackofficeAgentProfileRepository profileRepo) {
        this.grantRepo = grantRepo;
        this.profileRepo = profileRepo;
    }

    /**
     * Otorga (o reactiva) el grant. Idempotente respecto a la existencia previa
     * de la fila; si ya existia con active=false, se reactiva.
     */
    @Transactional
    public BackofficeAgentProfileGrant grant(Long userId, Long profileId, Long grantedBy) {
        if (userId == null || profileId == null) {
            throw new IllegalArgumentException("userId y profileId requeridos");
        }
        if (!profileRepo.existsById(profileId)) {
            throw new SupportNotFoundException("Profile no encontrada");
        }
        BackofficeAgentProfileGrant g = grantRepo.findByUserIdAndProfileId(userId, profileId)
                .orElseGet(() -> {
                    BackofficeAgentProfileGrant nu = new BackofficeAgentProfileGrant();
                    nu.setUserId(userId);
                    nu.setProfileId(profileId);
                    nu.setGrantedAt(LocalDateTime.now());
                    return nu;
                });
        g.setActive(true);
        g.setGrantedBy(grantedBy);
        return grantRepo.save(g);
    }

    /**
     * Revoca (soft delete). Sin cascade sobre conversaciones activas: los
     * casos en curso siguen su curso; solo se bloquean claims futuros.
     */
    @Transactional
    public void revoke(Long userId, Long profileId) {
        BackofficeAgentProfileGrant g = grantRepo.findByUserIdAndProfileId(userId, profileId)
                .orElseThrow(() -> new SupportNotFoundException("Grant no encontrado"));
        g.setActive(false);
        grantRepo.save(g);
    }

    @Transactional(readOnly = true)
    public List<BackofficeAgentProfileGrant> listActiveByUser(Long userId) {
        return grantRepo.findAllByUserIdAndActiveTrue(userId);
    }

    @Transactional(readOnly = true)
    public List<BackofficeAgentProfileGrant> listActiveByProfile(Long profileId) {
        return grantRepo.findAllByProfileIdAndActiveTrue(profileId);
    }

    @Transactional(readOnly = true)
    public boolean hasActiveGrant(Long userId, Long profileId) {
        return grantRepo.findByUserIdAndProfileId(userId, profileId)
                .map(BackofficeAgentProfileGrant::isActive)
                .orElse(false);
    }
}
