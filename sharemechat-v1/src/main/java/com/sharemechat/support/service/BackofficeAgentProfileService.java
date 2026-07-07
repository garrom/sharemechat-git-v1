package com.sharemechat.support.service;

import com.sharemechat.support.entity.BackofficeAgentProfile;
import com.sharemechat.support.exception.SupportConflictException;
import com.sharemechat.support.exception.SupportNotFoundException;
import com.sharemechat.support.repository.BackofficeAgentProfileRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * CRUD de identidades de servicio (profiles). Sin borrado fisico: la
 * desactivacion (active=false) preserva el historial. Ver ADR-046.
 */
@Service
public class BackofficeAgentProfileService {

    static final int MAX_DISPLAY_NAME_LENGTH = 80;
    static final int MAX_CATEGORY_LENGTH = 40;

    private final BackofficeAgentProfileRepository repo;

    public BackofficeAgentProfileService(BackofficeAgentProfileRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public List<BackofficeAgentProfile> listAll() {
        return repo.findAllByOrderByDisplayNameAsc();
    }

    @Transactional(readOnly = true)
    public BackofficeAgentProfile getById(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new SupportNotFoundException("Profile no encontrada"));
    }

    @Transactional
    public BackofficeAgentProfile create(String displayName, String category, Long createdBy) {
        String cleanName = normalize(displayName, MAX_DISPLAY_NAME_LENGTH);
        if (cleanName == null || cleanName.isEmpty()) {
            throw new IllegalArgumentException("display_name requerido");
        }
        String cleanCategory = normalize(category, MAX_CATEGORY_LENGTH);

        BackofficeAgentProfile p = new BackofficeAgentProfile();
        p.setDisplayName(cleanName);
        p.setCategory(cleanCategory);
        p.setActive(true);
        p.setCreatedBy(createdBy);
        try {
            return repo.save(p);
        } catch (DataIntegrityViolationException ex) {
            // uk_bap_display_name violado. Race entre dos admins con mismo nombre.
            throw new SupportConflictException("display_name ya existe");
        }
    }

    @Transactional
    public BackofficeAgentProfile update(Long id, String displayName, String category, Boolean active) {
        BackofficeAgentProfile p = getById(id);
        if (displayName != null) {
            String cleanName = normalize(displayName, MAX_DISPLAY_NAME_LENGTH);
            if (cleanName == null || cleanName.isEmpty()) {
                throw new IllegalArgumentException("display_name no puede quedar vacio");
            }
            p.setDisplayName(cleanName);
        }
        if (category != null) {
            p.setCategory(normalize(category, MAX_CATEGORY_LENGTH));
        }
        if (active != null) {
            p.setActive(active);
        }
        p.setUpdatedAt(LocalDateTime.now());
        try {
            return repo.save(p);
        } catch (DataIntegrityViolationException ex) {
            throw new SupportConflictException("display_name ya existe");
        }
    }

    private static String normalize(String s, int max) {
        if (s == null) return null;
        String trimmed = s.trim();
        if (trimmed.isEmpty()) return "";
        return trimmed.length() > max ? trimmed.substring(0, max) : trimmed;
    }
}
