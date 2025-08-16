import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getAuction, placeBid } from '../services/api';
import { connectWebSocket } from '../services/websocket';
import BidForm from './BidForm';

const toIST = (isoString) =>
  new Date(isoString).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
  });


const AuctionRoom = ({ currentUser }) => {
  const { id } = useParams();
  const [auction, setAuction] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [bidHistory, setBidHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ws, setWs] = useState(null);
  const [isSubmittingBid, setIsSubmittingBid] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    loadAuction();
    
    // Cleanup WebSocket on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [id]);

  useEffect(() => {
    if (auction) {
      // Setup WebSocket connection with retry logic
      const websocket = connectWebSocket(id, handleWebSocketMessage);
      setWs(websocket);
      wsRef.current = websocket;
      
      // Setup timer
      const timer = setInterval(() => {
        updateTimeLeft();
      }, 1000);
      
      return () => {
        clearInterval(timer);
        if (websocket) websocket.close();
      };
    }
  }, [auction]);

  const loadAuction = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const data = await getAuction(id);
      setAuction(data);
      setBidHistory(prev => {
  const serverBids = data.bids || [];
  const merged = [...serverBids, ...prev.filter(
    b => !serverBids.some(sb => sb.id === b.id)
  )];
  return merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
});

      setError(null);
    } catch (error) {
      console.error('Failed to load auction:', error);
      setError('Failed to load auction. Please try again.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const updateTimeLeft = () => {
    if (!auction) return;
    
    const now = new Date();
    const endTime = new Date(auction.end_time);

    const diff = endTime - now;
    
    if (diff <= 0) {
      setTimeLeft('Auction Ended');
      return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (days > 0) {
      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    } else {
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    }
  };

  const handleWebSocketMessage = (data) => {
    console.log('WebSocket message received:', data);
    
    if (data.type === 'bid_update') {
      setAuction(prev => ({
        ...prev,
        current_highest_bid: data.message.highest_bid,
        winner: {
          ...prev.winner,
          username: data.message.bidder
        }
      }));
      
      // Add new bid to history
      const newBid = {
        id: Date.now(),
        amount: data.message.highest_bid,
        bidder: { username: data.message.bidder },
        timestamp: new Date().toISOString()
      };
      setBidHistory(prev => [newBid, ...prev]);
      
      addNotification(`New bid: ₹${data.message.highest_bid} by ${data.message.bidder}`, 'info');
    } else if (data.type === 'auction_end') {
      setAuction(prev => ({
        ...prev,
        status: 'ended'
      }));
      addNotification('Auction has ended!', 'warning');
    }
  };

  const handleBidPlacement = async (amount) => {
    if (isSubmittingBid) {
      addNotification('Please wait, your previous bid is being processed...', 'warning');
      return;
    }

    setIsSubmittingBid(true);
    
    try {
      console.log('Placing bid:', amount);
      await placeBid(id, amount);
      addNotification('Your bid was placed successfully!', 'success');
      
      
      
    } catch (error) {
      console.error('Bid placement error:', error);
      
      // Handle specific error messages
      let errorMessage = 'Failed to place bid';
      if (error.response?.status === 500) {
        errorMessage = 'Server error. Please try again in a moment.';
        // Refresh auction data to get current state
        loadAuction(false);
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      addNotification(`Error: ${errorMessage}`, 'error');
      throw error;
    } finally {
      setIsSubmittingBid(false);
    }
  };

  const addNotification = (message, type = 'info') => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date()
    };
    
    setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  };

  const formatTime = (timestamp) => toIST(timestamp);


  const formatCurrency = (amount) => {
    return parseFloat(amount).toFixed(2);
  };

  // Auto-refresh auction data every 30 seconds as fallback
  useEffect(() => {
    if (!auction) return;
    
    const refreshInterval = setInterval(() => {
      loadAuction(false);
    }, 30000);
    
    return () => clearInterval(refreshInterval);
  }, [auction]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading auction...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => loadAuction()} className="btn btn-primary">
          Try Again
        </button>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="error-container">
        <h2>Auction Not Found</h2>
        <p>The auction you're looking for doesn't exist.</p>
      </div>
    );
  }

  const currentBid = auction.current_highest_bid || auction.starting_price;
  const now = new Date();
