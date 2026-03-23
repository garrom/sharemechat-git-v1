import React, { useEffect, useState } from 'react';
import i18n from '../../i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { TEASERS_PAGE_SIZE, TEASERS_PAGE_DEFAULT } from '../../config/appConfig';
import {
  faUserPlus,
  faVideo,
  faPhoneSlash,
  faForward,
  faChevronLeft,
  faChevronRight,
  faFlag
} from '@fortawesome/free-solid-svg-icons';

import {
  StyledCenterVideochat,
  StyledSplit2,
  StyledPane,
  StyledVideoArea,
  StyledPrecallVideoArea,
  StyledPrecallLocalStage,
  StyledRemoteVideo,
  StyledTitleAvatar,
  StyledPreCallCenter,
  StyledHelperLine,
  StyledRandomSearchControls,
  StyledRandomSearchCol,
  StyledSearchHint,
  StyledPaneCenter,
  StyledPaneCenterStack,
  StyledStatusText,
  StyledCallCardDesktop,
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
  BtnTeaserNext
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
    modelNickname,
    modelAvatar,
    handleFavoriteGate,
    openPurchaseModal,
    handleReportPeer,
  } = props;

  const [promoVideos, setPromoVideos] = useState([]);
  const [activePromoIndex, setActivePromoIndex] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);

  const fetchTeasers = async () => {
    setPromoLoading(true);
    setPromoError('');

    try {
      const res = await fetch(`/api/models/teasers?page=${TEASERS_PAGE_DEFAULT}&size=${TEASERS_PAGE_SIZE}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || t('dashboardUserClient.videoChatRandomUser.errors.loadPromoVideos'));
      }

      const data = await res.json();
      const mapped = (Array.isArray(data) ? data : []).map((item) => ({
        id: item.modelId,
        title: t('dashboardUserClient.videoChatRandomUser.promoTeaserTitle', { name: item.modelName }),
        modelName: item.modelName,
        thumb: item.avatarUrl || '/img/avatarChica.png',
        src: item.videoUrl,
        durationSec: null
      }));

      setPromoVideos(mapped);
      if (mapped.length > 0) setCurrentPromoIndex(0);
    } catch (e) {
      setPromoError(e?.message || t('dashboardUserClient.videoChatRandomUser.errors.loadPromoVideos'));
      setPromoVideos([]);
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

  return (
    <StyledCenterVideochat>
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
                <StyledCallCardDesktop>
                  <StyledCallVideoArea>
                    <StyledRemoteVideo ref={remoteVideoWrapRef} style={{position:'relative',width:'100%',height:'100%',borderRadius:'18px 18px 0 0',overflow:'hidden',background:'#000'}}>
                      <StyledCallStage>
                        <StyledCallTopBar>
                          {renderCallTopMeta()}
                          <StyledCallTopActions>
                            <BtnCallGhost type="button" onClick={() => toggleFullscreen(remoteVideoWrapRef.current)} title={t('dashboardUserClient.videoChatRandomUser.actions.fullscreen')} aria-label={t('dashboardUserClient.videoChatRandomUser.actions.fullscreen')}>
                              {t('dashboardUserClient.videoChatRandomUser.actions.fullscreen')}
                            </BtnCallGhost>
                          </StyledCallTopActions>
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
                  </StyledCallVideoArea>

                  <StyledCallFooterDesktop>
                    <StyledCallComposer>
                      <div style={{width:'100%',textAlign:'center',fontSize:14,color:'rgba(255,255,255,0.74)'}}>
                        {statusText || t('dashboardUserClient.videoChatRandomUser.status.default')}
                      </div>
                    </StyledCallComposer>
                  </StyledCallFooterDesktop>
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
