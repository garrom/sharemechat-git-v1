package com.sharemechat.repository;

import com.sharemechat.entity.ModelProfileAttributes;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Acceso a los datos fisicos 1:1 del modelo (Card 1, Fase 2).
 * La PK es el {@code user_id}; {@code findById(userId)} devuelve la fila
 * si existe (upsert lazy en el primer guardado).
 */
public interface ModelProfileAttributesRepository extends JpaRepository<ModelProfileAttributes, Long> {
}
