import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import { useSession } from '../components/SessionProvider';
import useAppModals from '../components/useAppModals';
import PublicNavbar from '../components/navbar/PublicNavbar';
import i18n from '../i18n';
import { ASSETS_BASE } from '../config/runtimeEnv';

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
  HomeCallWindow,
  HomeFeatureList,
  HomeFeaturePill,
  HomeHeroSection,
  HomeLandingSectionPastel,
  HomeLandingSectionWhite,
  HomePageStack,
  HomePanelLarge,
  HomeProfileCard,
  HomeProfileGrid,
  HomeProfilePhoto,
  HomeSectionBody,
  HomeSectionEyebrow,
  HomeSectionInner,
  HomeSectionInnerReverse,
  HomeSectionText,
  HomeSectionTextRight,
  HomeSectionTitle,
  HomeSectionVisual,
  HomeVisualMainPortrait,
  HomeVisualMiniCard,
  HomeVisualPhotoMain,
  HomeVisualPhotoMini,
  HomeVisualPhotoPanel,
  HomeVisualShine,
  HomeVisualStage
} from '../styles/public-styles/HomeStyles';

export default function Home() {

  const { uiLocale } = useSession();
  const [activeTab,setActiveTab]=useState('videochat');
  const location=useLocation();
  // Fase 4B.3.1: useHistory respeta el basename del Router (4B.3). Bajo
  // basename "/en", history.push('/blog') navega a "/en/blog" sin que el
  // componente conozca el locale. Sustituye a window.location.href usado
  // antes de la introduccion del basename multilingue (ADR-022).
  const history=useHistory();
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
    history.push('/');
  };

  const handleTabClick=(tab)=>{
    setActiveTab(tab);
    if(tab==='blog') history.push('/blog');
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
            <HomeSectionEyebrow>{i18n.t('home.quickMatching.eyebrow')}</HomeSectionEyebrow>
            <HomeSectionTitle>{i18n.t('home.quickMatching.title')}</HomeSectionTitle>
            <HomeSectionBody>{i18n.t('home.quickMatching.body')}</HomeSectionBody>
            <HomeFeatureList>
              <HomeFeaturePill>{i18n.t('home.quickMatching.pills.fastDiscovery')}</HomeFeaturePill>
              <HomeFeaturePill>{i18n.t('home.quickMatching.pills.lessBrowsing')}</HomeFeaturePill>
              <HomeFeaturePill>{i18n.t('home.quickMatching.pills.instantPath')}</HomeFeaturePill>
            </HomeFeatureList>
          </HomeSectionText>

          <HomeSectionVisual>
            <HomeVisualStage>
              {/* Fotos reales reemplazando los placeholders de gradient.
                  Opcion A del plan 2026-06-05: foto en main + foto en
                  mini-right (rotada +8deg arriba derecha). La mini-left
                  se elimina para componer una pieza unica con dos fotos
                  en lugar de una principal flanqueada por dos miniaturas
                  ilustrativas. El HomeVisualShine se conserva como
                  overlay brillante para mantener el sello de marca. */}
              <HomeVisualMainPortrait>
                <HomeVisualPhotoMain
                  src={`${ASSETS_BASE}/home/quick-matching/main_v1.webp`}
                  alt={i18n.t('home.quickMatching.imageAltMain')}
                  loading="lazy"
                  decoding="async"
                />
                <HomeVisualShine />
              </HomeVisualMainPortrait>

              <HomeVisualMiniCard data-pos="right">
                <HomeVisualPhotoMini
                  src={`${ASSETS_BASE}/home/quick-matching/mini_v2.webp`}
                  alt={i18n.t('home.quickMatching.imageAltMini')}
                  loading="lazy"
                  decoding="async"
                />
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
              {/* Foto unica (render de seguridad con centro calido)
                  reemplazando la ventana de videollamada simulada
                  anterior. Opcion A del plan: una sola imagen en el
                  panel, sin elementos extra; HomeCallWindow ahora
                  apaisado para alojar la foto sin recortes feos
                  (mismo patron que HomePanelLarge de Clear flow).
                  Se conserva HomeVisualShine para mantener el sello
                  de marca. */}
              <HomeCallWindow>
                <HomeVisualPhotoPanel
                  src={`${ASSETS_BASE}/home/confidence/confidence_v1.webp`}
                  alt={i18n.t('home.confidence.imageAltMain')}
                  loading="lazy"
                  decoding="async"
                />
                <HomeVisualShine />
              </HomeCallWindow>
            </HomeVisualStage>
          </HomeSectionVisual>

          <HomeSectionTextRight>
            <HomeSectionEyebrow>{i18n.t('home.confidence.eyebrow')}</HomeSectionEyebrow>
            <HomeSectionTitle>{i18n.t('home.confidence.title')}</HomeSectionTitle>
            <HomeSectionBody>{i18n.t('home.confidence.body')}</HomeSectionBody>
            <HomeFeatureList>
              <HomeFeaturePill>{i18n.t('home.confidence.pills.privateByDesign')}</HomeFeaturePill>
              <HomeFeaturePill>{i18n.t('home.confidence.pills.trustSignals')}</HomeFeaturePill>
              <HomeFeaturePill>{i18n.t('home.confidence.pills.cleanerSpace')}</HomeFeaturePill>
            </HomeFeatureList>
          </HomeSectionTextRight>
        </HomeSectionInnerReverse>
      </HomeLandingSectionPastel>

      <HomeLandingSectionWhite>
        <HomeSectionInner>
          <HomeSectionText>
            <HomeSectionEyebrow>{i18n.t('home.clearFlow.eyebrow')}</HomeSectionEyebrow>
            <HomeSectionTitle>{i18n.t('home.clearFlow.title')}</HomeSectionTitle>
            <HomeSectionBody>{i18n.t('home.clearFlow.body')}</HomeSectionBody>
            <HomeFeatureList>
              <HomeFeaturePill>{i18n.t('home.clearFlow.pills.cleanerInteractions')}</HomeFeaturePill>
              <HomeFeaturePill>{i18n.t('home.clearFlow.pills.simpleActions')}</HomeFeaturePill>
              <HomeFeaturePill>{i18n.t('home.clearFlow.pills.smoothOnAnyDevice')}</HomeFeaturePill>
            </HomeFeatureList>
          </HomeSectionText>

          <HomeSectionVisual>
            <HomeVisualStage>
              {/* Foto real apaisada con la chica usando la app en 3
                  dispositivos (movil + tablet + portatil). Opcion A
                  del plan: una sola foto en el panel grande;
                  HomePanelSmall flotante y HomePanelChart/HomePanelBars
                  placeholders se eliminan del JSX para que la pieza
                  quede limpia. */}
              <HomePanelLarge>
                <HomeVisualPhotoPanel
                  src={`${ASSETS_BASE}/home/clear-flow/clearflow_v1.webp`}
                  alt={i18n.t('home.clearFlow.imageAltMain')}
                  loading="lazy"
                  decoding="async"
                />
                <HomeVisualShine />
              </HomePanelLarge>
            </HomeVisualStage>
          </HomeSectionVisual>
        </HomeSectionInner>
      </HomeLandingSectionWhite>

      <HomeLandingSectionPastel>
        <HomeSectionInnerReverse>
          <HomeSectionVisual>
            <HomeProfileGrid>
              {/* Grid 2x2 con 4 retratos reales en posicion CRUZADA:
                  parejas en diagonal (chicas arriba, chicos abajo;
                  pero cada chica con un chico en diagonal opuesta).
                  Las cuatro cards son CUADRADAS e IGUALES (sin
                  desfase translateY del placeholder anterior).
                  object-position por imagen para que ninguna cara
                  quede recortada al aplicar object-fit cover sobre
                  el card cuadrado. */}
              <HomeProfileCard>
                <HomeProfilePhoto
                  src={`${ASSETS_BASE}/home/unexpected-chemistry/chica2_v1.webp`}
                  alt={i18n.t('home.unexpectedChemistry.imageAltChica2')}
                  $position="center 35%"
                  loading="lazy"
                  decoding="async"
                />
                <HomeVisualShine />
              </HomeProfileCard>

              <HomeProfileCard>
                <HomeProfilePhoto
                  src={`${ASSETS_BASE}/home/unexpected-chemistry/chica1_v1.webp`}
                  alt={i18n.t('home.unexpectedChemistry.imageAltChica1')}
                  $position="center 35%"
                  loading="lazy"
                  decoding="async"
                />
                <HomeVisualShine />
              </HomeProfileCard>

              <HomeProfileCard>
                <HomeProfilePhoto
                  src={`${ASSETS_BASE}/home/unexpected-chemistry/chico1_v1.webp`}
                  alt={i18n.t('home.unexpectedChemistry.imageAltChico1')}
                  $position="center 35%"
                  loading="lazy"
                  decoding="async"
                />
                <HomeVisualShine />
              </HomeProfileCard>

              <HomeProfileCard>
                <HomeProfilePhoto
                  src={`${ASSETS_BASE}/home/unexpected-chemistry/chico2_v1.webp`}
                  alt={i18n.t('home.unexpectedChemistry.imageAltChico2')}
                  $position="center 25%"
                  loading="lazy"
                  decoding="async"
                />
                <HomeVisualShine />
              </HomeProfileCard>
            </HomeProfileGrid>
          </HomeSectionVisual>

          <HomeSectionTextRight>
            <HomeSectionEyebrow>{i18n.t('home.unexpectedChemistry.eyebrow')}</HomeSectionEyebrow>
            <HomeSectionTitle>{i18n.t('home.unexpectedChemistry.title')}</HomeSectionTitle>
            <HomeSectionBody>{i18n.t('home.unexpectedChemistry.body')}</HomeSectionBody>
            <HomeFeatureList>
              <HomeFeaturePill>{i18n.t('home.unexpectedChemistry.pills.naturalDiscovery')}</HomeFeaturePill>
              <HomeFeaturePill>{i18n.t('home.unexpectedChemistry.pills.realPotential')}</HomeFeaturePill>
              <HomeFeaturePill>{i18n.t('home.unexpectedChemistry.pills.genuineSpark')}</HomeFeaturePill>
            </HomeFeatureList>
          </HomeSectionTextRight>
        </HomeSectionInnerReverse>
      </HomeLandingSectionPastel>

    </HomePageStack>

  </>
  );
}