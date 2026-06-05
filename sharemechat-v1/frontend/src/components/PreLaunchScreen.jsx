// src/components/PreLaunchScreen.jsx
//
// Pantalla pre-launch (ADR-009 PRELAUNCH mode).
//
// Renderizada por RequireRole cuando /api/users/me indica
// productAccessMode === 'PRELAUNCH' && allowlisted !== true. Sustituye al
// producto real: el usuario logueado ve esta pantalla "coming soon" en
// lugar del dashboard, perfil o cualquier ruta protegida del producto.
//
// Reutiliza los componentes de marca del sitio publico (NavbarBase +
// DesktopActions + MobileMenu para la navbar; HeroBackground/Overlay/
// Content/Copy/Title/Subtitle del hero de la home; tokens GlobalBlack
// para CSS vars de altura de navbar). La imagen de fondo se sirve desde
// el CDN de assets por entorno (ASSETS_BASE), siguiendo EXACTAMENTE la
// convencion del hero de Home (ver PreLaunchStyles).
//
// El cierre real esta en el backend (ProductOperationalModeFilter +
// ProductOperationalModeWsInterceptor): aunque alguien fuerce el URL del
// dashboard, los endpoints sensibles responden 503 PRODUCT_UNAVAILABLE
// para no-allowlisted. Esta pantalla es solo la experiencia visible.

import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons';
import i18n from '../i18n';
import { apiFetch } from '../config/http';
import { useSession } from './SessionProvider';
import NavbarBase from './navbar/NavbarBase';
import DesktopActions from './navbar/DesktopActions';
import MobileMenu from './navbar/MobileMenu';
import Roles from '../constants/Roles';
import UserTypes from '../constants/UserTypes';
import {
  GlobalBlack,
  HeroBackground,
  HeroContainer,
  HeroContent,
  HeroCopy,
  HeroOverlay,
  HeroSubtitle,
  HeroTitle,
  HomePageStack,
} from '../styles/public-styles/HomeStyles';
import {
  PreLaunchBackground,
  PreLaunchSection,
  PreLaunchVerifyBody,
  PreLaunchVerifyButton,
  PreLaunchVerifyCard,
  PreLaunchVerifyFeedback,
  PreLaunchVerifyTitle,
} from '../styles/public-styles/PreLaunchStyles';

// Decide si el usuario logueado encaja en la rama "modelo" o "cliente",
// para elegir el copy. role=MODEL o role=USER+userType=FORM_MODEL -> model.
// Resto (CLIENT, USER+FORM_CLIENT, fallback) -> client.
const resolveRoleSlot = (user) => {
  const role = String(user?.role || '').toUpperCase();
  const userType = String(user?.userType || '').toUpperCase();
  if (role === Roles.MODEL) return 'model';
  if (role === Roles.USER && userType === UserTypes.FORM_MODEL) return 'model';
  return 'client';
};

// Marcador silencioso para evitar warning de import no usado del
// HeroBackground. El styled component oficial de la home se mantiene en
// el bundle por reutilizacion documental, aunque aqui usamos el
// PreLaunchBackground con la imagen propia.
void HeroBackground;

const PreLaunchScreen = () => {
  const history = useHistory();
  const { user } = useSession();
  const t = (key, options) => i18n.t(key, options);

  const [resending, setResending] = useState(false);
  const [resentOk, setResentOk] = useState('');
  const [resentErr, setResentErr] = useState('');

  const slot = resolveRoleSlot(user);
  const name = user?.nickname || user?.name || user?.email || '';

  const titleKey = `modals.preLaunch.${slot}.title`;
  const bodyKey = `modals.preLaunch.${slot}.body`;

  const emailUnverified = !user?.emailVerifiedAt;

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      /* noop */
    }
    history.push('/');
  };

  const handleResend = async () => {
    setResentOk('');
    setResentErr('');
    setResending(true);
    try {
      const response = await apiFetch('/email-verification/resend', { method: 'POST' });
      const msg = (response && response.message)
        ? response.message
        : t('modals.preLaunch.common.verifyResentOk');
      setResentOk(msg);
    } catch (e) {
      setResentErr((e && e.message) || t('modals.preLaunch.common.verifyResentError'));
    } finally {
      setResending(false);
    }
  };

  const logoutLabel = t('modals.preLaunch.common.logout');

  const desktopRight = (
    <DesktopActions
      showLocaleSwitcher
      logoutLabel={logoutLabel}
      logoutTitle={logoutLabel}
      onLogout={handleLogout}
      showAvatar={false}
      useNavGroupAttr={false}
    />
  );

  const mobileMenu = ({ menuOpen, closeMenu }) => (
    <MobileMenu
      menuOpen={menuOpen}
      closeMenu={closeMenu}
      showLocaleSwitcher
      items={[
        {
          key: 'logout',
          icon: faSignOutAlt,
          label: logoutLabel,
          onClick: handleLogout,
          useIconWrapper: false,
        },
      ]}
    />
  );

  return (
    <>
      <GlobalBlack />

      <NavbarBase
        onBrandClick={(e) => { if (e && e.preventDefault) e.preventDefault(); }}
        brandAriaLabel="SharemeChat"
        desktopRight={desktopRight}
        mobileMenu={mobileMenu}
        mobileMenuButtonLabel={t('modals.preLaunch.common.menuLabel')}
        mobileMenuButtonTitle={t('modals.preLaunch.common.menuTitle')}
      />

      <HomePageStack>
        <PreLaunchSection>
          <HeroContainer>
            <PreLaunchBackground />
            <HeroOverlay />

            <HeroContent>
              <HeroCopy>
                <HeroTitle>{t(titleKey, { name })}</HeroTitle>
                <HeroSubtitle>{t(bodyKey)}</HeroSubtitle>

                {emailUnverified && (
                  <PreLaunchVerifyCard>
                    <PreLaunchVerifyTitle>
                      {t('modals.preLaunch.common.verifyTitle')}
                    </PreLaunchVerifyTitle>
                    <PreLaunchVerifyBody>
                      {t('modals.preLaunch.common.verifyBody')}
                    </PreLaunchVerifyBody>
                    <PreLaunchVerifyButton
                      type="button"
                      onClick={handleResend}
                      disabled={resending}
                    >
                      {resending
                        ? t('modals.preLaunch.common.verifyResending')
                        : t('modals.preLaunch.common.verifyResend')}
                    </PreLaunchVerifyButton>
                    {resentOk && (
                      <PreLaunchVerifyFeedback $kind="ok">{resentOk}</PreLaunchVerifyFeedback>
                    )}
                    {resentErr && (
                      <PreLaunchVerifyFeedback $kind="err">{resentErr}</PreLaunchVerifyFeedback>
                    )}
                  </PreLaunchVerifyCard>
                )}
              </HeroCopy>
            </HeroContent>
          </HeroContainer>
        </PreLaunchSection>
      </HomePageStack>
    </>
  );
};

export default PreLaunchScreen;
