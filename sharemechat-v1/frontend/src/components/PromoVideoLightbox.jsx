// src/components/PromoVideoLightbox.jsx
import React from 'react';
import {
  Backdrop,
  Wrapper,
  Dialog,
  Header,
  Title,
  CloseBtn,
  Body,
} from '../styles/ModalStyles';
import { BtnPromoNav } from '../styles/ButtonStyles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

export default function PromoVideoLightbox({
  videos,
  activeIndex,
  onClose,
  onPrev,
  onNext,
}) {
  if (!Array.isArray(videos) || videos.length === 0) return null;
  if (activeIndex == null || activeIndex < 0 || activeIndex >= videos.length) return null;

  const video = videos[activeIndex];

  const handleBackdropClick = () => {
    onClose && onClose();
  };

  const stopPropagation = (e) => e.stopPropagation();

  const canPrev = activeIndex > 0;
  const canNext = activeIndex < videos.length - 1;

  return (
    <>
      <Backdrop onClick={handleBackdropClick} />
      <Wrapper onClick={handleBackdropClick}>
        <Dialog
          data-variant="info"
          $size="lg"
          onClick={stopPropagation}
        >
          <Header>
            <Title>{video.title || 'Vídeo de modelo'}</Title>
            <CloseBtn onClick={onClose} aria-label="Cerrar vídeo">
              ×
            </CloseBtn>
          </Header>

          <Body data-kind="default">
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxHeight: '70vh',
              }}
            >
              {/* Botón anterior */}
              {canPrev && (
                <BtnPromoNav
                  type="button"
                  onClick={onPrev}
                  aria-label="Vídeo anterior"
                  style={{
                    position: 'absolute',
                    left: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 2,
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  <FontAwesomeIcon icon={faChevronLeft} />
                </BtnPromoNav>
              )}

              {/* Botón siguiente */}
              {canNext && (
                <BtnPromoNav
                  type="button"
                  onClick={onNext}
                  aria-label="Siguiente vídeo"
                  style={{
                    position: 'absolute',
                    right: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 2,
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  <FontAwesomeIcon icon={faChevronRight} />
                </BtnPromoNav>
              )}

              {/* Vídeo principal */}
              <video
                src={video.src}
                controls
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  maxHeight: '70vh',
                  borderRadius: 12,
                  background: '#000',
                  display: 'block',
                }}
              />
            </div>

            {/* Pie simple con info */}
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
              {video.modelName && (
                <div>
                  <strong>Modelo:</strong> {video.modelName}
                </div>
              )}
              {video.durationSec != null && (
                <div>
                  <strong>Duración:</strong> {video.durationSec} s
                </div>
              )}
            </div>
          </Body>
        </Dialog>
      </Wrapper>
    </>
  );
}
