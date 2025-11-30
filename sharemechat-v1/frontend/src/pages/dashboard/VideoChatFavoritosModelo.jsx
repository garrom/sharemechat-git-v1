// src/pages/dashboard/VideoChatFavoritosModelo.jsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPhoneSlash, faVideo, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import FavoritesModelList from '../favorites/FavoritesModelList';
import {
  StyledCenter,
  StyledFavoritesShell, StyledFavoritesColumns, StyledCenterPanel,
  StyledCenterBody, StyledChatScroller, StyledChatDock, StyledChatInput,
  StyledVideoArea, StyledRemoteVideo, StyledVideoTitle,
  StyledTitleAvatar, StyledLocalVideo, StyledTopActions, StyledChatWhatsApp,
  StyledChatContainer, StyledChatList, StyledChatMessageRow, StyledChatBubble,
  StyledPreCallCenter, StyledHelperLine, StyledBottomActionsMobile,
  StyledMobile3ColBar, StyledTopCenter, StyledConnectedText, StyledFloatingHangup,
  StyledCallCardDesktop, StyledCallFooterDesktop
} from '../../styles/pages-styles/VideochatStyles';

import {
  ButtonLlamar, ButtonColgar, ButtonAceptar, ButtonRechazar,
  ButtonActivarCam, ButtonActivarCamMobile,
  ButtonVolver, BtnRoundVideo, BtnHangup, BtnSend
} from '../../styles/ButtonStyles';

