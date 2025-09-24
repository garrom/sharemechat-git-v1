import React from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import RequireRole from './components/RequireRole';
import DashboardClient from './dashboard/DashboardClient';
import DashboardModel from './dashboard/DashboardModel';
import DashboardUserClient from './dashboard/DashboardUserClient';
import DashboardUserModel from './dashboard/DashboardUserModel';
import DashboardAdmin from './dashboard/DashboardAdmin';
import PerfilClient from './dashboard/subpages/PerfilClient';
import PerfilModel from './dashboard/subpages/PerfilModel';
import ChangePasswordPage from './dashboard/subpages/ChangePasswordPage';
import ModelDocuments from './dashboard/subpages/ModelDocuments';
import Login from './public/Login';
import Home from './public/Home';
import RegisterClient from './public/RegisterClient';
import RegisterModel from './public/RegisterModel';
import Unauthorized from './public/Unauthorized';
import ResetPassword from './public/ResetPassword';
import ForgotPassword from './public/ForgotPassword';
import Roles from './constants/Roles';
import GuestConsentGate from './consent/GuestConsentGate';

// Wrapper para rutas públicas que requieren age-gate/TyC (guest/no logueado)
const PublicWithGuestGate = ({ component: Component, ...rest }) => (
  <Route
    {...rest}
    render={(props) => (
      <GuestConsentGate>
        <Component {...props} />
      </GuestConsentGate>
    )}
  />
);

function App(){return(

  <Router>
      <Switch>
          {/* Públicas CON MODAL (age-gate/TyC):*/}
          <PublicWithGuestGate exact path="/" component={Home} />
          <PublicWithGuestGate exact path="/login" component={Login} />

          <Route path="/register-client" component={RegisterClient}/>
          <Route path="/register-model" component={RegisterModel}/>
          <Route path="/forgot-password" component={ForgotPassword}/>
          <Route path="/unauthorized" component={Unauthorized}/>
          <Route path="/reset-password" component={ResetPassword}/>

          {/* Dashboards por rol */}
          <Route path="/client" render={()=>(<RequireRole role="CLIENT"><DashboardClient/></RequireRole>)}/>
          <Route path="/model" render={()=>(<RequireRole role="MODEL"><DashboardModel/></RequireRole>)}/>
          <Route path="/dashboard-admin" render={()=>(<RequireRole role="ADMIN"><DashboardAdmin/></RequireRole>)}/>

          {/* Dashboards para USER (pre-conversión) */}
          <Route path="/dashboard-user-client" render={()=>(<RequireRole role="USER"><DashboardUserClient/></RequireRole>)}/>
          <Route path="/dashboard-user-model" render={()=>(<RequireRole role="USER"><DashboardUserModel/></RequireRole>)}/>
          <Route path="/model-documents" render={()=>(<RequireRole role="USER"><ModelDocuments/></RequireRole>)}/>


          {/* Subpáginas bajo dashboard (protegidas por rol) */}
          <Route path="/perfil-client" render={()=>(<RequireRole role="CLIENT"><PerfilClient/></RequireRole>)}/>
          <Route path="/perfil-model" render={()=>(<RequireRole role="MODEL"><PerfilModel/></RequireRole>)}/>
          <Route path="/change-password" render={()=>(<RequireRole roles={[Roles.CLIENT, Roles.MODEL, Roles.ADMIN]}><ChangePasswordPage/></RequireRole>)}/>
          {/* Fallback */}
          <Redirect to="/unauthorized"/>
      </Switch>
  </Router>);}
export default App;
