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
  videochatDisabled = false,
  favoritesDisabled = false,
  blogDisabled = false,
  visible = true,
}) => {
  if (!visible) return null;

  return (
    <StyledMobileBottomNav>
      <BottomNavButton
        active={activeTab === 'videochat'}
        onClick={onGoVideochat}
        disabled={videochatDisabled}
        style={videochatDisabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
      >
        <span>{videochatLabel}</span>
      </BottomNavButton>

      <BottomNavButton
        active={activeTab === 'favoritos'}
        onClick={onGoFavorites}
        disabled={favoritesDisabled}
        style={favoritesDisabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
      >
        <span>{favoritesLabel}</span>
      </BottomNavButton>

      <BottomNavButton
        active={activeTab === 'blog'}
        onClick={onGoBlog}
        disabled={blogDisabled}
        style={blogDisabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
      >
        <span>{blogLabel}</span>
      </BottomNavButton>
    </StyledMobileBottomNav>
  );
};

export default MobileBottomNav;