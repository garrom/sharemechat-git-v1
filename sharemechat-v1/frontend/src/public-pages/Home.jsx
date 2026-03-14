import React, { useState, useEffect } from 'react';
import i18n from '../i18n';
import BlurredPreview from '../components/BlurredPreview';
import { useLocation } from 'react-router-dom';
import { useSession } from '../components/SessionProvider';
import useAppModals from '../components/useAppModals';
import LocaleSwitcher from '../components/LocaleSwitcher';
import {
  GlobalBlack,
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
import {
  StyledNavbar,
  StyledBrand,
  MobileBottomNav,
  BottomNavButton,
  HamburgerButton,
  MobileMenu
} from '../styles/NavbarStyles';
import { StyledNavTab } from '../styles/pages-styles/VideochatStyles';
import { NavButton, ButtonActivarCam, ButtonActivarCamMobile } from '../styles/ButtonStyles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGem, faChevronLeft, faChevronRight, faBars } from '@fortawesome/free-solid-svg-icons';

export default function Home() {

  const { uiLocale } = useSession();

  const [activeTab,setActiveTab]=useState('videochat');
  const [menuOpen,setMenuOpen]=useState(false);
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

    <StyledNavbar style={{paddingLeft:24,paddingRight:24}}>

      <div style={{display:'flex',alignItems:'center'}}>
        <StyledBrand href="/" aria-label="SharemeChat" onClick={handleLogoClick}/>

        <div className="desktop-only" style={{display:'flex',alignItems:'center',gap:8,marginLeft:16}}>
          <StyledNavTab data-active={activeTab==='videochat'} onClick={()=>handleTabClick('videochat')}>{i18n.t('home.nav.videochat')}</StyledNavTab>
          <StyledNavTab data-active={activeTab==='favoritos'} onClick={()=>handleTabClick('favoritos')}>{i18n.t('home.nav.favorites')}</StyledNavTab>
          <StyledNavTab data-active={activeTab==='blog'} onClick={()=>handleTabClick('blog')}>{i18n.t('home.nav.blog')}</StyledNavTab>
        </div>
      </div>

      <div className="desktop-only" style={{display:'flex',alignItems:'center',gap:12,marginLeft:'auto'}}>
        <LocaleSwitcher/>
        <NavButton onClick={goRegister}>
          <FontAwesomeIcon icon={faGem} style={{color:'#22c55e',fontSize:'1rem'}}/>
          <span>{i18n.t('home.cta.buy')}</span>
        </NavButton>
        <NavButton onClick={goLogin}><span>{i18n.t('home.cta.login')}</span></NavButton>
      </div>

      <HamburgerButton onClick={()=>setMenuOpen(o=>!o)} aria-label={i18n.t('home.nav.openMenuAria')} title={i18n.t('home.nav.menuTitle')}>
        <FontAwesomeIcon icon={faBars}/>
      </HamburgerButton>

      <MobileMenu className={!menuOpen&&'hidden'}>
        <LocaleSwitcher onAfterChange={()=>setMenuOpen(false)}/>
        <NavButton onClick={()=>{goRegister();setMenuOpen(false);}}>{i18n.t('home.cta.buy')}</NavButton>
        <NavButton onClick={()=>{goLogin();setMenuOpen(false);}}>{i18n.t('home.cta.login')}</NavButton>
      </MobileMenu>

    </StyledNavbar>

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

      <MobileBottomNav>
        <BottomNavButton active={activeTab==='videochat'} onClick={()=>handleTabClick('videochat')}><span>{i18n.t('home.nav.videochat')}</span></BottomNavButton>
        <BottomNavButton active={activeTab==='favoritos'} onClick={()=>handleTabClick('favoritos')}><span>{i18n.t('home.nav.favorites')}</span></BottomNavButton>
        <BottomNavButton active={activeTab==='blog'} onClick={()=>handleTabClick('blog')}><span>{i18n.t('home.nav.blog')}</span></BottomNavButton>
      </MobileBottomNav>

    </StyledCenterVideochat>

  </>
  );
}
