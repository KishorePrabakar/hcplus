import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import './index.css';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import { RequireAuth, RequireRole, PublicOnly } from './components/guards';

import Login from './pages/Login';
import Register from './pages/Register';
import AcceptInvite from './pages/AcceptInvite';
import AwaitingApproval from './pages/AwaitingApproval';
import DashboardRouter from './pages/DashboardRouter';
import NewComplaint from './pages/NewComplaint';
import ComplaintDetail from './pages/ComplaintDetail';
import StaffQueue from './pages/StaffQueue';
import Approvals from './pages/Approvals';
import UsersAdmin from './pages/UsersAdmin';
import Profile from './pages/Profile';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicOnly><Outlet /></PublicOnly>}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/accept-invite/:token" element={<AcceptInvite />} />
            </Route>

            <Route path="/awaiting-approval" element={<AwaitingApproval />} />

            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route path="/" element={<DashboardRouter />} />
              <Route path="/complaints/new" element={<NewComplaint />} />
              <Route path="/complaints/:id" element={<ComplaintDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route
                path="/queue"
                element={
                  <RequireRole roles={['WARDEN', 'ADMIN']}>
                    <StaffQueue />
                  </RequireRole>
                }
              />
              <Route
                path="/approvals"
                element={
                  <RequireRole roles={['WARDEN', 'ADMIN']}>
                    <Approvals />
                  </RequireRole>
                }
              />
              <Route
                path="/users"
                element={
                  <RequireRole roles={['ADMIN']}>
                    <UsersAdmin />
                  </RequireRole>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
