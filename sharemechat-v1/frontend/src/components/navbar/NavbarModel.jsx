import React from 'react';
import {
  faChartLine,
  faGem,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import i18n from '../../i18n';
import { SaldoText } from '../../styles/NavbarStyles';
import NavbarBase from './NavbarBase';
import DesktopTabs from './DesktopTabs';
import DesktopActions from './DesktopActions';
import MobileMenu from './MobileMenu';
import MobileBottomNav from './MobileBottomNav';

const NavbarModel = ({
  activeTab,
  displayName,
  queueText = null,
  balanceTextDesktop = null,
  balanceTextMobile = null,
  avatarUrl = null,
  showBottomNav,
  onBrandClick,
  onGoVideochat,
  onGoFavorites,
  onGoBlog,
  onGoStats,
  onProfile,
  onWithdraw,
  onLogout,
  showLocaleSwitcher = true,
  showBalance = true,
  showQueue = true,
  showAvatar = true,
  profileDisabled = false,
  videochatDisabled = false,
  favoritesDisabled = false,
  blogDisabled = false,
  statsDisabled = false,
  withdrawDisabled = false,
}) => {
  const videochatLabel = i18n.t('dashboardModel.nav.videochat');
  const favoritesLabel = i18n.t('dashboardModel.nav.favorites');
  const blogLabel = i18n.t('dashboardModel.nav.blog');

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
      queueText={showQueue ? queueText : null}
      balanceText={showBalance ? balanceTextDesktop : null}
      showLocaleSwitcher={showLocaleSwitcher}
      primaryAction={{
        label: i18n.t('dashboardModel.actions.stats'),
        title: i18n.t('dashboardModel.actions.stats'),
        onClick: onGoStats,
        icon: faChartLine,
        iconStyle: { color: '#22c55e', fontSize: '1rem' },
        disabled: statsDisabled,
      }}
      secondaryAction={{
        label: i18n.t('dashboardModel.actions.withdraw'),
        title: i18n.t('dashboardModel.actions.withdraw'),
        onClick: onWithdraw,
        icon: faGem,
        iconStyle: { color: '#f97316', fontSize: '1rem' },
        disabled: withdrawDisabled,
      }}
      logoutLabel={i18n.t('dashboardModel.actions.logout')}
      logoutTitle={i18n.t('dashboardModel.actions.logoutTitle')}
      onLogout={onLogout}
      avatarUrl={avatarUrl}
      avatarFallback="/img/avatarChica.png"
      avatarTitle={i18n.t('dashboardModel.actions.viewProfile')}
      onAvatarClick={profileDisabled ? undefined : onProfile}
      showAvatar={showAvatar}
    />
  );

  const mobileMenu = ({ menuOpen, closeMenu }) => (
    <MobileMenu
      menuOpen={menuOpen}
      closeMenu={closeMenu}
      displayName={displayName}
      queueText={showQueue ? queueText : null}
      balanceText={showBalance ? balanceTextMobile : null}
      topRightContent={showBalance ? <SaldoText>{balanceTextMobile}</SaldoText> : null}
      showLocaleSwitcher={showLocaleSwitcher}
      items={[
        {
          key: 'profile',
          icon: faUser,
          label: i18n.t('dashboardModel.actions.profile'),
          onClick: onProfile || (() => {}),
          useIconWrapper: true,
          disabled: profileDisabled,
        },
        {
          key: 'stats',
          icon: faChartLine,
          iconStyle: { color: '#22c55e', fontSize: '1rem' },
          label: i18n.t('dashboardModel.actions.stats'),
          title: i18n.t('dashboardModel.actions.stats'),
          onClick: onGoStats,
          useIconWrapper: false,
          disabled: statsDisabled,
        },
        {
          key: 'withdraw',
          icon: faGem,
          iconStyle: { color: '#f97316', fontSize: '1rem' },
          label: i18n.t('dashboardModel.actions.withdraw'),
          title: i18n.t('dashboardModel.actions.withdraw'),
          onClick: onWithdraw,
          useIconWrapper: false,
          disabled: withdrawDisabled,
        },
        {
          key: 'logout',
          label: i18n.t('dashboardModel.actions.logout'),
          title: i18n.t('dashboardModel.actions.logoutTitle'),
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
      mobileMenuButtonLabel={i18n.t('dashboardModel.nav.openMenu')}
      mobileMenuButtonTitle={i18n.t('dashboardModel.nav.menu')}
    />
  );
};

export default NavbarModel;