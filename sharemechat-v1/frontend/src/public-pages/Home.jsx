import React, { useState, useEffect } from 'react';
import i18n from '../i18n';
import BlurredPreview from '../components/BlurredPreview';
import { useLocation } from 'react-router-dom';
import { useSession } from '../components/SessionProvider';
import useAppModals from '../components/useAppModals';
import PublicNavbar from '../components/navbar/PublicNavbar';
import {
  GlobalBlack,
  HomeCallControl,
  HomeCallControls,
  HomeCallFloating,
  HomeCallTopbar,
  HomeCallVideo,
  HomeCallWindow,
  HomeFeatureList,
  HomeFeaturePill,
  HomeHeroSection,
  HomeLandingSectionPastel,
  HomeLandingSectionWhite,
  HomePageStack,
  HomePanelBar,
  HomePanelBars,
  HomePanelChart,
  HomePanelLarge,
  HomePanelSmall,
  HomePanelSmallBody,
  HomePanelSmallHeader,
  HomeProfileAvatar,
  HomeProfileCard,
  HomeProfileGrid,
  HomeProfileMeta,
  HomeSectionBody,
  HomeSectionEyebrow,
  HomeSectionInner,
  HomeSectionInnerReverse,
  HomeSectionText,
  HomeSectionTextRight,
  HomeSectionTitle,
  HomeSectionVisual,
  HomeVisualAvatar,
  HomeVisualCardBottom,
  HomeVisualCardTop,
  HomeVisualLine,
  HomeVisualMainPortrait,
  HomeVisualMiniCard,
  HomeVisualShine,
  HomeVisualStage,
  StyledCenterVideochat,
  StyledSplit2,
  StyledPane,
  StyledThumbsGrid,
  StyledPrimaryCta,
  StyledSecondaryCta,
  HomeHeroText,
  StyledHomeMobileOverlay,
  HideOnMobile
} from '../styles/public-styles/HomeStyles';
import { ButtonActivarCam, ButtonActivarCamMobile } from '../styles/ButtonStyles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

