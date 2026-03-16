import React from 'react';
import {
  MobileBottomNav as StyledMobileBottomNav,
  BottomNavButton,
} from '../../styles/NavbarStyles';

const MobileBottomNav = ({
  activeTab,
  videochatLabel,
  favoritesLabel,
  blogLabel,
  onGoVideochat,
  onGoFavorites,
  onGoBlog,
  visible = true,
}) => {
  if (!visible) return null;

  return (
    <StyledMobileBottomNav>
      <BottomNavButton active={activeTab === 'videochat'} onClick={onGoVideochat}>
        <span>{videochatLabel}</span>
      </BottomNavButton>

      <BottomNavButton active={activeTab === 'favoritos'} onClick={onGoFavorites}>
        <span>{favoritesLabel}</span>
      </BottomNavButton>

      <BottomNavButton active={activeTab === 'blog'} onClick={onGoBlog}>
        <span>{blogLabel}</span>
      </BottomNavButton>
    </StyledMobileBottomNav>
  );
};

export default MobileBottomNav;