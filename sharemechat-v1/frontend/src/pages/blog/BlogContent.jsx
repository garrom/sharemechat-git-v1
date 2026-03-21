// src/pages/blog/BlogContent.jsx
import React from 'react';
import { NavButton } from '../../styles/ButtonStyles';
import {
  PageWrap,
  PageInner,
  HeroSection,
  HeroContent,
  HeroKicker,
  HeroTitle,
  HeroLead,
  HeroTagline,
  HeroAside,
  HeroAsideInner,
  HeroAsideCard,
  HeroAsideCardTop,
  HeroAsideCardBody,
  HeroAsideRow,
  HeroAsideMini,
  HeroAsideMiniLine,
  FeaturedSection,
  FeaturedCard,
  FeaturedContent,
  FeaturedVisual,
  FeaturedVisualMain,
  FeaturedVisualCard,
  PlaceholderTop,
  PlaceholderBody,
  ContentGrid,
  MainColumn,
  SectionLabel,
  ArticlesGrid,
  ArticleCard,
  ArticleBadge,
  ArticleTitle,
  FeaturedTitle,
  ArticleMeta,
  FeaturedMeta,
  ArticleExcerpt,
  FeaturedExcerpt,
  Sidebar,
  SidebarTitle,
  SidebarText,
  TagPills,
  TagPill,
  CTABox,
  CTATitle,
  CTAText,
  CTAActions
} from '../../styles/pages-styles/BlogStyles';

const BlogContent = ({ mode = 'public', onGoRegisterClient, onGoRegisterModel }) => {
  const isPublic = mode === 'public';
  const handleRegisterClient = () => { if (onGoRegisterClient) onGoRegisterClient(); };
  const handleRegisterModel = () => { if (onGoRegisterModel) onGoRegisterModel(); };

  return (
    <PageWrap>
      <PageInner>
        <HeroSection>
          <HeroContent>
            <HeroKicker>SharemeChat Journal</HeroKicker>
            <HeroTitle>Articles, guidance and product notes around live one-to-one video chat.</HeroTitle>
            <HeroLead>
              This space is being shaped as a practical editorial layer for users and models who want clearer explanations, better context and useful insights around the platform.
            </HeroLead>
            <HeroTagline>
              Expect concise reading, calmer presentation and topics that stay close to the real product: privacy, etiquette, setup, payments, platform updates and the evolution of live online interaction.
            </HeroTagline>
          </HeroContent>

          <HeroAside aria-hidden="true">
            <HeroAsideInner>
              <HeroAsideCard data-large="true">
                <HeroAsideCardTop />
                <HeroAsideCardBody />
              </HeroAsideCard>

              <HeroAsideRow>
                <HeroAsideMini>
                  <HeroAsideMiniLine />
                  <HeroAsideMiniLine />
                  <HeroAsideMiniLine />
                </HeroAsideMini>
                <HeroAsideMini>
                  <HeroAsideMiniLine />
                  <HeroAsideMiniLine />
                  <HeroAsideMiniLine />
                </HeroAsideMini>
              </HeroAsideRow>
            </HeroAsideInner>
          </HeroAside>
        </HeroSection>

        <FeaturedSection>
          <FeaturedCard>
            <FeaturedContent>
              <ArticleBadge>Featured soon</ArticleBadge>
              <FeaturedTitle>How one-to-one video chat with models actually works.</FeaturedTitle>
              <FeaturedMeta>Editorial guide · Quick read · Platform overview</FeaturedMeta>
              <FeaturedExcerpt>
                We will break down the full journey from balance top-up to live session start, including how time is measured, what the interface is designed to do and what kind of flow users can realistically expect.
              </FeaturedExcerpt>
            </FeaturedContent>

            <FeaturedVisual aria-hidden="true">
              <FeaturedVisualCard data-pos="left">
                <PlaceholderTop />
                <PlaceholderBody />
              </FeaturedVisualCard>
              <FeaturedVisualMain>
                <PlaceholderTop />
                <PlaceholderBody />
              </FeaturedVisualMain>
              <FeaturedVisualCard data-pos="right">
                <PlaceholderTop />
                <PlaceholderBody />
              </FeaturedVisualCard>
            </FeaturedVisual>
          </FeaturedCard>
        </FeaturedSection>

        <ContentGrid>
          <MainColumn>
            <SectionLabel>Latest planned reads</SectionLabel>
            <ArticlesGrid>
              <ArticleCard>
                <ArticleBadge>Coming next</ArticleBadge>
                <ArticleTitle>Tips for keeping the experience respectful and safe.</ArticleTitle>
                <ArticleMeta>Users · Best practices</ArticleMeta>
                <ArticleExcerpt>
                  We will cover limits, respect, reporting tools and the small habits that help keep live sessions more comfortable for both users and models.
                </ArticleExcerpt>
              </ArticleCard>

              <ArticleCard>
                <ArticleBadge>Coming next</ArticleBadge>
                <ArticleTitle>Guide for models: how to get started on SharemeChat.</ArticleTitle>
                <ArticleMeta>Models · First steps</ArticleMeta>
                <ArticleExcerpt>
                  From setting up your space and equipment to understanding earnings and stats, this guide will focus on practical steps that matter early on.
                </ArticleExcerpt>
              </ArticleCard>
            </ArticlesGrid>

            {isPublic && (
              <CTABox>
                <CTATitle>Explore the platform while the editorial section keeps growing.</CTATitle>
                <CTAText>
                  If you want a more direct sense of how the experience works, you can already enter as a user or prepare your profile as a model while new articles are being published.
                </CTAText>
                <CTAActions>
                  <NavButton type="button" onClick={handleRegisterClient}>Crear cuenta de usuario</NavButton>
                  <NavButton type="button" onClick={handleRegisterModel}>Registrarme como modelo</NavButton>
                </CTAActions>
              </CTABox>
            )}
          </MainColumn>

          <Sidebar>
            <SidebarTitle>What you will find here</SidebarTitle>
            <SidebarText>
              The goal is to publish short, practical reading that answers real questions without filler: payments, safety, model workflows, product updates and the broader shift toward live digital interaction.
            </SidebarText>
            <SidebarTitle>Planned topics</SidebarTitle>
            <TagPills>
              <TagPill>User guides</TagPill>
              <TagPill>Model advice</TagPill>
              <TagPill>Safety and privacy</TagPill>
              <TagPill>Product updates</TagPill>
              <TagPill>Monetization</TagPill>
            </TagPills>
            <SidebarText>
              The editorial section will expand gradually, following the real rhythm of the platform and focusing first on the topics users and models actually need.
            </SidebarText>
          </Sidebar>
        </ContentGrid>
      </PageInner>
    </PageWrap>
  );
};

export default BlogContent;
