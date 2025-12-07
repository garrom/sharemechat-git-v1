// src/public-pages/Home.jsx
import React, { useState } from 'react';
import {
  GlobalBlack, StyledCenterVideochat, StyledSplit2, StyledPane,
  StyledThumbsGrid, StyledPrimaryCta,StyledSecondaryCta, HomeHeroText
} from '../styles/public-styles/HomeStyles';
import {
  StyledNavbar, StyledBrand, MobileBottomNav,
  BottomNavButton, HamburgerButton, MobileMenu
} from '../styles/NavbarStyles';
import { StyledNavTab } from '../styles/pages-styles/VideochatStyles';
import { NavButton, ButtonActivarCam } from '../styles/ButtonStyles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGem } from '@fortawesome/free-solid-svg-icons';

export default function Home() {
  const [activeTab, setActiveTab] = useState('videochat');
  const [menuOpen, setMenuOpen] = useState(false);

  const thumbs = [
    '/img/avatarChica.png','/img/avatarChica.png','/img/avatarChica.png',
    '/img/avatarChica.png','/img/avatarChica.png','/img/avatarChica.png',
    '/img/avatarChica.png','/img/avatarChica.png','/img/avatarChica.png'
  ];

  const goLogin = () => { window.location.href = '/login'; };
  const goRegister = () => { window.location.href = '/register-client'; };
  const handleLogoClick = (e) => { e.preventDefault(); window.location.href = '/'; };

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    if (tab === 'blog') {
      window.location.href = '/blog';
    } else {
      goLogin();
    }
  };

  return (
    <>
      <GlobalBlack />
      {/* NAVBAR PÚBLICO: logo + tabs + botones derecha */}
      <StyledNavbar>
        {/* Logo */}
        <StyledBrand href="/" aria-label="SharemeChat" onClick={handleLogoClick} />

        {/* Tabs centrados/pegados a la izquierda (solo desktop) */}
        <div className="desktop-only" style={{ display:'flex', alignItems:'center', gap:8, marginLeft:16 }}>
          <StyledNavTab type="button" data-active={activeTab === 'videochat'} aria-pressed={activeTab === 'videochat'} onClick={() => handleTabClick('videochat')} title="Videochat">Videochat</StyledNavTab>
          <StyledNavTab type="button" data-active={activeTab === 'favoritos'} aria-pressed={activeTab === 'favoritos'} onClick={() => handleTabClick('favoritos')} title="Favoritos">Favoritos</StyledNavTab>
          <StyledNavTab type="button" data-active={activeTab === 'blog'} aria-pressed={activeTab === 'blog'} onClick={() => handleTabClick('blog')} title="blog">Blog</StyledNavTab>
        </div>

        {/* Botones derecha (solo desktop) */}
        <div className="desktop-only" style={{ display:'flex', alignItems:'center', gap:12, marginLeft:'auto' }}>
          <NavButton type="button" onClick={goRegister}>
            <FontAwesomeIcon icon={faGem} style={{ color:'#22c55e', fontSize:'1rem' }} />
            <span>Comprar</span>
          </NavButton>
          <NavButton type="button" onClick={goLogin}><span>Iniciar sesión</span></NavButton>
        </div>

        {/* Menú móvil (hamburguesa) */}
        <HamburgerButton onClick={() => setMenuOpen((o) => !o)} aria-label="Abrir menú" title="Menú">☰</HamburgerButton>
        <MobileMenu className={!menuOpen && 'hidden'}>
          <NavButton type="button" onClick={() => { handleTabClick('videochat'); setMenuOpen(false); }}>Videochat</NavButton>
          <NavButton type="button" onClick={() => { handleTabClick('favoritos'); setMenuOpen(false); }}>Favoritos</NavButton>
          <NavButton type="button" onClick={() => { handleTabClick('blog'); setMenuOpen(false); }}>Blog</NavButton>
          <NavButton type="button" onClick={() => { goRegister(); setMenuOpen(false); }}>Comprar</NavButton>
          <NavButton type="button" onClick={() => { goLogin(); setMenuOpen(false); }}>Iniciar sesión</NavButton>
        </MobileMenu>
      </StyledNavbar>

      {/* CONTENIDO HOME */}
      <StyledCenterVideochat>
        <StyledSplit2>
          <StyledPane data-side="left">
            <HomeHeroText>
              <h1>VideoChat con modelos</h1>
              <p>Conecta al instante con modelos reales, en vivo, en una experiencia 1 a 1 inspirada en plataformas como Coomeet, pero con la tecnología y control total de SharemeChat.</p>
              <p>Registrate y prueba GRATIS</p>
              <div style={{ marginTop:16, display:'flex', alignItems:'center', justifyContent:'flex-start' }}>
                <ButtonActivarCam onClick={goRegister}>Iniciar Video Chat</ButtonActivarCam>
              </div>
            </HomeHeroText>
          </StyledPane>
          <StyledPane data-side="right">
            <StyledThumbsGrid>{thumbs.map((src, idx) => <img key={idx} className="thumb" src={src} alt="Modelo en teaser" />)}</StyledThumbsGrid>
          </StyledPane>
        </StyledSplit2>

        {/* BOTTOM NAV MÓVIL (igual que dashboard, pero lleva a login/blog) */}
        <MobileBottomNav>
          <BottomNavButton active={activeTab === 'videochat'} onClick={() => handleTabClick('videochat')}><span>Videochat</span></BottomNavButton>
          <BottomNavButton active={activeTab === 'favoritos'} onClick={() => handleTabClick('favoritos')}><span>Favoritos</span></BottomNavButton>
          <BottomNavButton active={activeTab === 'blog'} onClick={() => handleTabClick('blog')}><span>Blog</span></BottomNavButton>
        </MobileBottomNav>
      </StyledCenterVideochat>
    </>
  );
}
