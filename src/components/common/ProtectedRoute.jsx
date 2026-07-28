import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useInterview } from '../../context/InterviewContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isAuthLoading } = useInterview();
  const location = useLocation();

  if (isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!isAuthenticated) {
    // Redirect to login, but save the current location they were trying to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
