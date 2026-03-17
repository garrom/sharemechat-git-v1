import React from 'react';
import { faGem, faUser } from '@fortawesome/free-solid-svg-icons';
import i18n from '../../i18n';
import NavbarBase from './NavbarBase';
import DesktopTabs from './DesktopTabs';
import DesktopActions from './DesktopActions';
import MobileMenu from './MobileMenu';
import MobileBottomNav from './MobileBottomNav';

const NavbarClient = ({
  activeTab,
  displayName,
  balanceTextDesktop = null,
  balanceTextMobile = null,
  avatarUrl = null,
  showBottomNav,
  onBrandClick,
  onGoVideochat,
  onGoFavorites,
  onGoBlog,
  onProfile,
  onBuy,
  onLogout,
  buyLabel = null,
  showLocaleSwitcher = true,
  showBalance = true,
  showAvatar = true,
  profileDisabled = false,
  videochatDisabled = false,
  favoritesDisabled = false,
  blogDisabled = false,
  buyDisabled = false,
}) => {
  const videochatLabel = i18n.t('dashboardClient.nav.videochat');
  const favoritesLabel = i18n.t('dashboardClient.nav.favorites');
  const blogLabel = i18n.t('dashboardClient.nav.blog');

  const effectiveBuyLabel = buyLabel || i18n.t('dashboardClient.actions.buy');

  const desktopLeft = (
    <DesktopTabs
      activeTab={activeTab}
      videochatLabel={videochatLabel}
      favoritesLabel={favoritesLabel}
      blogLabel={blogLabel}
      onGoVideochat={onGoVideochat}
      onGoFavorites={onGoFavorites}
      onGoBlog={onGoBlog}
      videochatDisabled={videochatDisabled}
      favoritesDisabled={favoritesDisabled}
      blogDisabled={blogDisabled}
    />
  );

  const desktopRight = (
    <DesktopActions
      displayName={displayName}
      balanceText={showBalance ? balanceTextDesktop : null}
      showLocaleSwitcher={showLocaleSwitcher}
      primaryAction={{
        label: effectiveBuyLabel,
        onClick: onBuy,
        icon: faGem,
        iconStyle: { color: '#22c55e', fontSize: '1rem' },
        disabled: buyDisabled,
      }}
      logoutLabel={i18n.t('dashboardClient.actions.logout')}
      logoutTitle={i18n.t('dashboardClient.actions.logoutTitle')}
      onLogout={onLogout}
      avatarUrl={avatarUrl}
      avatarFallback="/img/avatarChico.png"
      avatarTitle={i18n.t('dashboardClient.actions.viewProfile')}
      onAvatarClick={profileDisabled ? undefined : onProfile}
      showAvatar={showAvatar}
    />
  );

  const mobileMenu = ({ menuOpen, closeMenu }) => (
    <MobileMenu
      menuOpen={menuOpen}
      closeMenu={closeMenu}
      displayName={displayName}
      balanceText={showBalance ? balanceTextMobile : null}
      showLocaleSwitcher={showLocaleSwitcher}
      items={[
        {
          key: 'profile',
          icon: faUser,
          label: i18n.t('dashboardClient.actions.profile'),
          onClick: onProfile || (() => {}),
          useIconWrapper: true,
          disabled: profileDisabled,
        },
        {
          key: 'buy',
          icon: faGem,
          iconStyle: { color: '#22c55e', fontSize: '1rem' },
          label: effectiveBuyLabel,
          onClick: onBuy,
          useIconWrapper: false,
          disabled: buyDisabled,
        },
        {
          key: 'logout',
          label: i18n.t('dashboardClient.actions.logout'),
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
      videochatDisabled={videochatDisabled}
      favoritesDisabled={favoritesDisabled}
      blogDisabled={blogDisabled}
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