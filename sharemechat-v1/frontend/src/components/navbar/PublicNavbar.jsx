import React from 'react';
import { faGem, faHeadset } from '@fortawesome/free-solid-svg-icons';
import i18n from '../../i18n';
import NavbarBase from './NavbarBase';
import DesktopTabs from './DesktopTabs';
import DesktopActions from './DesktopActions';
import MobileMenu from './MobileMenu';
import MobileBottomNav from './MobileBottomNav';

const PublicNavbar = ({
  activeTab,
  onBrandClick,
  onGoVideochat,
  onGoFavorites,
  onGoSupport,
  onGoBlog,
  onBuy,
  onLogin,
  showLocaleSwitcher = true,
  showBottomNav = true,
}) => {
  const videochatLabel = i18n.t('home.nav.videochat');
  const favoritesLabel = i18n.t('home.nav.favorites');
  const supportLabel = i18n.t('support.navbar.button');
  const blogLabel = i18n.t('home.nav.blog');

  const desktopLeft = (
    <DesktopTabs
      activeTab={activeTab}
      videochatLabel={videochatLabel}
      favoritesLabel={favoritesLabel}
      supportLabel={onGoSupport ? supportLabel : null}
      blogLabel={blogLabel}
      onGoVideochat={onGoVideochat}
      onGoFavorites={onGoFavorites}
      onGoSupport={onGoSupport}
      onGoBlog={onGoBlog}
    />
  );

  const desktopRight = (
    <DesktopActions
      displayName=""
      balanceText={null}
      queueText={null}
      showLocaleSwitcher={showLocaleSwitcher}
      primaryAction={{
        label: i18n.t('home.cta.buy'),
        onClick: onBuy,
        icon: faGem,
        iconStyle: { color: '#22c55e', fontSize: '1rem' },
      }}
      secondaryAction={{
        label: i18n.t('home.cta.login'),
        onClick: onLogin,
      }}
      logoutLabel=""
      logoutTitle=""
      onLogout={() => {}}
      showAvatar={false}
      wrapperClassName="desktop-only"
      useNavGroupAttr={false}
    />
  );

  const mobileMenu = ({ menuOpen, closeMenu }) => (
    <MobileMenu
      menuOpen={menuOpen}
      closeMenu={closeMenu}
      displayName=""
      balanceText={null}
      topRightContent={null}
      showLocaleSwitcher={showLocaleSwitcher}
      items={[
        {
          key: 'buy',
          icon: faGem,
          iconStyle: { color: '#22c55e', fontSize: '1rem' },
          label: i18n.t('home.cta.buy'),
          onClick: onBuy,
          useIconWrapper: false,
        },
        ...(onGoSupport
          ? [{
              key: 'support',
              icon: faHeadset,
              label: supportLabel,
              onClick: onGoSupport,
              useIconWrapper: true,
            }]
          : []),
        {
          key: 'login',
          label: i18n.t('home.cta.login'),
          onClick: onLogin,
          useIconWrapper: false,
        },
      ]}
    />
  );

  const mobileBottomNav = (
    <MobileBottomNav
      activeTab={activeTab}
      videochatLabel={videochatLabel}
      favoritesLabel={favoritesLabel}
      blogLabel={blogLabel}
      onGoVideochat={onGoVideochat}
      onGoFavorites={onGoFavorites}
      onGoBlog={onGoBlog}
      visible={showBottomNav}
    />
  );

  return (
    <NavbarBase
      onBrandClick={onBrandClick}
      brandAriaLabel="SharemeChat"
      desktopLeft={desktopLeft}
      desktopRight={desktopRight}
      mobileMenu={mobileMenu}
      mobileBottomNav={mobileBottomNav}
      mobileMenuButtonLabel={i18n.t('home.nav.openMenuAria')}
      mobileMenuButtonTitle={i18n.t('home.nav.menuTitle')}
    />
  );
};

export default PublicNavbar;