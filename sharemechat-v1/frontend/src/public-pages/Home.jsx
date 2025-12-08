// src/public-pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import useAppModals from '../components/useAppModals';
import { GlobalBlack, StyledCenterVideochat, StyledSplit2, StyledPane, StyledThumbsGrid, StyledPrimaryCta,StyledSecondaryCta, HomeHeroText } from '../styles/public-styles/HomeStyles';
import { StyledNavbar, StyledBrand, MobileBottomNav, BottomNavButton, HamburgerButton, MobileMenu } from '../styles/NavbarStyles';
import { StyledNavTab } from '../styles/pages-styles/VideochatStyles';
import { NavButton, ButtonActivarCam } from '../styles/ButtonStyles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGem } from '@fortawesome/free-solid-svg-icons';

export default function Home() {
  const [activeTab, setActiveTab] = useState('videochat');
  const [menuOpen, setMenuOpen] = useState(false);
  const history = useHistory();
  const location = useLocation();
  const { openLoginModal } = useAppModals();
  const [loginModalOpened, setLoginModalOpened] = useState(false);

  // === Modelos destacados desde backend ===
  const [featured, setFeatured] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(false);

  // === Lightbox teaser ===
  const [lightboxModel, setLightboxModel] = useState(null);

  // Número fijo máximo de thumbs en el grid
  const MAX_THUMBS = 9;

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

  // Lista base solo desde backend
  const baseItems = Array.isArray(featured) ? featured : [];
  const thumbItems = baseItems.slice(0, MAX_THUMBS);


  const handleThumbClick = (item) => {
    // Si es solo una ruta de imagen estática, usamos el CTA directo
    if (typeof item === 'string') {
      goLogin();
      return;
    }
    // item viene del backend (ModelTeaserDTO / HomeFeaturedSlotDTO)
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

  return (
    <>
      <GlobalBlack/>
      <StyledNavbar style={{padding:'0 24px'}}>
        <StyledBrand href="/" aria-label="SharemeChat" onClick={handleLogoClick}/>
        <div className="desktop-only" style={{display:'flex',alignItems:'center',gap:8,marginLeft:16}}>
          <StyledNavTab type="button" data-active={activeTab==='videochat'} aria-pressed={activeTab==='videochat'} onClick={() => handleTabClick('videochat')} title="Videochat">Videochat</StyledNavTab>
          <StyledNavTab type="button" data-active={activeTab==='favoritos'} aria-pressed={activeTab==='favoritos'} onClick={() => handleTabClick('favoritos')} title="Favoritos">Favoritos</StyledNavTab>
          <StyledNavTab type="button" data-active={activeTab==='blog'} aria-pressed={activeTab==='blog'} onClick={() => handleTabClick('blog')} title="blog">Blog</StyledNavTab>
        </div>
        <div className="desktop-only" style={{display:'flex',alignItems:'center',gap:12,marginLeft:'auto'}}>
          <NavButton type="button" onClick={goRegister}><FontAwesomeIcon icon={faGem} style={{color:'#22c55e',fontSize:'1rem'}}/><span>Comprar</span></NavButton>
          <NavButton type="button" onClick={goLogin}><span>Iniciar sesión</span></NavButton>
        </div>
        <HamburgerButton onClick={() => setMenuOpen(o=>!o)} aria-label="Abrir menú" title="Menú">☰</HamburgerButton>
        <MobileMenu className={!menuOpen && 'hidden'}>
          <NavButton type="button" onClick={() => {handleTabClick('videochat');setMenuOpen(false);}}>Videochat</NavButton>
          <NavButton type="button" onClick={() => {handleTabClick('favoritos');setMenuOpen(false);}}>Favoritos</NavButton>
          <NavButton type="button" onClick={() => {handleTabClick('blog');setMenuOpen(false);}}>Blog</NavButton>
          <NavButton type="button" onClick={() => {goRegister();setMenuOpen(false);}}>Comprar</NavButton>
          <NavButton type="button" onClick={() => {goLogin();setMenuOpen(false);}}>Iniciar sesión</NavButton>
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
          <StyledPane data-side="right">
            <StyledThumbsGrid>
              {thumbItems.map((item,idx)=>{
                if (typeof item === 'string') {
                  return (
                    <button key={idx} type="button" className="thumb-btn" onClick={() => handleThumbClick(item)} style={{padding:0,margin:0,border:'none',background:'transparent',cursor:'pointer'}}>
                      <img className="thumb" src={item} alt="Modelo en teaser"/>
                    </button>
                  );
                }
                const key = item.modelId || idx;
                const src = item.avatarUrl || '/img/avatarChica.png';
                const name = item.modelName || 'Modelo en teaser';
                const label = slotLabel(item.slotType);
                return (
                  <button key={key} type="button" className="thumb-btn" onClick={() => handleThumbClick(item)} style={{position:'relative',padding:0,margin:0,border:'none',background:'transparent',cursor:'pointer'}}>
                    {label && (
                      <span style={{position:'absolute',left:6,top:6,zIndex:2,fontSize:'0.7rem',fontWeight:700,padding:'3px 8px',borderRadius:999,background:'rgba(0,0,0,0.65)',color:'#f9fafb',textTransform:'uppercase',letterSpacing:'.03em'}}>{label}</span>
                    )}
                    <img className="thumb" src={src} alt={name}/>
                  </button>
                );
              })}
            </StyledThumbsGrid>
          </StyledPane>
        </StyledSplit2>

        <MobileBottomNav>
          <BottomNavButton active={activeTab==='videochat'} onClick={() => handleTabClick('videochat')}><span>Videochat</span></BottomNavButton>
          <BottomNavButton active={activeTab==='favoritos'} onClick={() => handleTabClick('favoritos')}><span>Favoritos</span></BottomNavButton>
          <BottomNavButton active={activeTab==='blog'} onClick={() => handleTabClick('blog')}><span>Blog</span></BottomNavButton>
        </MobileBottomNav>
      </StyledCenterVideochat>

      {/* LIGHTBOX TEASER */}
      {lightboxModel && (
        <div style={{position:'fixed',inset:0,zIndex:3000,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}>
          <div style={{position:'relative',width:'100%',maxWidth:'720px',background:'#111827',borderRadius:'18px',boxShadow:'0 24px 60px rgba(0,0,0,0.6)',padding:'16px',boxSizing:'border-box',display:'flex',flexDirection:'column',gap:12}}>
            <button type="button" onClick={closeLightbox} aria-label="Cerrar" title="Cerrar" style={{position:'absolute',right:12,top:10,border:'none',background:'rgba(0,0,0,0.6)',color:'#f9fafb',width:32,height:32,borderRadius:'999px',cursor:'pointer',fontSize:'1rem',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <img src={lightboxModel.avatarUrl} alt={lightboxModel.modelName} style={{width:56,height:56,borderRadius:'50%',objectFit:'cover',border:'2px solid rgba(255,255,255,0.4)'}}/>
              <div style={{display:'flex',flexDirection:'column'}}>
                <span style={{fontSize:'0.78rem',color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.08em'}}>Modelo destacada</span>
                <span style={{fontSize:'1.1rem',fontWeight:700,color:'#f9fafb'}}>{lightboxModel.modelName}</span>
              </div>
            </div>
            <div style={{borderRadius:'14px',overflow:'hidden',background:'#000000',maxHeight:'360px'}}>
              {lightboxModel.videoUrl ? (
                <video src={lightboxModel.videoUrl} autoPlay controls muted playsInline style={{display:'block',width:'100%',height:'100%',maxHeight:'360px',objectFit:'cover'}}/>
              ) : (
                <div style={{padding:'40px 16px',textAlign:'center',color:'#e5e7eb',fontSize:'0.95rem'}}>Esta modelo todavía no tiene video teaser cargado.</div>
              )}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8,marginTop:4}}>
              <div style={{fontSize:'0.85rem',color:'#9ca3af'}}>Habla con modelos reales en vivo. Empieza en segundos, sin registros complicados.</div>
              <div style={{display:'flex',gap:8}}>
                <StyledSecondaryCta type="button" onClick={goLogin}>Ya tengo cuenta</StyledSecondaryCta>
                <ButtonActivarCam type="button" onClick={() => {closeLightbox();goRegister();}}>Quiero hablar ahora</ButtonActivarCam>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
