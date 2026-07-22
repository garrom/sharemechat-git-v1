package com.sharemechat.streammoderation.repository;

import com.sharemechat.streammoderation.entity.ModelModerationBan;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ModelModerationBanRepository
        extends JpaRepository<ModelModerationBan, Long> {
}
