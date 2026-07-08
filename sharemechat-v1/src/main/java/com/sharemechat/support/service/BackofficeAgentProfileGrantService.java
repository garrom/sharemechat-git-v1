package com.sharemechat.support.service;

import com.sharemechat.entity.User;
import com.sharemechat.repository.UserRepository;
import com.sharemechat.support.dto.GrantDetailDTO;
import com.sharemechat.support.entity.BackofficeAgentProfileGrant;
import com.sharemechat.support.exception.SupportNotFoundException;
import com.sharemechat.support.repository.BackofficeAgentProfileGrantRepository;
import com.sharemechat.support.repository.BackofficeAgentProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Grants N:N entre users backoffice y profiles. Sin borrado fisico: revoke
 * es active=false. Un mismo user puede tener grant a varias profiles y una
 * profile puede tener grant a varios users (turno rotativo). Ver ADR-046.
 */
@Service
public class BackofficeAgentProfileGrantService {

    private final BackofficeAgentProfileGrantRepository grantRepo;
    private final BackofficeAgentProfileRepository profileRepo;
    private final UserRepository userRepository;

    public BackofficeAgentProfileGrantService(
            BackofficeAgentProfileGrantRepository grantRepo,
            BackofficeAgentProfileRepository profileRepo,
            UserRepository userRepository) {
        this.grantRepo = grantRepo;
        this.profileRepo = profileRepo;
        this.userRepository = userRepository;
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

    /**
     * Listado admin de grants de una profile (activos e inactivos), enriquecido
     * con user_email y granted_by_email para no forzar joins JPA con
     * {@code FetchType.EAGER}. Dos queries: una a la tabla puente, otra
     * batch-fetch a users. Sin N+1. Ordenados por {@code granted_at DESC}.
     * Ver ADR-046 (frente B.3.2, cierre del hueco al no exponer GET grants).
     */
    @Transactional(readOnly = true)
    public List<GrantDetailDTO> listGrantsByProfileDetailed(Long profileId) {
        List<BackofficeAgentProfileGrant> grants =
                grantRepo.findAllByProfileIdOrderByGrantedAtDesc(profileId);
        if (grants.isEmpty()) {
            return List.of();
        }
        Set<Long> ids = new HashSet<>();
        for (BackofficeAgentProfileGrant g : grants) {
            if (g.getUserId() != null) ids.add(g.getUserId());
            if (g.getGrantedBy() != null) ids.add(g.getGrantedBy());
        }
        Map<Long, String> emailById = new HashMap<>();
        for (User u : userRepository.findAllById(ids)) {
            emailById.put(u.getId(), u.getEmail());
        }
        List<GrantDetailDTO> out = new ArrayList<>(grants.size());
        for (BackofficeAgentProfileGrant g : grants) {
            GrantDetailDTO dto = new GrantDetailDTO();
            dto.setUserId(g.getUserId());
            dto.setUserEmail(emailById.get(g.getUserId()));
            dto.setGrantedBy(g.getGrantedBy());
            dto.setGrantedByEmail(g.getGrantedBy() != null
                    ? emailById.get(g.getGrantedBy())
                    : null);
            dto.setGrantedAt(g.getGrantedAt());
            dto.setActive(g.isActive());
            out.add(dto);
        }
        return out;
    }
}
