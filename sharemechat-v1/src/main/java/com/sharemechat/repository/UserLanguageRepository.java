package com.sharemechat.repository;

import com.sharemechat.entity.UserLanguage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserLanguageRepository extends JpaRepository<UserLanguage, Long> {

    List<UserLanguage> findByUserId(Long userId);

    // Fase 2 i18n (2026-08-21): orden determinista para el perfil público y el
    // card. El primario primero, luego por peso de preferencia y id (estable).
    List<UserLanguage> findByUserIdOrderByPrimaryDescPreferenceWeightDescIdAsc(Long userId);

}
