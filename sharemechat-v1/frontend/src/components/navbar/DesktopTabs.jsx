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
      >
        {videochatLabel}
      </StyledNavTab>

      <StyledNavTab
        type="button"
        data-active={activeTab === 'favoritos'}
        aria-pressed={activeTab === 'favoritos'}
        onClick={onGoFavorites}
        title={favoritesLabel}
      >
        {favoritesLabel}
      </StyledNavTab>

      <StyledNavTab
        type="button"
        data-active={activeTab === 'blog'}
        aria-pressed={activeTab === 'blog'}
        onClick={onGoBlog}
        title={blogLabel}
      >
        {blogLabel}
      </StyledNavTab>
    </div>
  );
};

export default DesktopTabs;