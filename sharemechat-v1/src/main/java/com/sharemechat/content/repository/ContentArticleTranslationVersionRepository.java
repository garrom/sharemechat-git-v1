package com.sharemechat.content.repository;

import com.sharemechat.content.entity.ContentArticleTranslationVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repositorio del snapshot per-idioma de una version (ADR-025).
 *
 * Paquete 1 minimo: derivaciones basicas para resolver (version_id),
 * (version_id, locale). Lectura del body desde S3 es responsabilidad
 * de service en paquete 2.
 */
@Repository
public interface ContentArticleTranslationVersionRepository
        extends JpaRepository<ContentArticleTranslationVersion, Long> {

    List<ContentArticleTranslationVersion> findByVersionId(Long versionId);

    Optional<ContentArticleTranslationVersion> findByVersionIdAndLocale(Long versionId, String locale);
}
