// src/pages/blog/BlogContent.jsx
import React from 'react';
import { NavButton } from '../../styles/ButtonStyles';
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

const BlogContent = ({ mode = 'public', onGoRegisterClient, onGoRegisterModel }) => {
  const isPublic = mode === 'public';
  const handleRegisterClient = () => { if (onGoRegisterClient) onGoRegisterClient(); };
  const handleRegisterModel = () => { if (onGoRegisterModel) onGoRegisterModel(); };

  return (
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

            {isPublic && (
              <CTABox>
                <CTATitle>Mientras preparamos los primeros artículos…</CTATitle>
                <CTAText>Puedes ir adelantando y probar la plataforma: crea una cuenta como usuario para descubrir cómo funciona el videochat, o regístrate como modelo para preparar tu perfil.</CTAText>
                <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginTop:8 }}>
                  <NavButton type="button" onClick={handleRegisterClient}>Crear cuenta de usuario</NavButton>
                  <NavButton type="button" onClick={handleRegisterModel}>Registrarme como modelo</NavButton>
                </div>
              </CTABox>
            )}
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
    </PageWrap>
  );
};

export default BlogContent;
