import React from 'react';
import { faGem, faUser, faChartLine, faTicket } from '@fortawesome/free-solid-svg-icons';
import i18n from '../../i18n';
import NavbarBase from './NavbarBase';
import DesktopTabs from './DesktopTabs';
import DesktopActions from './DesktopActions';
import MobileMenu from './MobileMenu';
import MobileBottomNav from './MobileBottomNav';
import IconSupport from './IconSupport';

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
  onGoSupport,
  onGoBlog,
  onProfile,
  onBuy,
  onGoHistory,
  onGoTickets,
  onLogout,
  buyLabel = null,
  showLocaleSwitcher = true,
  showBalance = true,
  showAvatar = true,
  profileDisabled = false,
  videochatDisabled = false,
  favoritesDisabled = false,
  supportDisabled = false,
  blogDisabled = false,
  buyDisabled = false,
  historyDisabled = false,
  ticketsDisabled = false,
}) => {
  const videochatLabel = i18n.t('dashboardClient.nav.videochat');
  const favoritesLabel = i18n.t('dashboardClient.nav.favorites');
  const supportLabel = i18n.t('support.navbar.button');
  const blogLabel = i18n.t('dashboardClient.nav.blog');

  const effectiveBuyLabel = buyLabel || i18n.t('dashboardClient.actions.buy');
  const historyLabel = i18n.t('dashboardClient.actions.history', { defaultValue: 'Historial' });
  const ticketsLabel = i18n.t('support.tickets.navbar', { defaultValue: 'Mis incidencias' });

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
      balanceText={showBalance ? balanceTextDesktop : null}
      showLocaleSwitcher={showLocaleSwitcher}
      // ADR-049 Subpasada 2C: pill de Comprar / Buy pasa a icon-only para
      // alinearse con el patron compacto que introdujo NavbarModel. La
      // etiqueta se preserva via title + aria-label (DesktopActions lo
      // aplica cuando `iconOnly`).
      primaryAction={{
        label: effectiveBuyLabel,
        title: effectiveBuyLabel,
        onClick: onBuy,
        icon: faGem,
        iconStyle: { color: '#22c55e', fontSize: '1rem' },
        disabled: buyDisabled,
        iconOnly: true,
      }}
      // Historial de transacciones (2026-07-19 Fase 1). Simetria con
      // secondaryAction Withdraw del NavbarModel (icon-only con tooltip).
      secondaryAction={onGoHistory ? {
        label: historyLabel,
        title: historyLabel,
        onClick: onGoHistory,
        icon: faChartLine,
        iconStyle: { color: '#3b82f6', fontSize: '1rem' },
        disabled: historyDisabled,
        iconOnly: true,
      } : null}
      // ADR-054 T4: Mis incidencias (icon-only con tooltip).
      tertiaryAction={onGoTickets ? {
        label: ticketsLabel,
        title: ticketsLabel,
        onClick: onGoTickets,
        icon: faTicket,
        iconStyle: { color: '#a78bfa', fontSize: '1rem' },
        disabled: ticketsDisabled,
        iconOnly: true,
      } : null}
      logoutLabel={i18n.t('dashboardClient.actions.logout')}
      logoutTitle={i18n.t('dashboardClient.actions.logoutTitle')}
      onLogout={onLogout}
      logoutIconOnly={true}
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
        ...(onGoHistory ? [{
          key: 'history',
          icon: faChartLine,
          iconStyle: { color: '#3b82f6', fontSize: '1rem' },
          label: historyLabel,
          title: historyLabel,
          onClick: onGoHistory,
          useIconWrapper: false,
          disabled: historyDisabled,
        }] : []),
        ...(onGoTickets ? [{
          key: 'tickets',
          icon: faTicket,
          iconStyle: { color: '#a78bfa', fontSize: '1rem' },
          label: ticketsLabel,
          title: ticketsLabel,
          onClick: onGoTickets,
          useIconWrapper: false,
          disabled: ticketsDisabled,
        }] : []),
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