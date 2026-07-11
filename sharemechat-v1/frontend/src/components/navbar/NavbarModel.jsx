import React from 'react';
import {
  faChartLine,
  faGem,
  faShareNodes,
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
  onGoSupport,
  onGoBlog,
  onGoStats,
  onGoAffiliate,
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
  supportDisabled = false,
  blogDisabled = false,
  statsDisabled = false,
  withdrawDisabled = false,
  affiliateDisabled = false,
}) => {
  const videochatLabel = i18n.t('dashboardModel.nav.videochat');
  const favoritesLabel = i18n.t('dashboardModel.nav.favorites');
  const supportLabel = i18n.t('support.navbar.button');
  const blogLabel = i18n.t('dashboardModel.nav.blog');
  const affiliateLabel = i18n.t('dashboardModel.nav.affiliate');

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
      balanceText={showBalance ? balanceTextDesktop : null}
      showLocaleSwitcher={showLocaleSwitcher}
      // ADR-049 Subpasada 2C: tertiaryAction = pill de Afiliada, PRIMERO del
      // grupo derecho, con texto visible. Solo se muestra si el caller
      // provee onGoAffiliate (siempre en NavbarModel; NavbarClient lo omite).
      tertiaryAction={onGoAffiliate ? {
        label: affiliateLabel,
        title: affiliateLabel,
        onClick: onGoAffiliate,
        icon: faShareNodes,
        iconStyle: { color: '#0ea5e9', fontSize: '1rem' },
        disabled: affiliateDisabled,
      } : null}
      // Stats / Withdraw / Logout: icon-only con tooltip nativo + aria-label
      // para screen readers (aria-label lo pone DesktopActions cuando iconOnly).
      primaryAction={{
        label: i18n.t('dashboardModel.actions.stats'),
        title: i18n.t('dashboardModel.actions.stats'),
        onClick: onGoStats,
        icon: faChartLine,
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
        ...(onGoAffiliate ? [{
          key: 'affiliate',
          icon: faShareNodes,
          iconStyle: { color: '#0ea5e9', fontSize: '1rem' },
          label: affiliateLabel,
          title: affiliateLabel,
          onClick: onGoAffiliate,
          useIconWrapper: false,
          disabled: affiliateDisabled,
        }] : []),
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
        ...(onGoSupport
          ? [{
              key: 'support',
              iconImgSrc: '/img/icono-agente-ia.png',
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