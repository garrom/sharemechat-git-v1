package com.sharemechat.service;

import com.sharemechat.entity.UserLanguage;
import com.sharemechat.repository.UserLanguageRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class UserLanguageService {

    private final UserLanguageRepository userLanguageRepository;

    public UserLanguageService(UserLanguageRepository userLanguageRepository) {
        this.userLanguageRepository = userLanguageRepository;
    }

    public List<UserLanguage> getLanguages(Long userId) {
        if (userId == null) return Collections.emptyList();
        return userLanguageRepository.findByUserId(userId);
    }

    public Set<String> getLanguageCodes(Long userId) {
        return getLanguages(userId).stream()
                .map(UserLanguage::getLangCode)
                .collect(Collectors.toSet());
    }

    public Optional<String> getPrimaryLanguage(Long userId) {
        return getLanguages(userId).stream()
                .filter(UserLanguage::isPrimary)
                .map(UserLanguage::getLangCode)
                .findFirst();
    }

    /**
     * Scoring industrial simple:
     *  +100 si idioma primario coincide
     *  +50 si hay idioma común no primario
     *  0 si no hay intersección
     */
    public int languageMatchScore(Long userA, Long userB) {
        Set<String> langsA = getLanguageCodes(userA);
        Set<String> langsB = getLanguageCodes(userB);

        if (langsA.isEmpty() || langsB.isEmpty()) return 0;

        Optional<String> primaryA = getPrimaryLanguage(userA);
        Optional<String> primaryB = getPrimaryLanguage(userB);

        if (primaryA.isPresent() && primaryB.isPresent()
                && primaryA.get().equals(primaryB.get())) {
            return 100;
        }

        for (String l : langsA) {
            if (langsB.contains(l)) {
                return 50;
            }
        }

        return 0;
    }
}
