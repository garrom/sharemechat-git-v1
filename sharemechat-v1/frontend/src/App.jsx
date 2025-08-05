import React from 'react';
import { BrowserRouter as Router, Routes, Route,Switch  } from 'react-router-dom';
import DashboardClient from './pages/DashboardClient';
import DashboardModel from './pages/DashboardModel';

function App() {
  return (
        <Router>
          <Switch>
            <Route path="/client" component={DashboardClient} />
            <Route path="/model" component={DashboardModel} />
            <Route path="/" render={() => (
              <div>
                <a href="/client">Cliente</a><br />
                <a href="/model">Modelo</a>
              </div>
            )} />
          </Switch>
        </Router>
  );
}

export default App;