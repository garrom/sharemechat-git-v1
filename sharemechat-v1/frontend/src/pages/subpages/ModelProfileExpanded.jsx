// src/pages/subpages/ModelProfileExpanded.jsx
//
// Card 1 (Fase 2). Panel "Ver perfil completo" del modelo, renderizado
// INLINE a todo el ancho debajo del chat en favoritos (antes era un modal).
// Lo monta/desmonta DashboardClient según selectedProfileUserId.
//
// Datos públicos del modelo:
//   - nickname, biography, interests, languages, tarifa €/min
//   - edad (derivada), datos físicos (talla pecho/altura/talla trasero/cuerpo)
//     + sexo constante "Female"
//   - disponibilidad observada ("Suele estar en línea", histograma día×hora)
//   - foto principal grande + galería de fotos/vídeos APROBADOS
//
// Endpoints:
//   GET /api/models/{userId}/public-profile  → ModelPublicProfileDTO
//   GET /api/models/{userId}/assets          → galería aprobada ordenada
//
// Si el modelo no está disponible, backend responde 404 y mostramos
// el bloque "Esta modelo ya no está disponible".

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import ModalBase from '../../components/ModalBase';
import RoyaltyBadge from '../../components/RoyaltyBadge';
import {
  LikesRow,
  LikeButton,
  RankChip,
  RankNone,
  ProfilePanel,
  PanelHead,
  PanelTitle,
  PanelClose,
  PanelInner,
  ProfileBody,
  ProfileHeaderRow,
  HeaderPhotoFrame,
  HeaderEmptyPhoto,
  HeaderInfo,
  Nickname,
  OnlineBadge,
  RateBadge,
  CtaButton,
  Biography,
  InterestsLine,
  InterestsLabel,
  InterestChip,
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
  StatsGrid,
  Stat,
  StatValue,
  StatLabel,
  AvailabilityHead,
  DayNav,
  DayNavBtn,
  DayNavLabel,
  Bars,
  Bar,
  BarLabels,
  AvailabilityNote,
} from '../../styles/pages-styles/ModelProfileExpandedStyles';

const ASSET_PIC = 'PIC';
const ASSET_VIDEO = 'VIDEO';

const tk = (key, options) => i18n.t(key, options);

const languageLabel = (code) => {
  if (!code) return '';
  const upper = String(code).toUpperCase();
  return tk(`modelProfileExpanded.languages.${upper}`, { defaultValue: upper });
};

// Código canónico (SMALL/CURVY/...) → etiqueta i18n; fallback al propio código.
const enumLabel = (kind, code) => {
  if (!code) return '';
  return tk(`modelProfileExpanded.${kind}Values.${String(code).toUpperCase()}`, {
    defaultValue: String(code),
  });
};

// Día ISO actual (1=Lunes .. 7=Domingo) para el histograma por defecto.
const todayIsoDay = () => {
  const d = new Date().getDay(); // 0=Domingo
  return d === 0 ? 7 : d;
};

