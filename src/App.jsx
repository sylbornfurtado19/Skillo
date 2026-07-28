import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { InterviewProvider } from './context/InterviewContext';
import { ToastProvider } from './components/ui/Toast';
import MainLayout from './layouts/MainLayout';
import AppLayout from './layouts/AppLayout';
import Landing from './pages/Landing';
import ResumeUpload from './pages/ResumeUpload';
import CareerSetup from './pages/CareerSetup';
import InterviewSession from './pages/InterviewSession';
import Results from './pages/Results';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import ProtectedRoute from './components/common/ProtectedRoute';

export default function App() {
  return (
    <InterviewProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Visitor Marketing Website Routes */}
            <Route path="/" element={<MainLayout><Landing /></MainLayout>} />
            <Route path="/login" element={<MainLayout><Login /></MainLayout>} />

            {/* SaaS Application Workspace Routes */}
            <Route 
              path="/app/*" 
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="resume" element={<ResumeUpload />} />
                      <Route path="setup" element={<CareerSetup />} />
                      <Route path="interview" element={<InterviewSession />} />
                      <Route path="results" element={<Results />} />
                      <Route path="profile" element={<Profile />} />
                      <Route path="settings" element={<Settings />} />
                      {/* Default redirect to Dashboard */}
                      <Route path="*" element={<Navigate to="dashboard" replace />} />
                    </Routes>
                  </AppLayout>
                </ProtectedRoute>
              } 
            />

            {/* Catch-all redirect to homepage */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </InterviewProvider>
  );
}





