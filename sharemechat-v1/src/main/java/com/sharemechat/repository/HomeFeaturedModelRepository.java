// src/main/java/com/sharemechat/repository/HomeFeaturedModelRepository.java
package com.sharemechat.repository;

import com.sharemechat.entity.HomeFeaturedModel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface HomeFeaturedModelRepository extends JpaRepository<HomeFeaturedModel, Long> {

    @Query("""
        select h
        from HomeFeaturedModel h
        order by h.position asc
    """)
    List<HomeFeaturedModel> findAllOrdered();
}
