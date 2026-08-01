package com.sharemechat.repository;

import com.sharemechat.entity.UserAcquisition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Repositorio de la capa B de atribucion de origen (ADR-057).
 */
@Repository
public interface UserAcquisitionRepository extends JpaRepository<UserAcquisition, Long> {
}
