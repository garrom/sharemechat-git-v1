import React from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect, useLocation } from 'react-router-dom';
import i18n from './i18n';
import RequireRole from './components/RequireRole';
import DashboardClient from './pages/dashboard/DashboardClient';
import DashboardModel from './pages/dashboard/DashboardModel';
import DashboardUserClient from './pages/dashboard/DashboardUserClient';
import DashboardUserModel from './pages/dashboard/DashboardUserModel';
import DashboardAdmin from './pages/admin/DashboardAdmin';
import AdminAccessPage from './pages/admin/AdminAccessPage';
import PerfilClient from './pages/subpages/PerfilClient';
import PerfilModel from './pages/subpages/PerfilModel';
import AffiliatePanelModel from './pages/subpages/AffiliatePanelModel';
import ModelKycVeriffPage from './pages/subpages/ModelKycVeriffPage';
import ModelKycDiditPage from './pages/subpages/ModelKycDiditPage';
import ModelKycDiditProcessingPage from './pages/subpages/ModelKycDiditProcessingPage';
import ClientKycDiditPage from './pages/subpages/ClientKycDiditPage';
import ClientKycProcessingPage from './pages/subpages/ClientKycProcessingPage';
import Blog from './pages/blog/Blog';
import BlogArticleView from './pages/blog/BlogArticleView';
import BlogNotFound from './pages/blog/BlogNotFound';
import ChangePasswordPage from './pages/subpages/ChangePasswordPage';
import ModelDocuments from './pages/subpages/ModelDocuments';
import Home from './public-pages/Home';
import Unauthorized from './public-pages/Unauthorized';
import ResetPassword from './public-pages/ResetPassword';
import ForgotPassword from './public-pages/ForgotPassword';
import AffiliateLandingPage from './public-pages/AffiliateLandingPage';
import AdminEmailVerificationPage from './pages/admin/AdminEmailVerificationPage';
import ProductEmailVerificationPage from './public-pages/ProductEmailVerificationPage';
import CheckoutSuccessPage from './public-pages/CheckoutSuccessPage';
import CheckoutCancelPage from './public-pages/CheckoutCancelPage';
import Roles from './constants/Roles';
import UserTypes from './constants/UserTypes';
import { ModalProvider } from './components/ModalProvider';
import GuestConsentGate from './consent/GuestConsentGate';
import { GlobalTypography } from './styles/core/typography';
import Footer from './footer/Footer';
import Legal from './footer/Legal';
import ComplaintForm from './footer/ComplaintForm';
import Faq from './footer/Faq';
import Safety from './footer/Safety';
import Rules from './footer/Rules';
import Config from './footer/Config';
import CookieBanner from './components/CookieBanner';
import { CallUiProvider } from './components/CallUiContext';
import { SessionProvider } from './components/SessionProvider';
import MaintenanceProvider from './components/MaintenanceProvider';
import { buildAdminAppUrl, isAdminSurface } from './utils/runtimeSurface';

const PublicWithGuestGate = ({ component: Component, ...rest }) => (
  <Route {...rest} render={(props) => (<GuestConsentGate><Component {...props} /></GuestConsentGate>)} />
);

