// src/pages/subpages/MyAssetsManager.jsx
//
// Capa 2 — Gestor multi-asset del modelo (5 fotos + 2 vídeos máximo).
//
// Se importa como bloque dentro de PerfilModel.jsx y sustituye las
// 2 MediaCard de Capa 1 (foto + vídeo) por una galería con:
//   - 5 slots PIC + 2 slots VIDEO
//   - badge de estado de moderación por slot (Aprobado / Pendiente / Rechazado)
//   - estrella si is_principal
//   - menú "..." con "Marcar como principal" + "Eliminar"
//   - modal de upload con preview previo al envío
//   - lightbox de visualización al pulsar la thumbnail
//
// Endpoints (Capa 2):
//   GET    /api/me/assets                       → lista propia con status
//   POST   /api/me/assets  (multipart)          → subir asset {type, file}
//   PUT    /api/me/assets/{id}/principal        → marcar principal
//   DELETE /api/me/assets/{id}                  → hard delete (+ S3 cleanup)
//
// Props:
//   contractBlocked (bool)         → si true, deshabilita acciones (gate de contrato)
//   onAssetsChange   (fn opcional) → callback con (assets) tras cada carga/cambio,
//                                    útil para que el parent refresque el avatar.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import i18n from '../../i18n';
import { apiFetch } from '../../config/http';
import { useAppModals } from '../../components/useAppModals';
import ModalBase from '../../components/ModalBase';

import {
  ProfilePrimaryButton,
  ProfileSecondaryButton,
} from '../../styles/ButtonStyles';

import {
  ManagerSection,
  ManagerCard,
  ManagerCardHeader,
  ManagerCardTitle,
  ManagerCardSubtitle,
  ManagerHint,
  ManagerMessage,
  SlotsGrid,
  SlotBase,
  SlotEmpty,
  SlotPlusIcon,
  SlotThumb,
  SlotPrincipalBadge,
  SlotStatusBadge,
  SlotMenuButton,
  SlotMenuDropdown,
  SlotMenuItem,
  SlotRejectionNote,
  UploadBody,
  UploadPickerRow,
  UploadFileTag,
  UploadPreviewBox,
  UploadNoticeBox,
  HiddenFileInput,
  LightboxFrame,
} from '../../styles/pages-styles/MyAssetsManagerStyles';

// ----- Constantes operativas (replican el backend) -----
const MAX_PIC = 5;
const MAX_VIDEO = 2;
const ASSET_PIC = 'PIC';
const ASSET_VIDEO = 'VIDEO';

const STATUS_APPROVED = 'APPROVED';
const STATUS_REJECTED = 'REJECTED';
const STATUS_PENDING = 'PENDING_REVIEW';

const ACCEPT_IMAGE = 'image/jpeg,image/png,image/webp';
const ACCEPT_VIDEO = 'video/mp4';

// Validación de tamaño cliente (defensa en profundidad; backend valida también)
const MAX_PIC_BYTES = 10 * 1024 * 1024;     // 10 MB
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;   // 60 MB

const tk = (key, options) => i18n.t(key, options);

// Traduce el código de motivo a string i18n. Las claves viven en
// admin.assetModeration.reasons (Capa 1) y se reusan tal cual.
const translateRejection = (reasonCode) => {
  if (!reasonCode) return null;
  const fallback = tk('admin.assetModeration.reasons.OTHER', {
    defaultValue: 'Otro motivo',
  });
  return tk(`admin.assetModeration.reasons.${reasonCode}`, {
    defaultValue: fallback,
  });
};

const statusVariant = (status) => {
  if (status === STATUS_APPROVED) return 'approved';
  if (status === STATUS_REJECTED) return 'rejected';
  return 'pending';
};

const statusLabel = (status) => {
  if (status === STATUS_APPROVED) return tk('perfilModel.assetsManager.status.approved');
  if (status === STATUS_REJECTED) return tk('perfilModel.assetsManager.status.rejected');
  if (status === STATUS_PENDING) return tk('perfilModel.assetsManager.status.pending');
  return tk('perfilModel.assetsManager.status.unknown');
};

