// src/pages/subpages/ModelProfileExpanded.jsx
//
// Capa 2 — Fase 4. Modal "Ver perfil completo" del modelo, accesible
// desde el menú "..." de la lista de favoritos del cliente.
//
// Datos públicos del modelo (definidos en decisión de negocio Fase 4):
//   - nickname
//   - biography (si existe)
//   - interests (si existen)
//   - languages (si existen)
//   - foto principal grande + galería de fotos APROBADAS
//   - lista de vídeos APROBADOS
//
// Datos que NO se exponen: name/surname legales, email, country (decisión
// explícita: country_detected por IP no es fiable y no merece exponerse).
//
// Endpoints:
//   GET /api/models/{userId}/public-profile  → ModelPublicProfileDTO
//   GET /api/models/{userId}/assets          → galería aprobada ordenada
//
// Si el modelo no está disponible (no existe, baja, suspendido,
// banneado, KYC no aprobado, ...), backend responde 404 y mostramos
// el bloque "Esta modelo ya no está disponible" + botón cerrar.

import React, { useCallback, useEffect, useState } from 'react';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import ModalBase from '../../components/ModalBase';
import {
  ProfileBody,
  ProfileHeaderRow,
  HeaderPhotoFrame,
  HeaderEmptyPhoto,
  HeaderInfo,
  Nickname,
  Biography,
  InterestsLine,
  InterestsLabel,
  LanguageChips,
  LanguageChip,
  SectionDivider,
  SectionTitle,
  GallerySection,
  PhotosGrid,
  PhotoThumb,
  VideosGrid,
  VideoThumb,
  PlayOverlay,
  EmptyGalleryMsg,
  UnavailableBox,
  LoadingBox,
  LightboxFrame,
} from '../../styles/pages-styles/ModelProfileExpandedStyles';

const ASSET_PIC = 'PIC';
const ASSET_VIDEO = 'VIDEO';

const tk = (key, options) => i18n.t(key, options);

// Mapeo lang_code → etiqueta humana. Para una primera versión usamos
// el upper-case del código (ej. "ES", "EN") cuando no haya traducción.
// Si en el futuro queremos nombres completos (Español, English, ...)
// podemos añadir una tabla de mapeo en i18n.
const languageLabel = (code) => {
  if (!code) return '';
  const upper = String(code).toUpperCase();
  return tk(`modelProfileExpanded.languages.${upper}`, {
    defaultValue: upper,
  });
};

