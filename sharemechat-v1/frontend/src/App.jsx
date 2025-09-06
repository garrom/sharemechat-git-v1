import React from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';

// Páginas privadas (dashboards)
import DashboardClient from './dashboard/DashboardClient';
import DashboardModel from './dashboard/DashboardModel';
import DashboardUserClient from './dashboard/DashboardUserClient';
import DashboardUserModel from './dashboard/DashboardUserModel';
import DashboardAdmin from './dashboard/DashboardAdmin';

// Subpáginas dentro de dashboard
import PerfilClient from './dashboard/subpages/PerfilClient';
import PerfilModel from './dashboard/subpages/PerfilModel';
import ChangePasswordPage from './dashboard/subpages/ChangePasswordPage';

// Páginas públicas
import Login from './public/Login';
import RegisterClient from './public/RegisterClient';
import RegisterModel from './public/RegisterModel';
import Unauthorized from './public/Unauthorized';
import ResetPassword from './public/ResetPassword';
import ForgotPassword from './public/ForgotPassword';

function App() {
  return (
    <Router>
      <Switch>
        {/* Públicas */}
        <Route exact path="/" component={Login} />
        <Route path="/register-client" component={RegisterClient} />
        <Route path="/register-model" component={RegisterModel} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/unauthorized" component={Unauthorized} />

        {/* Privadas (Dashboards) */}
        <Route path="/client" component={DashboardClient} />
        <Route path="/model" component={DashboardModel} />
        <Route path="/dashboard-user-client" component={DashboardUserClient} />
        <Route path="/dashboard-user-model" component={DashboardUserModel} />
        <Route path="/dashboard-admin" component={DashboardAdmin} />

        {/* Subpáginas bajo dashboard */}
        <Route path="/perfil-client" component={PerfilClient} />
        <Route path="/perfil-model" component={PerfilModel} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/change-password" component={ChangePasswordPage} />

        {/* Fallback */}
        <Redirect to="/unauthorized" />
      </Switch>
    </Router>
  );
}

export default App;