const start = new Date(auction.go_live_time);
const end = new Date(auction.end_time);


   const isAuctionActive = (now >= start && now <= end);

  const isUserWinning = auction.winner?.id === currentUser?.id;

  return (
    <div className="auction-room">
    
      {/* Header */}
      <div className="auction-header">
        <div className="auction-title">
        <h1>{auction.item_name}</h1>

        {(() => {
           const displayStatus = isAuctionActive ? 'active' : (timeLeft === 'Auction Ended' ? 'ended' : auction.status);
          return ( <span className={`status-badge ${displayStatus}`}>
        {displayStatus}
                  </span> );
          })()}

        </div>

        <div className={`time-left ${!isAuctionActive ? 'ended' : ''}`}>
          {timeLeft || 'Loading...'}
        </div>
      </div>

      {/* WebSocket Status Indicator */}
      <div className="connection-status">
        <span className={`status-indicator ${ws?.readyState === 1 ? 'connected' : 'disconnected'}`}>
          {ws?.readyState === 1 ? '🟢 Live Updates Active' : '🔴 Reconnecting...'}
        </span>
      </div>

      {/* Main Content */}
      <div className="auction-content">
        <div className="main-content">
          {/* Auction Details */}
          <div className="auction-details">
            <h2>Item Details</h2>
            <div className="item-description">
              <p>{auction.description}</p>
            </div>
            
            <div className="auction-info-grid">
              <div className="info-item">
                <label>Starting Price</label>
                <span>₹{formatCurrency(auction.starting_price)}</span>
              </div>
              <div className="info-item">
                <label>Bid Increment</label>
                <span>₹{formatCurrency(auction.bid_increment)}</span>
              </div>
              <div className="info-item">
                <label>Seller</label>
                <span>{auction.seller.username}</span>
              </div>
              <div className="info-item">
                <label>Total Bids</label>
                <span>{bidHistory.length}</span>
              </div>
            </div>
          </div>

          {/* Current Bid Display */}
          <div className="current-bid-display">
            <h3>Current Highest Bid</h3>
            <div className="bid-amount">₹{formatCurrency(currentBid)}</div>
            {auction.winner && (
              <div className="current-winner">
                Leading Bidder: <strong>{auction.winner.username}</strong>
                {isUserWinning && <span className="winning-badge">🏆 You!</span>}
              </div>
            )}
          </div>

          {/* Bid Form */}
          {currentUser && (
            <BidForm
              auction={auction}
              onBidPlaced={handleBidPlacement}
              isActive={isAuctionActive && !isSubmittingBid}
              currentUser={currentUser}
              minimumBid={parseFloat(currentBid) + parseFloat(auction.bid_increment)}
              isSubmitting={isSubmittingBid}
            />
          )}
          
          {!currentUser && (
            <div className="login-prompt">
              <p>Please log in to place bids on this auction.</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          {/* Live Notifications */}
          <div className="notifications-panel">
            <h3>Live Updates</h3>
            {notifications.length === 0 ? (
              <p className="no-notifications">No recent updates</p>
            ) : (
              <div className="notification-list">
                {notifications.map(notif => (
                  <div key={notif.id} className={`notification ${notif.type}`}>
                    <div className="notification-message">{notif.message}</div>
                    <div className="notification-time">
                      {formatTime(notif.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bid History */}
          <div className="bid-history">
            <h3>Bid History</h3>
            <button 
              onClick={() => loadAuction(false)} 
              className="refresh-btn"
              style={{ fontSize: '12px', padding: '4px 8px', marginBottom: '10px' }}
            >
              Refresh
            </button>
            {bidHistory.length === 0 ? (
              <p className="no-bids">No bids yet. Be the first to bid!</p>
            ) : (
              <div className="bid-history-list">
                {bidHistory.slice(0, 10).map((bid, index) => (
                  <div key={bid.id || index} className="bid-history-item">
                    <div className="bid-info">
                      <div className="bid-amount">₹{formatCurrency(bid.amount)}</div>
                      <div className="bid-bidder">by {bid.bidder.username}</div>
                    </div>
                    <div className="bid-time">
                      {formatTime(bid.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuctionRoom;
