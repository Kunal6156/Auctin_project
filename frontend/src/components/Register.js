import React, { useState } from 'react';
import { register } from '../services/api';
import { useNavigate } from 'react-router-dom';  

const Register = ({ onRegister, switchToLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();   

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await register({
        username: formData.username,
        email: formData.email,
        password: formData.password
      });
      onRegister(response.user); 
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>Join the Auction</h2>
          <p>Create your account to start bidding</p>
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
              name="email"
              type="email"
              required
              className="auth-input"
              placeholder="Email address"
              value={formData.email}
              onChange={handleChange}
            />
            <input
              name="password"
              type="password"
              required
              className="auth-input"
              placeholder="Password (min 6 characters)"
              value={formData.password}
              onChange={handleChange}
            />
            <input
              name="confirmPassword"
              type="password"
              required
              className="auth-input"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="auth-submit-btn"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <div className="auth-switch">
            <span>Already have an account? </span>
            <button
              type="button"
              onClick={switchToLogin}
              className="auth-switch-btn"
            >
              Sign in here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
