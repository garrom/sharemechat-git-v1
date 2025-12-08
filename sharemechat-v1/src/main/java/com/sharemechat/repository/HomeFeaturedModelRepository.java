package com.sharemechat.repository;

import com.sharemechat.entity.HomeFeaturedModel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;

import java.util.List;

public interface HomeFeaturedModelRepository extends JpaRepository<HomeFeaturedModel, Long> {

    @Query("""
        select h
        from HomeFeaturedModel h
        where h.active = true
        order by h.position asc
    """)
    List<HomeFeaturedModel> findActiveOrdered();

    void deleteByActiveTrue();

    @Modifying
    @Query("update HomeFeaturedModel h set h.active = false where h.active = true")
    void deactivateAllActive();
}
