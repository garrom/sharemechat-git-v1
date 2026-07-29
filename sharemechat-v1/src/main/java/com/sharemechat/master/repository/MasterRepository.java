package com.sharemechat.master.repository;

import com.sharemechat.master.entity.Master;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * ADR-056 S1: repositorio del rol Master (1-a-1 con users via user_id PK).
 * Consultas específicas se añaden bajo demanda en fases posteriores
 * (listados admin con paginacion en S7, agregados economicos en S3, etc.).
 */
public interface MasterRepository extends JpaRepository<Master, Long> {

    Optional<Master> findByUserId(Long userId);
}
