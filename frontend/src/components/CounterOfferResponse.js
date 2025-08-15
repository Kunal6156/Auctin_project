import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { respondToCounterOffer } from '../services/api';

const CounterOfferResponse = ({ currentUser }) => {
  const { offerId } = useParams();
  const navigate = useNavigate();
  const [counterOffer, setCounterOffer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [responseMade, setResponseMade] = useState(false);

  useEffect(() => {
    loadCounterOffer();
  }, [offerId]);

  const loadCounterOffer = async () => {
    try {
      setPageLoading(true);
      // This would need to be implemented in your API
      const response = await fetch(`/api/counter-offers/${offerId}/`, {
        headers: {
          'Authorization': `Token ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to load counter offer');
      }
      
      const data = await response.json();
      
      // Verify this is for the current user
      if (data.buyer.id !== currentUser?.id) {
        setError("You don't have permission to respond to this counter offer.");
        return;
      }

      // Check if already responded
      if (data.status !== 'pending') {
        setError("This counter offer has already been responded to.");
        return;
      }

      setCounterOffer(data);
      setError(null);
    } catch (error) {
      console.error('Failed to load counter offer:', error);
      setError('Failed to load counter offer. Please try again.');
    } finally {
      setPageLoading(false);
    }
  };

  const handleResponse = async (response) => {
    if (loading || responseMade) return;

    const confirmMessage = response === 'accept' 
      ? `Are you sure you want to accept the counter offer of $${counterOffer.counter_amount}?`
      : 'Are you sure you want to reject this counter offer?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await respondToCounterOffer(offerId, response);
      
      const message = response === 'accept'
        ? '✅ Counter offer accepted! You will receive a confirmation email shortly.'
        : '❌ Counter offer rejected. The seller has been notified.';
      
      setSuccessMessage(message);
      setResponseMade(true);
      
      // Reload to show updated status
      setTimeout(() => {
        loadCounterOffer();
      }, 1000);
      
    } catch (error) {
      console.error('Response processing error:', error);
      let errorMessage = 'Failed to process response';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toFixed(2);
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  // Loading state
  if (pageLoading) {
    return (
      <div className="counter-offer-response">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading counter offer details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !counterOffer) {
    return (
      <div className="counter-offer-response">
        <div className="error-container">
          <h2>⚠️ Error</h2>
          <p>{error}</p>
          <div style={{ marginTop: '1rem' }}>
            <button onClick={loadCounterOffer} className="btn btn-primary" style={{ marginRight: '1rem' }}>
              Try Again
            </button>
            <button onClick={() => navigate('/')} className="btn btn-secondary">
              Back to Auctions
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!counterOffer) {
    return (
      <div className="counter-offer-response">
        <div className="error-container">
          <h2>Counter Offer Not Found</h2>
          <p>The counter offer you're looking for doesn't exist.</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Back to Auctions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="counter-offer-response">
      <div className="page-header">
        <h1>💬 Counter Offer Response</h1>
        <button 
          onClick={() => navigate('/')} 
          className="btn btn-secondary"
        >
          ← Back to Auctions
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="success-message" style={{
          background: '#d4edda',
          color: '#155724',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          border: '1px solid #c3e6cb'
        }}>
          <h3>Response Processed Successfully!</h3>
          <p>{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="error-message" style={{
          background: '#f8d7da',
          color: '#721c24',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          border: '1px solid #f5c6cb'
        }}>
          <h3>⚠️ Error</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Counter Offer Details */}
      <div className="counter-offer-details" style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        marginBottom: '2rem'
      }}>
        <h2>📋 Counter Offer Details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1rem' }}>
          <div>
            <h3>Auction Information</h3>
            <p><strong>Item:</strong> {counterOffer.auction.item_name}</p>
            <p><strong>Seller:</strong> {counterOffer.seller.username}</p>
            <p><strong>Original Starting Price:</strong> ${formatCurrency(counterOffer.auction.starting_price)}</p>
          </div>
          <div>
            <h3>Offer Details</h3>
            <p><strong>Your Original Bid:</strong> 
              <span style={{ color: '#6c757d' }}>${formatCurrency(counterOffer.original_bid)}</span>
            </p>
            <p><strong>Counter Offer Amount:</strong>
              <span style={{ color: '#ffc107', fontSize: '1.3rem', fontWeight: 'bold' }}>
                ${formatCurrency(counterOffer.counter_amount)}
              </span>
            </p>
            <p><strong>Difference:</strong>
              <span style={{ color: '#dc3545' }}>
                +${formatCurrency(counterOffer.counter_amount - counterOffer.original_bid)}
              </span>
            </p>
          </div>
        </div>

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <h3>📅 Timeline</h3>
          <p><strong>Counter Offer Sent:</strong> {formatDateTime(counterOffer.created_at)}</p>
          <p><strong>Status:</strong> 
            <span className={`status-badge ${counterOffer.status}`}>
              {counterOffer.status}
            </span>
          </p>
        </div>
      </div>

      {/* Response Actions */}
      {!responseMade && counterOffer.status === 'pending' && (
        <div className="response-actions" style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <h2>⚖️ Your Response</h2>
          <p style={{ marginBottom: '2rem', color: '#6c757d' }}>
            The seller has made a counter offer. Please choose your response:
          </p>
          
          <div className="response-grid" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            {/* Accept Option */}
            <div className="response-option" style={{
              border: '2px solid #28a745',
              borderRadius: '12px',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <h3 style={{ color: '#28a745' }}>✅ Accept Counter Offer</h3>
              <div style={{ margin: '1rem 0' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#28a745' }}>
                  ${formatCurrency(counterOffer.counter_amount)}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                  (+${formatCurrency(counterOffer.counter_amount - counterOffer.original_bid)} from your bid)
                </div>
              </div>
              <p style={{ marginBottom: '1.5rem' }}>
                Accept this price and complete the purchase.
              </p>
              <button 
                className="btn btn-success"
                onClick={() => handleResponse('accept')}
                disabled={loading}
                style={{ width: '100%', padding: '1rem' }}
              >
                {loading ? '⏳ Processing...' : '✅ Accept & Purchase'}
              </button>
            </div>

            {/* Reject Option */}
            <div className="response-option" style={{
              border: '2px solid #dc3545',
              borderRadius: '12px',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <h3 style={{ color: '#dc3545' }}>❌ Reject Counter Offer</h3>
              <div style={{ margin: '1rem 0' }}>
                <div style={{ fontSize: '1rem', color: '#6c757d' }}>
                  Decline the counter offer
                </div>
              </div>
              <p style={{ marginBottom: '1.5rem' }}>
                Reject this counter offer. The auction will be closed without a sale.
              </p>
              <button 
                className="btn btn-danger"
                onClick={() => handleResponse('reject')}
                disabled={loading}
                style={{ width: '100%', padding: '1rem' }}
              >
                {loading ? '⏳ Processing...' : '❌ Reject Offer'}
              </button>
            </div>
          </div>

          {/* Comparison Table */}
          <div style={{
            marginTop: '2rem',
            padding: '1rem',
            background: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <h4>💰 Price Comparison</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', textAlign: 'center' }}>
              <div>
                <strong>Your Original Bid</strong>
                <div style={{ color: '#6c757d', fontSize: '1.1rem' }}>
                  ${formatCurrency(counterOffer.original_bid)}
                </div>
              </div>
              <div>
                <strong>Counter Offer</strong>
                <div style={{ color: '#ffc107', fontSize: '1.1rem', fontWeight: 'bold' }}>
                  ${formatCurrency(counterOffer.counter_amount)}
                </div>
              </div>
              <div>
                <strong>Difference</strong>
                <div style={{ color: '#dc3545', fontSize: '1.1rem' }}>
                  +${formatCurrency(counterOffer.counter_amount - counterOffer.original_bid)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Display for Completed Response */}
      {(responseMade || counterOffer.status !== 'pending') && (
        <div className="status-display" style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center'
        }}>
          <h3>Response Status</h3>
          <span className={`status-badge ${counterOffer.status}`} style={{
            fontSize: '1.2rem',
            padding: '0.5rem 1rem'
          }}>
            {counterOffer.status}
          </span>
          
          {counterOffer.status === 'accepted' && (
            <p style={{ marginTop: '1rem', color: '#28a745' }}>
              ✅ Counter offer accepted! You will receive a confirmation email with payment instructions.
            </p>
          )}
          
          {counterOffer.status === 'rejected' && (
            <p style={{ marginTop: '1rem', color: '#dc3545' }}>
              ❌ Counter offer rejected. The seller has been notified.
            </p>
          )}

          {counterOffer.responded_at && (
            <p style={{ marginTop: '1rem', color: '#6c757d', fontSize: '0.9rem' }}>
              Response made on: {formatDateTime(counterOffer.responded_at)}
            </p>
          )}
        </div>
      )}

      {/* Additional Actions */}
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <button 
          onClick={() => navigate('/')} 
          className="btn btn-outline-primary"
          style={{ marginRight: '1rem' }}
        >
          View All Auctions
        </button>
        {counterOffer.auction && (
          <button 
            onClick={() => navigate(`/auction/${counterOffer.auction.id}`)} 
            className="btn btn-outline-secondary"
          >
            View Original Auction
          </button>
        )}
      </div>
    </div>
  );
};

export default CounterOfferResponse;