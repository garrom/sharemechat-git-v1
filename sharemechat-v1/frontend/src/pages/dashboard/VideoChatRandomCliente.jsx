import React, { useState, useEffect } from 'react';
import i18n from '../../i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import BlurredPreview from '../../components/BlurredPreview';
import {
  faUserPlus,
  faVideo,
  faPhoneSlash,
  faForward,
  faPaperPlane,
  faGift,
  faChevronLeft,
  faChevronRight,
  faBan,
  faFlag
} from '@fortawesome/free-solid-svg-icons';
import {
  StyledCenterVideochat,
  StyledSplit2,
  StyledPane,
  StyledVideoArea,
  StyledPrecallVideoArea,
  StyledPrecallLocalStage,
  StyledChatContainer,
  StyledChatList,
  StyledChatMessageRow,
  StyledChatBubble,
  StyledChatDock,
  StyledChatInput,
  StyledGiftsPanel,
  StyledGiftCatalog,
  StyledGiftSection,
  StyledGiftSectionTitle,
  StyledGiftMessage,
  StyledGiftGrid,
  StyledGiftIcon,
  StyledRemoteVideo,
  StyledTitleAvatar,
  StyledPaneCenter,
  StyledPaneCenterStack,
  StyledStatusText,
  StyledPreCallCenter,
  StyledHelperLine,
  StyledRandomSearchControls,
  StyledRandomSearchCol,
  StyledSearchHint,
  StyledCallCardDesktop,
  StyledCallVideoArea,
  StyledCallFooterDesktop,
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
  ButtonRegalo,
  BtnSend,
  BtnCallDanger,
  BtnCallLight,
  BtnCallAlert,
  BtnCallGhost,
  BtnTeaserPrev,
  BtnTeaserNext
} from '../../styles/ButtonStyles';
import PromoVideoLightbox from '../../components/PromoVideoLightbox';
import { useSession } from '../../components/SessionProvider';
import { apiFetch } from '../../config/http';