const ModelProfileExpanded = ({ open, userId, fallbackNickname, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [assets, setAssets] = useState([]);
  const [unavailable, setUnavailable] = useState(false);
  const [lightbox, setLightbox] = useState({ open: false, asset: null });

  // Carga al abrir + reset al cerrar para evitar arrastrar datos del
  // modelo anterior si el cliente abre varias veces seguidas.
  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setProfile(null);
    setAssets([]);
    setUnavailable(false);

    (async () => {
      let profileFailed = false;
      let assetsFailed = false;
      let p = null;
      let a = [];
      try {
        p = await apiFetch(`/models/${userId}/public-profile`);
      } catch (e) {
        profileFailed = true;
      }
      try {
        const raw = await apiFetch(`/models/${userId}/assets`);
        a = Array.isArray(raw) ? raw : [];
      } catch (e) {
        assetsFailed = true;
      }
      if (cancelled) return;

      // Modelo no disponible = backend 404 en perfil.
      // El listado de assets puede devolver [] aunque el perfil exista,
      // si el modelo borró todas sus fotos (caso transitorio).
      if (profileFailed) {
        setUnavailable(true);
      } else {
        setProfile(p);
        setAssets(a);
        // Si assets falla pero profile va, seguimos pero galería vacía.
        if (assetsFailed) setAssets([]);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [open, userId]);

  // Limpieza también al cerrar (por si el usuario cierra antes de cargar).
  const handleClose = useCallback(() => {
    setLightbox({ open: false, asset: null });
    if (typeof onClose === 'function') onClose();
  }, [onClose]);

  // ----- Helpers de derivación -----
  const picAssets = assets.filter((a) => a.assetType === ASSET_PIC);
  const videoAssets = assets.filter((a) => a.assetType === ASSET_VIDEO);

  // Foto principal: la del array marcada isPrincipal=true; si no hay,
  // la primera por position. Si no hay ninguna, null.
  const principalPic = (() => {
    if (picAssets.length === 0) return null;
    const flagged = picAssets.find((a) => a.isPrincipal === true);
    return flagged || picAssets[0];
  })();

  const displayedNickname = profile?.nickname || fallbackNickname || tk('modelProfileExpanded.fallbackNickname');

  const languages = Array.isArray(profile?.languages) ? profile.languages : [];

  // ----- Render -----
  const renderHeader = () => (
    <ProfileHeaderRow>
      <HeaderPhotoFrame
        $clickable={!!principalPic}
        onClick={() => {
          if (principalPic) setLightbox({ open: true, asset: principalPic });
        }}
      >
        {principalPic ? (
          <img
            src={principalPic.url}
            alt={tk('modelProfileExpanded.alt.principalPhoto', { name: displayedNickname })}
          />
        ) : (
          <HeaderEmptyPhoto>
            {tk('modelProfileExpanded.noPrincipalPhoto')}
          </HeaderEmptyPhoto>
        )}
      </HeaderPhotoFrame>

      <HeaderInfo>
        <Nickname>{displayedNickname}</Nickname>

        {profile?.biography && (
          <Biography>{profile.biography}</Biography>
        )}

        {profile?.interests && (
          <InterestsLine>
            <InterestsLabel>{tk('modelProfileExpanded.labels.interests')}</InterestsLabel>
            {profile.interests}
          </InterestsLine>
        )}

        {languages.length > 0 && (
          <LanguageChips>
            {languages.map((l, i) => (
              <LanguageChip key={`${l.langCode}-${i}`} $primary={!!l.primary} title={l.level || undefined}>
                {languageLabel(l.langCode)}
              </LanguageChip>
            ))}
          </LanguageChips>
        )}
      </HeaderInfo>
    </ProfileHeaderRow>
  );

  const renderPhotosSection = () => (
    <GallerySection>
      <SectionTitle>{tk('modelProfileExpanded.sections.photos')}</SectionTitle>
      {picAssets.length === 0 ? (
        <EmptyGalleryMsg>{tk('modelProfileExpanded.empty.photos')}</EmptyGalleryMsg>
      ) : (
        <PhotosGrid>
          {picAssets.map((a) => (
            <PhotoThumb
              key={`pic-${a.id}`}
              type="button"
              onClick={() => setLightbox({ open: true, asset: a })}
              aria-label={tk('modelProfileExpanded.alt.expandPhoto')}
            >
              <img src={a.url} alt={tk('modelProfileExpanded.alt.thumbnailPhoto', { name: displayedNickname })} />
            </PhotoThumb>
          ))}
        </PhotosGrid>
      )}
    </GallerySection>
  );

  const renderVideosSection = () => (
    <GallerySection>
      <SectionTitle>{tk('modelProfileExpanded.sections.videos')}</SectionTitle>
      {videoAssets.length === 0 ? (
        <EmptyGalleryMsg>{tk('modelProfileExpanded.empty.videos')}</EmptyGalleryMsg>
      ) : (
        <VideosGrid>
          {videoAssets.map((a) => (
            <VideoThumb
              key={`video-${a.id}`}
              type="button"
              onClick={() => setLightbox({ open: true, asset: a })}
              aria-label={tk('modelProfileExpanded.alt.playVideo')}
            >
              <video src={`${a.url}#t=0.1`} muted preload="metadata" />
              <PlayOverlay aria-hidden="true" />
            </VideoThumb>
          ))}
        </VideosGrid>
      )}
    </GallerySection>
  );

  const renderContent = () => {
    if (loading) {
      return <LoadingBox>{tk('modelProfileExpanded.loading')}</LoadingBox>;
    }
    if (unavailable) {
      return (
        <UnavailableBox>
          {tk('modelProfileExpanded.unavailable')}
        </UnavailableBox>
      );
    }
    return (
      <ProfileBody>
        {renderHeader()}
        <SectionDivider />
        {renderPhotosSection()}
        <SectionDivider />
        {renderVideosSection()}
      </ProfileBody>
    );
  };

  return (
    <>
      <ModalBase
        open={!!open}
        onClose={handleClose}
        title={profile?.nickname
          ? tk('modelProfileExpanded.title', { name: profile.nickname })
          : tk('modelProfileExpanded.titleDefault')}
        size="lg"
        variant="info"
        actions={[
          {
            label: tk('common.close'),
            primary: true,
            onClick: handleClose,
          },
        ]}
      >
        {renderContent()}
      </ModalBase>

      {/* Lightbox apilado para ampliar foto/vídeo individual. */}
      <ModalBase
        open={lightbox.open}
        onClose={() => setLightbox({ open: false, asset: null })}
        title=""
        size="lg"
        variant="info"
        hideChrome
      >
        <LightboxFrame>
          {lightbox.asset ? (
            lightbox.asset.assetType === ASSET_VIDEO ? (
              <video src={lightbox.asset.url} controls autoPlay />
            ) : (
              <img
                src={lightbox.asset.url}
                alt={tk('modelProfileExpanded.alt.expandedPhoto', { name: displayedNickname })}
              />
            )
          ) : null}
        </LightboxFrame>
      </ModalBase>
    </>
  );
};

export default ModelProfileExpanded;
