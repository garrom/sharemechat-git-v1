import React from 'react';
import {
  faChartColumn,
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
import IconSupport from './IconSupport';

const NavbarModel = ({
  activeTab,
  displayName,
  queueText = null,
  balanceTextDesktop = null,
  balanceTextMobile = null,
  studioTextDesktop = null,
  studioTextMobile = null,
  avatarUrl = null,
  showBottomNav,
  onBrandClick,
  onGoVideochat,
  onGoFavorites,
  onGoSupport,
  onGoBlog,
  onGoStats,
  onProfile,
  onWithdraw,
  onLogout,
  showLocaleSwitcher = true,
  localeGuard = null,
  showBalance = true,
  showQueue = true,
  showAvatar = true,
  profileDisabled = false,
  videochatDisabled = false,
  favoritesDisabled = false,
  supportDisabled = false,
  blogDisabled = false,
  statsDisabled = false,
  withdrawDisabled = false,
}) => {
  const videochatLabel = i18n.t('dashboardModel.nav.videochat');
  const favoritesLabel = i18n.t('dashboardModel.nav.favorites');
  const supportLabel = i18n.t('support.navbar.button');
  const blogLabel = i18n.t('dashboardModel.nav.blog');

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
      videochatDisabled={videochatDisabled}
      favoritesDisabled={favoritesDisabled}
      supportDisabled={supportDisabled}
      blogDisabled={blogDisabled}
    />
  );

  const desktopRight = (
    <DesktopActions
      displayName={displayName}
      queueText={showQueue ? queueText : null}
      studioText={showBalance ? studioTextDesktop : null}
      balanceText={showBalance ? balanceTextDesktop : null}
      showLocaleSwitcher={showLocaleSwitcher}
      localeGuard={localeGuard}
      // tertiaryAction (pill Afiliada) retirada el 2026-07-24 junto con el
      // resto del programa de afiliadas ([ADR-052 §D11]).
      // Stats / Withdraw / Logout: icon-only con tooltip nativo + aria-label
      // para screen readers (aria-label lo pone DesktopActions cuando iconOnly).
      primaryAction={{
        label: i18n.t('dashboardModel.actions.stats'),
        title: i18n.t('dashboardModel.actions.stats'),
        onClick: onGoStats,
        icon: faChartColumn,
        iconStyle: { color: '#22c55e', fontSize: '1rem' },
        disabled: statsDisabled,
        iconOnly: true,
      }}
      secondaryAction={{
        label: i18n.t('dashboardModel.actions.withdraw'),
        title: i18n.t('dashboardModel.actions.withdraw'),
        onClick: onWithdraw,
        icon: faGem,
        iconStyle: { color: '#f97316', fontSize: '1rem' },
        disabled: withdrawDisabled,
        iconOnly: true,
      }}
      logoutLabel={i18n.t('dashboardModel.actions.logout')}
      logoutTitle={i18n.t('dashboardModel.actions.logoutTitle')}
      onLogout={onLogout}
      logoutIconOnly={true}
      avatarUrl={avatarUrl}
      avatarFallback="/img/avatar-model.svg"
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
      topRightContent={showBalance ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {studioTextMobile ? <SaldoText>{studioTextMobile}</SaldoText> : null}
          {balanceTextMobile ? <SaldoText>{balanceTextMobile}</SaldoText> : null}
        </div>
      ) : null}
      showLocaleSwitcher={showLocaleSwitcher}
      localeGuard={localeGuard}
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
          icon: faChartColumn,
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
        ...(onGoSupport
          ? [{
              key: 'support',
              iconNode: <IconSupport size={20} />,
              label: supportLabel,
              onClick: onGoSupport,
              useIconWrapper: true,
              disabled: supportDisabled,
            }]
          : []),
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