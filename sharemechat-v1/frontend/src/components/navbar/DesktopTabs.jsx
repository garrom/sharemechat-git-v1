import React from 'react';
import { StyledNavTab } from '../../styles/NavbarStyles';

const DesktopTabs = ({
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
}) => {
  return (
    <div
      className="desktop-only"
      style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}
    >
      <StyledNavTab
        type="button"
        data-active={activeTab === 'videochat'}
        aria-pressed={activeTab === 'videochat'}
        onClick={onGoVideochat}
        title={videochatLabel}
        disabled={videochatDisabled}
        style={videochatDisabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
      >
        {videochatLabel}
      </StyledNavTab>

      <StyledNavTab
        type="button"
        data-active={activeTab === 'favoritos'}
        aria-pressed={activeTab === 'favoritos'}
        onClick={onGoFavorites}
        title={favoritesLabel}
        disabled={favoritesDisabled}
        style={favoritesDisabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
      >
        {favoritesLabel}
      </StyledNavTab>

      <StyledNavTab
        type="button"
        data-active={activeTab === 'blog'}
        aria-pressed={activeTab === 'blog'}
        onClick={onGoBlog}
        title={blogLabel}
        disabled={blogDisabled}
        style={blogDisabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
      >
        {blogLabel}
      </StyledNavTab>
    </div>
  );
};

export default DesktopTabs;