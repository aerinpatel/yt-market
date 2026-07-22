import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Portfolio from './pages/Portfolio';
import Analytics from './pages/Analytics';

import React from 'react';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { token } = useAuth();
    if (!token) {
        return <Navigate to="/auth" />;
    }
    return children as React.ReactElement;
};

import LandingPage from './pages/LandingPage';
import { AdminDashboard } from './pages/AdminDashboard';
import CreatorPortal from './pages/CreatorPortal';

function AppRoutes() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
            <Route path="/creator" element={<ProtectedRoute><CreatorPortal /></ProtectedRoute>} />
            <Route path="/analytics/:channelId" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        </Routes>
    );
}


function App() {
    return (
        <AuthProvider>
            <WebSocketProvider>
                <BrowserRouter>
                    <AppRoutes />
                </BrowserRouter>
            </WebSocketProvider>
        </AuthProvider>
    );
}

export default App;
