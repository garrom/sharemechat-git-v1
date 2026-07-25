import React from 'react';
import i18n from '../../i18n';
import SessionHUD from '../../components/SessionHUD';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faVideo, faPhoneSlash, faForward, faPaperPlane, faBan, faFlag, faExpand } from '@fortawesome/free-solid-svg-icons';
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
  StyledGiftMessage,
  StyledGiftIcon,
  StyledRemoteVideo,
  StyledRemoteVideoMedia,
  StyledRemoteVideoPlaceholder,
  StyledTitleAvatar,
  StyledPaneCenter,
  StyledPaneCenterStack,
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
  StyledStatsPrecallCard,
  StyledStatsInline,
  StyledTierProgressCard,
  StyledTierProgressRow,
  StyledTierKpiCol,
  StyledTierKpiTitle,
  StyledTierKpiLine,
  StyledTierBarWrap,
  StyledTierBarTrack,
  StyledTierBarFill,
  StyledTierBarLegend,
  StyledTierPercentCol,
  StyledTierPercentValue,
} from '../../styles/pages-styles/VideochatStyles';

import {
  ButtonActivarCam,
  ButtonActivarCamMobile,
  ButtonBuscar,
  BtnSend,
  BtnCallDanger,
  BtnCallLight,
  BtnCallAlert,
  BtnCallGhost,
} from '../../styles/ButtonStyles';

