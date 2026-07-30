import React from 'react';
import { faUser } from '@fortawesome/free-solid-svg-icons';
import i18n from '../../i18n';
import { SaldoText, StyledNavTab } from '../../styles/NavbarStyles';
import NavbarBase from './NavbarBase';
import DesktopActions from './DesktopActions';
import MobileMenu from './MobileMenu';

// ADR-056 Fase S5.a: navbar del dashboard Master post-login.
// Tabs del dashboard interno: Overview / Modelos / Historial / Payout
// + tab Blog (contenido publico). Acciones icon-only: Perfil + Logout.
// Sin videochat/favoritos: no aplica al rol Master (no emite, no consume).

const NavbarMaster = ({
  activeTab,
  displayName,
  balanceTextDesktop = null,
  balanceTextMobile = null,
  onBrandClick,
  onGoOverview,
  onGoModelos,
  onGoHistorial,
  onGoPayout,
  onGoBlog,
  onProfile,
  onLogout,
  showLocaleSwitcher = true,
  showBalance = true,
}) => {
  const overviewLabel = i18n.t('masterDashboard.nav.overview');
  const modelosLabel = i18n.t('masterDashboard.nav.modelos');
  const historialLabel = i18n.t('masterDashboard.nav.historial');
  const payoutLabel = i18n.t('masterDashboard.nav.payout');
  const blogLabel = i18n.t('masterDashboard.nav.blog');

  const tab = (key, label, onClick) => (
    <StyledNavTab
      type="button"
      key={key}
      data-active={activeTab === key}
      aria-pressed={activeTab === key}
      onClick={onClick}
      title={label}
    >
      {label}
    </StyledNavTab>
  );

  const desktopLeft = (
    <div
      className="desktop-only"
      style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}
    >
      {tab('overview', overviewLabel, onGoOverview)}
      {tab('modelos', modelosLabel, onGoModelos)}
      {tab('historial', historialLabel, onGoHistorial)}
      {tab('payout', payoutLabel, onGoPayout)}
      {tab('blog', blogLabel, onGoBlog)}
    </div>
  );

  const desktopRight = (
    <DesktopActions
      displayName={displayName}
      queueText={null}
      balanceText={showBalance ? balanceTextDesktop : null}
      showLocaleSwitcher={showLocaleSwitcher}
      primaryAction={null}
      secondaryAction={null}
      logoutLabel={i18n.t('masterDashboard.actions.logout')}
      logoutTitle={i18n.t('masterDashboard.actions.logoutTitle')}
      onLogout={onLogout}
      logoutIconOnly={true}
      avatarUrl={null}
      avatarFallback="/img/avatar-master.png"
      avatarTitle={i18n.t('masterDashboard.actions.profile')}
      onAvatarClick={onProfile}
      showAvatar={true}
    />
  );

  const mobileMenu = ({ menuOpen, closeMenu }) => (
    <MobileMenu
      menuOpen={menuOpen}
      closeMenu={closeMenu}
      displayName={displayName}
      queueText={null}
      balanceText={showBalance ? balanceTextMobile : null}
      topRightContent={showBalance ? <SaldoText>{balanceTextMobile}</SaldoText> : null}
      showLocaleSwitcher={showLocaleSwitcher}
      items={[
        {
          key: 'profile',
          icon: faUser,
          label: i18n.t('masterDashboard.actions.profile'),
          onClick: onProfile || (() => {}),
          useIconWrapper: true,
        },
        {
          key: 'overview',
          label: overviewLabel,
          onClick: onGoOverview,
          useIconWrapper: false,
        },
        {
          key: 'modelos',
          label: modelosLabel,
          onClick: onGoModelos,
          useIconWrapper: false,
        },
        {
          key: 'historial',
          label: historialLabel,
          onClick: onGoHistorial,
          useIconWrapper: false,
        },
        {
          key: 'payout',
          label: payoutLabel,
          onClick: onGoPayout,
          useIconWrapper: false,
        },
        {
          key: 'blog',
          label: blogLabel,
          onClick: onGoBlog,
          useIconWrapper: false,
        },
        {
          key: 'logout',
          label: i18n.t('masterDashboard.actions.logout'),
          title: i18n.t('masterDashboard.actions.logoutTitle'),
          onClick: onLogout,
          useIconWrapper: true,
        },
      ]}
    />
  );

  return (
    <NavbarBase
      onBrandClick={onBrandClick}
      brandAriaLabel="SharemeChat"
      desktopLeft={desktopLeft}
      desktopRight={desktopRight}
      mobileMenu={mobileMenu}
      mobileBottomNav={null}
      mobileMenuButtonLabel={i18n.t('masterDashboard.nav.openMenu')}
      mobileMenuButtonTitle={i18n.t('masterDashboard.nav.menu')}
    />
  );
};

export default NavbarMaster;