// ADR-049 Subpasada 2E fix UX: en las rutas de captacion de la landing
// publica del programa de afiliadas (/i y /register/client) ocultamos el
// Footer global. El visitante ha llegado con intencion de registrarse y
// conseguir el bono; los links del footer (FAQ, Safety, Rules, Legal)
// son links reales de React Router que le sacan del contexto de
// conversion. Patron estandar de industria en landings de captacion:
// reducir superficies de escape al maximo hasta que el usuario complete
// (o abandone conscientemente) la conversion. Los links legales
// imprescindibles (T&C, Privacidad) siguen accesibles desde el modal de
// registro que se abre al pulsar el CTA principal.
const AFFILIATE_LANDING_PATHS = ['/i', '/register/client'];
const ConditionalFooter = () => {
  const location = useLocation();
  const path = location.pathname || '';
  const isAffiliateLanding = AFFILIATE_LANDING_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`)
  );
  if (isAffiliateLanding) return null;
  return <Footer />;
};

const ExternalRedirect = ({ to }) => {
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.replace(to);
    }
  }, [to]);

  return null;
};

function App() {
  const adminSurface = isAdminSurface();

  // Fase 4B.3 (ADR-022) + paquete 5 (ADR-025): deteccion de locale por
  // prefijo de URL. La URL es la fuente de verdad estricta.
  //
  // Excepcion paquete 5: las rutas del blog (`/blog`, `/blog/{locale}`,
  // `/blog/{locale}/{slug}`) llevan el locale en el path interno y NO
  // pasan por el basename `/en` global. Si el path empieza por `/blog`,
  // basename siempre es `/`, aunque el path empezara casualmente por
  // `/en/blog/...` (caso de backlinks viejos -> 404 limpio, sin colision
  // con el detector de basename).
  const initialPath = typeof window !== 'undefined' && window.location
    ? window.location.pathname
    : '/';
  const isBlogPath = initialPath === '/blog'
    || initialPath.startsWith('/blog/');
  const matchesEn = !adminSurface
    && !isBlogPath
    && (initialPath === '/en' || initialPath.startsWith('/en/'));
  const localeBasename = matchesEn ? '/en' : '/';

  // /en/legal queda fuera del scope multilingue (ADR-022 D9: /legal se
  // mantiene hardcoded en ingles, sin version bajo /en/). Redirigimos via
  // location.replace para que el navegador retire el prefijo de la barra
  // de URL. NO es navegacion SPA porque cruza basenames; el navegador
  // recarga y vuelve a ejecutar este bloque con path "/legal" -> es.
  if (matchesEn
      && (initialPath === '/en/legal' || initialPath.startsWith('/en/legal/'))) {
    if (typeof window !== 'undefined') {
      const stripped = initialPath.replace(/^\/en/, '');
      window.location.replace(stripped + window.location.search + window.location.hash);
    }
    return null;
  }

  // Sincronizar i18n con el locale detectado en la URL antes de renderizar
  // para evitar flash de chrome en el locale incorrecto.
  //
  // Reglas:
  //  - En rutas del blog (`/blog/{locale}/...`), el locale viene del SEGUNDO
  //    segmento del path. Esto desacopla el chrome del blog del basename
  //    global del resto del producto (paquete 5).
  //  - En el resto del producto, sigue valiendo el detector `matchesEn`
  //    (basename `/en` global).
  let expectedLocale = matchesEn ? 'en' : 'es';
  if (isBlogPath) {
    const parts = initialPath.split('/').filter(Boolean);
    // ['blog', 'es', 'mi-slug'] -> parts[1] = 'es'
    if (parts.length >= 2 && (parts[1] === 'es' || parts[1] === 'en')) {
      expectedLocale = parts[1];
    } else {
      // /blog (sin locale) -> default ES; el redirect del Router se encarga.
      expectedLocale = 'es';
    }
  }
  if (i18n.language !== expectedLocale) {
    i18n.changeLanguage(expectedLocale);
  }

  return (
    <Router basename={localeBasename}>
      <SessionProvider>
        <CallUiProvider>
          <ModalProvider>
            <MaintenanceProvider>
              <GlobalTypography />

              {adminSurface ? (
                <Switch>
                  <Route exact path="/" render={() => <Redirect to="/dashboard-admin" />} />
                  <Route exact path="/login" component={AdminAccessPage} />
                  <Route exact path="/verify-email" component={AdminEmailVerificationPage} />
                  <Route
                    path="/dashboard-admin"
                    render={() => (
                      <RequireRole backofficeRoles={['ADMIN', 'SUPPORT', 'AUDIT']}>
                        <DashboardAdmin />
                      </RequireRole>
                    )}
                  />
                  <Route path="/unauthorized" component={Unauthorized} />
                  <Redirect to="/dashboard-admin" />
                </Switch>
              ) : (
                <>
                  <Switch>
                    <PublicWithGuestGate exact path="/" component={Home} />
                    <PublicWithGuestGate exact path="/login" component={Home} />
                    {/* Blog publico bilingue (paquete 5, ADR-025): locale en path. */}
                    {/* /blog sin locale -> redirect a /blog/es (mercado primario). */}
                    <Route exact path="/blog" render={() => <Redirect to="/blog/es" />} />
                    <PublicWithGuestGate exact path="/blog/:locale(es|en)" component={Blog} />
                    <PublicWithGuestGate exact path="/blog/:locale(es|en)/:slug" component={BlogArticleView} />
                    {/* Catch-all del blog (paquete 5 ext, ADR-025): cualquier */}
                    {/* `/blog/{algo}` o `/blog/{algo}/{slug}` donde `{algo}` no */}
                    {/* sea `es` ni `en` cae a la 404 propia del blog en vez */}
                    {/* del wildcard global `<Redirect to="/unauthorized" />`. */}
                    {/* Sin `exact`: absorbe cualquier profundidad de path. */}
                    <Route path="/blog" component={BlogNotFound} />
                    <Route path="/forgot-password" component={ForgotPassword} />
                    <Route path="/unauthorized" component={Unauthorized} />
                    <Route path="/reset-password" component={ResetPassword} />
                    <Route path="/verify-email" component={ProductEmailVerificationPage} />
                    {/* ADR-051 Fase 4: retorno del hosted checkout NOWPayments.
                        /checkout/success hace polling al backend hasta ver
                        SUCCESS via webhook (o timeout). /checkout/cancel
                        muestra mensaje simple. Ambas requieren sesion viva
                        (RequireRole cliente para USER/CLIENT); si el usuario
                        cerro sesion antes de volver, RequireRole redirige a
                        /unauthorized. */}
                    <Route path="/checkout/success" render={() => (<RequireRole roles={[Roles.USER, Roles.CLIENT]}><CheckoutSuccessPage /></RequireRole>)} />
                    <Route path="/checkout/cancel" render={() => (<RequireRole roles={[Roles.USER, Roles.CLIENT]}><CheckoutCancelPage /></RequireRole>)} />
                    {/* ADR-049 Subpasada 2E: landing publica del programa de
                        afiliadas. /i?ref=<code> es el destino del QR y de la
                        URL directa que la modelo comparte. /register/client
                        es el destino del redirect 302 del backend tras
                        consumir un magic link (?ref=<code>&email_verified=true).
                        Ambas rutas montan el mismo componente; el componente
                        decide que renderizar segun query params y sesion.

                        Envuelto en PublicWithGuestGate (mismo patron que
                        Home/Blog/Login) para que el AgeGateModal se
                        superponga si el visitante no ha confirmado edad
                        18+ todavia. Sin este wrapper, openLoginModal hace
                        return silencioso por el guard isLocalAgeOk y los
                        botones CTA no responden. */}
                    <PublicWithGuestGate path="/i" component={AffiliateLandingPage} />
                    <PublicWithGuestGate path="/register/client" component={AffiliateLandingPage} />
                    <Route path="/legal" component={Legal} />
                    <Route path="/complaint" component={ComplaintForm} />
                    <Route path="/faq" component={Faq} />
                    <Route path="/safety" component={Safety} />
                    <Route path="/community-guidelines" component={Rules} />
                    <Route path="/cookies-settings" component={Config} />

                    <Route path="/client" render={() => (<RequireRole role="CLIENT"><DashboardClient /></RequireRole>)} />
                    <Route path="/model" render={() => (<RequireRole role="MODEL"><DashboardModel /></RequireRole>)} />
                    <Route path="/dashboard-admin" render={() => <ExternalRedirect to={buildAdminAppUrl('/dashboard-admin')} />} />

                    <Route path="/dashboard-user-client" render={() => (<RequireRole role="USER" allowedUserTypes={[UserTypes.FORM_CLIENT]}><DashboardUserClient /></RequireRole>)} />
                    <Route path="/dashboard-user-model" render={() => (<RequireRole role="USER" allowedUserTypes={[UserTypes.FORM_MODEL]}><DashboardUserModel /></RequireRole>)} />

                    <Route path="/model-documents" render={() => (<RequireRole role="USER" allowedUserTypes={[UserTypes.FORM_MODEL]}><ModelDocuments /></RequireRole>)} />
                    <Route path="/model-kyc-didit/processing" render={() => (<RequireRole role="USER" allowedUserTypes={[UserTypes.FORM_MODEL]}><ModelKycDiditProcessingPage /></RequireRole>)} />
                    <Route path="/model-kyc-didit" render={() => (<RequireRole role="USER" allowedUserTypes={[UserTypes.FORM_MODEL]}><ModelKycDiditPage /></RequireRole>)} />
                    {/* /model-kyc: placeholder Veriff dormido (frente Veriff archivado, ADR-035 Plan A = Didit). Ruta conservada por compatibilidad historica con la URL antigua; no se referencia desde dashboard activo. */}
                    <Route path="/model-kyc" render={() => (<RequireRole role="USER" allowedUserTypes={[UserTypes.FORM_MODEL]}><ModelKycVeriffPage /></RequireRole>)} />
                    {/* /client-kyc: alineado con el hot-fix backend 8456660. Pre-recarga
                        el usuario es USER + FORM_CLIENT y aun asi debe poder verificar
                        edad (ADR-029: age verification ANTES de la primera recarga). Post-
                        recarga el role escala a CLIENT (caso futuro). Filtrado fino por
                        user_type para excluir FORM_MODEL/MODEL/ADMIN. Composicion natural
                        de la API ya soportada por RequireRole (roles + allowedUserTypes),
                        sin extender el componente. */}
                    <Route path="/client-kyc/processing" render={() => (<RequireRole roles={[Roles.USER, Roles.CLIENT]} allowedUserTypes={[UserTypes.FORM_CLIENT]}><ClientKycProcessingPage /></RequireRole>)} />
                    <Route path="/client-kyc" render={() => (<RequireRole roles={[Roles.USER, Roles.CLIENT]} allowedUserTypes={[UserTypes.FORM_CLIENT]}><ClientKycDiditPage /></RequireRole>)} />

                    <Route path="/perfil-client" render={() => (<RequireRole role="CLIENT"><PerfilClient /></RequireRole>)} />
                    <Route path="/perfil-model" render={() => (<RequireRole role="MODEL"><PerfilModel /></RequireRole>)} />
                    {/* ADR-049 Subpasada 2C: panel de Afiliadas de la modelo.
                        Placeholder mientras no llegue la implementacion real
                        (URL/QR/stats — subpasada 2D). */}
                    <Route path="/perfil-modelo/afiliada" render={() => (<RequireRole role="MODEL"><AffiliatePanelModel /></RequireRole>)} />
                    <Route path="/change-password" render={() => (<RequireRole roles={[Roles.CLIENT, Roles.MODEL, Roles.ADMIN]}><ChangePasswordPage /></RequireRole>)} />
                    {/* Fallback para bookmarks antiguos: el chat con el
                        Agente IA vive dentro de /client|/model (panel central
                        de favoritos). No hay página propia /support. */}
                    <Route path="/support" render={() => <Redirect to="/client" />} />

                    <Redirect to="/unauthorized" />
                  </Switch>

                  <ConditionalFooter />
                  <CookieBanner />
                </>
              )}
            </MaintenanceProvider>
          </ModalProvider>
        </CallUiProvider>
      </SessionProvider>
    </Router>
  );
}

export default App;
