import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAuction } from '../services/api';

const AuctionCreate = ({ onSuccess }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    item_name: '',
    description: '',
    starting_price: '',
    bid_increment: '',
    go_live_time: '',
    duration_hours: '24'
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Get current datetime for min value
  const getCurrentDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const validateForm = () => {
    const newErrors = {};

    // Required field validations
    if (!formData.item_name.trim()) {
      newErrors.item_name = 'Item name is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.starting_price || parseFloat(formData.starting_price) <= 0) {
      newErrors.starting_price = 'Starting price must be greater than 0';
    }

    if (!formData.bid_increment || parseFloat(formData.bid_increment) <= 0) {
      newErrors.bid_increment = 'Bid increment must be greater than 0';
    }

    if (!formData.go_live_time) {
      newErrors.go_live_time = 'Go live time is required';
    } else {
      // Check if go live time is in the future
      const goLiveTime = new Date(formData.go_live_time);
      const now = new Date();
      if (goLiveTime < now) {
        newErrors.go_live_time = 'Go live time must be in the future';
      }
    }

    if (!formData.duration_hours || parseInt(formData.duration_hours) <= 0) {
      newErrors.duration_hours = 'Duration must be at least 1 hour';
    }

    // Business logic validations
    if (parseFloat(formData.bid_increment) > parseFloat(formData.starting_price)) {
      newErrors.bid_increment = 'Bid increment cannot be greater than starting price';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      const auctionData = { 
  ...formData,
  starting_price: parseFloat(formData.starting_price),
  bid_increment: parseFloat(formData.bid_increment),
  duration_hours: parseInt(formData.duration_hours)
};



      const createdAuction = await createAuction(auctionData);
      
      // Success feedback
      alert('Auction created successfully!');
      
      // Reset form
      setFormData({
        item_name: '',
        description: '',
        starting_price: '',
        bid_increment: '',
        go_live_time: '',
        duration_hours: '24'
      });

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Navigate to the created auction
      navigate(`/auction/${createdAuction.id}`);
      
    } catch (error) {
      console.error('Failed to create auction:', error);
      
      // Handle specific API errors
      if (error.response?.data) {
        const apiErrors = error.response.data;
        setErrors(apiErrors);
      } else {
        alert('Failed to create auction. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateEndTime = () => {
    if (formData.go_live_time && formData.duration_hours) {
      const startTime = new Date(formData.go_live_time);
      const endTime = new Date(startTime.getTime() + (parseInt(formData.duration_hours) * 60 * 60 * 1000));
      return endTime.toLocaleString();
    }
    return '';
  };

  return (
    <div className="create-auction">
      <div className="create-auction-header">
        <h1>🎯 Create New Auction</h1>
        <p>Fill in the details below to create your auction</p>
      </div>

      <form onSubmit={handleSubmit} className="auction-form">
        {/* Item Name */}
        <div className="form-group">
          <label htmlFor="item_name">
            <span className="required">*</span> Item Name
          </label>
          <input
            type="text"
            id="item_name"
            name="item_name"
            value={formData.item_name}
            onChange={handleChange}
            placeholder="Enter the name of your item"
            className={errors.item_name ? 'error' : ''}
            maxLength="200"
            required
          />
          {errors.item_name && <span className="error-message">{errors.item_name}</span>}
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="description">
            <span className="required">*</span> Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Provide a detailed description of your item"
            className={errors.description ? 'error' : ''}
            rows="4"
            required
          />
          {errors.description && <span className="error-message">{errors.description}</span>}
          <small className="form-help">Be specific about condition, features, and any defects</small>
        </div>

        {/* Pricing Section */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="starting_price">
              <span className="required">*</span> Starting Price (₹)
            </label>
            <input
              type="number"
              id="starting_price"
              name="starting_price"
              value={formData.starting_price}
              onChange={handleChange}
              placeholder="0.00"
              className={errors.starting_price ? 'error' : ''}
              step="0.01"
              min="0.01"
              required
            />
            {errors.starting_price && <span className="error-message">{errors.starting_price}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="bid_increment">
              <span className="required">*</span> Bid Increment (₹)
            </label>
            <input
              type="number"
              id="bid_increment"
              name="bid_increment"
              value={formData.bid_increment}
              onChange={handleChange}
              placeholder="1.00"
              className={errors.bid_increment ? 'error' : ''}
              step="0.01"
              min="0.01"
              required
            />
            {errors.bid_increment && <span className="error-message">{errors.bid_increment}</span>}
            <small className="form-help">Minimum amount each bid must increase</small>
          </div>
        </div>

        {/* Timing Section */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="go_live_time">
              <span className="required">*</span> Go Live Time
            </label>
            <input
              type="datetime-local"
              id="go_live_time"
              name="go_live_time"
              value={formData.go_live_time}
              onChange={handleChange}
              className={errors.go_live_time ? 'error' : ''}
              min={getCurrentDateTime()}
              required
            />
            {errors.go_live_time && <span className="error-message">{errors.go_live_time}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="duration_hours">
              <span className="required">*</span> Duration (Hours)
            </label>
            <select
              id="duration_hours"
              name="duration_hours"
              value={formData.duration_hours}
              onChange={handleChange}
              className={errors.duration_hours ? 'error' : ''}
              required
            >
              <option value="1">1 Hour</option>
              <option value="3">3 Hours</option>
              <option value="6">6 Hours</option>
              <option value="12">12 Hours</option>
              <option value="24">24 Hours</option>
              <option value="48">48 Hours</option>
              <option value="72">72 Hours</option>
              <option value="168">1 Week</option>
            </select>
            {errors.duration_hours && <span className="error-message">{errors.duration_hours}</span>}
          </div>
        </div>

        {/* Preview Section */}
        {formData.go_live_time && formData.duration_hours && (
          <div className="auction-preview">
            <h3>📅 Auction Timeline</h3>
            <div className="timeline-info">
              <div className="timeline-item">
                <strong>Starts:</strong> {new Date(formData.go_live_time).toLocaleString()}
              </div>
              <div className="timeline-item">
                <strong>Ends:</strong> {calculateEndTime()}
              </div>
              <div className="timeline-item">
                <strong>Duration:</strong> {formData.duration_hours} hours
              </div>
            </div>
          </div>
        )}

        {/* Submit Section */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/')}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner small"></span>
                Creating...
              </>
            ) : (
              '🚀 Create Auction'
            )}
          </button>
        </div>
      </form>

      {/* Form Tips */}
      <div className="form-tips">
        <h3>💡 Tips for a Successful Auction</h3>
        <ul>
          <li>Use clear, descriptive titles that highlight key features</li>
          <li>Include detailed descriptions with condition information</li>
          <li>Set competitive starting prices to attract bidders</li>
          <li>Choose appropriate bid increments (not too high or too low)</li>
          <li>Schedule your auction when your target audience is most active</li>
        </ul>
      </div>
    </div>
  );
};

export default AuctionCreate;
