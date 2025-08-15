import React, { useState } from 'react';
import { login } from '../services/api';

const Login = ({ onLogin, switchToRegister }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        username: formData.username.trim(),
        password: formData.password.trim(),
      };
      const response = await login(payload);
      
      onLogin(response.user);
      
      if (response.user.is_staff || response.user.is_superuser) {
        console.log('Admin user logged in:', response.user.username);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Welcome Back</h2>
          <p>Sign in to access your auction account</p>
        </div>
        
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}
          
          <div className="auth-input-group">
            <input
              name="username"
              type="text"
              required
              className="auth-input"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
            />
            <input
              name="password"
              type="password"
              required
              className="auth-input"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="auth-submit-btn"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="auth-switch">
            <span>Don't have an account? </span>
            <button
              type="button"
              onClick={switchToRegister}
              className="auth-switch-btn"
            >
              Register here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;