// src/pages/blog/Blog.jsx
import React, { useState } from 'react';
import { GlobalBlack } from '../../styles/public-styles/HomeStyles';
import { StyledNavbar, StyledBrand, MobileBottomNav, BottomNavButton, HamburgerButton, MobileMenu } from '../../styles/NavbarStyles';
import { StyledNavTab } from '../../styles/pages-styles/VideochatStyles';
import { NavButton } from '../../styles/ButtonStyles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGem } from '@fortawesome/free-solid-svg-icons';
import BlogContent from './BlogContent';

export default function Blog() {
  const [activeTab, setActiveTab] = useState('blog');
  const [menuOpen, setMenuOpen] = useState(false);

  const goLogin = () => { window.location.href = '/login'; };
  const goRegister = () => { window.location.href = '/login'; };
  const goRegisterModel = () => { window.location.href = '/login'; };
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
      <StyledNavbar>
        <StyledBrand href="/" aria-label="SharemeChat" onClick={handleLogoClick} />
        <div className="desktop-only" style={{ display:'flex', alignItems:'center', gap:8, marginLeft:16 }}>
          <StyledNavTab type="button" data-active={activeTab === 'videochat'} aria-pressed={activeTab === 'videochat'} onClick={() => handleTabClick('videochat')} title="Videochat">Videochat</StyledNavTab>
          <StyledNavTab type="button" data-active={activeTab === 'favoritos'} aria-pressed={activeTab === 'favoritos'} onClick={() => handleTabClick('favoritos')} title="Favoritos">Favoritos</StyledNavTab>
          <StyledNavTab type="button" data-active={activeTab === 'blog'} aria-pressed={activeTab === 'blog'} onClick={() => handleTabClick('blog')} title="Blog">Blog</StyledNavTab>
        </div>
        <div className="desktop-only" style={{ display:'flex', alignItems:'center', gap:12, marginLeft:'auto' }}>
          <NavButton type="button" onClick={goRegister}>
            <FontAwesomeIcon icon={faGem} style={{ color:'#22c55e', fontSize:'1rem' }} />
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

      <BlogContent mode="public" onGoRegisterClient={goRegister} onGoRegisterModel={goRegisterModel} />

      <MobileBottomNav>
        <BottomNavButton active={activeTab === 'videochat'} onClick={() => handleTabClick('videochat')}><span>Videochat</span></BottomNavButton>
        <BottomNavButton active={activeTab === 'favoritos'} onClick={() => handleTabClick('favoritos')}><span>Favoritos</span></BottomNavButton>
        <BottomNavButton active={activeTab === 'blog'} onClick={() => handleTabClick('blog')}><span>Blog</span></BottomNavButton>
      </MobileBottomNav>
    </>
  );
}
