// src/pages/blog/Blog.jsx
import React, { useState } from 'react';
import { GlobalBlack } from '../../styles/public-styles/HomeStyles';
import { StyledNavbar, StyledBrand, MobileBottomNav, BottomNavButton, HamburgerButton, MobileMenu } from '../../styles/NavbarStyles';
import { StyledNavTab } from '../../styles/pages-styles/VideochatStyles';
import { NavButton } from '../../styles/ButtonStyles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGem } from '@fortawesome/free-solid-svg-icons';
import {
  PageWrap,
  PageInner,
  HeroKicker,
  HeroTitle,
  HeroLead,
  HeroTagline,
  ArticlesGrid,
  ArticleCard,
  ArticleBadge,
  ArticleTitle,
  ArticleMeta,
  ArticleExcerpt,
  Sidebar,
  SidebarTitle,
  SidebarText,
  TagPills,
  TagPill,
  CTABox,
  CTATitle,
  CTAText
} from '../../styles/pages-styles/BlogStyles';

export default function Blog() {
  const [activeTab, setActiveTab] = useState('blog');
  const [menuOpen, setMenuOpen] = useState(false);

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
      {/* NAVBAR PÚBLICO (igual Home) */}
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

      {/* CONTENIDO BLOG – ESTILO CLARO / PASTEL */}
      <PageWrap>
        <PageInner>
          <header>
            <HeroKicker>Blog de SharemeChat</HeroKicker>
            <HeroTitle>Artículos, consejos y novedades sobre videochat con modelos.</HeroTitle>
            <HeroLead>Aquí publicaremos guías para usuarios, recomendaciones para modelos y noticias sobre cómo evolucionan las citas por video en tiempo real.</HeroLead>
            <HeroTagline>Contenido en construcción: estamos preparando artículos útiles y fáciles de leer, pensados para que entiendas cómo sacarle partido a SharemeChat de forma segura.</HeroTagline>
          </header>

          <div style={{ display:'grid', gridTemplateColumns:'minmax(0,2fr) minmax(0,1fr)', gap:24 }}>
            {/* COLUMNA PRINCIPAL */}
            <div>
              <ArticlesGrid>
                <ArticleCard>
                  <ArticleBadge>Próximamente</ArticleBadge>
                  <ArticleTitle>Cómo funciona un videochat 1 a 1 con modelos.</ArticleTitle>
                  <ArticleMeta>Guía básica · Lectura rápida</ArticleMeta>
                  <ArticleExcerpt>Explicaremos paso a paso qué ocurre desde que recargas saldo hasta que empiezas una sesión con una modelo, cómo se cobra el tiempo y qué puedes esperar de la experiencia.</ArticleExcerpt>
                </ArticleCard>

                <ArticleCard>
                  <ArticleBadge>Próximamente</ArticleBadge>
                  <ArticleTitle>Consejos para tener una experiencia respetuosa y segura.</ArticleTitle>
                  <ArticleMeta>Usuarios · Buenas prácticas</ArticleMeta>
                  <ArticleExcerpt>Hablaremos de límites, respeto, reportes y herramientas de seguridad para que la experiencia sea agradable tanto para clientes como para modelos.</ArticleExcerpt>
                </ArticleCard>

                <ArticleCard>
                  <ArticleBadge>Próximamente</ArticleBadge>
                  <ArticleTitle>Guía para modelos: cómo empezar en SharemeChat.</ArticleTitle>
                  <ArticleMeta>Modelos · Primeros pasos</ArticleMeta>
                  <ArticleExcerpt>Desde cómo preparar tu espacio, qué equipo mínimo necesitas, hasta cómo entender tus ingresos y estadísticas dentro de la plataforma.</ArticleExcerpt>
                </ArticleCard>
              </ArticlesGrid>

              <CTABox>
                <CTATitle>Mientras preparamos los primeros artículos…</CTATitle>
                <CTAText>
                  Puedes ir adelantando y probar la plataforma: crea una cuenta como usuario para descubrir cómo funciona el videochat, o regístrate como modelo para preparar tu perfil.
                </CTAText>
                <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginTop:8 }}>
                  <NavButton type="button" onClick={goRegister}>Crear cuenta de usuario</NavButton>
                  <NavButton type="button" onClick={() => { window.location.href = '/register-model'; }}>Registrarme como modelo</NavButton>
                </div>
              </CTABox>
            </div>

            {/* SIDEBAR DERECHA */}
            <Sidebar>
              <SidebarTitle>Qué encontrarás aquí</SidebarTitle>
              <SidebarText>Publicaremos contenido breve y práctico, sin relleno, centrado en resolver dudas reales: pagos, seguridad, experiencias de modelos, tendencias del sector adulto online y mejoras de SharemeChat.</SidebarText>
              <SidebarTitle style={{ marginTop:16 }}>Temas previstos</SidebarTitle>
              <TagPills>
                <TagPill>Guías para usuarios</TagPill>
                <TagPill>Consejos para modelos</TagPill>
                <TagPill>Seguridad y privacidad</TagPill>
                <TagPill>Novedades de producto</TagPill>
                <TagPill>Monetización</TagPill>
              </TagPills>
              <SidebarText>Si todo va bien, el blog crecerá poco a poco, en paralelo al crecimiento real de la plataforma.</SidebarText>
            </Sidebar>
          </div>
        </PageInner>

        {/* NAV INFERIOR MÓVIL (igual Home) */}
        <MobileBottomNav>
          <BottomNavButton active={activeTab === 'videochat'} onClick={() => handleTabClick('videochat')}><span>Videochat</span></BottomNavButton>
          <BottomNavButton active={activeTab === 'favoritos'} onClick={() => handleTabClick('favoritos')}><span>Favoritos</span></BottomNavButton>
          <BottomNavButton active={activeTab === 'blog'} onClick={() => handleTabClick('blog')}><span>Blog</span></BottomNavButton>
        </MobileBottomNav>
      </PageWrap>
    </>
  );
}
