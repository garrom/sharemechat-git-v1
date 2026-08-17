package com.sharemechat.repository;

import com.sharemechat.entity.Model;
import com.sharemechat.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ModelRepository extends JpaRepository<Model, Long> {
    Optional<Model> findByUser(User user);
    boolean existsByUserId(Long userId);

    @org.springframework.data.jpa.repository.Query("SELECT m.userId FROM Model m")
    java.util.List<Long> findAllModelUserIds();

    /**
     * Card 1 Fase 2 (PresenceSampleJob): de un conjunto de userIds online
     * (leidos del set Redis user:available), devuelve cuales corresponden a
     * un modelo (tienen fila en models). Filtra clientes que tambien estan
     * en el set de disponibles.
     */
    @org.springframework.data.jpa.repository.Query(
        "SELECT m.userId FROM Model m WHERE m.userId IN :ids")
    java.util.List<Long> filterModelUserIds(
        @org.springframework.data.repository.query.Param("ids") java.util.Collection<Long> ids);

    /**
     * ADR-056 S3: lookup del master_user_id de una modelo por su userId.
     * Devuelve NULL si es modelo individual (sin Master). Devuelve el
     * userId del Master si la modelo esta bajo umbrella.
     */
    @org.springframework.data.jpa.repository.Query(
        "SELECT m.masterUserId FROM Model m WHERE m.userId = :modelUserId")
    Optional<Long> findMasterUserIdByModelUserId(
        @org.springframework.data.repository.query.Param("modelUserId") Long modelUserId);

    /**
     * ADR-056 S7.a: listado de modelos bajo la umbrella de un Master.
     * Usado en el drill-down admin.
     */
    java.util.List<Model> findAllByMasterUserIdOrderByUserIdAsc(Long masterUserId);
}
