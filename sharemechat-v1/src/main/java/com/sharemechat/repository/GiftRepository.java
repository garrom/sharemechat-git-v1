package com.sharemechat.repository;

import com.sharemechat.entity.Gift;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GiftRepository extends JpaRepository<Gift, Long> {
    boolean existsByName(String name);
    List<Gift> findByActiveTrueOrderByDisplayOrderAscIdAsc();
    Optional<Gift> findByIdAndActiveTrue(Long id);

}
