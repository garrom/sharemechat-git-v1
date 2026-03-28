import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '../components/SessionProvider';
import useAppModals from '../components/useAppModals';
import PublicNavbar from '../components/navbar/PublicNavbar';
import i18n from '../i18n';

import {
  GlobalBlack,
  HeroBackground,
  HeroContainer,
  HeroContent,
  HeroCopy,
  HeroCtaRow,
  HeroEyebrow,
  HeroMeta,
  HeroOverlay,
  HeroSubtitle,
  HeroTitle,
  HeroPrimaryCta,
  HeroSecondaryCta,
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
  HomeVisualStage
} from '../styles/public-styles/HomeStyles';

export default function Home() {

  const { uiLocale } = useSession();
  const [activeTab,setActiveTab]=useState('videochat');
  const location=useLocation();
  const { openLoginModal }=useAppModals();
  const [loginModalOpened,setLoginModalOpened]=useState(false);
  const quickMatchingRef=useRef(null);

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
  const goHowItWorks=()=>{
    quickMatchingRef.current?.scrollIntoView({behavior:'smooth',block:'start'});
  };

  const handleLogoClick=(e)=>{
    e.preventDefault();
    window.location.href='/';
  };

  const handleTabClick=(tab)=>{
    setActiveTab(tab);
    if(tab==='blog') window.location.href='/blog';
    else goLogin();
  };

  void uiLocale;

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
        <HeroContainer>

          <HeroBackground />
          <HeroOverlay />

          <HeroContent>
            <HeroCopy>

              <HeroEyebrow>
                {i18n.t('home.hero.eyebrow')}
              </HeroEyebrow>

              <HeroTitle>
                {i18n.t('home.hero.titlePrefix')} <span>{i18n.t('home.hero.titleAccent')}</span>
              </HeroTitle>

              <HeroSubtitle>
                {i18n.t('home.hero.subtitle')}
              </HeroSubtitle>

              <HeroMeta>
                {i18n.t('home.hero.meta')}
              </HeroMeta>

              <HeroCtaRow>
                <HeroPrimaryCta onClick={goRegister}>
                  {i18n.t('home.hero.actions.start')}
                </HeroPrimaryCta>

                <HeroSecondaryCta onClick={goHowItWorks}>
                  {i18n.t('home.hero.actions.howItWorks')}
                </HeroSecondaryCta>
              </HeroCtaRow>

            </HeroCopy>
          </HeroContent>

        </HeroContainer>
      </HomeHeroSection>

      <HomeLandingSectionWhite ref={quickMatchingRef}>
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