package com.sharemechat.repository;

import com.sharemechat.entity.PromoGrantCounter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PromoGrantCounterRepository extends JpaRepository<PromoGrantCounter, String> {

    /**
     * Intento atómico de reservar un hueco del cupo de la promo. Un único
     * UPDATE condicional (race-safe): incrementa granted SOLO si aún queda
     * cupo. Devuelve el número de filas afectadas: 1 = hueco reservado
     * (conceder bono); 0 = cupo lleno (no conceder). Debe invocarse dentro de
     * la @Transactional de la recarga para que revierta con ella.
     */
    @Modifying
    @Query("update PromoGrantCounter c set c.granted = c.granted + 1, c.updatedAt = CURRENT_TIMESTAMP "
            + "where c.promoKey = :promoKey and c.granted < :cap")
    int tryIncrement(@Param("promoKey") String promoKey, @Param("cap") int cap);
}
