import React from 'react';
import i18n from '../../i18n';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faVideo, faPhoneSlash, faForward, faPaperPlane, faBan, faFlag } from '@fortawesome/free-solid-svg-icons';
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
    modelStatsSummary,
    modelStatsTiers,
    clientSaldo,
    clientSaldoLoading,
    handleNext,
    nextDisabled,
  } = props;

  const tierProgress = React.useMemo(() => {
    const billed = Number(modelStatsSummary?.billedMinutes30d || 0);

    const tiers = Array.isArray(modelStatsTiers) ? modelStatsTiers : [];
    const ordered = [...tiers]
      .filter((tier) => tier && (tier.active === true || tier.active === false))
      .sort((a, b) => Number(a?.minBilledMinutes || 0) - Number(b?.minBilledMinutes || 0));

    if (!ordered.length) {
      return { billed, hasTiers: false, currentTier: null, nextTier: null, remaining: 0, pct: 0 };
    }

    const byName = ordered.find((tier) => String(tier?.name || '') === String(modelStatsSummary?.tierName || ''));

    let byMinutes = null;
    for (const tier of ordered) {
      if (Number(tier?.minBilledMinutes || 0) <= billed) byMinutes = tier;
    }

    const currentTier = byName || byMinutes || ordered[0] || null;
    const currentMin = Number(currentTier?.minBilledMinutes || 0);
    const nextTier = ordered.find((tier) => Number(tier?.minBilledMinutes || 0) > currentMin) || null;
    const nextMin = Number(nextTier?.minBilledMinutes || 0);
    const remaining = nextTier ? Math.max(0, nextMin - billed) : 0;

    const pct = nextTier
      ? Math.max(0, Math.min(100, (billed / Math.max(1, nextMin)) * 100))
      : 100;

    return { billed, hasTiers: true, currentTier, nextTier, remaining, pct };
  }, [modelStatsSummary, modelStatsTiers]);

  const renderMessages = () => (
    messages.map((msg, index) => {
      const isMe = msg.from === 'me';
      const variant = isMe ? 'me' : 'peer';

      return (
        <StyledChatMessageRow key={index}>
          {msg.gift ? (
            <StyledGiftMessage>
              {giftRenderReady &&
                (() => {
                  const src = getGiftIcon(msg.gift);
                  const isPremium = typeof src === 'string' && src.toLowerCase().includes('.png');
                  return src ? <StyledGiftIcon src={src} alt="" $premium={isPremium} /> : null;
                })()}
            </StyledGiftMessage>
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

  const renderCallTopMeta = () => (
    <StyledCallTopMeta>
      <StyledTitleAvatar src={clientAvatar || '/img/avatarChico.png'} alt="" />
      <div style={{display:'flex',flexDirection:'column',minWidth:0,lineHeight:1.15}}>
        <StyledCallTopMetaText>
          {clientNickname || t('dashboardModel.videoChatRandomModelo.labels.clientDefault')}
        </StyledCallTopMetaText>
        <div style={{fontSize:12,opacity:0.9,marginTop:2,color:'rgba(255,255,255,0.82)'}}>
          {renderClientBalance()}
        </div>
      </div>
    </StyledCallTopMeta>
  );

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
                  <div style={{fontSize:14,color:'rgba(255,255,255,.85)'}}>
                    {t('dashboardModel.videoChatRandomModelo.stats.progressSubtitle')}
                  </div>
                </div>

                <StyledTierProgressCard>
                  {!tierProgress.hasTiers ? (
                    <StyledStatsInline>
                      <div>{t('dashboardModel.videoChatRandomModelo.stats.noTierData')}</div>
                      <div>
                        {t('dashboardModel.videoChatRandomModelo.stats.currentMinutes30d')} <b>{Number(modelStatsSummary?.billedMinutes30d || 0)}</b>
                      </div>
                    </StyledStatsInline>
                  ) : (
                    <>
                      <StyledTierProgressRow>
                        <StyledTierKpiCol>
                          <StyledTierKpiTitle>{t('dashboardModel.videoChatRandomModelo.stats.yourSituation')}</StyledTierKpiTitle>
                          <StyledTierKpiLine>
                            {t('dashboardModel.videoChatRandomModelo.stats.currentMinutes')} <b>{tierProgress.billed}</b>
                          </StyledTierKpiLine>
                          <StyledTierKpiLine>
                            {t('dashboardModel.videoChatRandomModelo.stats.detectedTier')} <b>{tierProgress.currentTier?.name || modelStatsSummary?.tierName || '-'}</b>
                          </StyledTierKpiLine>
                        </StyledTierKpiCol>

                        <StyledTierKpiCol>
                          <StyledTierKpiTitle>{t('dashboardModel.videoChatRandomModelo.stats.nextGoal')}</StyledTierKpiTitle>
                          {tierProgress.nextTier ? (
                            <>
                              <StyledTierKpiLine>
                                {t('dashboardModel.videoChatRandomModelo.stats.nextTier')} <b>{tierProgress.nextTier?.name || '-'}</b>
                              </StyledTierKpiLine>
                              <StyledTierKpiLine>
                                {t('dashboardModel.videoChatRandomModelo.stats.requirement')} <b>{Number(tierProgress.nextTier?.minBilledMinutes || 0)}</b> {t('dashboardModel.videoChatRandomModelo.stats.minutesShort')}
                              </StyledTierKpiLine>
                              <StyledTierKpiLine>
                                {t('dashboardModel.videoChatRandomModelo.stats.remaining')} <b>{tierProgress.remaining}</b> {t('dashboardModel.videoChatRandomModelo.stats.minutesShort')}
                              </StyledTierKpiLine>
                            </>
                          ) : (
                            <StyledTierKpiLine>
                              {t('dashboardModel.videoChatRandomModelo.stats.maxTier')}
                            </StyledTierKpiLine>
                          )}
                        </StyledTierKpiCol>
                      </StyledTierProgressRow>

                      <StyledTierBarWrap>
                        <StyledTierBarTrack>
                          <StyledTierBarFill style={{width:`${tierProgress.pct}%`}} />
                        </StyledTierBarTrack>

                        <StyledTierBarLegend>
                          <span>{tierProgress.billed} {t('dashboardModel.videoChatRandomModelo.stats.minutesShort')}</span>
                          <span>
                            {tierProgress.nextTier ? `${Number(tierProgress.nextTier?.minBilledMinutes || 0)} ${t('dashboardModel.videoChatRandomModelo.stats.minutesShort')}` : '-'}
                          </span>
                        </StyledTierBarLegend>
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
                          {renderCallTopMeta()}
                          <StyledCallTopActions>
                            <BtnCallGhost
                              type="button"
                              onClick={() => toggleFullscreen(remoteVideoWrapRef.current)}
                              title={t('common.fullscreen')}
                              aria-label={t('common.fullscreen')}
                            >
                              {t('common.fullscreen')}
                            </BtnCallGhost>
                          </StyledCallTopActions>
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
                            style={{width:'100%',objectFit:'cover',display:'block'}}
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