export default function VideoChatRandomModelo(props) {
  const t = (key, options) => i18n.t(key, options);

  const {
    cameraActive,
    handleActivateCamera,
    localVideoRef,
    vcListRef,
    messages,
    giftRenderReady,
    getGiftIcon,
    remoteStream,
    isMobile,
    remoteVideoWrapRef,
    stopAll,
    searching,
    currentClientId,
    handleAddFavorite,
    clientAvatar,
    clientNickname,
    remoteVideoRef,
    sendRandomMediaReady,
    toggleFullscreen,
    handleStartMatch,
    chatInput,
    setChatInput,
    sendChatMessage,
    handleBlockPeer,
    handleReportPeer,
    error,
    modelEconomics,
    clientSaldo,
    clientSaldoLoading,
    handleNext,
    nextDisabled,
    // ADR-037 Bloque 5 Paso 1: TRIAL | PAID | null (sin peer). Cuando es TRIAL
    // pintamos badge FREE sobre el video del cliente para avisar que la
    // moderacion trial-only aplicara si muestra contenido explicito.
    currentClientAccessTier,
  } = props;

  const showTrialBadge = currentClientAccessTier === 'TRIAL';

  // ADR-037 Bloque 5 Paso 1 + ADR-052 Superficie 2 fase 2 (2026-07-25):
  // TrialBadge se integra INLINE dentro del StyledCallTopBar (a la
  // izquierda del avatar), no como overlay flotante, para no solaparse
  // con el HUD de sesion + saldo cliente + nickname que ya ocupan la
  // topbar. Formato compacto pill con el titulo unicamente; el subtitulo
  // pasa a tooltip (title) para no crecer verticalmente.
  const TrialBadge = () => (
    <span
      role="note"
      title={t('videochat.trial.modelBadge.subtitle')}
      aria-label={t('videochat.trial.modelBadge.subtitle')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid #22c55e',
        color: '#ffffff',
        fontSize: '0.78rem',
        fontWeight: 800,
        letterSpacing: 0.4,
        userSelect: 'none',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {t('videochat.trial.modelBadge.title')}
    </span>
  );

  const [isDesktopRemoteVideoReady, setIsDesktopRemoteVideoReady] = React.useState(false);

  // ADR-052 Superficie 2 (2026-07-25): acumulador local de ganancia por
  // regalos en la sesion activa. El WS trae el `cost` bruto del regalo;
  // aplicamos el %reparto vigente del tramo (modelEconomics.modelSharePct)
  // para reflejar lo que efectivamente ganara la modelo. Se resetea al
  // arrancar cada nueva llamada (remoteStream vira null -> stream).
  const [giftsSumEur, setGiftsSumEur] = React.useState(0);
  const seenGiftKeysRef = React.useRef(new Set());
  const sessionStartRef = React.useRef(null);

  React.useEffect(() => {
    if (remoteStream) {
      if (sessionStartRef.current == null) {
        sessionStartRef.current = Date.now();
        seenGiftKeysRef.current = new Set();
        setGiftsSumEur(0);
      }
    } else {
      sessionStartRef.current = null;
      seenGiftKeysRef.current = new Set();
      setGiftsSumEur(0);
    }
  }, [remoteStream]);

  React.useEffect(() => {
    if (!remoteStream) return;
    // Los regalos se reparten con `gift.model-share` (property backend,
    // default 0.90 = 90%), NO con el %reparto del tramo T1-T4. El backend
    // lo expone en modelEconomics.giftModelSharePct para no duplicar la
    // constante en frontend. Si no viene (compat rara), fallback a 90.
    const pctRaw = modelEconomics?.giftModelSharePct;
    const pct = Number.isFinite(Number(pctRaw)) && Number(pctRaw) > 0
      ? Number(pctRaw)
      : 90;
    if (!Array.isArray(messages)) return;
    let addedThisPass = 0;
    messages.forEach((m, idx) => {
      const g = m?.gift;
      if (!g) return;
      if (m.from !== 'peer') return;
      const cost = Number(g.cost);
      if (!Number.isFinite(cost) || cost <= 0) return;
      const key = `${idx}:${g.giftId ?? g.code ?? cost}`;
      if (seenGiftKeysRef.current.has(key)) return;
      seenGiftKeysRef.current.add(key);
      addedThisPass += (cost * pct) / 100;
    });
    if (addedThisPass > 0) {
      setGiftsSumEur((prev) => prev + addedThisPass);
    }
  }, [messages, remoteStream, modelEconomics?.giftModelSharePct]);

  React.useEffect(() => {
    if (!remoteStream || isMobile || !cameraActive) {
      setIsDesktopRemoteVideoReady(false);
      return;
    }

    setIsDesktopRemoteVideoReady(false);
  }, [cameraActive, isMobile, remoteStream]);

  // ADR-052 sub-frente 3.C iter.2 (2026-07-25): tierProgress reescrito
  // para hablar del nuevo regimen (T0-T3 + facturacion bruta EUR + %reparto)
  // en vez del sistema tier viejo por minutos. Consume `modelEconomics`
  // (ModelEconomicsDTO servido por PricingService.getEconomics).
  const tierProgress = React.useMemo(() => {
    if (!modelEconomics) {
      return {
        hasData: false,
        tierCode: null,
        modelSharePct: 0,
        billedGrossEur30d: 0,
        nextTierCode: null,
        nextTierMinBilledGrossEur30d: 0,
        remainingEur: 0,
        pct: 0,
      };
    }
    const billedGross = Number(modelEconomics.billedGrossEur30d || 0);
    const nextMin = Number(modelEconomics.nextTierMinBilledGrossEur30d || 0);
    const nextTier = modelEconomics.nextTierCode;
    const remainingEur = nextTier ? Math.max(0, nextMin - billedGross) : 0;
    const pct = nextTier
      ? Math.max(0, Math.min(100, (billedGross / Math.max(1, nextMin)) * 100))
      : 100;

    return {
      hasData: true,
      tierCode: modelEconomics.tierCode || null,
      modelSharePct: Number(modelEconomics.modelSharePct || 0),
      billedGrossEur30d: billedGross,
      nextTierCode: nextTier,
      nextTierMinBilledGrossEur30d: nextMin,
      remainingEur,
      pct,
    };
  }, [modelEconomics]);

  const normalizeGift = (gift) => {
    if (!gift) return null;

    const giftId = Number(gift.giftId ?? gift.id);
    if (!Number.isFinite(giftId) || giftId <= 0) return null;

    return {
      id: giftId,
      giftId,
      code: gift.code ?? null,
      name: gift.name || '',
      icon: gift.icon || null,
      cost: gift.cost ?? null,
      tier: String(gift.tier || 'QUICK').toUpperCase() === 'PREMIUM' ? 'PREMIUM' : 'QUICK',
      featured: gift.featured ?? null,
    };
  };

  const getGiftRenderData = (gift) => {
    const normalized = normalizeGift(gift);
    if (!normalized) return null;

    const fallbackIcon =
      !normalized.icon && giftRenderReady && typeof getGiftIcon === 'function'
        ? getGiftIcon(normalized)
        : null;
    return {
      ...normalized,
      icon: normalized.icon || fallbackIcon || null,
      isPremium: normalized.tier === 'PREMIUM',
    };
  };

  const renderGiftMessage = (gift) => {
    const renderData = getGiftRenderData(gift);
    if (!renderData?.icon) return null;

    return (
      <StyledGiftMessage $premium={renderData.isPremium}>
        <StyledGiftIcon src={renderData.icon} alt={renderData.name || ''} $premium={renderData.isPremium} />
      </StyledGiftMessage>
    );
  };

  const renderMessages = () => (
    messages.map((msg, index) => {
      const isMe = msg.from === 'me';
      const variant = isMe ? 'me' : 'peer';
      const giftData = getGiftRenderData(msg.gift);

      return (
        <StyledChatMessageRow key={msg.id || index}>
          {giftData ? (
            renderGiftMessage(giftData)
          ) : (
            <StyledChatBubble $variant={variant}>{msg.text}</StyledChatBubble>
          )}
        </StyledChatMessageRow>
      );
    })
  );

  const renderClientBalance = () => (
    clientSaldoLoading ? (
      <span>{t('dashboardModel.videoChatRandomModelo.labels.balance')} ...</span>
    ) : Number.isFinite(Number(clientSaldo)) ? (
      <span>{t('dashboardModel.videoChatRandomModelo.labels.balance')} EUR {Number(clientSaldo).toFixed(2)}</span>
    ) : (
      <span>{t('dashboardModel.videoChatRandomModelo.labels.balance')} -</span>
    )
  );

  const renderCallActions = () => (
    <StyledCallBottomBar>
      <StyledCallBottomInner>
        <StyledCallPrimaryActions>
          <BtnCallDanger
            onClick={stopAll}
            title={t('common.hangup')}
            aria-label={t('common.hangup')}
          >
            <FontAwesomeIcon icon={faPhoneSlash} />
          </BtnCallDanger>

          <BtnCallLight
            onClick={() => handleNext && handleNext()}
            disabled={!!nextDisabled}
            aria-disabled={!!nextDisabled}
            title={t('home.hero.nextAria')}
            aria-label={t('home.hero.nextAria')}
          >
            <FontAwesomeIcon icon={faForward} />
          </BtnCallLight>

          {currentClientId && (
            <BtnCallLight
              onClick={handleAddFavorite}
              aria-label={t('common.actions.addToFavorites')}
              title={t('common.actions.addToFavorites')}
            >
              <FontAwesomeIcon icon={faUserPlus} />
            </BtnCallLight>
          )}
        </StyledCallPrimaryActions>

        <StyledCallSecondaryActions>
          <BtnCallAlert
            type="button"
            onClick={() => handleReportPeer && handleReportPeer()}
            aria-label={t('modals.report.title')}
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

  const renderCallTopMeta = (hud = null) => (
    <StyledCallTopMeta>
      {showTrialBadge && <TrialBadge />}
      <StyledTitleAvatar src={clientAvatar || '/img/avatarChico.png'} alt="" />
      <div style={{display:'flex',flexDirection:'column',minWidth:0,lineHeight:1.15}}>
        <StyledCallTopMetaText>
          {clientNickname || t('dashboardModel.videoChatRandomModelo.labels.clientDefault')}
        </StyledCallTopMetaText>
        <div style={{fontSize:12,opacity:0.9,marginTop:2,color:'rgba(255,255,255,0.82)'}}>
          {renderClientBalance()}
        </div>
      </div>
      {hud}
    </StyledCallTopMeta>
  );

  const logLocalVideoEvent = (eventName, videoEl) => {
    const stream = videoEl?.srcObject || null;
    const tracks = Array.isArray(stream?.getTracks?.()) ? stream.getTracks() : [];
    const trackSummary = tracks.map((track) => ({
      kind: track.kind,
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
    }));

    console.log('[RANDOM_TRACE_LOCAL_VIDEO]', {
      role: 'model',
      event: eventName,
      readyState: videoEl?.readyState ?? null,
      networkState: videoEl?.networkState ?? null,
      paused: videoEl?.paused ?? null,
      currentTime: videoEl?.currentTime ?? null,
      trackCount: tracks.length,
      tracks: trackSummary,
    });
  };

  return (
    <StyledCenterVideochat>
      <StyledSplit2 data-mode={!isMobile && remoteStream ? 'full-remote' : 'split'}>
        <StyledPane data-side="left">
          {!isMobile && (
            !cameraActive ? (
              <StyledPaneCenter>
                <StyledPaneCenterStack>
                  <ButtonActivarCam onClick={handleActivateCamera}>
                    {t('dashboardModel.videoChatRandomModelo.actions.activateCamera')}
                  </ButtonActivarCam>
                  <StyledHelperLine style={{color:'#fff',justifyContent:'center'}}>
                    <FontAwesomeIcon icon={faVideo} />
                    {t('dashboardModel.videoChatRandomModelo.hints.activateCamera')}
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
                      onLoadedMetadata={(e) => logLocalVideoEvent('localVideoLoadedMetadata', e.currentTarget)}
                      onCanPlay={(e) => logLocalVideoEvent('localVideoCanPlay', e.currentTarget)}
                      onPlaying={(e) => logLocalVideoEvent('localVideoPlaying', e.currentTarget)}
                      onPause={(e) => logLocalVideoEvent('localVideoPause', e.currentTarget)}
                      onError={(e) => logLocalVideoEvent('localVideoError', e.currentTarget)}
                      style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                    />
                  </StyledPrecallLocalStage>
                </StyledPrecallVideoArea>
              )
            )
          )}
        </StyledPane>

        <StyledPane
          data-side="right"
          data-view={!cameraActive && !isMobile ? 'precall-stats' : (cameraActive ? 'call' : 'thumbs')}
          style={{position:'relative'}}
        >
          {!cameraActive ? (
            <>
              <StyledStatsPrecallCard>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <div style={{fontWeight:900,fontSize:16,color:'#fff',letterSpacing:'.2px'}}>
                    {t('dashboardModel.videoChatRandomModelo.stats.progressTitle')}
                  </div>
                </div>

                <StyledTierProgressCard>
                  {!tierProgress.hasData ? (
                    <StyledStatsInline>
                      <div>{t('dashboardModel.videoChatRandomModelo.stats.noTierData')}</div>
                    </StyledStatsInline>
                  ) : (
                    <>
                      <StyledTierProgressRow>
                        <StyledTierKpiCol>
                          <StyledTierKpiTitle>{t('dashboardModel.videoChatRandomModelo.stats.yourSituation')}</StyledTierKpiTitle>
                          <StyledTierKpiLine>
                            {t('dashboardModel.videoChatRandomModelo.stats.currentTramo')} <b>{tierProgress.tierCode || '—'}</b>
                          </StyledTierKpiLine>
                        </StyledTierKpiCol>

                        <StyledTierKpiCol>
                          <StyledTierKpiTitle>{t('dashboardModel.videoChatRandomModelo.stats.nextGoal')}</StyledTierKpiTitle>
                          {tierProgress.nextTierCode ? (
                            <StyledTierKpiLine>
                              {t('dashboardModel.videoChatRandomModelo.stats.nextTramo')} <b>{tierProgress.nextTierCode}</b>
                            </StyledTierKpiLine>
                          ) : (
                            <StyledTierKpiLine>
                              {t('dashboardModel.videoChatRandomModelo.stats.maxTier')}
                            </StyledTierKpiLine>
                          )}
                        </StyledTierKpiCol>

                        {tierProgress.nextTierCode && (
                          <StyledTierPercentCol>
                            <StyledTierPercentValue>
                              {tierProgress.pct.toLocaleString(undefined,{minimumFractionDigits:1,maximumFractionDigits:1})}%
                            </StyledTierPercentValue>
                          </StyledTierPercentCol>
                        )}
                      </StyledTierProgressRow>

                      <StyledTierBarWrap>
                        <StyledTierBarTrack>
                          <StyledTierBarFill style={{width:`${tierProgress.pct}%`}} />
                        </StyledTierBarTrack>
                      </StyledTierBarWrap>
                    </>
                  )}
                </StyledTierProgressCard>
              </StyledStatsPrecallCard>

              {isMobile && (
                <StyledPreCallCenter style={{position:'absolute',top:'70%',left:0,right:0,transform:'translateY(-50%)'}}>
                  <div>
                    <ButtonActivarCamMobile onClick={handleActivateCamera}>
                      {t('dashboardModel.videoChatRandomModelo.actions.activateCamera')}
                    </ButtonActivarCamMobile>
                    <StyledHelperLine style={{color:'#fff'}}>
                      <FontAwesomeIcon icon={faVideo} />
                      {t('dashboardModel.videoChatRandomModelo.hints.activateCamera')}
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
                        <ButtonBuscar onClick={handleStartMatch}>{t('common.actions.search')}</ButtonBuscar>
                        <StyledSearchHint>{t('dashboardModel.videoChatRandomModelo.hints.search')}</StyledSearchHint>
                      </>
                    ) : (
                      <>
                        <StyledSearchHint>{t('dashboardModel.videoChatRandomModelo.loading.searchingClient')}</StyledSearchHint>
                        <div style={{marginTop:8,display:'flex',justifyContent:'center'}}>
                          <BtnCallDanger
                            onClick={stopAll}
                            title={t('dashboardModel.videoChatRandomModelo.actions.stopSearch')}
                            aria-label={t('dashboardModel.videoChatRandomModelo.actions.stopSearch')}
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
                      style={{position:'relative',width:'100%',height:'100%',borderRadius:'18px 18px 0 0',overflow:'hidden',background:'#000'}}
                    >
                      <StyledCallStage>
                        <StyledCallTopBar>
                          {renderCallTopMeta(
                            <SessionHUD
                              variant="model"
                              active={!!remoteStream}
                              ratePerMin={Number(modelEconomics?.chosenRateEurPerMin)}
                              modelSharePct={Number(modelEconomics?.modelSharePct)}
                              giftsSum={giftsSumEur}
                              inline
                            />
                          )}
                          <StyledCallTopActions>
                            <BtnCallGhost
                              type="button"
                              onClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                              title={t('common.fullscreen')}
                              aria-label={t('common.fullscreen')}
                              style={{ width: 36, height: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
                            >
                              <FontAwesomeIcon icon={faExpand} />
                            </BtnCallGhost>
                          </StyledCallTopActions>
                        </StyledCallTopBar>

                        <StyledRemoteVideoMedia
                          ref={remoteVideoRef}
                          $ready={isDesktopRemoteVideoReady}
                          onLoadedMetadata={(e) => {
                            const el = e.currentTarget;
                            console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoLoadedMetadata readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                          }}
                          onCanPlay={(e) => {
                            const el = e.currentTarget;
                            console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoCanPlay readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                          }}
                          onPlaying={(e) => {
                            const el = e.currentTarget;
                            setIsDesktopRemoteVideoReady(true);
                            console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoPlaying readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                            sendRandomMediaReady?.();
                          }}
                          onError={(e) => {
                            const el = e.currentTarget;
                            console.warn(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoError readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} mediaError=${el?.error?.message || el?.error?.code || 'unknown'}`);
                          }}
                          autoPlay
                          playsInline
                          onDoubleClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                        />

                        {!isDesktopRemoteVideoReady && (
                          <StyledRemoteVideoPlaceholder>
                            Conectando...
                          </StyledRemoteVideoPlaceholder>
                        )}

                        {cameraActive && (
                          <StyledCallLocalVideo>
                            <video
                              ref={localVideoRef}
                              muted
                              autoPlay
                              playsInline
                              onLoadedMetadata={(e) => logLocalVideoEvent('localVideoLoadedMetadata', e.currentTarget)}
                              onCanPlay={(e) => logLocalVideoEvent('localVideoCanPlay', e.currentTarget)}
                              onPlaying={(e) => logLocalVideoEvent('localVideoPlaying', e.currentTarget)}
                              onPause={(e) => logLocalVideoEvent('localVideoPause', e.currentTarget)}
                              onError={(e) => logLocalVideoEvent('localVideoError', e.currentTarget)}
                              style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
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
                        placeholder={t('dashboardModel.videoChatRandomModelo.placeholders.message')}
                        autoComplete="off"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendChatMessage();
                          }
                        }}
                      />
                      <BtnSend type="button" onClick={sendChatMessage} aria-label={t('common.sendMessage')} title={t('common.sendMessage')}>
                        <FontAwesomeIcon icon={faPaperPlane} />
                      </BtnSend>
                    </StyledCallComposer>
                  </StyledCallFooterDesktop>
                </StyledCallCardDesktop>
              )}

              {remoteStream && isMobile && (
                <StyledVideoArea>
                  <StyledRemoteVideo
                    ref={remoteVideoWrapRef}
                    style={{position:'relative',width:'100%',overflow:'hidden',background:'#000'}}
                  >
                    <StyledCallStage>
                      <SessionHUD
                        variant="model"
                        active={!!remoteStream}
                        ratePerMin={Number(modelEconomics?.chosenRateEurPerMin)}
                        modelSharePct={Number(modelEconomics?.modelSharePct)}
                        giftsSum={giftsSumEur}
                      />
                      <StyledCallTopBar>
                        {renderCallTopMeta()}
                      </StyledCallTopBar>

                      <video
                        ref={remoteVideoRef}
                        onLoadedMetadata={(e) => {
                          const el = e.currentTarget;
                          console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoLoadedMetadata readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                        }}
                        onCanPlay={(e) => {
                          const el = e.currentTarget;
                          console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoCanPlay readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                        }}
                        onPlaying={(e) => {
                          const el = e.currentTarget;
                          console.log(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoPlaying readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} paused=${el?.paused ?? 'null'} currentTime=${el?.currentTime ?? 'null'}`);
                          sendRandomMediaReady?.();
                        }}
                        onError={(e) => {
                          const el = e.currentTarget;
                          console.warn(`[RANDOM_TRACE_MEDIA] ts=${Date.now()} role=model action=remoteVideoError readyState=${el?.readyState ?? 'null'} networkState=${el?.networkState ?? 'null'} mediaError=${el?.error?.message || el?.error?.code || 'unknown'}`);
                        }}
                        style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
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
                            onLoadedMetadata={(e) => logLocalVideoEvent('localVideoLoadedMetadata', e.currentTarget)}
                            onCanPlay={(e) => logLocalVideoEvent('localVideoCanPlay', e.currentTarget)}
                            onPlaying={(e) => logLocalVideoEvent('localVideoPlaying', e.currentTarget)}
                            onPause={(e) => logLocalVideoEvent('localVideoPause', e.currentTarget)}
                            onError={(e) => logLocalVideoEvent('localVideoError', e.currentTarget)}
                            style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
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
            placeholder={t('dashboardModel.videoChatRandomModelo.placeholders.message')}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
              }
            }}
          />
          <BtnSend data-send-button="true" type="button" onClick={sendChatMessage} aria-label={t('common.sendMessage')} title={t('common.sendMessage')}>
            <FontAwesomeIcon icon={faPaperPlane} />
          </BtnSend>
        </StyledChatDock>
      )}

      {error && <p style={{color:'red',marginTop:'10px'}}>{error}</p>}
    </StyledCenterVideochat>
  );
}
