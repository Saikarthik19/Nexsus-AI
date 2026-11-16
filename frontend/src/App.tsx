import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import RAG from './pages/RAG';
import Evaluation from './pages/Evaluation';
import CostTracking from './pages/CostTracking';
import AIOperations from './pages/AIOperations';
import Settings from './pages/Settings';

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const auth = React.useContext(AuthContext);
  if (!auth?.user) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <PrivateRoute>
              <Chat />
            </PrivateRoute>
          }
        />
        <Route
          path="/rag"
          element={
            <PrivateRoute>
              <RAG />
            </PrivateRoute>
          }
        />
        <Route
          path="/evaluation"
          element={
            <PrivateRoute>
              <Evaluation />
            </PrivateRoute>
          }
        />
        <Route
          path="/ai-operations"
          element={
            <PrivateRoute>
              <AIOperations />
            </PrivateRoute>
          }
        />
        <Route
          path="/cost-tracking"
          element={
            <PrivateRoute>
              <CostTracking />
            </PrivateRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;
