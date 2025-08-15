import React, { useState, useEffect } from 'react';
import { getCurrentUser, isAuthenticated, logout } from '../services/api';
import Login from './Login';
import Register from './Register';

const AuthWrapper = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      const currentUser = getCurrentUser();
      setUser(currentUser);
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleRegister = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  const isAdmin = (user) => {
    return user && (user.is_staff === true || user.is_superuser === true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return showRegister ? (
      <Register 
        onRegister={handleRegister}
        switchToLogin={() => setShowRegister(false)}
      />
    ) : (
      <Login 
        onLogin={handleLogin}
        switchToRegister={() => setShowRegister(true)}
      />
    );
  }

  return React.cloneElement(children, { 
    user, 
    onLogout: handleLogout,
    isAdmin: isAdmin(user)
  });
};

export default AuthWrapper;