const ModelProfileExpanded = ({ open, userId, fallbackNickname, presence, onClose, onStartVideochat }) => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [assets, setAssets] = useState([]);
  const [unavailable, setUnavailable] = useState(false);
  const [lightbox, setLightbox] = useState({ open: false, asset: null });
  const [selectedDay, setSelectedDay] = useState(todayIsoDay());
  const [likeState, setLikeState] = useState(null);
  const [likeBusy, setLikeBusy] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);
    setProfile(null);
    setAssets([]);
    setUnavailable(false);
    setSelectedDay(todayIsoDay());
    setLikeState(null);

    (async () => {
      let profileFailed = false;
      let p = null;
      let a = [];
      let likes = null;
      try {
        p = await apiFetch(`/models/${userId}/public-profile`);
      } catch (e) {
        profileFailed = true;
      }
      try {
        const raw = await apiFetch(`/models/${userId}/assets`);
        a = Array.isArray(raw) ? raw : [];
      } catch (e) {
        a = [];
      }
      try {
        likes = await apiFetch(`/models/${userId}/likes`);
      } catch (e) {
        likes = null;
      }
      if (cancelled) return;

      if (profileFailed) {
        setUnavailable(true);
      } else {
        setProfile(p);
        setAssets(a);
        setLikeState(likes);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [open, userId]);

  const handleClose = useCallback(() => {
    setLightbox({ open: false, asset: null });
    if (typeof onClose === 'function') onClose();
  }, [onClose]);

  const handleToggleLike = useCallback(async () => {
    if (!userId || likeBusy) return;
    setLikeBusy(true);
    try {
      const res = await apiFetch(`/models/${userId}/likes/toggle`, { method: 'POST' });
      setLikeState(res);
    } catch (e) {
      // silencioso: si falla, el estado no cambia
    } finally {
      setLikeBusy(false);
    }
  }, [userId, likeBusy]);

  // ----- Derivaciones -----
  const picAssets = assets.filter((a) => a.assetType === ASSET_PIC);
  const videoAssets = assets.filter((a) => a.assetType === ASSET_VIDEO);

  const principalPic = (() => {
    if (picAssets.length === 0) return null;
    const flagged = picAssets.find((a) => a.isPrincipal === true);
    return flagged || picAssets[0];
  })();

  const displayedNickname = profile?.nickname || fallbackNickname || tk('modelProfileExpanded.fallbackNickname');
  const languages = Array.isArray(profile?.languages) ? profile.languages : [];

  const presenceNorm = String(presence || '').toLowerCase();
  const presenceOnline = presenceNorm === 'online';
  const presenceLabel = presenceNorm
    ? tk(`common.presence.${presenceNorm}`, { defaultValue: presenceNorm })
    : null;

  const rateNum = profile?.chosenRateEurPerMin != null ? Number(profile.chosenRateEurPerMin) : null;
  const rateLabel = rateNum != null && !Number.isNaN(rateNum)
    ? tk('common.ratePerMin', { rate: rateNum.toFixed(2) })
    : null;

  // Matriz día(1-7) × hora(0-23) de intensidad, a partir de availability[].
  const availabilityByDay = useMemo(() => {
    const grid = Array.from({ length: 8 }, () => new Array(24).fill(0));
    const list = Array.isArray(profile?.availability) ? profile.availability : [];
    for (const b of list) {
      const d = Number(b?.dayOfWeek);
      const h = Number(b?.hour);
      if (d >= 1 && d <= 7 && h >= 0 && h <= 23) {
        grid[d][h] = Number(b?.intensity) || 0;
      }
    }
    return grid;
  }, [profile]);

  const dayName = (d) => tk(`modelProfileExpanded.days.${d}`, { defaultValue: `${d}` });

  const cycleDay = (delta) => {
    setSelectedDay((prev) => {
      let next = prev + delta;
      if (next < 1) next = 7;
      if (next > 7) next = 1;
      return next;
    });
  };

  // ----- Bloques de render -----
  // Card 1 Fase 3: likes + insignia (donde el mock tenía las estrellas).
  const renderLikes = () => {
    const count = likeState?.count ?? 0;
    const liked = !!likeState?.hasLiked;
    const badge = likeState?.badgeCode || null;
    const badgeName = badge ? tk(`modelProfileExpanded.badgeValues.${badge}`, { defaultValue: badge }) : null;
    return (
      <LikesRow>
        <LikeButton
          type="button"
          $on={liked}
          disabled={likeBusy}
          onClick={handleToggleLike}
          aria-label={tk(liked ? 'modelProfileExpanded.likes.unlike' : 'modelProfileExpanded.likes.like')}
        >
          <span className="heart">{liked ? '❤' : '🤍'}</span>
          {Number(count).toLocaleString('es-ES')}
        </LikeButton>
        {badge ? (
          <RankChip>
            <RoyaltyBadge code={badge} size={24} title={badgeName} />
            {badgeName}
          </RankChip>
        ) : (
          <RankNone>{tk('modelProfileExpanded.likes.badgeNone')}</RankNone>
        )}
      </LikesRow>
    );
  };

  const renderHeader = () => (
    <ProfileHeaderRow>
      <HeaderPhotoFrame
        $clickable={!!principalPic}
        onClick={() => { if (principalPic) setLightbox({ open: true, asset: principalPic }); }}
      >
        {principalPic ? (
          <img src={principalPic.url} alt={tk('modelProfileExpanded.alt.principalPhoto', { name: displayedNickname })} />
        ) : (
          <HeaderEmptyPhoto>{tk('modelProfileExpanded.noPrincipalPhoto')}</HeaderEmptyPhoto>
        )}
      </HeaderPhotoFrame>

      <HeaderInfo>
        <Nickname>
          {displayedNickname}
          {presenceLabel && <OnlineBadge $online={presenceOnline}>{presenceLabel}</OnlineBadge>}
        </Nickname>
        {renderLikes()}
        {rateLabel && <RateBadge>💎 {rateLabel}</RateBadge>}
        {profile?.biography && <Biography>{profile.biography}</Biography>}
        {profile?.interests && (
          <InterestsLine>
            <InterestsLabel>{tk('modelProfileExpanded.labels.interests')}</InterestsLabel>
            <LanguageChips>
              {String(profile.interests).split(',').map((it, i) => {
                const v = it.trim();
                return v ? <InterestChip key={i}>{v}</InterestChip> : null;
              })}
            </LanguageChips>
          </InterestsLine>
        )}
        {languages.length > 0 && (
          <>
            <InterestsLabel>{tk('modelProfileExpanded.labels.languages')}</InterestsLabel>
            <LanguageChips>
              {languages.map((l, i) => (
                <LanguageChip key={`${l.langCode}-${i}`} $primary={!!l.primary} title={l.level || undefined}>
                  {languageLabel(l.langCode)}
                </LanguageChip>
              ))}
            </LanguageChips>
          </>
        )}
        {typeof onStartVideochat === 'function' && (
          <CtaButton type="button" onClick={() => onStartVideochat(userId)}>
            {tk('modelProfileExpanded.startVideochat')}
          </CtaButton>
        )}
      </HeaderInfo>
    </ProfileHeaderRow>
  );

  // Bloque "Suele estar en línea" (histograma). Siempre visible; si aún no
  // hay datos (arranque), muestra un placeholder en vez de ocultarse.
  const renderAvailability = () => {
    if (!profile) return null;
    const hasData = !!profile.hasAvailabilityData;
    const dayRow = availabilityByDay[selectedDay] || new Array(24).fill(0);
    const peak = Math.max(...dayRow, 0);
    return (
      <GallerySection>
        <AvailabilityHead>
          <SectionTitle style={{ margin: 0 }}>{tk('modelProfileExpanded.sections.availability')}</SectionTitle>
          {hasData && (
            <DayNav>
              <DayNavBtn type="button" onClick={() => cycleDay(-1)} aria-label={tk('modelProfileExpanded.availability.prevDay')}>‹</DayNavBtn>
              <DayNavLabel>{dayName(selectedDay)}</DayNavLabel>
              <DayNavBtn type="button" onClick={() => cycleDay(1)} aria-label={tk('modelProfileExpanded.availability.nextDay')}>›</DayNavBtn>
            </DayNav>
          )}
        </AvailabilityHead>
        {hasData ? (
          <>
            <Bars>
              {dayRow.map((v, h) => (
                <Bar key={h} $h={v} $peak={v > 0 && v === peak} title={`${h}:00`} />
              ))}
            </Bars>
            <BarLabels>
              <span>00h</span><span>03h</span><span>06h</span><span>09h</span>
              <span>12h</span><span>15h</span><span>18h</span><span>21h</span>
            </BarLabels>
            <AvailabilityNote>{tk('modelProfileExpanded.availability.note')}</AvailabilityNote>
          </>
        ) : (
          <EmptyGalleryMsg>{tk('modelProfileExpanded.availability.empty')}</EmptyGalleryMsg>
        )}
      </GallerySection>
    );
  };

  // Bloque "Datos" (stat-tiles). Se muestra si hay edad o algún dato físico.
  const renderData = () => {
    if (!profile) return null;
    const hasPhysical = profile.age != null || profile.bustSize || profile.heightCm != null
      || profile.buttSize || profile.bodyType;
    if (!hasPhysical) return null;

    const tiles = [];
    if (profile.age != null) tiles.push({ v: profile.age, l: tk('modelProfileExpanded.labels.age') });
    if (profile.bustSize) tiles.push({ v: enumLabel('bust', profile.bustSize), l: tk('modelProfileExpanded.labels.bust') });
    // Sexo constante femenino.
    tiles.push({ v: tk('modelProfileExpanded.sexValue'), l: tk('modelProfileExpanded.labels.sex') });
    if (profile.heightCm != null) {
      tiles.push({ v: <>{profile.heightCm}<small> cm</small></>, l: tk('modelProfileExpanded.labels.height') });
    }
    if (profile.buttSize) tiles.push({ v: enumLabel('butt', profile.buttSize), l: tk('modelProfileExpanded.labels.butt') });
    if (profile.bodyType) tiles.push({ v: enumLabel('body', profile.bodyType), l: tk('modelProfileExpanded.labels.body') });

    return (
      <GallerySection>
        <SectionTitle>{tk('modelProfileExpanded.sections.data')}</SectionTitle>
        <StatsGrid>
          {tiles.map((t, i) => (
            <Stat key={i}>
              <StatValue>{t.v}</StatValue>
              <StatLabel>{t.l}</StatLabel>
            </Stat>
          ))}
        </StatsGrid>
      </GallerySection>
    );
  };

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
    if (loading) return <LoadingBox>{tk('modelProfileExpanded.loading')}</LoadingBox>;
    if (unavailable) return <UnavailableBox>{tk('modelProfileExpanded.unavailable')}</UnavailableBox>;
    const availabilityNode = renderAvailability();
    const dataNode = renderData();
    return (
      <ProfileBody>
        {renderHeader()}
        {availabilityNode && <SectionDivider />}
        {availabilityNode}
        {dataNode && <SectionDivider />}
        {dataNode}
        <SectionDivider />
        {renderPhotosSection()}
        <SectionDivider />
        {renderVideosSection()}
      </ProfileBody>
    );
  };

  return (
    <>
      <ModalBase open={!!open} onClose={handleClose} title="" size="xl" variant="info" hideChrome>
        <ProfilePanel>
          <PanelHead>
            <PanelTitle>
              {profile?.nickname
                ? tk('modelProfileExpanded.title', { name: profile.nickname })
                : tk('modelProfileExpanded.titleDefault')}
            </PanelTitle>
            <PanelClose type="button" onClick={handleClose} aria-label={tk('common.close')}>✕</PanelClose>
          </PanelHead>
          <PanelInner>
            {renderContent()}
          </PanelInner>
        </ProfilePanel>
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
              <img src={lightbox.asset.url} alt={tk('modelProfileExpanded.alt.expandedPhoto', { name: displayedNickname })} />
            )
          ) : null}
        </LightboxFrame>
      </ModalBase>
    </>
  );
};

export default ModelProfileExpanded;
