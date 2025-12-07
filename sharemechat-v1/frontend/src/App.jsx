// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import RequireRole from './components/RequireRole';
import DashboardClient from './pages/dashboard/DashboardClient';
import DashboardModel from './pages/dashboard/DashboardModel';
import DashboardUserClient from './pages/dashboard/DashboardUserClient';
import DashboardUserModel from './pages/dashboard/DashboardUserModel';
import DashboardAdmin from './pages/dashboard/DashboardAdmin';
import PerfilClient from './pages/subpages/PerfilClient';
import PerfilModel from './pages/subpages/PerfilModel';
import Blog from './pages/blog/Blog';
import ChangePasswordPage from './pages/subpages/ChangePasswordPage';
import ModelDocuments from './pages/subpages/ModelDocuments';
// import Login from './public-pages/Login'; // <-- YA NO SE USA
import Home from './public-pages/Home';
import RegisterClient from './public-pages/RegisterClient';
import RegisterModel from './public-pages/RegisterModel';
import Unauthorized from './public-pages/Unauthorized';
import ResetPassword from './public-pages/ResetPassword';
import ForgotPassword from './public-pages/ForgotPassword';
import Roles from './constants/Roles';
import { ModalProvider } from './components/ModalProvider';
import GuestConsentGate from './consent/GuestConsentGate';
import { GlobalTypography } from './styles/core/typography';
import Footer from './components/Footer';
import CookieBanner from './components/CookieBanner';

// Wrapper para rutas públicas que requieren age-gate/TyC (guest/no logueado)
const PublicWithGuestGate = ({ component: Component, ...rest }) => (
  <Route {...rest} render={(props) => (<GuestConsentGate><Component {...props} /></GuestConsentGate>)} />
);

function App() {
  return (
    <ModalProvider>
      <>
        <GlobalTypography />
        <Router>
          <Switch>
            {/* Públicas CON MODAL (age-gate/TyC):*/}
            <PublicWithGuestGate exact path="/" component={Home} />
            {/* Ahora /login también usa Home como fondo; el propio Home abrirá el modal de login */}
            <PublicWithGuestGate exact path="/login" component={Home} />
            <PublicWithGuestGate exact path="/blog" component={Blog} />

            <Route path="/register-client" component={RegisterClient} />
            <Route path="/register-model" component={RegisterModel} />
            <Route path="/forgot-password" component={ForgotPassword} />
            <Route path="/unauthorized" component={Unauthorized} />
            <Route path="/reset-password" component={ResetPassword} />

            {/* Dashboards por rol */}
            <Route path="/client" render={() => (<RequireRole role="CLIENT"><DashboardClient /></RequireRole>)} />
            <Route path="/model" render={() => (<RequireRole role="MODEL"><DashboardModel /></RequireRole>)} />
            <Route path="/dashboard-admin" render={() => (<RequireRole role="ADMIN"><DashboardAdmin /></RequireRole>)} />

            {/* Dashboards para USER (pre-conversión) */}
            <Route path="/dashboard-user-client" render={() => (<RequireRole role="USER"><DashboardUserClient /></RequireRole>)} />
            <Route path="/dashboard-user-model" render={() => (<RequireRole role="USER"><DashboardUserModel /></RequireRole>)} />
            <Route path="/model-documents" render={() => (<RequireRole role="USER"><ModelDocuments /></RequireRole>)} />

            {/* Subpáginas bajo dashboard (protegidas por rol) */}
            <Route path="/perfil-client" render={() => (<RequireRole role="CLIENT"><PerfilClient /></RequireRole>)} />
            <Route path="/perfil-model" render={() => (<RequireRole role="MODEL"><PerfilModel /></RequireRole>)} />
            <Route path="/change-password" render={() => (<RequireRole roles={[Roles.CLIENT, Roles.MODEL, Roles.ADMIN]}><ChangePasswordPage /></RequireRole>)} />

            {/* Fallback */}
            <Redirect to="/unauthorized" />
          </Switch>

          {/* Footer siempre visible en todas las páginas */}
          <Footer />
          <CookieBanner />
        </Router>
      </>
    </ModalProvider>
  );
}

export default App;
