package com.sharemechat.repository;

import com.sharemechat.entity.FavoriteModel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FavoriteModelRepository extends JpaRepository<FavoriteModel, Long> {
    boolean existsByClientIdAndModelId(Long clientId, Long modelId);
    List<FavoriteModel> findAllByClientIdOrderByCreatedAtDesc(Long clientId);
    long deleteByClientIdAndModelId(Long clientId, Long modelId);
}