export default function VideoChatRandomCliente(props) {
  const t = (key, options) => i18n.t(key, options);

  const {
    isMobile,
    cameraActive,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    vcListRef,
    messages,
    modelNickname,
    giftRenderReady,
    getGiftIcon,
    chatInput,
    setChatInput,
    sendChatMessage,
    showGifts,
    setShowGifts,
    gifts,
    sendGiftMatch,
    fmtEUR,
    searching,
    stopAll,
    handleStartMatch,
    handleNext,
    handleAddFavorite,
    error,
    toggleFullscreen,
    remoteVideoWrapRef,
    modelAvatar,
    handleActivateCamera,
    handleBlockPeer,
    matchGraceRef,
    sendRandomMediaReady,
    nextDisabled,
    handleReportPeer
  } = props;

  const { user: sessionUser, loading: sessionLoading } = useSession();

  const [promoVideos, setPromoVideos] = useState([]);
  const [activePromoIndex, setActivePromoIndex] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [currentPromoIndex, setCurrentPromoIndex] = useState(0);

  const fetchTeasers = async () => {
    setPromoLoading(true);
    setPromoError('');
    try {
      const data = await apiFetch('/models/teasers?page=0&size=20');

      const mapped = (Array.isArray(data) ? data : []).map((item) => ({
        id: item.modelId,
        title: t('dashboardClient.videoChatRandomCliente.promoTeaserTitle', { name: item.modelName }),
        modelName: item.modelName,
        thumb: item.avatarUrl || '/img/avatarChica.png',
        src: item.videoUrl,
        durationSec: null,
      }));

      setPromoVideos(mapped);
      if (mapped.length > 0) setCurrentPromoIndex(0);
    } catch (e) {
      setPromoError(e?.message || t('dashboardClient.videoChatRandomCliente.errors.loadPromoVideos'));
    } finally {
      setPromoLoading(false);
    }
  };

  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser?.id) return;

    fetchTeasers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, sessionUser?.id]);

  const handleOpenPromo = (index) => {
    setActivePromoIndex(index);
  };

  const handleClosePromo = () => {
    setActivePromoIndex(null);
  };

  const handlePrevPromo = () => {
    setActivePromoIndex((idx) => (idx > 0 ? idx - 1 : idx));
  };

  const handleNextPromo = () => {
    setActivePromoIndex((idx) => (idx < promoVideos.length - 1 ? idx + 1 : idx));
  };

  const goPrevCard = () => {
    if (promoVideos.length === 0) return;
    setCurrentPromoIndex((idx) => (idx > 0 ? idx - 1 : promoVideos.length - 1));
  };

  const goNextCard = () => {
    if (promoVideos.length === 0) return;
    setCurrentPromoIndex((idx) => (idx < promoVideos.length - 1 ? idx + 1 : 0));
  };

  const currentPromo =
    promoVideos.length > 0 ? promoVideos[Math.min(currentPromoIndex, promoVideos.length - 1)] : null;

  const handleAddFavoriteFromTeaser = (promoVideo) => {
    if (!promoVideo || !promoVideo.id) return;
    if (typeof handleAddFavorite === 'function') {
      handleAddFavorite(promoVideo.id);
    }
  };

  const normalizeGiftTier = (gift) =>
    String(gift?.tier || 'QUICK').toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'QUICK';

  const normalizeMessageGift = (gift) => {
    if (!gift) return null;

    const giftId = Number(gift.giftId ?? gift.id);
    const safeId = Number.isFinite(giftId) ? giftId : null;

    return {
      id: safeId,
      giftId: safeId,
      code: gift.code ?? null,
      name: gift.name ?? '',
      icon: gift.icon ?? null,
      cost: gift.cost ?? null,
      tier: gift.tier ?? null,
      featured: gift.featured ?? null,
    };
  };

  const resolveGiftVisual = (gift) => {
    const normalized = normalizeMessageGift(gift);
    if (!normalized) return null;

    const directIcon = normalized.icon || null;
    const fallbackIcon =
      !directIcon && giftRenderReady && typeof getGiftIcon === 'function'
        ? getGiftIcon(normalized)
        : null;
    const src = directIcon || fallbackIcon || null;

    const tier = normalizeGiftTier(normalized);
    const isPremium = tier === 'PREMIUM';

    return {
      ...normalized,
      icon: src,
      tier,
      isPremium,
    };
  };

  const renderGiftVisual = (gift) => {
    const visual = resolveGiftVisual(gift);
    if (!visual?.icon) return null;

    return (
      <StyledGiftMessage $premium={visual.isPremium}>
        <StyledGiftIcon src={visual.icon} alt={visual.name || ''} $premium={visual.isPremium} />
      </StyledGiftMessage>
    );
  };

  const renderMessages = () =>
    messages.map((msg, index) => {
      const isMe = msg.from === 'me';
      const variant = isMe ? 'me' : 'peer';
      const giftVisual = msg.gift ? renderGiftVisual(msg.gift) : null;

      return (
        <StyledChatMessageRow key={msg.id || index}>
          {giftVisual ? (
            giftVisual
          ) : (
            <StyledChatBubble $variant={variant}>{msg.text}</StyledChatBubble>
          )}
        </StyledChatMessageRow>
      );
    });

  const renderCallActions = () => (
    <StyledCallBottomBar>
      <StyledCallBottomInner>
        <StyledCallPrimaryActions>
          <BtnCallDanger
            onClick={stopAll}
            title={t('dashboardClient.videoChatRandomCliente.actions.hangup')}
            aria-label={t('dashboardClient.videoChatRandomCliente.actions.hangup')}
          >
            <FontAwesomeIcon icon={faPhoneSlash} />
          </BtnCallDanger>

          <BtnCallLight
            onClick={handleNext}
            disabled={!!nextDisabled}
            aria-disabled={!!nextDisabled}
            title={t('home.hero.nextAria')}
            aria-label={t('home.hero.nextAria')}
          >
            <FontAwesomeIcon icon={faForward} />
          </BtnCallLight>

          <BtnCallLight
            onClick={() => handleAddFavorite && handleAddFavorite()}
            aria-label={t('common.actions.addToFavorites')}
            title={t('common.actions.addToFavorites')}
          >
            <FontAwesomeIcon icon={faUserPlus} />
          </BtnCallLight>
        </StyledCallPrimaryActions>

        <StyledCallSecondaryActions>
          <BtnCallAlert
            type="button"
            onClick={() => handleReportPeer && handleReportPeer()}
            aria-label={t('dashboardUserClient.report.title')}
            title={t('modals.report.title')}
          >
            <FontAwesomeIcon icon={faFlag} />
          </BtnCallAlert>

          <BtnCallAlert
            type="button"
            onClick={() => handleBlockPeer && handleBlockPeer()}
            aria-label={t('modals.block.title')}
            title={t('modals.block.title')}
          >
            <FontAwesomeIcon icon={faBan} />
          </BtnCallAlert>
        </StyledCallSecondaryActions>
      </StyledCallBottomInner>
    </StyledCallBottomBar>
  );

  const quickGifts = gifts.filter((gift) => normalizeGiftTier(gift) === 'QUICK');
  const premiumGifts = gifts.filter((gift) => normalizeGiftTier(gift) === 'PREMIUM');

  const renderGiftSection = (title, items) => {
    if (!items.length) return null;

    return (
      <StyledGiftSection>
        <StyledGiftSectionTitle>{title}</StyledGiftSectionTitle>
        <StyledGiftGrid>
          {items.map((g) => (
            <button key={g.id} type="button" onClick={() => sendGiftMatch(g.id)}>
              {g.featured === true && <span className="gift-card__badge">Featured</span>}
              <div className="gift-card__media">
                <img src={g.icon} alt={g.name} />
              </div>
              <div className="gift-card__meta">
                <div className="gift-card__name">{g.name}</div>
                <div className="gift-card__cost">{fmtEUR(g.cost)}</div>
              </div>
            </button>
          ))}
        </StyledGiftGrid>
      </StyledGiftSection>
    );
  };

  const renderGiftPicker = () => (
    <StyledGiftsPanel>
      <StyledGiftCatalog>
        {renderGiftSection('Quick', quickGifts)}
        {renderGiftSection('Premium', premiumGifts)}
      </StyledGiftCatalog>
    </StyledGiftsPanel>
  );

  return (
    <StyledCenterVideochat>
      <StyledSplit2 data-mode={!isMobile && remoteStream ? 'full-remote' : 'split'}>
        <StyledPane data-side="left">
          {!isMobile &&
            (!cameraActive ? (
              <StyledPaneCenter>
                <StyledPaneCenterStack>
                  <ButtonActivarCam onClick={handleActivateCamera}>
                    {t('dashboardClient.videoChatRandomCliente.actions.activateCamera')}
                  </ButtonActivarCam>
                  <StyledHelperLine style={{ color: '#fff', justifyContent: 'center' }}>
                    <FontAwesomeIcon icon={faVideo} />
                    {t('dashboardClient.videoChatRandomCliente.hints.activateCamera')}
                  </StyledHelperLine>
                </StyledPaneCenterStack>
              </StyledPaneCenter>
            ) : (
              !remoteStream && (
                <StyledPrecallVideoArea>
                  <StyledPrecallLocalStage>
                    <video
                      ref={localVideoRef}
                      muted
                      autoPlay
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </StyledPrecallLocalStage>
                </StyledPrecallVideoArea>
              )
            ))}
        </StyledPane>

        <StyledPane
          data-side="right"
          data-view={cameraActive ? 'call' : 'thumbs'}
          style={{ position: 'relative' }}
        >
          {!cameraActive ? (
            <>
              {promoLoading && promoVideos.length === 0 && (
                <StyledStatusText>
                  {t('dashboardClient.videoChatRandomCliente.loading.promoVideos')}
                </StyledStatusText>
              )}

              {promoError && (
                <StyledStatusText $tone="error">{promoError}</StyledStatusText>
              )}

              {currentPromo && (
                <StyledTeaserCenter>
                  <StyledTeaserInner>
                    <StyledTeaserCard>
                      <StyledTeaserNavSlot $side="left">
                        <BtnTeaserPrev
                          type="button"
                          onClick={goPrevCard}
                          aria-label={t('home.hero.prevAria')}
                          title={t('home.hero.prevAria')}
                        >
                          <FontAwesomeIcon icon={faChevronLeft} />
                        </BtnTeaserPrev>
                      </StyledTeaserNavSlot>

                      <StyledTeaserMediaButton
                        type="button"
                        onClick={() => handleOpenPromo(currentPromoIndex)}
                        title={currentPromo.title || t('dashboardClient.videoChatRandomCliente.actions.viewTeaser')}
                      >
                        <BlurredPreview
                          type="video"
                          src={currentPromo.src}
                          poster={currentPromo.thumb || '/img/avatarChica.png'}
                          muted={true}
                          autoPlay={true}
                          loop={true}
                          playsInline={true}
                          controls={false}
                          showVignette={true}
                          style={{ width: '100%', height: '100%' }}
                        />
                      </StyledTeaserMediaButton>

                      <StyledTeaserFavoriteSlot>
                        <BtnCallLight
                          type="button"
                          onClick={() => currentPromo && handleAddFavorite(currentPromo.id)}
                          aria-label={t('common.actions.addToFavorites')}
                          title={t('common.actions.addToFavorites')}
                        >
                          <FontAwesomeIcon icon={faUserPlus} />
                        </BtnCallLight>
                      </StyledTeaserFavoriteSlot>

                      <StyledTeaserNavSlot $side="right">
                        <BtnTeaserNext
                          type="button"
                          onClick={goNextCard}
                          aria-label={t('home.hero.nextAria')}
                          title={t('home.hero.nextAria')}
                        >
                          <FontAwesomeIcon icon={faChevronRight} />
                        </BtnTeaserNext>
                      </StyledTeaserNavSlot>
                    </StyledTeaserCard>
                  </StyledTeaserInner>
                </StyledTeaserCenter>
              )}

              {!promoLoading && !promoError && promoVideos.length === 0 && (
                <StyledStatusText>
                  {t('dashboardClient.videoChatRandomCliente.empty.promoVideos')}
                </StyledStatusText>
              )}

              {isMobile && (
                <StyledPreCallCenter
                  style={{ position: 'absolute', top: '70%', left: 0, right: 0, transform: 'translateY(-50%)' }}
                >
                  <div>
                    <ButtonActivarCamMobile onClick={handleActivateCamera}>
                      {t('dashboardClient.videoChatRandomCliente.actions.activateCamera')}
                    </ButtonActivarCamMobile>
                    <StyledHelperLine style={{ color: '#fff' }}>
                      <FontAwesomeIcon icon={faVideo} />
                      {t('dashboardClient.videoChatRandomCliente.hints.activateCamera')}
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
                        <ButtonBuscar onClick={handleStartMatch}>
                          {t('dashboardClient.videoChatRandomCliente.actions.search')}
                        </ButtonBuscar>
                        <StyledSearchHint>
                          {t('dashboardClient.videoChatRandomCliente.hints.search')}
                        </StyledSearchHint>
                      </>
                    ) : (
                      <>
                        <StyledSearchHint>
                          {t('dashboardClient.videoChatRandomCliente.loading.searchingModel')}
                        </StyledSearchHint>
                        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
                          <BtnCallDanger
                            onClick={stopAll}
                            title={t('dashboardClient.videoChatRandomCliente.actions.stopSearch')}
                            aria-label={t('dashboardClient.videoChatRandomCliente.actions.stopSearch')}
                          >
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
                    <StyledRemoteVideo
                      ref={remoteVideoWrapRef}
                      style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '18px 18px 0 0', overflow: 'hidden', background: '#000' }}
                    >
                      <StyledCallStage>
                        <StyledCallTopBar>
                          <StyledCallTopMeta>
                            <StyledTitleAvatar src={modelAvatar || '/img/avatarChica.png'} alt="" />
                            <StyledCallTopMetaText>
                              {modelNickname || t('dashboardUserClient.report.displayName')}
                            </StyledCallTopMetaText>
                          </StyledCallTopMeta>
                          <StyledCallTopActions>
                            <BtnCallGhost
                              type="button"
                              onClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                              title={t('dashboardClient.videoChatRandomCliente.actions.fullscreen')}
                              aria-label={t('dashboardClient.videoChatRandomCliente.actions.fullscreen')}
                            >
                              {t('dashboardClient.videoChatRandomCliente.actions.fullscreen')}
                            </BtnCallGhost>
                          </StyledCallTopActions>
                        </StyledCallTopBar>

                        <video
                          ref={remoteVideoRef}
                          onLoadedMetadata={(e) => {
                            const el = e.currentTarget;
                            console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoLoadedMetadata readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                          }}
                          onCanPlay={(e) => {
                            const el = e.currentTarget;
                            console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoCanPlay readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                          }}
                          onPlaying={() => {
                            const el = remoteVideoRef?.current;
                            console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoPlaying readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                            sendRandomMediaReady?.();
                            if (matchGraceRef) matchGraceRef.current = false;
                          }}
                          onError={(e) => {
                            const el = e.currentTarget;
                            console.warn(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoError readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} mediaError=${el?.error?.message || el?.error?.code || 'unknown'}`);
                          }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          autoPlay
                          playsInline
                          onDoubleClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                        />

                        {cameraActive && (
                          <StyledCallLocalVideo>
                            <video
                              ref={localVideoRef}
                              muted
                              autoPlay
                              playsInline
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          </StyledCallLocalVideo>
                        )}

                        {cameraActive && renderCallActions()}

                        <StyledChatContainer data-wide="true">
                          <StyledChatList ref={vcListRef}>
                            {renderMessages()}
                          </StyledChatList>
                        </StyledChatContainer>
                      </StyledCallStage>
                    </StyledRemoteVideo>
                  </StyledCallVideoArea>

                  <StyledCallFooterDesktop>
                    <StyledCallComposer>
                      <StyledChatInput
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={t('dashboardClient.videoChatRandomCliente.placeholders.message')}
                        autoComplete="off"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendChatMessage();
                          }
                        }}
                      />
                      <BtnSend
                        type="button"
                        onClick={sendChatMessage}
                        aria-label={t('dashboardClient.videoChatRandomCliente.actions.sendMessage')}
                        title={t('dashboardClient.videoChatRandomCliente.actions.sendMessage')}
                      >
                        <FontAwesomeIcon icon={faPaperPlane} />
                      </BtnSend>
                      <ButtonRegalo
                        type="button"
                        onClick={() => setShowGifts((s) => !s)}
                        title={t('dashboardClient.videoChatRandomCliente.actions.sendGift')}
                        aria-label={t('dashboardClient.videoChatRandomCliente.actions.sendGift')}
                      >
                        <FontAwesomeIcon icon={faGift} />
                      </ButtonRegalo>
                      {showGifts && renderGiftPicker()}
                    </StyledCallComposer>
                  </StyledCallFooterDesktop>
                </StyledCallCardDesktop>
              )}

              {remoteStream && isMobile && (
                <StyledVideoArea>
                  <StyledRemoteVideo
                    ref={remoteVideoWrapRef}
                    style={{ position: 'relative', width: '100%', overflow: 'hidden', background: '#000' }}
                  >
                    <StyledCallStage>
                      <StyledCallTopBar>
                        <StyledCallTopMeta>
                          <StyledTitleAvatar src={modelAvatar || '/img/avatarChica.png'} alt="" />
                          <StyledCallTopMetaText>
                            {modelNickname || t('dashboardUserClient.report.displayName')}
                          </StyledCallTopMetaText>
                        </StyledCallTopMeta>
                      </StyledCallTopBar>

                      <video
                        ref={remoteVideoRef}
                        onLoadedMetadata={(e) => {
                          const el = e.currentTarget;
                          console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoLoadedMetadata readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                        }}
                        onCanPlay={(e) => {
                          const el = e.currentTarget;
                          console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoCanPlay readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                        }}
                        onPlaying={() => {
                          const el = remoteVideoRef?.current;
                          console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoPlaying readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                          sendRandomMediaReady?.();
                          if (matchGraceRef) matchGraceRef.current = false;
                        }}
                        onError={(e) => {
                          const el = e.currentTarget;
                          console.warn(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=client action=remoteVideoError readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} mediaError=${el?.error?.message || el?.error?.code || 'unknown'}`);
                        }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        autoPlay
                        playsInline
                        onDoubleClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                      />

                      {cameraActive && (
                        <StyledCallLocalVideo>
                          <video
                            ref={localVideoRef}
                            muted
                            autoPlay
                            playsInline
                            style={{ width: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </StyledCallLocalVideo>
                      )}

                      {cameraActive && renderCallActions()}

                      <StyledChatContainer data-wide="true">
                        <StyledChatList ref={vcListRef}>
                          {renderMessages()}
                        </StyledChatList>
                      </StyledChatContainer>
                    </StyledCallStage>
                  </StyledRemoteVideo>
                </StyledVideoArea>
              )}
            </>
          )}
        </StyledPane>
      </StyledSplit2>

      {remoteStream && isMobile && (
        <StyledChatDock data-surface="call-dark">
          <StyledChatInput
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={t('dashboardClient.videoChatRandomCliente.placeholders.message')}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
              }
            }}
          />

          <BtnSend
            data-send-button="true"
            type="button"
            onClick={sendChatMessage}
            aria-label={t('dashboardClient.videoChatRandomCliente.actions.sendMessage')}
            title={t('dashboardClient.videoChatRandomCliente.actions.sendMessage')}
          >
            <FontAwesomeIcon icon={faPaperPlane} />
          </BtnSend>

          <ButtonRegalo
            type="button"
            data-gift-button="true"
            onClick={() => setShowGifts((s) => !s)}
            title={t('dashboardClient.videoChatRandomCliente.actions.sendGift')}
            aria-label={t('dashboardClient.videoChatRandomCliente.actions.sendGift')}
          >
            <FontAwesomeIcon icon={faGift} />
          </ButtonRegalo>

          {showGifts && renderGiftPicker()}
        </StyledChatDock>
      )}

      {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}

      {activePromoIndex != null && (
        <PromoVideoLightbox
          videos={promoVideos}
          activeIndex={activePromoIndex}
          onClose={handleClosePromo}
          onPrev={handlePrevPromo}
          onNext={handleNextPromo}
          onAddFavorite={handleAddFavoriteFromTeaser}
        />
      )}
    </StyledCenterVideochat>
  );
}
