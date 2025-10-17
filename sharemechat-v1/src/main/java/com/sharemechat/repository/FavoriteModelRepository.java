package com.sharemechat.repository;

import com.sharemechat.entity.FavoriteModel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface FavoriteModelRepository extends JpaRepository<FavoriteModel, Long> {
    boolean existsByClientIdAndModelId(Long clientId, Long modelId);
    Optional<FavoriteModel> findByClientIdAndModelId(Long clientId, Long modelId);
    List<FavoriteModel> findAllByClientIdAndStatusOrderByCreatedAtDesc(Long clientId, String status);
    long deleteByClientIdAndModelId(Long clientId, Long modelId);
    List<FavoriteModel> findAllByClientIdAndStatusInOrderByCreatedAtDesc(Long clientId, List<String> statuses);


}
