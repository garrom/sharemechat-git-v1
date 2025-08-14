package com.sharemechat.repository;

import com.sharemechat.entity.Model;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ModelRepository extends JpaRepository<Model, Long> {

    boolean existsByUserId(Long userId);

}
