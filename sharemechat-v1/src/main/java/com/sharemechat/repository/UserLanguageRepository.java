package com.sharemechat.repository;

import com.sharemechat.entity.UserLanguage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UserLanguageRepository extends JpaRepository<UserLanguage, Long> {

    List<UserLanguage> findByUserId(Long userId);

}