const MyAssetsManager = ({ contractBlocked = false, onAssetsChange }) => {
  const { alert, confirm } = useAppModals();

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // estado del menú "..."
  const [openMenuId, setOpenMenuId] = useState(null);

  // estado del modal de upload
  const [uploadModal, setUploadModal] = useState({ open: false, type: null });
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // estado del lightbox
  const [lightbox, setLightbox] = useState({ open: false, asset: null });

  // refs para los input file ocultos
  const picInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // ----- Lectura -----
  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/me/assets');
      const list = Array.isArray(data) ? data : [];
      setAssets(list);
      if (typeof onAssetsChange === 'function') {
        onAssetsChange(list);
      }
    } catch (e) {
      setError(e?.message || tk('perfilModel.assetsManager.loadError'));
    } finally {
      setLoading(false);
    }
  }, [onAssetsChange]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Cierra el menú "..." al hacer click fuera
  useEffect(() => {
    if (!openMenuId) return;
    const onDocClick = (e) => {
      const target = e.target;
      if (!target || !target.closest) return;
      if (target.closest('[data-asset-menu]')) return;
      setOpenMenuId(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openMenuId]);

  // ----- Helpers de derivación -----
  const photoAssets = assets.filter((a) => a.assetType === ASSET_PIC);
  const videoAssets = assets.filter((a) => a.assetType === ASSET_VIDEO);
  const photoCount = photoAssets.length;
  const videoCount = videoAssets.length;
  const photoLimitReached = photoCount >= MAX_PIC;
  const videoLimitReached = videoCount >= MAX_VIDEO;

  const buildSlots = (list, max) => {
    const ordered = [...list].sort((a, b) => {
      // Principal primero; luego por position asc, luego por id asc.
      if (a.isPrincipal && !b.isPrincipal) return -1;
      if (!a.isPrincipal && b.isPrincipal) return 1;
      const posDiff = (a.position ?? 0) - (b.position ?? 0);
      if (posDiff !== 0) return posDiff;
      return (a.id ?? 0) - (b.id ?? 0);
    });
    const slots = [...ordered];
    while (slots.length < max) slots.push(null);
    return slots;
  };

  const photoSlots = buildSlots(photoAssets, MAX_PIC);
  const videoSlots = buildSlots(videoAssets, MAX_VIDEO);

  // ----- Upload modal -----
  const clearPreviewUrl = useCallback(() => {
    setPendingPreviewUrl((prev) => {
      if (prev) {
        try { URL.revokeObjectURL(prev); } catch { /* noop */ }
      }
      return null;
    });
  }, []);

  const closeUploadModal = useCallback(() => {
    setUploadModal({ open: false, type: null });
    setPendingFile(null);
    clearPreviewUrl();
  }, [clearPreviewUrl]);

  const openUploadModal = (type) => {
    if (contractBlocked) return;
    if (type === ASSET_PIC && photoLimitReached) return;
    if (type === ASSET_VIDEO && videoLimitReached) return;
    setUploadModal({ open: true, type });
    setPendingFile(null);
    clearPreviewUrl();
    setError('');
    setMsg('');
  };

  const onFilePicked = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setPendingFile(null);
      clearPreviewUrl();
      return;
    }
    const type = uploadModal.type;
    // Validación tamaño cliente
    const maxBytes = type === ASSET_VIDEO ? MAX_VIDEO_BYTES : MAX_PIC_BYTES;
    if (file.size > maxBytes) {
      alert({
        title: tk('common.error', { defaultValue: 'Error' }),
        message: type === ASSET_VIDEO
          ? tk('perfilModel.assetsManager.upload.errors.tooLargeVideo')
          : tk('perfilModel.assetsManager.upload.errors.tooLargePhoto'),
        variant: 'danger',
        size: 'sm',
      });
      e.target.value = '';
      return;
    }
    // Validación formato cliente
    const ok = type === ASSET_VIDEO
      ? file.type === 'video/mp4'
      : ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    if (!ok) {
      alert({
        title: tk('common.error', { defaultValue: 'Error' }),
        message: type === ASSET_VIDEO
          ? tk('perfilModel.assetsManager.upload.errors.invalidVideoFormat')
          : tk('perfilModel.assetsManager.upload.errors.invalidImageFormat'),
        variant: 'danger',
        size: 'sm',
      });
      e.target.value = '';
      return;
    }
    setPendingFile(file);
    clearPreviewUrl();
    try {
      const url = URL.createObjectURL(file);
      setPendingPreviewUrl(url);
    } catch {
      // si falla la creación del objectURL, seguimos sin preview
    }
  };

  const triggerFilePicker = () => {
    const ref = uploadModal.type === ASSET_VIDEO ? videoInputRef : picInputRef;
    if (ref.current) ref.current.click();
  };

  const submitUpload = async () => {
    if (!pendingFile || !uploadModal.type) return;
    setSubmitting(true);
    setError('');
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('type', uploadModal.type);
      fd.append('file', pendingFile);
      await apiFetch('/me/assets', { method: 'POST', body: fd });
      closeUploadModal();
      setMsg(tk('perfilModel.assetsManager.actions.success.upload'));
      await loadAssets();
    } catch (e) {
      setError(e?.message || tk('perfilModel.assetsManager.upload.errors.uploadFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Acciones de slot -----
  const handleMarkPrincipal = async (assetId) => {
    setOpenMenuId(null);
    if (contractBlocked) return;
    setError('');
    setMsg('');
    try {
      await apiFetch(`/me/assets/${assetId}/principal`, { method: 'PUT' });
      setMsg(tk('perfilModel.assetsManager.actions.success.markPrincipal'));
      await loadAssets();
    } catch (e) {
      setError(e?.message || tk('perfilModel.assetsManager.actions.errors.markPrincipal'));
    }
  };

  const handleDelete = async (asset) => {
    setOpenMenuId(null);
    if (contractBlocked) return;
    const isVideo = asset.assetType === ASSET_VIDEO;
    const ok = await confirm({
      title: isVideo
        ? tk('perfilModel.assetsManager.confirm.deleteVideo')
        : tk('perfilModel.assetsManager.confirm.deletePhoto'),
      message: '',
      okText: tk('common.delete', { defaultValue: 'Eliminar' }),
      cancelText: tk('common.cancel', { defaultValue: 'Cancelar' }),
      danger: true,
    });
    if (!ok) return;
    setError('');
    setMsg('');
    try {
      await apiFetch(`/me/assets/${asset.id}`, { method: 'DELETE' });
      setMsg(tk('perfilModel.assetsManager.actions.success.delete'));
      await loadAssets();
    } catch (e) {
      setError(e?.message || tk('perfilModel.assetsManager.actions.errors.delete'));
    }
  };

  // ----- Render helpers -----
  const renderSlot = (asset, idx, kind) => {
    const isVideo = kind === ASSET_VIDEO;
    if (!asset) {
      const limitReached = isVideo ? videoLimitReached : photoLimitReached;
      const disabledByLimit = limitReached;
      const titleAttr = disabledByLimit
        ? (isVideo
            ? tk('perfilModel.assetsManager.limit.videoReached')
            : tk('perfilModel.assetsManager.limit.photoReached'))
        : (contractBlocked
            ? tk('perfilModel.assetsManager.hints.acceptContractFirst')
            : undefined);
      return (
        <SlotEmpty
          key={`empty-${kind}-${idx}`}
          $kind={isVideo ? 'video' : 'pic'}
          type="button"
          onClick={() => openUploadModal(isVideo ? ASSET_VIDEO : ASSET_PIC)}
          disabled={contractBlocked || disabledByLimit}
          title={titleAttr}
        >
          <SlotPlusIcon aria-hidden="true">+</SlotPlusIcon>
          {isVideo
            ? tk('perfilModel.assetsManager.slot.empty.video')
            : tk('perfilModel.assetsManager.slot.empty.photo')}
        </SlotEmpty>
      );
    }

    const variant = statusVariant(asset.reviewStatus);
    const canMarkPrincipal = asset.reviewStatus === STATUS_APPROVED && !asset.isPrincipal;
    const menuOpen = openMenuId === asset.id;
    const rejectionLabel = asset.reviewStatus === STATUS_REJECTED
      ? translateRejection(asset.rejectionReasonCode)
      : null;
    const rejectionText = asset.rejectionReasonText;

    return (
      <React.Fragment key={`asset-${asset.id}`}>
        <SlotBase $kind={isVideo ? 'video' : 'pic'} data-asset-menu>
          <SlotThumb
            onClick={() => setLightbox({ open: true, asset })}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setLightbox({ open: true, asset });
              }
            }}
            aria-label={tk('perfilModel.assetsManager.lightbox.open', {
              defaultValue: 'Ampliar',
            })}
          >
            {isVideo ? (
              <video src={`${asset.url}#t=0.1`} muted preload="metadata" />
            ) : (
              <img src={asset.url} alt={tk('profileCommon.alt.profilePhoto')} />
            )}
          </SlotThumb>

          {asset.isPrincipal && (
            <SlotPrincipalBadge
              title={tk('perfilModel.assetsManager.slot.principalTitle')}
              aria-label={tk('perfilModel.assetsManager.slot.principal')}
            >
              ★
            </SlotPrincipalBadge>
          )}

          <SlotStatusBadge $variant={variant}>{statusLabel(asset.reviewStatus)}</SlotStatusBadge>

          <SlotMenuButton
            type="button"
            aria-label={tk('perfilModel.assetsManager.menu.label')}
            aria-haspopup="menu"
            aria-expanded={menuOpen ? 'true' : 'false'}
            disabled={contractBlocked}
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(menuOpen ? null : asset.id);
            }}
            title={contractBlocked
              ? tk('perfilModel.assetsManager.hints.acceptContractFirst')
              : tk('perfilModel.assetsManager.menu.label')}
          >
            ⋯
          </SlotMenuButton>

          {menuOpen && (
            <SlotMenuDropdown role="menu">
              {canMarkPrincipal && (
                <SlotMenuItem
                  type="button"
                  role="menuitem"
                  onClick={() => handleMarkPrincipal(asset.id)}
                >
                  ★ {tk('perfilModel.assetsManager.menu.markPrincipal')}
                </SlotMenuItem>
              )}
              <SlotMenuItem
                type="button"
                role="menuitem"
                $danger
                onClick={() => handleDelete(asset)}
              >
                ✕ {tk('perfilModel.assetsManager.menu.delete')}
              </SlotMenuItem>
            </SlotMenuDropdown>
          )}
        </SlotBase>

        {rejectionLabel && (
          <SlotRejectionNote>
            <strong>{tk('perfilModel.assetsManager.rejected.label')}</strong>{' '}
            {rejectionLabel}
            {rejectionText ? (
              <>
                <br />
                <em>{tk('perfilModel.assetsManager.rejected.moderatorNote')}</em>{' '}
                {rejectionText}
              </>
            ) : null}
          </SlotRejectionNote>
        )}
      </React.Fragment>
    );
  };

  const uploadModalTitle = uploadModal.type === ASSET_VIDEO
    ? tk('perfilModel.assetsManager.upload.title.video')
    : tk('perfilModel.assetsManager.upload.title.photo');

  return (
    <ManagerSection>
      {/* SECCIÓN FOTOS */}
      <ManagerCard>
        <ManagerCardHeader>
          <ManagerCardTitle>
            {tk('perfilModel.assetsManager.sectionPhotos.title')}{' '}
            <span style={{ color: '#8a929b', fontWeight: 600, fontSize: '0.92rem' }}>
              ({photoCount}/{MAX_PIC})
            </span>
          </ManagerCardTitle>
          <ManagerCardSubtitle>
            {tk('perfilModel.assetsManager.sectionPhotos.subtitle')}
          </ManagerCardSubtitle>
        </ManagerCardHeader>

        <SlotsGrid>
          {photoSlots.map((a, i) => renderSlot(a, i, ASSET_PIC))}
        </SlotsGrid>

        {contractBlocked && (
          <ManagerHint>
            {tk('perfilModel.assetsManager.hints.acceptContractFirst')}
          </ManagerHint>
        )}
      </ManagerCard>

      {/* SECCIÓN VÍDEOS */}
      <ManagerCard>
        <ManagerCardHeader>
          <ManagerCardTitle>
            {tk('perfilModel.assetsManager.sectionVideos.title')}{' '}
            <span style={{ color: '#8a929b', fontWeight: 600, fontSize: '0.92rem' }}>
              ({videoCount}/{MAX_VIDEO})
            </span>
          </ManagerCardTitle>
          <ManagerCardSubtitle>
            {tk('perfilModel.assetsManager.sectionVideos.subtitle')}
          </ManagerCardSubtitle>
        </ManagerCardHeader>

        <SlotsGrid>
          {videoSlots.map((a, i) => renderSlot(a, i, ASSET_VIDEO))}
        </SlotsGrid>

        {contractBlocked && (
          <ManagerHint>
            {tk('perfilModel.assetsManager.hints.acceptContractFirst')}
          </ManagerHint>
        )}
      </ManagerCard>

      {/* Mensajes globales del componente */}
      {loading && <ManagerHint>{tk('perfilModel.assetsManager.loading')}</ManagerHint>}
      {error && <ManagerMessage $type="error">{error}</ManagerMessage>}
      {msg && <ManagerMessage $type="ok">{msg}</ManagerMessage>}

      {/* Inputs file ocultos */}
      <HiddenFileInput
        ref={picInputRef}
        type="file"
        accept={ACCEPT_IMAGE}
        onChange={onFilePicked}
      />
      <HiddenFileInput
        ref={videoInputRef}
        type="file"
        accept={ACCEPT_VIDEO}
        onChange={onFilePicked}
      />

      {/* Modal de upload */}
      <ModalBase
        open={uploadModal.open}
        onClose={closeUploadModal}
        title={uploadModalTitle}
        size="md"
        variant="info"
        actions={[
          {
            label: tk('perfilModel.assetsManager.upload.actions.cancel'),
            onClick: closeUploadModal,
          },
          {
            label: submitting
              ? tk('perfilModel.assetsManager.upload.actions.uploading')
              : tk('perfilModel.assetsManager.upload.actions.submit'),
            primary: true,
            onClick: submitUpload,
          },
        ]}
      >
        <UploadBody>
          <UploadNoticeBox>
            {tk('perfilModel.assetsManager.upload.body.notice')}
          </UploadNoticeBox>

          <UploadPickerRow>
            <ProfileSecondaryButton type="button" onClick={triggerFilePicker}>
              {tk('perfilModel.assetsManager.upload.actions.choose')}
            </ProfileSecondaryButton>
            {pendingFile && <UploadFileTag>{pendingFile.name}</UploadFileTag>}
          </UploadPickerRow>

          {pendingPreviewUrl && (
            <UploadPreviewBox>
              {uploadModal.type === ASSET_VIDEO ? (
                <video src={pendingPreviewUrl} controls preload="metadata" />
              ) : (
                <img
                  src={pendingPreviewUrl}
                  alt={tk('perfilModel.assetsManager.upload.preview.imageAlt')}
                />
              )}
            </UploadPreviewBox>
          )}
        </UploadBody>
      </ModalBase>

      {/* Lightbox */}
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
                alt={tk('profileCommon.alt.currentProfilePhoto')}
              />
            )
          ) : null}
        </LightboxFrame>
      </ModalBase>
    </ManagerSection>
  );
};

// Silenciar el linter sobre ProfilePrimaryButton/ReactDOM si no se usan
void ProfilePrimaryButton;
void ReactDOM;

export default MyAssetsManager;
