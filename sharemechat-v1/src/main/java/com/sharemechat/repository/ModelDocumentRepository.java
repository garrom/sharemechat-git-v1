package com.sharemechat.repository;

import com.sharemechat.dto.FunnyplaceItemDTO;
import com.sharemechat.entity.ModelDocument;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ModelDocumentRepository extends JpaRepository<ModelDocument, Long> {
    Optional<ModelDocument> findByUserId(Long userId);
    boolean existsByUserId(Long userId);

    @Query("""
           select count(md)
           from ModelDocument md, User u
           where u.id = md.userId
             and md.urlVideo is not null
             and u.role = 'MODEL'
             and u.verificationStatus = 'APPROVED'
           """)
    long countEligibleModelsWithVideo();

    @Query("""
           select new com.sharemechat.dto.FunnyplaceItemDTO(
               u.id,
               COALESCE(u.nickname, u.name, u.email),
               md.urlPic,
               md.urlVideo
           )
           from ModelDocument md, User u
           where u.id = md.userId
             and md.urlVideo is not null
             and u.role = 'MODEL'
             and u.verificationStatus = 'APPROVED'
           order by u.id asc
           """)
    List<FunnyplaceItemDTO> findEligiblePage(Pageable pageable);

}
