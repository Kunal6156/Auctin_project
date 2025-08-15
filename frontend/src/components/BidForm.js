import React, { useState } from 'react';

const BidForm = ({ 
  auction, 
  onBidPlaced, 
  isActive = true, 
  currentUser,
  minimumBid = 0 
}) => {
  const [bidAmount, setBidAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Calculate quick bid amounts
  const currentBid = parseFloat(auction?.current_highest_bid || auction?.starting_price || 0);
  const increment = parseFloat(auction?.bid_increment || 1);
  const minBid = Math.max(currentBid + increment, minimumBid);

  const quickBidAmounts = [
    minBid,
    minBid + increment,
    minBid + (increment * 2)
  ];

  const handleBidSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const amount = parseFloat(bidAmount);
      
      // Validation
      if (!amount || amount < minBid) {
        throw new Error(`Minimum bid is ₹${minBid.toFixed(2)}`);
      }

      // Call the parent's bid placement function
      await onBidPlaced(amount);
      setBidAmount('');
      
    } catch (err) {
      setError(err.message || 'Failed to place bid');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickBid = async (amount) => {
    setBidAmount(amount.toString());
    setError('');
    setLoading(true);

    try {
      await onBidPlaced(amount);
      setBidAmount('');
    } catch (err) {
      setError(err.message || 'Failed to place bid');
    } finally {
      setLoading(false);
    }
  };

  if (!isActive) {
    return (
      <div className="bid-section inactive">
        <h3>🔒 Auction Ended</h3>
        <p>This auction is no longer accepting bids.</p>
      </div>
    );
  }

  return (
    <div className="bid-section">
      <h3>💰 Place Your Bid</h3>
      
      {/* Current Bid Information */}
      <div className="current-bid-info">
        <p>Current Highest Bid: <span>₹{currentBid.toFixed(2)}</span></p>
        <p>Minimum Next Bid: <span>₹{minBid.toFixed(2)}</span></p>
        {auction?.winner && (
          <p>Current Leader: <span>{auction.winner.username}</span>
            {auction.winner.id === currentUser?.id && 
              <span className="winning-badge">🏆 You're Winning!</span>
            }
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message" style={{
          background: '#f8d7da',
          color: '#721c24',
          padding: '0.75rem',
          borderRadius: '4px',
          marginBottom: '1rem',
          border: '1px solid #f5c6cb'
        }}>
          {error}
        </div>
      )}

      {/* Manual Bid Form */}
      <form onSubmit={handleBidSubmit} className="bid-form">
        <div className="bid-input-group">
          <span className="currency-symbol">₹</span>
          <input
            type="number"
            step="0.01"
            min={minBid}
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder={`Enter amount (min: ₹${minBid.toFixed(2)})`}
            className="bid-input"
            disabled={loading}
            required
          />
          <button 
            type="submit" 
            className="btn btn-primary bid-btn"
            disabled={loading || !bidAmount || parseFloat(bidAmount) < minBid}
          >
            {loading ? '⏳ Placing...' : '🚀 Place Bid'}
          </button>
        </div>
      </form>

      {/* Quick Bid Buttons */}
      <div className="quick-bid-buttons">
        <h4>⚡ Quick Bid Options</h4>
        <div className="quick-bid-grid">
          {quickBidAmounts.map((amount, index) => (
            <button
              key={index}
              className="btn btn-outline-primary quick-bid"
              onClick={() => handleQuickBid(amount)}
              disabled={loading}
            >
              ${amount.toFixed(2)}
            </button>
          ))}
        </div>
      </div>

      {/* Bid Tips */}
      <div className="bid-tips" style={{
        marginTop: '1rem',
        padding: '0.75rem',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '6px',
        fontSize: '0.9rem'
      }}>
        💡 <strong>Tips:</strong> Use quick bid buttons for faster bidding, or enter a custom amount above.
      </div>
    </div>
  );
};

export default BidForm;