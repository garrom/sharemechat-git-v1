// src/public-pages/Home.jsx
import React, { useState, useEffect } from 'react';
import BlurredPreview from '../components/BlurredPreview';
import { useHistory, useLocation } from 'react-router-dom';
import useAppModals from '../components/useAppModals';
import { GlobalBlack, StyledCenterVideochat, StyledSplit2, StyledPane, StyledThumbsGrid, StyledPrimaryCta, StyledSecondaryCta, HomeHeroText } from '../styles/public-styles/HomeStyles';
import { StyledNavbar, StyledBrand, MobileBottomNav, BottomNavButton, HamburgerButton, MobileMenu } from '../styles/NavbarStyles';
import { StyledNavTab } from '../styles/pages-styles/VideochatStyles';
import { NavButton, ButtonActivarCam } from '../styles/ButtonStyles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGem, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

export default function Home() {
  const [activeTab, setActiveTab] = useState('videochat');
  const [menuOpen, setMenuOpen] = useState(false);
  const history = useHistory();
  const location = useLocation();
  const { openLoginModal, openPublicSignupTeaser } = useAppModals();
  const [loginModalOpened, setLoginModalOpened] = useState(false);

  // === Modelos destacados desde backend ===
  const [featured, setFeatured] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(false);
  const [lightboxModel, setLightboxModel] = useState(null);
  const [signupModalOpen, setSignupModalOpen] = useState(false);

  const baseItems = Array.isArray(featured) ? featured : [];
  const [heroIndex, setHeroIndex] = useState(0);
  const heroItem = baseItems && baseItems.length > 0 ? baseItems[Math.min(heroIndex, baseItems.length - 1)] : null;

  useEffect(() => {
    const loadFeatured = async () => {
      try {
        setLoadingFeatured(true);
        const res = await fetch('/api/public/home/featured');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setFeatured(data);
        } else if (data && Array.isArray(data.slots)) {
          setFeatured(data.slots);
        } else {
          setFeatured([]);
        }
      } catch (e) {
        console.error('Error cargando modelos destacados:', e);
        setFeatured([]);
      } finally {
        setLoadingFeatured(false);
      }
    };
    loadFeatured();
  }, []);

  useEffect(() => {
    if (!baseItems || baseItems.length === 0) {
      if (heroIndex !== 0) setHeroIndex(0);
      return;
    }
    if (heroIndex > baseItems.length - 1) setHeroIndex(baseItems.length - 1);
  }, [baseItems.length]);

  useEffect(() => {
    if (location.pathname === '/login' && !loginModalOpened) {
      openLoginModal();
      setLoginModalOpened(true);
    } else if (location.pathname !== '/login' && loginModalOpened) {
      setLoginModalOpened(false);
    }
  }, [location.pathname, loginModalOpened, openLoginModal]);

  const goLogin = () => { openLoginModal(); };
  const goRegister = () => { openLoginModal(); };
  const handleLogoClick = (e) => { e.preventDefault(); window.location.href = '/'; };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    if (tab === 'blog') {
      window.location.href = '/blog';
    } else {
      goLogin();
    }
  };

  const handleThumbClick = (item) => {
    if (typeof item === 'string') {
      goLogin();
      return;
    }
    const model = {
      modelId: item.modelId,
      modelName: item.modelName || 'Modelo',
      avatarUrl: item.avatarUrl || '/img/avatarChica.png',
      videoUrl: item.videoUrl || null,
      slotType: item.slotType || null
    };
    setLightboxModel(model);
  };

  const closeLightbox = () => setLightboxModel(null);

  const slotLabel = (slotType) => {
    if (!slotType) return null;
    const t = String(slotType).toUpperCase();
    if (t === 'TOP') return 'Top modelos';
    if (t === 'NEW') return 'Nueva modelo';
    if (t === 'RANDOM') return 'Descubre';
    return null;
  };

  const canPrev = heroIndex > 0;
  const canNext = baseItems && heroIndex < (baseItems.length - 1);

  const goPrevCard = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!canPrev) return;
    setHeroIndex(i => Math.max(0, i - 1));
  };

  const goNextCard = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!canNext) return;
    setHeroIndex(i => Math.min((baseItems.length - 1), i + 1));
  };

  return (
    <>
      <GlobalBlack />

      <StyledNavbar style={{padding:'0 24px'}}>
        <StyledBrand href="/" aria-label="SharemeChat" onClick={handleLogoClick} />

        <div className="desktop-only" style={{display:'flex',alignItems:'center',gap:8,marginLeft:16}}>
          <StyledNavTab type="button" data-active={activeTab === 'videochat'} aria-pressed={activeTab === 'videochat'} onClick={() => handleTabClick('videochat')} title="Videochat">Videochat</StyledNavTab>
          <StyledNavTab type="button" data-active={activeTab === 'favoritos'} aria-pressed={activeTab === 'favoritos'} onClick={() => handleTabClick('favoritos')} title="Favoritos">Favoritos</StyledNavTab>
          <StyledNavTab type="button" data-active={activeTab === 'blog'} aria-pressed={activeTab === 'blog'} onClick={() => handleTabClick('blog')} title="blog">Blog</StyledNavTab>
        </div>

        <div className="desktop-only" style={{display:'flex',alignItems:'center',gap:12,marginLeft:'auto'}}>
          <NavButton type="button" onClick={goRegister}>
            <FontAwesomeIcon icon={faGem} style={{color:'#22c55e',fontSize:'1rem'}} />
            <span>Comprar</span>
          </NavButton>
          <NavButton type="button" onClick={goLogin}><span>Iniciar sesión</span></NavButton>
        </div>

        <HamburgerButton onClick={() => setMenuOpen(o => !o)} aria-label="Abrir menú" title="Menú">☰</HamburgerButton>

        <MobileMenu className={!menuOpen && 'hidden'}>
          <NavButton type="button" onClick={() => { handleTabClick('videochat'); setMenuOpen(false); }}>Videochat</NavButton>
          <NavButton type="button" onClick={() => { handleTabClick('favoritos'); setMenuOpen(false); }}>Favoritos</NavButton>
          <NavButton type="button" onClick={() => { handleTabClick('blog'); setMenuOpen(false); }}>Blog</NavButton>
          <NavButton type="button" onClick={() => { goRegister(); setMenuOpen(false); }}>Comprar</NavButton>
          <NavButton type="button" onClick={() => { goLogin(); setMenuOpen(false); }}>Iniciar sesión</NavButton>
        </MobileMenu>
      </StyledNavbar>

      <StyledCenterVideochat>
        <StyledSplit2>
          <StyledPane data-side="left">
            <HomeHeroText>
              <h1>VideoChat con modelos</h1>
              <p>Conecta al instante con modelos reales, en vivo, en una experiencia 1 a 1 inspirada en plataformas como Coomeet, pero con la tecnología y control total de SharemeChat.</p>
              <p>Regístrate y prueba GRATIS</p>
              <div style={{marginTop:16,display:'flex',alignItems:'center',justifyContent:'flex-start'}}>
                <ButtonActivarCam onClick={goRegister}>Iniciar Video Chat</ButtonActivarCam>
              </div>
            </HomeHeroText>
          </StyledPane>

          <StyledPane data-side="right" style={{padding:0}}>
            <div style={{width:'100%', height:'100%'}}>
              <button type="button" className="thumb-btn" onClick={()=>{if(!heroItem){goLogin();return;} openPublicSignupTeaser();}}
                  style={{width:'100%',height:'100%',border:'none',padding:0,margin:0,background:'transparent',cursor:'pointer',borderRadius:16,overflow:'hidden',boxShadow:'none',position:'relative'}}>
                {heroItem ? (
                  <>
                    {slotLabel(heroItem.slotType) && (
                      <span style={{position:'absolute',left:10,top:10,zIndex:20,fontSize:'0.72rem',fontWeight:800,padding:'4px 10px',borderRadius:999,background:'rgba(0,0,0,0.65)',color:'#f9fafb',textTransform:'uppercase',letterSpacing:'.04em'}}>
                        {slotLabel(heroItem.slotType)}
                      </span>
                    )}

                    {heroItem?.videoUrl ? (
                      <BlurredPreview
                        type="video"
                        src={heroItem.videoUrl}
                        poster={(heroItem.avatarUrl || '/img/avatarChica.png')}
                        muted={true}
                        autoPlay={true}
                        loop={true}
                        playsInline={true}
                        controls={false}
                        alt={(heroItem.modelName || 'Modelo')}
                        showVignette={true}
                        style={{width:'100%',height:'100%'}}
                      />
                    ) : (
                      <BlurredPreview
                        type="img"
                        src={(heroItem?.avatarUrl || '/img/avatarChica.png')}
                        alt={(heroItem?.modelName || 'Modelo')}
                        showVignette={true}
                      />
                    )}

                    {canPrev && (
                      <button type="button" onClick={goPrevCard} aria-label="Modelo anterior" title="Modelo anterior" style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',width:44,height:44,border:'none',background:'transparent',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:26,cursor:'pointer',zIndex:31}}>
                        <FontAwesomeIcon icon={faChevronLeft} />
                      </button>
                    )}

                    {canNext && (
                      <button type="button" onClick={goNextCard} aria-label="Siguiente modelo" title="Siguiente modelo" style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',width:44,height:44,border:'none',background:'transparent',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:26,cursor:'pointer',zIndex:31}}>
                        <FontAwesomeIcon icon={faChevronRight} />
                      </button>
                    )}

                  </>
                ) : (
                  <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:18,background:'#0b1220',border:'1px solid rgba(148,163,184,.25)',color:'rgba(255,255,255,.75)',fontWeight:800}}>
                    Cargando modelos…
                  </div>
                )}
              </button>
            </div>
          </StyledPane>
        </StyledSplit2>

        <MobileBottomNav>
          <BottomNavButton active={activeTab === 'videochat'} onClick={() => handleTabClick('videochat')}><span>Videochat</span></BottomNavButton>
          <BottomNavButton active={activeTab === 'favoritos'} onClick={() => handleTabClick('favoritos')}><span>Favoritos</span></BottomNavButton>
          <BottomNavButton active={activeTab === 'blog'} onClick={() => handleTabClick('blog')}><span>Blog</span></BottomNavButton>
        </MobileBottomNav>
      </StyledCenterVideochat>

    </>
  );
}
