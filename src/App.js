import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';
import NotificationHandler from './components/NotificationHandler';

// Lazy load components including PrivateRoute
const PrivateRoute = React.lazy(() => import('./components/PrivateRoute'));
const Home = React.lazy(() => import('./pages/Home'));
const Login = React.lazy(() => import('./pages/Login'));
const Signup = React.lazy(() => import('./pages/Signup'));
const ForgotPassword = React.lazy(() => import('./pages/ForgotPassword'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Topics = React.lazy(() => import('./pages/Topics'));
const Results = React.lazy(() => import('./pages/Results'));
const Settings = React.lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationHandler />
        <Layout>
          <React.Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route
                path="/dashboard"
                element={
                  <React.Suspense fallback={<LoadingSpinner />}>
                    <PrivateRoute>
                      <Dashboard />
                    </PrivateRoute>
                  </React.Suspense>
                }
              />
              <Route
                path="/topics"
                element={
                  <React.Suspense fallback={<LoadingSpinner />}>
                    <PrivateRoute>
                      <Topics />
                    </PrivateRoute>
                  </React.Suspense>
                }
              />
              <Route
                path="/results"
                element={
                  <React.Suspense fallback={<LoadingSpinner />}>
                    <PrivateRoute>
                      <Results />
                    </PrivateRoute>
                  </React.Suspense>
                }
              />
              <Route
                path="/settings"
                element={
                  <React.Suspense fallback={<LoadingSpinner />}>
                    <PrivateRoute>
                      <Settings />
                    </PrivateRoute>
                  </React.Suspense>
                }
              />
            </Routes>
          </React.Suspense>
        </Layout>
      </AuthProvider>
    </Router>
  );
}

export default App;
