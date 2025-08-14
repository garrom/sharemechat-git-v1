import React from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import DashboardClient from './pages/DashboardClient';
import DashboardModel from './pages/DashboardModel';
import RegisterClient from './pages/RegisterClient';
import RegisterModel from './pages/RegisterModel';
import Login from './pages/Login';
import DashboardUserClient from './pages/DashboardUserClient';
import DashboardUserModel from './pages/DashboardUserModel';
import DashboardAdmin from './pages/DashboardAdmin';

function App() {
  return (
    <Router>
      <Switch>
        <Route exact path="/" component={Login} />
        <Route path="/register-client" component={RegisterClient} />
        <Route path="/register-model" component={RegisterModel} />
        <Route path="/client" component={DashboardClient} />
        <Route path="/model" component={DashboardModel} />
        <Route path="/dashboard-user-client" component={DashboardUserClient} />
        <Route path="/dashboard-user-model" component={DashboardUserModel} />
        <Route path="/dashboard-admin" component={DashboardAdmin} />
      </Switch>
    </Router>
  );
}

export default App;