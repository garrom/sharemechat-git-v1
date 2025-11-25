// src/pages/dashboard/VideoChatRandomUser.jsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVideo, faPhoneSlash, faForward } from '@fortawesome/free-solid-svg-icons';

import {
  StyledCenterVideochat,
  StyledSplit2,
  StyledPane,
  StyledVideoArea,
  StyledThumbsGrid,
  StyledRemoteVideo,
  StyledVideoTitle,
  StyledTitleAvatar,
  StyledPreCallCenter,
  StyledHelperLine,
  StyledRandomSearchControls,
  StyledRandomSearchCol,
  StyledSearchHint,
  StyledLocalVideo,
} from '../../styles/pages-styles/VideochatStyles';

import {
  ButtonActivarCam,
  ButtonActivarCamMobile,
  ButtonBuscar,
  ButtonNext,
  BtnHangup,
} from '../../styles/ButtonStyles';

export default function VideoChatRandomUser(props) {
  const {
    isMobile,
    cameraActive,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    searching,
    stopAll,
    handleStartMatch,
    handleNext,
    toggleFullscreen,
    remoteVideoWrapRef,
    handleActivateCamera,
    statusText,
    error,
  } = props;

  return (
    <StyledCenterVideochat>
      <StyledSplit2>
        {/* ------- PANE IZQUIERDO (LOCAL) ------- */}
        <StyledPane data-side="left">
          {!isMobile && (
            !cameraActive ? (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <ButtonActivarCam onClick={handleActivateCamera}>
                    Activar cámara
                  </ButtonActivarCam>
                  <StyledHelperLine style={{ color: '#fff', justifyContent: 'center' }}>
                    <FontAwesomeIcon icon={faVideo} />
                    activar cámara para iniciar videochat
                  </StyledHelperLine>
                </div>
              </div>
            ) : (
              <StyledVideoArea>
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: '#000',
                  }}
                >
                  <video
                    ref={localVideoRef}
                    muted
                    autoPlay
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>
              </StyledVideoArea>
            )
          )}
        </StyledPane>

        {/* ------- PANE DERECHO (REMOTO + CONTROLES) ------- */}
        <StyledPane data-side="right" style={{ position: 'relative' }}>
          {/* SIN CÁMARA: thumbs + CTA activar cámara (especial móvil) */}
          {!cameraActive ? (
            <>
              <StyledThumbsGrid>
                <img className="thumb" src="https://picsum.photos/seed/a/300/400" alt="" />
                <img className="thumb" src="https://picsum.photos/seed/b/300/400" alt="" />
                <img className="thumb" src="https://picsum.photos/seed/c/300/400" alt="" />
                <img className="thumb" src="https://picsum.photos/seed/d/300/400" alt="" />
                <img className="thumb" src="https://picsum.photos/seed/e/300/400" alt="" />
                <img className="thumb" src="https://picsum.photos/seed/f/300/400" alt="" />
              </StyledThumbsGrid>

              {isMobile && (
                <StyledPreCallCenter
                  style={{
                    position: 'absolute',
                    top: '70%',
                    left: 0,
                    right: 0,
                    transform: 'translateY(-50%)',
                  }}
                >
                  <div>
                    <ButtonActivarCamMobile onClick={handleActivateCamera}>
                      Activar cámara
                    </ButtonActivarCamMobile>
                    <StyledHelperLine style={{ color: '#fff' }}>
                      <FontAwesomeIcon icon={faVideo} />
                      activar cámara para iniciar videochat
                    </StyledHelperLine>
                  </div>
                </StyledPreCallCenter>
              )}
            </>
          ) : (
            <>
              {/* CONTROLES inferiores centrados */}
              {cameraActive && (remoteStream || searching) && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 12,
                    left: 12,
                    right: 12,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 8,
                    zIndex: 5,
                  }}
                >
                  {!isMobile && (
                    <BtnHangup
                      onClick={stopAll}
                      title="Colgar"
                      aria-label="Colgar"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '999px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        background: '#dc3545',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.4)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fff';
                        e.currentTarget.style.color = '#dc3545';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#dc3545';
                        e.currentTarget.style.color = '#fff';
                      }}
                    >
                      <FontAwesomeIcon icon={faPhoneSlash} />
                    </BtnHangup>
                  )}

                  {remoteStream && (
                    <ButtonNext
                      onClick={handleNext}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '999px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        background: '#fff',
                        color: '#000',
                        border: '1px solid rgba(255,255,255,0.4)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#000';
                        e.currentTarget.style.color = '#fff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fff';
                        e.currentTarget.style.color = '#000';
                      }}
                    >
                      <FontAwesomeIcon icon={faForward} />
                    </ButtonNext>
                  )}
                </div>
              )}

              {/* SIN REMOTO: botón Buscar centrado */}
              {!remoteStream && (
                <StyledRandomSearchControls>
                  <StyledRandomSearchCol>
                    {!searching ? (
                      <>
                        <ButtonBuscar onClick={handleStartMatch}>Buscar</ButtonBuscar>
                        <StyledSearchHint>Pulsa “Buscar” para empezar.</StyledSearchHint>
                      </>
                    ) : (
                      <StyledSearchHint>Buscando modelo disponible…</StyledSearchHint>
                    )}
                  </StyledRandomSearchCol>
                </StyledRandomSearchControls>
              )}

              {/* REMOTO ACTIVO */}
              {remoteStream ? (
                <StyledVideoArea>
                  <StyledRemoteVideo
                    ref={remoteVideoWrapRef}
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      background: '#000',
                    }}
                  >
                    <StyledVideoTitle>
                      <StyledTitleAvatar src="/img/avatarChica.png" alt="" />
                      Modelo
                      <button
                        type="button"
                        onClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                        title="Pantalla completa"
                        style={{
                          marginLeft: 8,
                          padding: '2px 8px',
                          borderRadius: 6,
                          border: '1px solid rgba(255,255,255,.6)',
                          background: 'rgba(0,0,0,.25)',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        Pantalla completa
                      </button>
                    </StyledVideoTitle>

                    <video
                      ref={remoteVideoRef}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                      autoPlay
                      playsInline
                      onDoubleClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                    />
                  </StyledRemoteVideo>
                </StyledVideoArea>
              ) : null}

              {/* PiP móvil: cámara local siempre que esté activa */}
              {isMobile && cameraActive && (
                <StyledLocalVideo>
                  <video
                    ref={localVideoRef}
                    muted
                    autoPlay
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </StyledLocalVideo>
              )}

              {isMobile && cameraActive && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: '72px',
                    zIndex: 8,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <BtnHangup onClick={stopAll} title="Colgar" aria-label="Colgar">
                    <FontAwesomeIcon icon={faPhoneSlash} />
                  </BtnHangup>
                  {remoteStream && (
                    <ButtonNext
                      onClick={handleNext}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '999px',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#fff',
                        color: '#000',
                        border: '1px solid rgba(255,255,255,0.4)',
                      }}
                    >
                      <FontAwesomeIcon icon={faForward} />
                    </ButtonNext>
                  )}
                </div>
              )}
            </>
          )}
        </StyledPane>
      </StyledSplit2>

      {/* Mensajes de estado / error debajo del layout */}
      {statusText && (
        <p style={{ marginTop: 10, color: '#adb5bd', fontSize: 14 }}>
          {statusText}
        </p>
      )}
      {error && (
        <p style={{ marginTop: 4, color: 'red', fontSize: 14 }}>
          {error}
        </p>
      )}
    </StyledCenterVideochat>
  );
}