// FAVORITOS MODELO (desktop + móvil)
export default function VideoChatFavoritosModelo(props) {
  const {
    // flags
    isMobile, allowChat, isPendingPanel, isSentPanel, contactMode,
    // identificadores / nombres
    openChatWith, centerChatPeerName, callPeerName, callPeerId, callPeerAvatar,
    // estados llamada/chat
    callError, callStatus, callCameraActive, centerMessages, centerInput,
    // refs
    callRemoteWrapRef, callRemoteVideoRef, callListRef, modelCenterListRef, callLocalVideoRef,
    // handlers de chat central
    setContactMode, enterCallMode, sendCenterMessage, setCenterInput,
    acceptInvitation, rejectInvitation,
    // handlers de llamada
    handleCallActivateCamera, handleCallInvite, handleCallEnd, toggleFullscreen,
    handleCallAccept, handleCallReject,
    // data para regalos/yo
    user, gifts, giftRenderReady,
    // móvil: lista favoritos
    handleOpenChatFromFavorites, favReload, selectedContactId, setCtxUser, setCtxPos,
    // móvil: volver atrás
    setTargetPeerId, setTargetPeerName, setSelectedFav
  } = props;

  return (
    <>
      {/* === Desktop Favoritos MODELO === */}
      {!isMobile && (
        <StyledFavoritesShell>
          <StyledFavoritesColumns>
            <StyledCenterPanel>
              {!openChatWith ? (
                <div style={{ color: '#adb5bd' }}>
                  Selecciona un favorito y pulsa <em>Chatear</em> para abrir la conversación aquí.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '4px 0 10px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8 }}>
                      <ButtonLlamar
                        onClick={enterCallMode}
                        disabled={!openChatWith || contactMode === 'call'}
                        title="Llamar"
                        aria-label="Llamar"
                        style={contactMode === 'call' ? { display: 'none' } : undefined}
                      >
                        <FontAwesomeIcon icon={faVideo} style={{ marginRight: 6 }} />
                        Iniciar VideoChat
                      </ButtonLlamar>
                    </div>
                  </div>

                  <StyledCenterBody>
                    {isPendingPanel && (
                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid #333',
                          borderRadius: 8,
                          padding: 16,
                          background: 'rgba(0,0,0,0.2)',
                        }}
                      >
                        <div style={{ textAlign: 'center', maxWidth: 520 }}>
                          <p style={{ color: '#e9ecef', marginBottom: 16 }}>
                            <strong>{centerChatPeerName}</strong> te ha invitado a ser favoritos
                            mutuos. Acepta para habilitar el chat.
                          </p>
                          <div
                            style={{
                              display: 'flex',
                              gap: 12,
                              justifyContent: 'center',
                            }}
                          >
                            <ButtonAceptar onClick={acceptInvitation} title="Aceptar invitación">
                              Aceptar
                            </ButtonAceptar>
                            <ButtonRechazar
                              onClick={rejectInvitation}
                              title="Rechazar invitación"
                            >
                              Rechazar
                            </ButtonRechazar>
                          </div>
                        </div>
                      </div>
                    )}

                    {isSentPanel && (
                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid #333',
                          borderRadius: 8,
                          padding: 16,
                          background: 'rgba(0,0,0,0.2)',
                        }}
                      >
                        <div
                          style={{
                            textAlign: 'center',
                            maxWidth: 520,
                            color: '#e9ecef',
                          }}
                        >
                          <p style={{ marginBottom: 8 }}>
                            Invitación enviada. Esperando respuesta de{' '}
                            <strong>{centerChatPeerName}</strong>.
                          </p>
                          <p style={{ fontSize: 12, color: '#adb5bd' }}>
                            El chat se habilitará cuando acepte tu invitación.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Desktop Favoritos Calling (MODELO) */}
                    {!isPendingPanel && !isSentPanel && contactMode === 'call' && (
                      <>
                        {callError && (
                          <p style={{ color: 'orange', marginTop: 6 }}>[CALL] {callError}</p>
                        )}

                        {/* Controles superiores (activar cam / llamar / colgar mientras conecta) */}
                        <StyledTopActions style={{ gap: 8 }}>
                          {!callCameraActive && callStatus !== 'incoming' && (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                marginTop: 8,
                              }}
                            >
                              <ButtonActivarCam
                                onClick={handleCallActivateCamera}
                                disabled={callStatus === 'idle' ? !allowChat : false}
                                title={
                                  callStatus === 'idle'
                                    ? allowChat
                                      ? 'Activa tu cámara'
                                      : 'Debéis ser favoritos aceptados para poder llamar'
                                    : 'Activa tu cámara'
                                }
                              >
                                Activar cámara
                              </ButtonActivarCam>
                              <StyledHelperLine style={{ color: '#000' }}>
                                <FontAwesomeIcon icon={faVideo} />
                                activar cámara para iniciar videochat
                              </StyledHelperLine>
                            </div>
                          )}

                          {callCameraActive &&
                            callStatus !== 'in-call' &&
                            callStatus !== 'ringing' &&
                            callStatus !== 'connecting' && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  marginTop: 8,
                                }}
                              >
                                <BtnRoundVideo
                                  onClick={handleCallInvite}
                                  disabled={!allowChat || !callPeerId}
                                  title={
                                    !allowChat
                                      ? 'Debéis ser favoritos aceptados para poder llamar'
                                      : !callPeerId
                                      ? 'Selecciona un contacto para llamar'
                                      : `Llamar a ${callPeerName || 'Usuario'}`
                                  }
                                  aria-label="Llamar"
                                >
                                  <FontAwesomeIcon icon={faVideo} />
                                </BtnRoundVideo>
                                <StyledHelperLine style={{ color: '#000' }}>
                                  <FontAwesomeIcon icon={faVideo} />
                                  pulsar botón para iniciar videollamada
                                </StyledHelperLine>
                              </div>
                            )}

                          {(callStatus === 'ringing' || callStatus === 'connecting') && (
                            <ButtonColgar
                              onClick={() => handleCallEnd(false)}
                              title="Colgar"
                              aria-label="Colgar"
                            >
                              <FontAwesomeIcon icon={faPhoneSlash} />
                            </ButtonColgar>
                          )}
                        </StyledTopActions>

                        {/* Card 16:9 + overlay chat SOLO cuando ya estamos en llamada */}
                        {callStatus === 'in-call' && (
                          <StyledCallCardDesktop>
                            <StyledVideoArea
                              style={{
                                height: 'calc(100vh - 220px)',
                                maxHeight: 'calc(100vh - 220px)',
                                position: 'relative',
                              }}
                            >
                              <StyledRemoteVideo
                                ref={callRemoteWrapRef}
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
                                  <StyledTitleAvatar
                                    src={callPeerAvatar || '/img/avatarChico.png'}
                                    alt=""
                                  />
                                {callPeerName || 'Remoto'}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleFullscreen(callRemoteWrapRef.current)
                                    }
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
                                    Full Screen
                                  </button>
                                </StyledVideoTitle>

                                <video
                                  ref={callRemoteVideoRef}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block',
                                  }}
                                  autoPlay
                                  playsInline
                                  onDoubleClick={() =>
                                    toggleFullscreen(callRemoteWrapRef.current)
                                  }
                                />

                                {/* PiP local encima del remoto */}
                                <StyledLocalVideo>
                                  <video
                                    ref={callLocalVideoRef}
                                    muted
                                    autoPlay
                                    playsInline
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                      display: 'block',
                                      border: '1px solid rgba(255,255,255,0.25)',
                                    }}
                                  />
                                </StyledLocalVideo>

                                {/* Botón colgar flotante en el centro inferior */}
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    bottom: 16,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    zIndex: 10,
                                  }}
                                >
                                  <BtnHangup
                                    onClick={() => handleCallEnd(false)}
                                    title="Colgar"
                                    aria-label="Colgar"
                                  >
                                    <FontAwesomeIcon icon={faPhoneSlash} />
                                  </BtnHangup>
                                </div>

                                {/* Chat overlay sobre el vídeo */}
                                <StyledChatContainer
                                  data-wide="true"
                                  style={{ maxHeight: '70vh' }}
                                >
                                  <StyledChatList ref={callListRef}>
                                    {centerMessages.map((m) => {
                                      let giftData = m.gift;
                                      if (
                                        !giftData &&
                                        typeof m.body === 'string' &&
                                        m.body.startsWith('[[GIFT:') &&
                                        m.body.endsWith(']]')
                                      ) {
                                        try {
                                          const parts = m.body.slice(2, -2).split(':');
                                          giftData = {
                                            id: Number(parts[1]),
                                            name: parts.slice(2).join(':'),
                                          };
                                        } catch {}
                                      }
                                      const isMe =
                                        Number(m.senderId) === Number(user?.id);
                                      // modelo=rosa, cliente=azul (inverso al cliente)
                                      const variant = isMe ? 'peer' : 'me';

                                      return (
                                        <StyledChatMessageRow key={m.id}>
                                          <StyledChatBubble $variant={variant}>
                                            {giftData
                                              ? giftRenderReady &&
                                                (() => {
                                                  const src =
                                                    gifts.find(
                                                      (gg) =>
                                                        Number(gg.id) ===
                                                        Number(giftData.id),
                                                    )?.icon || null;
                                                  return src ? (
                                                    <img
                                                      src={src}
                                                      alt=""
                                                      style={{
                                                        width: 24,
                                                        height: 24,
                                                        verticalAlign: 'middle',
                                                      }}
                                                    />
                                                  ) : null;
                                                })()
                                              : m.body}
                                          </StyledChatBubble>
                                        </StyledChatMessageRow>
                                      );
                                    })}
                                  </StyledChatList>
                                </StyledChatContainer>
                              </StyledRemoteVideo>
                            </StyledVideoArea>

                            {/* Footer alineado al ancho del vídeo: input + send (sin gifts) */}
                            <StyledCallFooterDesktop style={{ maxWidth: 960, margin: '0px auto 0', width: '100%', padding: '0 8px', position: 'relative' }}>
                              <StyledChatDock>
                                <StyledChatInput
                                  type="text"
                                  value={centerInput}
                                  onChange={(e) => setCenterInput(e.target.value)}
                                  placeholder="Escribe un mensaje…"
                                  autoComplete="off"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      sendCenterMessage();
                                    }
                                  }}
                                />
                                <BtnSend
                                  type="button"
                                  onClick={sendCenterMessage}
                                  aria-label="Enviar"
                                >
                                  <FontAwesomeIcon icon={faPaperPlane} />
                                </BtnSend>
                              </StyledChatDock>
                            </StyledCallFooterDesktop>
                          </StyledCallCardDesktop>
                        )}

                        {/* Mensajes de estado de llamada (incoming / ringing) */}
                        {callStatus === 'incoming' && (
                          <div
                            style={{
                              marginTop: 12,
                              padding: 12,
                              border: '1px solid #333',
                              borderRadius: 8,
                              background: 'rgba(0,0,0,0.35)',
                            }}
                          >
                            <div
                              style={{
                                color: '#fff',
                                marginBottom: 8,
                              }}
                            >
                              Te está llamando{' '}
                              <strong>{callPeerName || 'Usuario'}</strong>.
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                gap: 10,
                              }}
                            >
                              <ButtonAceptar onClick={handleCallAccept}>
                                Aceptar
                              </ButtonAceptar>
                              <ButtonRechazar
                                onClick={handleCallReject}
                                style={{ backgroundColor: '#dc3545' }}
                              >
                                Rechazar
                              </ButtonRechazar>
                            </div>
                          </div>
                        )}

                        {callStatus === 'ringing' && (
                          <div
                            style={{
                              marginTop: 12,
                              color: '#fff',
                            }}
                          >
                            Llamando a {callPeerName || 'Usuario'}… (sonando)
                          </div>
                        )}
                      </>
                    )}

                    {/* Desktop Favoritos chat (MODELO, sin gift button) */}
                    {!isPendingPanel && !isSentPanel && contactMode !== 'call' && (
                      <StyledChatWhatsApp>
                        <StyledChatScroller ref={modelCenterListRef} data-bg="whatsapp">
                          {centerMessages.length === 0 && (
                            <div style={{ color: '#adb5bd' }}>
                              {allowChat
                                ? 'No hay mensajes todavía. ¡Escribe el primero!'
                                : 'Este chat no está activo.'}
                            </div>
                          )}
                          {centerMessages.map((m) => {
                            let giftData = m.gift;
                            if (
                              !giftData &&
                              typeof m.body === 'string' &&
                              m.body.startsWith('[[GIFT:') &&
                              m.body.endsWith(']]')
                            ) {
                              try {
                                const parts = m.body.slice(2, -2).split(':');
                                giftData = {
                                  id: Number(parts[1]),
                                  name: parts.slice(2).join(':'),
                                };
                              } catch {}
                            }
                            const isMe = Number(m.senderId) === Number(user?.id);
                            const variant = isMe ? 'me' : 'peer';

                            return (
                              <StyledChatMessageRow
                                key={m.id}
                                style={{
                                  justifyContent: isMe ? 'flex-end' : 'flex-start',
                                }}
                              >
                                <StyledChatBubble $variant={variant}>
                                  {giftData ? (
                                    giftRenderReady &&
                                    (() => {
                                      const src =
                                        gifts.find(
                                          (gg) =>
                                            Number(gg.id) === Number(giftData.id),
                                        )?.icon || null;
                                      return src ? (
                                        <img
                                          src={src}
                                          alt=""
                                          style={{
                                            width: 24,
                                            height: 24,
                                            verticalAlign: 'middle',
                                          }}
                                        />
                                      ) : null;
                                    })()
                                  ) : (
                                    m.body
                                  )}
                                </StyledChatBubble>
                              </StyledChatMessageRow>
                            );
                          })}
                        </StyledChatScroller>

                        <StyledChatDock>
                          <StyledChatInput
                            value={centerInput}
                            onChange={(e) => setCenterInput(e.target.value)}
                            placeholder={
                              allowChat ? 'Escribe un mensaje…' : 'Chat inactivo'
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && allowChat) {
                                sendCenterMessage();
                              }
                            }}
                            disabled={!allowChat}
                          />
                          <BtnSend
                            type="button"
                            onClick={sendCenterMessage}
                            disabled={!allowChat}
                            aria-label="Enviar"
                          >
                            <FontAwesomeIcon icon={faPaperPlane} />
                          </BtnSend>
                        </StyledChatDock>
                      </StyledChatWhatsApp>
                    )}
                  </StyledCenterBody>
                </>
              )}
            </StyledCenterPanel>
          </StyledFavoritesColumns>
        </StyledFavoritesShell>
      )}

      {/* === Móvil Favoritos MODELO === */}
      {isMobile && (
        <>
          {!openChatWith && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
              }}
            >
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                <FavoritesModelList
                  onSelect={handleOpenChatFromFavorites}
                  reloadTrigger={favReload}
                  selectedId={selectedContactId}
                  onContextMenu={(user, pos) => {
                    setCtxUser(user);
                    setCtxPos(pos);
                  }}
                />
              </div>
            </div>
          )}

          {openChatWith && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
              }}
            >
              {/* Header móvil: volver + iniciar (centrado) + texto; NO aparece en llamada */}
              {contactMode !== 'call' && (
                <StyledMobile3ColBar>
                  <ButtonVolver
                    type="button"
                    onClick={() => {
                      setTargetPeerId(null);
                      setTargetPeerName('');
                      setSelectedFav(null);
                      setContactMode('chat');
                    }}
                    aria-label="Volver a la lista"
                    title="Volver"
                  >
                    <FontAwesomeIcon icon={faArrowLeft} />
                  </ButtonVolver>

                  <StyledTopCenter>
                    {allowChat && (
                      <ButtonLlamar
                        onClick={enterCallMode}
                        title="Llamar"
                        aria-label="Llamar"
                      >
                        Iniciar VideoChat
                      </ButtonLlamar>
                    )}
                  </StyledTopCenter>

                  <StyledConnectedText>{centerChatPeerName}</StyledConnectedText>
                </StyledMobile3ColBar>
              )}

              {/* CONTROLES DE LLAMADA EN MÓVIL */}
              {contactMode === 'call' && (
                <>
                  {!callCameraActive && callStatus !== 'incoming' && (
                    <StyledPreCallCenter>
                      <div>
                        <ButtonActivarCamMobile
                          onClick={handleCallActivateCamera}
                          disabled={callStatus === 'idle' ? !allowChat : false}
                          title={
                            callStatus === 'idle'
                              ? allowChat
                                ? 'Activa tu cámara'
                                : 'Debéis ser favoritos aceptados para poder llamar'
                              : 'Activa tu cámara'
                          }
                        >
                          Activar cámara
                        </ButtonActivarCamMobile>
                        <StyledHelperLine>
                          <FontAwesomeIcon icon={faVideo} />
                          activar cámara para iniciar videochat
                        </StyledHelperLine>
                      </div>
                    </StyledPreCallCenter>
                  )}

                  {!callCameraActive && callStatus === 'incoming' && (
                    <StyledPreCallCenter>
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          justifyContent: 'center',
                        }}
                      >
                        <ButtonAceptar onClick={handleCallAccept}>
                          Aceptar
                        </ButtonAceptar>
                        <ButtonRechazar onClick={handleCallReject}>
                          Rechazar
                        </ButtonRechazar>
                      </div>
                    </StyledPreCallCenter>
                  )}

                  {callCameraActive &&
                    callStatus !== 'in-call' &&
                    callStatus !== 'ringing' &&
                    callStatus !== 'connecting' && (
                      <StyledBottomActionsMobile>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <BtnRoundVideo
                            onClick={handleCallInvite}
                            disabled={!allowChat || !callPeerId}
                            title={
                              !allowChat
                                ? 'Debéis ser favoritos aceptados para poder llamar'
                                : !callPeerId
                                ? 'Selecciona un contacto para llamar'
                                : `Llamar a ${callPeerName || 'Usuario'}`
                            }
                            aria-label="Llamar"
                          >
                            <FontAwesomeIcon icon={faVideo} />
                          </BtnRoundVideo>
                          <StyledHelperLine style={{ marginTop: 4 }}>
                            <FontAwesomeIcon icon={faVideo} />
                            pulsar botón para iniciar llamada
                          </StyledHelperLine>
                        </div>
                      </StyledBottomActionsMobile>
                    )}
                </>
              )}

              {/* Área de vídeo + chat en llamada (móvil) */}
              {contactMode === 'call' && (
                <div
                  style={{
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  <StyledVideoArea
                    style={{
                      display: callStatus === 'in-call' ? 'block' : 'none',
                      position: 'relative',
                    }}
                  >
                    <StyledRemoteVideo ref={callRemoteWrapRef}>
                      <StyledVideoTitle>
                        <StyledTitleAvatar
                          src={callPeerAvatar || '/img/avatarChico.png'}
                          alt=""
                        />
                        {callPeerName || 'Remoto'}
                        <button
                          type="button"
                          onClick={() => toggleFullscreen(callRemoteWrapRef.current)}
                          title="Pantalla completa"
                          style={{
                            marginLeft: 8,
                            padding: '2px 8px',
                            borderRadius: 6,
                            border: '1px solid rgba(255,255,255,.6)',
                            background: 'rgba(0,0,0,0.25)',
                            color: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          Full Screen
                        </button>
                      </StyledVideoTitle>
                      <video
                        ref={callRemoteVideoRef}
                        autoPlay
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </StyledRemoteVideo>

                    <StyledLocalVideo>
                      <video
                        ref={callLocalVideoRef}
                        muted
                        autoPlay
                        playsInline
                        style={{
                          width: '100%',
                          display: 'block',
                          border: '1px solid rgba(255,255,255,0.25)',
                        }}
                      />
                    </StyledLocalVideo>

                    {callStatus === 'in-call' && (
                      <StyledFloatingHangup>
                        <BtnHangup
                          onClick={() => handleCallEnd(false)}
                          title="Colgar"
                          aria-label="Colgar"
                        >
                          <FontAwesomeIcon icon={faPhoneSlash} />
                        </BtnHangup>
                      </StyledFloatingHangup>
                    )}

                    <StyledChatContainer data-wide="true">
                      <StyledChatList ref={callListRef}>
                        {centerMessages.map((m) => {
                          let giftData = m.gift;
                          if (
                            !giftData &&
                            typeof m.body === 'string' &&
                            m.body.startsWith('[[GIFT:') &&
                            m.body.endsWith(']]')
                          ) {
                            try {
                              const parts = m.body.slice(2, -2).split(':');
                              giftData = {
                                id: Number(parts[1]),
                                name: parts.slice(2).join(':'),
                              };
                            } catch {}
                          }
                          const isMe = Number(m.senderId) === Number(user?.id);
                          const variant = isMe ? 'peer' : 'me';

                          return (
                            <StyledChatMessageRow key={m.id}>
                              <StyledChatBubble $variant={variant}>
                                {giftData
                                  ? giftRenderReady &&
                                    (() => {
                                      const src =
                                        gifts.find(
                                          (gg) =>
                                            Number(gg.id) === Number(giftData.id),
                                        )?.icon || null;
                                      return src ? (
                                        <img
                                          src={src}
                                          alt=""
                                          style={{
                                            width: 24,
                                            height: 24,
                                            verticalAlign: 'middle',
                                          }}
                                        />
                                      ) : null;
                                    })()
                                  : m.body}
                              </StyledChatBubble>
                            </StyledChatMessageRow>
                          );
                        })}
                      </StyledChatList>
                    </StyledChatContainer>
                  </StyledVideoArea>

                  <StyledChatDock
                    style={{ display: callStatus === 'in-call' ? 'flex' : 'none' }}
                  >
                    <StyledChatInput
                      type="text"
                      value={centerInput}
                      onChange={(e) => setCenterInput(e.target.value)}
                      placeholder="Escribe un mensaje…"
                      autoComplete="off"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendCenterMessage();
                        }
                      }}
                    />
                    <BtnSend
                      type="button"
                      onClick={sendCenterMessage}
                      aria-label="Enviar"
                    >
                      <FontAwesomeIcon icon={faPaperPlane} />
                    </BtnSend>
                  </StyledChatDock>

                  {(callStatus === 'connecting' ||
                    callStatus === 'ringing' ||
                    callStatus === 'incoming') && (
                    <p
                      style={{
                        color: '#000',
                        textAlign: 'center',
                        margin: '6px 0',
                      }}
                    >
                      {callStatus === 'connecting' && 'Conectando…'}
                      {callStatus === 'ringing' &&
                        `Llamando a ${callPeerName || 'Usuario'}…`}
                      {callStatus === 'incoming' &&
                        `Te está llamando ${callPeerName || 'Usuario'}…`}
                    </p>
                  )}
                </div>
              )}

              {/* Chat persistente cuando NO estás en llamada (móvil) */}
              <StyledCenterBody data-call={contactMode === 'call' ? 'true' : undefined}>
                {isPendingPanel && (
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #333',
                      borderRadius: 8,
                      padding: 16,
                      background: 'rgba(0,0,0,0.2)',
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ color: '#fff', marginBottom: 16 }}>
                        {centerChatPeerName} te ha invitado a favoritos. Acepta
                        para habilitar el chat.
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          gap: 12,
                          justifyContent: 'center',
                        }}
                      >
                        <ButtonAceptar onClick={acceptInvitation}>
                          Aceptar
                        </ButtonAceptar>
                        <ButtonRechazar onClick={rejectInvitation}>
                          Rechazar
                        </ButtonRechazar>
                      </div>
                    </div>
                  </div>
                )}

                {isSentPanel && (
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #333',
                      borderRadius: 8,
                      padding: 16,
                      background: 'rgba(0,0,0,0.2)',
                    }}
                  >
                    <div
                      style={{
                        textAlign: 'center',
                        color: '#e9ecef',
                      }}
                    >
                      <p style={{ marginBottom: 8 }}>
                        Invitación enviada. Esperando respuesta de{' '}
                        <strong>{centerChatPeerName}</strong>.
                      </p>
                      <p style={{ fontSize: 12, color: '#adb5bd' }}>
                        El chat se habilitará cuando acepte tu invitación.
                      </p>
                    </div>
                  </div>
                )}

                {!isPendingPanel && !isSentPanel && contactMode !== 'call' && (
                  <StyledChatWhatsApp>
                    <StyledChatScroller ref={modelCenterListRef} data-bg="whatsapp">
                      {centerMessages.length === 0 && (
                        <div style={{ color: '#adb5bd' }}>
                          {allowChat
                            ? 'No hay mensajes todavía. ¡Escribe el primero!'
                            : 'Este chat no está activo.'}
                        </div>
                      )}
                      {centerMessages.map((m) => {
                        let giftData = m.gift;
                        if (
                          !giftData &&
                          typeof m.body === 'string' &&
                          m.body.startsWith('[[GIFT:') &&
                          m.body.endsWith(']]')
                        ) {
                          try {
                            const parts = m.body.slice(2, -2).split(':');
                            giftData = {
                              id: Number(parts[1]),
                              name: parts.slice(2).join(':'),
                            };
                          } catch {}
                        }
                        const isMe = Number(m.senderId) === Number(user?.id);
                        const variant = isMe ? 'me' : 'peer';

                        return (
                          <StyledChatMessageRow
                            key={m.id}
                            style={{
                              justifyContent: isMe ? 'flex-end' : 'flex-start',
                            }}
                          >
                            <StyledChatBubble $variant={variant}>
                              {giftData ? (
                                giftRenderReady &&
                                (() => {
                                  const src =
                                    gifts.find(
                                      (gg) => Number(gg.id) === Number(giftData.id),
                                    )?.icon || null;
                                  return src ? (
                                    <img
                                      src={src}
                                      alt=""
                                      style={{
                                        width: 24,
                                        height: 24,
                                        verticalAlign: 'middle',
                                      }}
                                    />
                                  ) : null;
                                })()
                              ) : (
                                m.body
                              )}
                            </StyledChatBubble>
                          </StyledChatMessageRow>
                        );
                      })}
                    </StyledChatScroller>

                    <StyledChatDock>
                      <StyledChatInput
                        value={centerInput}
                        onChange={(e) => setCenterInput(e.target.value)}
                        placeholder={
                          allowChat ? 'Escribe un mensaje…' : 'Chat inactivo'
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && allowChat) {
                            sendCenterMessage();
                          }
                        }}
                        disabled={!allowChat}
                      />
                      <BtnSend
                        type="button"
                        onClick={sendCenterMessage}
                        disabled={!allowChat}
                        aria-label="Enviar"
                      >
                        <FontAwesomeIcon icon={faPaperPlane} />
                      </BtnSend>
                    </StyledChatDock>
                  </StyledChatWhatsApp>
                )}
              </StyledCenterBody>
            </div>
          )}
        </>
      )}
    </>
  );
}
