import React, { useEffect, useState, useRef } from 'react';
import i18n from '../../i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { TEASERS_PAGE_SIZE, TEASERS_PAGE_DEFAULT } from '../../config/appConfig';
import { apiFetch } from '../../config/http';
import {
  faUserPlus,
  faVideo,
  faPhoneSlash,
  faForward,
  faChevronLeft,
  faChevronRight,
  faFlag,
  faGift,
  faLock,
  faPaperPlane,
  faExpand
} from '@fortawesome/free-solid-svg-icons';

import {
  StyledCenterVideochat,
  StyledSplit2,
  StyledPane,
  StyledVideoArea,
  StyledPrecallVideoArea,
  StyledPrecallLocalStage,
  StyledRemoteVideo,
  StyledRemoteVideoBlur,
  StyledTitleAvatar,
  StyledPreCallCenter,
  StyledHelperLine,
  StyledRandomSearchControls,
  StyledRandomSearchCol,
  StyledSearchHint,
  StyledPaneCenter,
  StyledPaneCenterStack,
  StyledStatusText,
  StyledChatInput,
  StyledCallCardDesktop,
  StyledCallChatColumn,
  StyledCallChatColHeader,
  StyledCallChatColScroll,
  StyledCallFooterDesktop,
  StyledCallVideoArea,
  StyledCallStage,
  StyledCallTopBar,
  StyledCallTopMeta,
  StyledCallTopMetaText,
  StyledCallTopActions,
  StyledCallLocalVideo,
  StyledCallBottomBar,
  StyledCallBottomInner,
  StyledCallPrimaryActions,
  StyledCallSecondaryActions,
  StyledCallComposer,
  StyledTeaserCenter,
  StyledTeaserInner,
  StyledTeaserCard,
  StyledTeaserMediaButton,
  StyledTeaserNavSlot,
  StyledTeaserFavoriteSlot
} from '../../styles/pages-styles/VideochatStyles';

import {
  ButtonActivarCam,
  ButtonActivarCamMobile,
  ButtonBuscar,
  BtnCallDanger,
  BtnCallLight,
  BtnCallAlert,
  BtnCallGhost,
  BtnTeaserPrev,
  BtnTeaserNext,
  ButtonRegalo,
  BtnSend
} from '../../styles/ButtonStyles';

import PromoVideoLightbox from '../../components/PromoVideoLightbox';
import BlurredPreview from '../../components/BlurredPreview';

