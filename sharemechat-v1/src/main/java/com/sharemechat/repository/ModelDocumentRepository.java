package com.sharemechat.repository;

import com.sharemechat.dto.ModelTeaserDTO;
import com.sharemechat.entity.ModelDocument;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ModelDocumentRepository extends JpaRepository<ModelDocument, Long> {

    Optional<ModelDocument> findByUserId(Long userId);
    boolean existsByUserId(Long userId);

    // Cantidad total de modelos aprobadas con video
    @Query("""
           select count(md)
           from ModelDocument md, User u
           where u.id = md.userId
             and md.urlVideo is not null
             and u.role = 'MODEL'
             and u.verificationStatus = 'APPROVED'
           """)
    long countEligibleModelsWithVideo();

    // Consulta paginada genérica para teasers (orden técnico)
    @Query("""
           select new com.sharemechat.dto.ModelTeaserDTO(
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
    List<ModelTeaserDTO> findTeasersPage(Pageable pageable);

    // TOP: modelos ordenadas por total_ingresos (mayor facturación primero)
    @Query("""
           select new com.sharemechat.dto.ModelTeaserDTO(
               u.id,
               COALESCE(u.nickname, u.name, u.email),
               md.urlPic,
               md.urlVideo
           )
           from ModelDocument md, User u, Model m
           where u.id = md.userId
             and m.userId = u.id
             and md.urlVideo is not null
             and u.role = 'MODEL'
             and u.verificationStatus = 'APPROVED'
           order by m.totalIngresos desc nulls last
           """)
    List<ModelTeaserDTO> findTopByEarnings(Pageable pageable);

    // NEW: modelos más recientes según users.created_at
    @Query("""
           select new com.sharemechat.dto.ModelTeaserDTO(
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
           order by u.createdAt desc
           """)
    List<ModelTeaserDTO> findNewestModels(Pageable pageable);

    // RANDOM: selección aleatoria (para el job horario; no para cada request)
    @Query("""
           select new com.sharemechat.dto.ModelTeaserDTO(
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
           order by function('RAND')
           """)
    List<ModelTeaserDTO> findRandomModels(Pageable pageable);

}