export default function Home() {

  const { uiLocale } = useSession();

  const [activeTab,setActiveTab]=useState('videochat');
  const location=useLocation();
  const { openLoginModal,openPublicSignupTeaser }=useAppModals();

  const [loginModalOpened,setLoginModalOpened]=useState(false);
  const [featured,setFeatured]=useState([]);
  const [loadingFeatured,setLoadingFeatured]=useState(false);
  const baseItems=Array.isArray(featured)?featured:[];
  const [heroIndex,setHeroIndex]=useState(0);
  const heroItem=baseItems&&baseItems.length>0?baseItems[Math.min(heroIndex,baseItems.length-1)]:null;

  useEffect(()=>{

    const loadFeatured=async()=>{
      try{
        setLoadingFeatured(true);
        const res=await fetch('/api/public/home/featured');
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const data=await res.json();

        if(Array.isArray(data)) setFeatured(data);
        else if(data&&Array.isArray(data.slots)) setFeatured(data.slots);
        else setFeatured([]);

      }catch(e){
        console.error('Error cargando modelos destacados:',e);
        setFeatured([]);
      }finally{
        setLoadingFeatured(false);
      }
    };

    loadFeatured();

  },[]);

  useEffect(()=>{
    if(!baseItems||baseItems.length===0){
      if(heroIndex!==0) setHeroIndex(0);
      return;
    }

    if(heroIndex>baseItems.length-1){
      setHeroIndex(baseItems.length-1);
    }

  },[baseItems.length,heroIndex]);

  useEffect(()=>{
    if(location.pathname==='/login'&&!loginModalOpened){
      openLoginModal();
      setLoginModalOpened(true);
    }
    else if(location.pathname!=='/login'&&loginModalOpened){
      setLoginModalOpened(false);
    }
  },[location.pathname,loginModalOpened,openLoginModal]);

  const goLogin=()=>{openLoginModal();};
  const goRegister=()=>{openLoginModal({initialView:'register-gender'});};

  const handleLogoClick=(e)=>{
    e.preventDefault();
    window.location.href='/';
  };

  const handleTabClick=(tab)=>{
    setActiveTab(tab);
    if(tab==='blog') window.location.href='/blog';
    else goLogin();
  };

  const slotLabel=(slotType)=>{
    if(!slotType) return null;

    const tSlot=String(slotType).toUpperCase();

    if(tSlot==='TOP') return i18n.t('home.hero.slot.top');
    if(tSlot==='NEW') return i18n.t('home.hero.slot.new');
    if(tSlot==='RANDOM') return i18n.t('home.hero.slot.random');

    return null;
  };

  const canPrev=heroIndex>0;
  const canNext=baseItems&&heroIndex<(baseItems.length-1);

  const goPrevCard=(e)=>{
    if(e){e.preventDefault();e.stopPropagation();}
    if(!canPrev) return;
    setHeroIndex(i=>Math.max(0,i-1));
  };

  void uiLocale;

  const goNextCard=(e)=>{
    if(e){e.preventDefault();e.stopPropagation();}
    if(!canNext) return;
    setHeroIndex(i=>Math.min((baseItems.length-1),i+1));
  };

  return(
  <>
    <GlobalBlack/>

    <PublicNavbar
      activeTab={activeTab}
      onBrandClick={handleLogoClick}
      onGoVideochat={() => handleTabClick('videochat')}
      onGoFavorites={() => handleTabClick('favoritos')}
      onGoBlog={() => handleTabClick('blog')}
      onBuy={goRegister}
      onLogin={goLogin}
      showLocaleSwitcher={true}
      showBottomNav={true}
    />

    <HomePageStack>

      <HomeHeroSection>
        <StyledCenterVideochat>

          <StyledSplit2>

            <StyledPane data-side="left">

              <HideOnMobile>
                <HomeHeroText>
                  <h1>{i18n.t('home.hero.title')}</h1>
                  <p>{i18n.t('home.hero.subtitle')}</p>
                  <p>{i18n.t('home.hero.freeTrial')}</p>

                  <div style={{marginTop:16,display:'flex',alignItems:'center',justifyContent:'flex-start'}}>
                    <ButtonActivarCam onClick={goRegister}>{i18n.t('home.cta.startVideoChat')}</ButtonActivarCam>
                  </div>

                </HomeHeroText>
              </HideOnMobile>

            </StyledPane>

            <StyledPane data-side="right" style={{padding:0}}>

              <div style={{width:'100%',height:'100%'}}>

                <button type="button" className="home-hero-media"
                  onClick={()=>{if(!heroItem){goLogin();return;}openPublicSignupTeaser();}}
                  style={{width:'100%',height:'100%',border:'none',padding:0,margin:0,background:'transparent',cursor:'pointer',borderRadius:16,overflow:'hidden',position:'relative'}}>

                  {heroItem?(
                  <>

                    {slotLabel(heroItem.slotType)&&(
                      <span style={{position:'absolute',left:10,top:10,zIndex:20,fontSize:'0.72rem',fontWeight:800,padding:'4px 10px',borderRadius:999,background:'rgba(0,0,0,0.65)',color:'#fff',textTransform:'uppercase'}}>
                        {slotLabel(heroItem.slotType)}
                      </span>
                    )}

                    <BlurredPreview
                      type={heroItem.videoUrl?'video':'img'}
                      src={heroItem.videoUrl||heroItem.avatarUrl||'/img/avatarChica.png'}
                      poster={heroItem.avatarUrl||'/img/avatarChica.png'}
                      muted
                      autoPlay
                      loop
                      playsInline
                      controls={false}
                      showVignette
                      style={{width:'100%',height:'100%'}}
                    />

                    <StyledHomeMobileOverlay>
                      <div>
                        <ButtonActivarCamMobile onClick={goRegister}>
                          {i18n.t('home.cta.startVideoChat')}
                        </ButtonActivarCamMobile>
                      </div>
                    </StyledHomeMobileOverlay>

                    {canPrev&&(
                      <button onClick={goPrevCard} aria-label={i18n.t('home.hero.prevAria')}
                        style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',width:44,height:44,border:'none',background:'transparent',color:'#fff',fontSize:26,zIndex:30}}>
                        <FontAwesomeIcon icon={faChevronLeft}/>
                      </button>
                    )}

                    {canNext&&(
                      <button onClick={goNextCard} aria-label={i18n.t('home.hero.nextAria')}
                        style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',width:44,height:44,border:'none',background:'transparent',color:'#fff',fontSize:26,zIndex:30}}>
                        <FontAwesomeIcon icon={faChevronRight}/>
                      </button>
                    )}

                  </>
                  ):(
                    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#0b1220',color:'#fff',fontWeight:800}}>
                      {i18n.t('home.hero.loading')}
                    </div>
                  )}

                </button>

              </div>

            </StyledPane>

          </StyledSplit2>
        </StyledCenterVideochat>
      </HomeHeroSection>

      <HomeLandingSectionWhite>
        <HomeSectionInner>
          <HomeSectionText>
            <HomeSectionEyebrow>Quick matching</HomeSectionEyebrow>
            <HomeSectionTitle>Skip the search. Start the spark.</HomeSectionTitle>
            <HomeSectionBody>
              Jump into new conversations without digging through endless profiles. The flow is built to make discovery feel immediate, light and easy to follow.
            </HomeSectionBody>
            <HomeFeatureList>
              <HomeFeaturePill>Fast random discovery</HomeFeaturePill>
              <HomeFeaturePill>Less browsing, more meeting</HomeFeaturePill>
              <HomeFeaturePill>Instant path into conversation</HomeFeaturePill>
            </HomeFeatureList>
          </HomeSectionText>

          <HomeSectionVisual>
            <HomeVisualStage>
              <HomeVisualMiniCard data-pos="left">
                <HomeVisualCardTop />
                <HomeVisualAvatar />
                <HomeVisualCardBottom>
                  <HomeVisualLine />
                  <HomeVisualLine />
                  <HomeVisualLine />
                </HomeVisualCardBottom>
                <HomeVisualShine />
              </HomeVisualMiniCard>

              <HomeVisualMainPortrait>
                <HomeVisualCardTop />
                <HomeVisualAvatar />
                <HomeVisualCardBottom>
                  <HomeVisualLine />
                  <HomeVisualLine />
                  <HomeVisualLine />
                </HomeVisualCardBottom>
                <HomeVisualShine />
              </HomeVisualMainPortrait>

              <HomeVisualMiniCard data-pos="right">
                <HomeVisualCardTop />
                <HomeVisualAvatar />
                <HomeVisualCardBottom>
                  <HomeVisualLine />
                  <HomeVisualLine />
                  <HomeVisualLine />
                </HomeVisualCardBottom>
                <HomeVisualShine />
              </HomeVisualMiniCard>
            </HomeVisualStage>
          </HomeSectionVisual>
        </HomeSectionInner>
      </HomeLandingSectionWhite>

      <HomeLandingSectionPastel>
        <HomeSectionInnerReverse>
          <HomeSectionVisual>
            <HomeVisualStage>
              <HomeCallWindow>
                <HomeCallTopbar />
                <HomeCallVideo />
                <HomeCallFloating />
                <HomeCallControls>
                  <HomeCallControl />
                  <HomeCallControl />
                  <HomeCallControl />
                </HomeCallControls>
                <HomeVisualShine />
              </HomeCallWindow>
            </HomeVisualStage>
          </HomeSectionVisual>

          <HomeSectionTextRight>
            <HomeSectionEyebrow>Private and protected</HomeSectionEyebrow>
            <HomeSectionTitle>Confidence built into every chat</HomeSectionTitle>
            <HomeSectionBody>
              A stronger sense of privacy changes how people connect. With a calmer environment, clearer control and support from moderation systems, every interaction can feel more secure.
            </HomeSectionBody>
            <HomeFeatureList>
              <HomeFeaturePill>More private by design</HomeFeaturePill>
              <HomeFeaturePill>Technology-backed trust signals</HomeFeaturePill>
              <HomeFeaturePill>Cleaner space for real interaction</HomeFeaturePill>
            </HomeFeatureList>
          </HomeSectionTextRight>
        </HomeSectionInnerReverse>
      </HomeLandingSectionPastel>

      <HomeLandingSectionWhite>
        <HomeSectionInner>
          <HomeSectionText>
            <HomeSectionEyebrow>Clear flow</HomeSectionEyebrow>
            <HomeSectionTitle>Everything feels easier when the interface gets out of the way</HomeSectionTitle>
            <HomeSectionBody>
              The experience is shaped to stay direct, readable and comfortable from screen to screen. Less friction means more attention on the moment and less on figuring things out.
            </HomeSectionBody>
            <HomeFeatureList>
              <HomeFeaturePill>Cleaner interactions from start to finish</HomeFeaturePill>
              <HomeFeaturePill>Simple actions, clear feedback</HomeFeaturePill>
              <HomeFeaturePill>Made to feel smooth on every device</HomeFeaturePill>
            </HomeFeatureList>
          </HomeSectionText>

          <HomeSectionVisual>
            <HomeVisualStage>
              <HomePanelLarge>
                <HomePanelChart />
                <HomePanelBars>
                  <HomePanelBar />
                  <HomePanelBar />
                  <HomePanelBar />
                  <HomePanelBar />
                </HomePanelBars>
                <HomeVisualShine />
              </HomePanelLarge>

              <HomePanelSmall>
                <HomePanelSmallHeader />
                <HomePanelSmallBody />
                <HomeVisualShine />
              </HomePanelSmall>
            </HomeVisualStage>
          </HomeSectionVisual>
        </HomeSectionInner>
      </HomeLandingSectionWhite>

      <HomeLandingSectionPastel>
        <HomeSectionInnerReverse>
          <HomeSectionVisual>
            <HomeProfileGrid>
              {[0,1,2,3].map((item)=>(
                <HomeProfileCard key={item}>
                  <HomeVisualCardTop />
                  <HomeProfileAvatar />
                  <HomeProfileMeta>
                    <HomeVisualLine />
                    <HomeVisualLine />
                  </HomeProfileMeta>
                  <HomeVisualShine />
                </HomeProfileCard>
              ))}
            </HomeProfileGrid>
          </HomeSectionVisual>

          <HomeSectionTextRight>
            <HomeSectionEyebrow>Unexpected chemistry</HomeSectionEyebrow>
            <HomeSectionTitle>Sometimes the right connection appears when you stop forcing it</HomeSectionTitle>
            <HomeSectionBody>
              Not every meaningful conversation starts with a perfect plan. Sometimes it begins with one spontaneous click, one surprise match and the feeling that you want to stay a little longer.
            </HomeSectionBody>
            <HomeFeatureList>
              <HomeFeaturePill>Discovery that feels natural</HomeFeaturePill>
              <HomeFeaturePill>Unexpected matches with real potential</HomeFeaturePill>
              <HomeFeaturePill>Room for a genuine spark to happen</HomeFeaturePill>
            </HomeFeatureList>
          </HomeSectionTextRight>
        </HomeSectionInnerReverse>
      </HomeLandingSectionPastel>

    </HomePageStack>

  </>
  );
}