export default function VideoChatRandomUser(props) {
  const t = (key, options) => i18n.t(key, options);

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
    onboardingSlot,
    modelNickname,
    modelAvatar,
    handleFavoriteGate,
    openPurchaseModal,
    // ADR-037 Bloque 5 Paso 1: callback del boton "Go Premium" del banner.
    // Debe orquestar el flow completo (KYC + email verified + modal pack +
    // NOWPayments checkout + redirect), NO solo abrir el modal. En
    // DashboardUserClient se cablea a handleFirstPayment.
    onGoPremium,
    handleReportPeer,
  } = props;

  // Fase 0 streaming (trial): backdrop borroso del vídeo remoto (mismo stream).
  const blurVideoRef = useRef(null);
  useEffect(() => {
    const el = blurVideoRef.current;
    if (!el) return;
    if (el.srcObject !== (remoteStream || null)) el.srcObject = remoteStream || null;
  }, [remoteStream, isMobile]);

  const [promoVideos, setPromoVideos] = useState([]);
  const [activePromoIndex, setActivePromoIndex] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);

  const fetchTeasers = async () => {
    setPromoLoading(true);
    setPromoError('');

    try {
      const data = await apiFetch(`/models/teasers?page=${TEASERS_PAGE_DEFAULT}&size=${TEASERS_PAGE_SIZE}`);

      const mapped = (Array.isArray(data) ? data : []).map((item) => ({
        id: item.modelId,
        title: t('dashboardUserClient.videoChatRandomUser.promoTeaserTitle', { name: item.modelName }),
        modelName: item.modelName,
        thumb: item.avatarUrl || '/img/avatarChica.png',
        src: item.videoUrl,
        durationSec: null,
        // ADR-052 Superficie 2 (2026-07-25): precio autoservicio de la
        // modelo, mostrado en el lightbox como "X EUR/min".
        chosenRateEurPerMin: item.chosenRateEurPerMin,
      }));

      setPromoVideos(mapped);
      if (mapped.length > 0) setCurrentPromoIndex(0);
    } catch (e) {
      setPromoVideos([]);
      // Email sin verificar (EMAIL_NOT_VERIFIED): el aviso vive en la barra de
      // onboarding, no en el panel de teasers; aqui no mostramos nada.
      if (String(e?.code || '').toUpperCase() !== 'EMAIL_NOT_VERIFIED') {
        setPromoError(e?.message || t('dashboardUserClient.videoChatRandomUser.errors.loadPromoVideos'));
      }
    } finally {
      setPromoLoading(false);
    }
  };

  useEffect(() => {
    fetchTeasers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenPromo = (index) => setActivePromoIndex(index);
  const handleClosePromo = () => setActivePromoIndex(null);
  const handlePrevPromo = () => setActivePromoIndex((idx) => (idx > 0 ? idx - 1 : idx));
  const handleNextPromo = () => setActivePromoIndex((idx) => (idx < promoVideos.length - 1 ? idx + 1 : idx));

  const goPrevCard = () => {
    if (promoVideos.length === 0) return;
    setCurrentPromoIndex((idx) => (idx > 0 ? idx - 1 : promoVideos.length - 1));
  };

  const goNextCard = () => {
    if (promoVideos.length === 0) return;
    setCurrentPromoIndex((idx) => (idx < promoVideos.length - 1 ? idx + 1 : 0));
  };

  const currentPromo =
    promoVideos.length > 0
      ? promoVideos[Math.min(currentPromoIndex, promoVideos.length - 1)]
      : null;

  const handleFavoriteFromTeaser = async (promoVideo) => {
    if (!promoVideo || !promoVideo.id) return;

    try {
      if (typeof openPurchaseModal === 'function') {
        await openPurchaseModal({ context: 'user-favorite', modelId: promoVideo.id });
      } else if (typeof handleFavoriteGate === 'function') {
        handleFavoriteGate(promoVideo.id);
      }
    } catch {
    }
  };

  const onReportClick = () => {
    try {
      if (typeof handleReportPeer === 'function') handleReportPeer();
    } catch {
    }
  };

  const renderCallTopMeta = () => (
    <StyledCallTopMeta>
      <StyledTitleAvatar src={modelAvatar || '/img/avatarChica.png'} alt="" />
      <StyledCallTopMetaText>
        {modelNickname || t('dashboardUserClient.report.displayName')}
      </StyledCallTopMetaText>
    </StyledCallTopMeta>
  );

  const renderCallActions = () => (
    <StyledCallBottomBar>
      <StyledCallBottomInner>
        <StyledCallPrimaryActions>
          <BtnCallDanger
            onClick={stopAll}
            title={t('dashboardUserClient.videoChatRandomUser.actions.hangup')}
            aria-label={t('dashboardUserClient.videoChatRandomUser.actions.hangup')}
          >
            <FontAwesomeIcon icon={faPhoneSlash} />
          </BtnCallDanger>

          <BtnCallLight
            onClick={handleNext}
            title={t('home.hero.nextAria')}
            aria-label={t('home.hero.nextAria')}
          >
            <FontAwesomeIcon icon={faForward} />
          </BtnCallLight>

          <BtnCallLight
            onClick={() => openPurchaseModal && openPurchaseModal({ context:'user-favorite', modelId: null })}
            aria-label={t('common.actions.addToFavorites')}
            title={t('dashboardUserClient.videoChatRandomUser.actions.addToFavoritesPremium')}
          >
            <FontAwesomeIcon icon={faUserPlus} />
          </BtnCallLight>
        </StyledCallPrimaryActions>

        <StyledCallSecondaryActions>
          <BtnCallAlert
            type="button"
            onClick={onReportClick}
            title={t('modals.report.title')}
            aria-label={t('modals.report.title')}
          >
            <FontAwesomeIcon icon={faFlag} />
          </BtnCallAlert>
        </StyledCallSecondaryActions>
      </StyledCallBottomInner>
    </StyledCallBottomBar>
  );

  const showGlobalStatus = !(remoteStream && !isMobile);

  // ADR-037 Bloque 5 Paso 1: banner permanente en la seccion videochat del USER
  // ("modo Free · sin contenido adulto") + boton "Go Premium" que reutiliza
  // openPurchaseModal (mismo flujo que el modal TrialCooldown existente).
  // Siempre visible mientras el usuario esta en esta seccion; la propia
  // logica de streaming impide navegar a otras secciones sin colgar antes,
  // asi que no necesita ocultarse por estado.
  const handleGoPremiumClick = () => {
    try {
      if (typeof onGoPremium === 'function') {
        onGoPremium();
      }
    } catch { /* noop */ }
  };

  const TrialFreeBanner = () => (
    <div
      role="note"
      aria-label={t('videochat.trial.userBanner.text')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        padding: '8px 16px',
        background: 'linear-gradient(90deg, rgba(30,58,138,0.92) 0%, rgba(59,130,246,0.92) 100%)',
        color: '#ffffff',
        fontSize: '0.85rem',
        boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {onboardingSlot}
      <div
        style={{
          marginLeft: 'auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          whiteSpace: 'nowrap',
        }}
      >
        <span>{t('videochat.trial.userBanner.text')}</span>
        <button
          type="button"
          onClick={handleGoPremiumClick}
          style={{
            background: '#ffffff',
            color: '#1e3a8a',
            border: 'none',
            borderRadius: 999,
            padding: '5px 14px',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            letterSpacing: 0.3,
          }}
        >
          {t('videochat.trial.userBanner.cta')}
        </button>
      </div>
    </div>
  );

  return (
    <StyledCenterVideochat>
      {/* En llamada desktop el CTA ya vive en la columna de chat (gancho);
          ocultamos la barra azul ahí para no duplicar. Se mantiene en precall
          y en móvil (donde es el único CTA). */}
      {!(remoteStream && !isMobile) && <TrialFreeBanner />}
      <StyledSplit2 data-mode={!isMobile && remoteStream ? 'full-remote' : 'split'}>
        <StyledPane data-side="left">
          {!isMobile && (
            !cameraActive ? (
              <StyledPaneCenter>
                <StyledPaneCenterStack>
                  <ButtonActivarCam onClick={handleActivateCamera}>{t('dashboardUserClient.videoChatRandomUser.actions.activateCamera')}</ButtonActivarCam>
                  <StyledHelperLine style={{color:'#fff',justifyContent:'center'}}>
                    <FontAwesomeIcon icon={faVideo} />
                    {t('dashboardUserClient.videoChatRandomUser.hints.activateCamera')}
                  </StyledHelperLine>
                </StyledPaneCenterStack>
              </StyledPaneCenter>
            ) : (
              !remoteStream && (
                <StyledPrecallVideoArea>
                  <StyledPrecallLocalStage>
                    <video ref={localVideoRef} muted autoPlay playsInline style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                  </StyledPrecallLocalStage>
                </StyledPrecallVideoArea>
              )
            )
          )}
        </StyledPane>

        <StyledPane data-side="right" data-view={!cameraActive ? 'thumbs' : 'call'} style={{position:'relative'}}>
          {!cameraActive ? (
            <>
              {promoLoading && (
                <StyledStatusText>
                  {t('dashboardUserClient.videoChatRandomUser.loading.promoVideos')}
                </StyledStatusText>
              )}
              {promoError && (
                <StyledStatusText $tone="error">
                  {promoError}
                </StyledStatusText>
              )}

              {currentPromo && (
                <StyledTeaserCenter>
                  <StyledTeaserInner>
                    <StyledTeaserCard>
                      <StyledTeaserNavSlot $side="left">
                        <BtnTeaserPrev type="button" onClick={goPrevCard} aria-label={t('home.hero.prevAria')} title={t('home.hero.prevAria')}>
                          <FontAwesomeIcon icon={faChevronLeft} />
                        </BtnTeaserPrev>
                      </StyledTeaserNavSlot>

                      <StyledTeaserMediaButton type="button" onClick={() => handleOpenPromo(currentPromoIndex)} title={currentPromo.title || t('dashboardUserClient.videoChatRandomUser.actions.viewTeaser')}>
                        <BlurredPreview type="video" src={currentPromo.src} poster={currentPromo.thumb} style={{width:'100%',height:'100%'}} />
                      </StyledTeaserMediaButton>

                      <StyledTeaserFavoriteSlot>
                        <BtnCallLight
                          type="button"
                          onClick={() => openPurchaseModal && openPurchaseModal({ context:'user-favorite', modelId: currentPromo?.id })}
                          aria-label={t('common.actions.addToFavorites')}
                          title={t('dashboardUserClient.videoChatRandomUser.actions.addToFavoritesPremium')}
                        >
                          <FontAwesomeIcon icon={faUserPlus} />
                        </BtnCallLight>
                      </StyledTeaserFavoriteSlot>

                      <StyledTeaserNavSlot $side="right">
                        <BtnTeaserNext type="button" onClick={goNextCard} aria-label={t('home.hero.nextAria')} title={t('home.hero.nextAria')}>
                          <FontAwesomeIcon icon={faChevronRight} />
                        </BtnTeaserNext>
                      </StyledTeaserNavSlot>
                    </StyledTeaserCard>
                  </StyledTeaserInner>
                </StyledTeaserCenter>
              )}

              {!promoLoading && !promoError && promoVideos.length === 0 && (
                <StyledStatusText>
                  {t('dashboardUserClient.videoChatRandomUser.empty.promoVideos')}
                </StyledStatusText>
              )}

              {isMobile && (
                <StyledPreCallCenter style={{position:'absolute',top:'70%',left:0,right:0,transform:'translateY(-50%)'}}>
                  <div>
                    <ButtonActivarCamMobile onClick={handleActivateCamera}>{t('dashboardUserClient.videoChatRandomUser.actions.activateCamera')}</ButtonActivarCamMobile>
                    <StyledHelperLine style={{color:'#fff'}}>
                      <FontAwesomeIcon icon={faVideo} />
                      {t('dashboardUserClient.videoChatRandomUser.hints.activateCamera')}
                    </StyledHelperLine>
                  </div>
                </StyledPreCallCenter>
              )}
            </>
          ) : (
            <>
              {!remoteStream && (
                <StyledRandomSearchControls>
                  <StyledRandomSearchCol>
                    {!searching ? (
                      <>
                        <ButtonBuscar onClick={handleStartMatch}>{t('dashboardUserClient.videoChatRandomUser.actions.search')}</ButtonBuscar>
                        <StyledSearchHint>{t('dashboardUserClient.videoChatRandomUser.hints.search')}</StyledSearchHint>
                      </>
                    ) : (
                      <>
                        <StyledSearchHint>{t('dashboardUserClient.videoChatRandomUser.loading.searchingModel')}</StyledSearchHint>
                        <div style={{marginTop:8,display:'flex',justifyContent:'center'}}>
                          <BtnCallDanger onClick={stopAll} title={t('dashboardUserClient.videoChatRandomUser.actions.stopSearch')} aria-label={t('dashboardUserClient.videoChatRandomUser.actions.stopSearch')}>
                            <FontAwesomeIcon icon={faPhoneSlash} />
                          </BtnCallDanger>
                        </div>
                      </>
                    )}
                  </StyledRandomSearchCol>
                </StyledRandomSearchControls>
              )}

              {remoteStream && !isMobile && (
                <StyledCallCardDesktop data-full="true" data-chat-side="true">
                  <StyledCallVideoArea>
                    <StyledRemoteVideo ref={remoteVideoWrapRef} style={{position:'relative',width:'100%',height:'100%',borderRadius:0,overflow:'hidden',background:'#000'}}>
                      <StyledCallStage>
                        <StyledCallTopBar>
                          {renderCallTopMeta()}
                          <StyledCallTopActions>
                            <BtnCallGhost type="button" onClick={() => toggleFullscreen(remoteVideoWrapRef.current)} title={t('dashboardUserClient.videoChatRandomUser.actions.fullscreen')} aria-label={t('dashboardUserClient.videoChatRandomUser.actions.fullscreen')} style={{ width: 36, height: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                              <FontAwesomeIcon icon={faExpand} />
                            </BtnCallGhost>
                          </StyledCallTopActions>
                        </StyledCallTopBar>

                        <StyledRemoteVideoBlur ref={blurVideoRef} $ready={!!remoteStream} autoPlay playsInline muted aria-hidden="true" />

                        <video ref={remoteVideoRef} style={{width:'100%',height:'100%',objectFit:'contain',display:'block',position:'relative',zIndex:1,background:'transparent'}} autoPlay playsInline onDoubleClick={() => toggleFullscreen(remoteVideoWrapRef.current)} />

                        {cameraActive && (
                          <StyledCallLocalVideo data-compact="true">
                            <video ref={localVideoRef} muted autoPlay playsInline style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                          </StyledCallLocalVideo>
                        )}

                        {cameraActive && renderCallActions()}
                      </StyledCallStage>
                    </StyledRemoteVideo>
                  </StyledCallVideoArea>

                  {/* Columna de chat de GANCHO (trial): se ve igual que la del
                      cliente normal, pero TODO está bloqueado -> al pulsar,
                      CTA "hazte cliente" (onGoPremium). */}
                  <StyledCallChatColumn>
                    <StyledCallChatColHeader>
                      <StyledTitleAvatar src={modelAvatar || '/img/avatarChica.png'} alt="" style={{ width: 28, height: 28 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e7ebf0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {modelNickname || t('dashboardUserClient.report.displayName')}
                        </div>
                        {statusText && (
                          <div style={{ fontSize: 10, color: 'rgba(231,235,240,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {statusText}
                          </div>
                        )}
                      </div>
                    </StyledCallChatColHeader>

                    <StyledCallChatColScroll>
                      <button
                        type="button"
                        onClick={onGoPremium}
                        style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '18px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, color: '#e7ebf0', cursor: 'pointer', textAlign: 'center' }}
                      >
                        <FontAwesomeIcon icon={faLock} style={{ fontSize: 20, color: '#ff5c8a' }} />
                        <div style={{ fontSize: 13, lineHeight: 1.4, color: 'rgba(231,235,240,0.85)' }}>
                          {t('dashboardUserClient.videoChatRandomUser.teaser.chatLocked', 'Hazte cliente para chatear y enviar regalos')}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,#ff5c8a,#a78bfa)', borderRadius: 999, padding: '6px 14px' }}>
                          {t('dashboardUserClient.videoChatRandomUser.teaser.cta', 'Hazte cliente')}
                        </span>
                      </button>
                    </StyledCallChatColScroll>

                    <StyledCallFooterDesktop>
                      <StyledCallComposer>
                        <StyledChatInput
                          type="text"
                          readOnly
                          placeholder={t('dashboardUserClient.videoChatRandomUser.teaser.inputLocked', 'Hazte cliente para escribir…')}
                          onClick={onGoPremium}
                          style={{ cursor: 'pointer' }}
                        />
                        <BtnSend type="button" onClick={onGoPremium} aria-label={t('dashboardUserClient.videoChatRandomUser.teaser.cta', 'Hazte cliente')} title={t('dashboardUserClient.videoChatRandomUser.teaser.cta', 'Hazte cliente')}>
                          <FontAwesomeIcon icon={faPaperPlane} />
                        </BtnSend>
                        <ButtonRegalo type="button" onClick={onGoPremium} aria-label={t('dashboardUserClient.videoChatRandomUser.teaser.cta', 'Hazte cliente')} title={t('dashboardUserClient.videoChatRandomUser.teaser.cta', 'Hazte cliente')}>
                          <FontAwesomeIcon icon={faGift} />
                        </ButtonRegalo>
                      </StyledCallComposer>
                    </StyledCallFooterDesktop>
                  </StyledCallChatColumn>
                </StyledCallCardDesktop>
              )}

              {remoteStream && isMobile && (
                <StyledVideoArea>
                  <StyledRemoteVideo ref={remoteVideoWrapRef} style={{position:'relative',width:'100%',overflow:'hidden',background:'#000'}}>
                    <StyledCallStage>
                      <StyledCallTopBar>
                        {renderCallTopMeta()}
                      </StyledCallTopBar>

                      <video ref={remoteVideoRef} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} autoPlay playsInline onDoubleClick={() => toggleFullscreen(remoteVideoWrapRef.current)} />

                      {cameraActive && (
                        <StyledCallLocalVideo>
                          <video ref={localVideoRef} muted autoPlay playsInline style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                        </StyledCallLocalVideo>
                      )}

                      {cameraActive && renderCallActions()}
                    </StyledCallStage>
                  </StyledRemoteVideo>
                </StyledVideoArea>
              )}
            </>
          )}
        </StyledPane>
      </StyledSplit2>

      {showGlobalStatus && statusText && <p style={{marginTop:10,color:'#adb5bd',fontSize:14}}>{statusText}</p>}
      {error && <p style={{marginTop:4,color:'red',fontSize:14}}>{error}</p>}

      {activePromoIndex != null && (
        <PromoVideoLightbox
          videos={promoVideos}
          activeIndex={activePromoIndex}
          onClose={handleClosePromo}
          onPrev={handlePrevPromo}
          onNext={handleNextPromo}
          onAddFavorite={handleFavoriteFromTeaser}
        />
      )}
    </StyledCenterVideochat>
  );
}
