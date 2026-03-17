import React from 'react';
import { faGem, faUser, faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import i18n from '../../i18n';
import NavbarBase from './NavbarBase';
import DesktopTabs from './DesktopTabs';
import DesktopActions from './DesktopActions';
import MobileMenu from './MobileMenu';
import MobileBottomNav from './MobileBottomNav';

const NavbarClient = ({
  activeTab,
  displayName,
  balanceTextDesktop,
  balanceTextMobile,
  avatarUrl,
  showBottomNav,
  onBrandClick,
  onGoVideochat,
  onGoFavorites,
  onGoBlog,
  onProfile,
  onBuy,
  onLogout,
}) => {
  const videochatLabel = i18n.t('dashboardClient.nav.videochat');
  const favoritesLabel = i18n.t('dashboardClient.nav.favorites');
  const blogLabel = i18n.t('dashboardClient.nav.blog');

  const desktopLeft = (
    <DesktopTabs
      activeTab={activeTab}
      videochatLabel={videochatLabel}
      favoritesLabel={favoritesLabel}
      blogLabel={blogLabel}
      onGoVideochat={onGoVideochat}
      onGoFavorites={onGoFavorites}
      onGoBlog={onGoBlog}
    />
  );

  const desktopRight = (
    <DesktopActions
      displayName={displayName}
      balanceText={balanceTextDesktop}
      showLocaleSwitcher={true}
      primaryAction={{
        label: i18n.t('dashboardClient.actions.buy'),
        onClick: onBuy,
        icon: faGem,
        iconStyle: { color: '#22c55e', fontSize: '1rem' },
      }}
      logoutLabel={i18n.t('dashboardClient.actions.logout')}
      logoutTitle={i18n.t('dashboardClient.actions.logoutTitle')}
      onLogout={onLogout}
      avatarUrl={avatarUrl}
      avatarFallback="/img/avatarChico.png"
      avatarTitle={i18n.t('dashboardClient.actions.viewProfile')}
      onAvatarClick={onProfile}
    />
  );

  const mobileMenu = ({ menuOpen, closeMenu }) => (
    <MobileMenu
      menuOpen={menuOpen}
      closeMenu={closeMenu}
      displayName={displayName}
      balanceText={balanceTextMobile}
      showLocaleSwitcher={true}
      tabs={[
        {
          key: 'videochat',
          label: videochatLabel,
          active: activeTab === 'videochat',
          onClick: onGoVideochat,
        },
        {
          key: 'favoritos',
          label: favoritesLabel,
          active: activeTab === 'favoritos',
          onClick: onGoFavorites,
        },
        {
          key: 'blog',
          label: blogLabel,
          active: activeTab === 'blog',
          onClick: onGoBlog,
        },
      ]}
      items={[
        {
          key: 'profile',
          icon: faUser,
          label: i18n.t('dashboardClient.actions.profile'),
          onClick: onProfile,
          useIconWrapper: true,
        },
        {
          key: 'buy',
          icon: faGem,
          iconStyle: { color: '#22c55e', fontSize: '1rem' },
          label: i18n.t('dashboardClient.actions.buy'),
          onClick: onBuy,
          useIconWrapper: false,
        },
        {
          key: 'logout',
          icon: faSignOutAlt,
          label: i18n.t('dashboardClient.actions.logout'),
          title: i18n.t('dashboardClient.actions.logoutTitle'),
          onClick: onLogout,
          useIconWrapper: true,
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
      mobileMenuButtonLabel={i18n.t('dashboardClient.nav.openMenu')}
      mobileMenuButtonTitle={i18n.t('dashboardClient.nav.menu')}
    />
  );
};

export default NavbarClient;