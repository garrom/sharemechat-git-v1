import React from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import './i18n';
import RequireRole from './components/RequireRole';
import DashboardClient from './pages/dashboard/DashboardClient';
import DashboardModel from './pages/dashboard/DashboardModel';
import DashboardUserClient from './pages/dashboard/DashboardUserClient';
import DashboardUserModel from './pages/dashboard/DashboardUserModel';
import DashboardAdmin from './pages/admin/DashboardAdmin';
import AdminAccessPage from './pages/admin/AdminAccessPage';
import PerfilClient from './pages/subpages/PerfilClient';
import PerfilModel from './pages/subpages/PerfilModel';
import ModelKycVeriffPage from './pages/subpages/ModelKycVeriffPage';
import Blog from './pages/blog/Blog';
import ChangePasswordPage from './pages/subpages/ChangePasswordPage';
import ModelDocuments from './pages/subpages/ModelDocuments';
import Home from './public-pages/Home';
import Unauthorized from './public-pages/Unauthorized';
import ResetPassword from './public-pages/ResetPassword';
import ForgotPassword from './public-pages/ForgotPassword';
import AdminEmailVerificationPage from './pages/admin/AdminEmailVerificationPage';
import ProductEmailVerificationPage from './public-pages/ProductEmailVerificationPage';
import Roles from './constants/Roles';
import UserTypes from './constants/UserTypes';
import { ModalProvider } from './components/ModalProvider';
import GuestConsentGate from './consent/GuestConsentGate';
import { GlobalTypography } from './styles/core/typography';
import Footer from './footer/Footer';
import Legal from './footer/Legal';
import Faq from './footer/Faq';
import Safety from './footer/Safety';
import Rules from './footer/Rules';
import Config from './footer/Config';
import CookieBanner from './components/CookieBanner';
import { CallUiProvider } from './components/CallUiContext';
import { SessionProvider } from './components/SessionProvider';
import { buildAdminAppUrl, isAdminSurface } from './utils/runtimeSurface';

const PublicWithGuestGate = ({ component: Component, ...rest }) => (
  <Route {...rest} render={(props) => (<GuestConsentGate><Component {...props} /></GuestConsentGate>)} />
);

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

  return (
    <Router>
      <SessionProvider>
        <CallUiProvider>
          <ModalProvider>
            <>
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
                    <PublicWithGuestGate exact path="/blog" component={Blog} />
                    <Route path="/forgot-password" component={ForgotPassword} />
                    <Route path="/unauthorized" component={Unauthorized} />
                    <Route path="/reset-password" component={ResetPassword} />
                    <Route path="/verify-email" component={ProductEmailVerificationPage} />
                    <Route path="/legal" component={Legal} />
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
                    <Route path="/model-kyc" render={() => (<RequireRole role="USER" allowedUserTypes={[UserTypes.FORM_MODEL]}><ModelKycVeriffPage /></RequireRole>)} />

                    <Route path="/perfil-client" render={() => (<RequireRole role="CLIENT"><PerfilClient /></RequireRole>)} />
                    <Route path="/perfil-model" render={() => (<RequireRole role="MODEL"><PerfilModel /></RequireRole>)} />
                    <Route path="/change-password" render={() => (<RequireRole roles={[Roles.CLIENT, Roles.MODEL, Roles.ADMIN]}><ChangePasswordPage /></RequireRole>)} />

                    <Redirect to="/unauthorized" />
                  </Switch>

                  <Footer />
                  <CookieBanner />
                </>
              )}
            </>
          </ModalProvider>
        </CallUiProvider>
      </SessionProvider>
    </Router>
  );
}

export default App;
