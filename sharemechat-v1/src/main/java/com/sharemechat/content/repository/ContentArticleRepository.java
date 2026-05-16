package com.sharemechat.content.repository;

import com.sharemechat.content.entity.ContentArticle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repositorio del articulo logico (ADR-025).
 *
 * Modelo bilingue post-rediseno: los campos slug, locale y title viven
 * en {@link ContentArticleTranslation} y se consultan desde
 * {@link ContentArticleTranslationRepository}. Aqui solo quedan queries
 * sobre campos compartidos del articulo: state, fechas, autoria.
 *
 * Paquete 1 minimo: solo metodos derivados basicos para que entidades
 * sean utilizables. Servicios y queries derivadas mas ricas vendran en
 * paquete 2-3.
 */
@Repository
public interface ContentArticleRepository extends JpaRepository<ContentArticle, Long> {

    List<ContentArticle> findByStateOrderByPublishedAtDesc(String state);
}
