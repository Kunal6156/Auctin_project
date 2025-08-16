import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  getAuction, 
  sellerDecision, 
  updateAuctionStatus, 
  createCounterOffer,
  getUserCounterOffers,
  getSellerDashboard,
  adminUpdateAllStatuses
} from '../services/api';

const toIST = (dateString) => {
  return new Date(dateString).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false
  });
};


const SellerDecision = ({ currentUser }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [auction, setAuction] = useState(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [decisionMade, setDecisionMade] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [recentCounterOffers, setRecentCounterOffers] = useState([]);
  const [bidHistory, setBidHistory] = useState([]);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);

  useEffect(() => {
    loadAuction();
    loadSellerDashboardData();
    loadCounterOffers();
  }, [id]);

  const loadAuction = async () => {
    try {
      setPageLoading(true);
      const data = await getAuction(id);
      if (data.seller.id !== currentUser?.id) {
        setError("You don't have permission to make decisions on this auction.");
        return;
      }

      setAuction(data);
      setBidHistory(data.bids || []);
      setError(null);
    } catch (error) {
      console.error('Failed to load auction:', error);
      setError('Failed to load auction. Please try again.');
    } finally {
      setPageLoading(false);
    }
  };

  const loadSellerDashboardData = async () => {
    try {
      const dashboardData = await getSellerDashboard();
      setDashboardStats(dashboardData.stats);
    } catch (error) {
      console.error('Failed to load seller dashboard:', error);
    }
  };

  const loadCounterOffers = async () => {
    try {
      const offers = await getUserCounterOffers();
      // Filter for recent offers related to current auction
      const recentOffers = offers.sent?.filter(offer => 
        offer.auction.id === parseInt(id)
      ).slice(0, 5) || [];
      setRecentCounterOffers(recentOffers);
    } catch (error) {
      console.error('Failed to load counter offers:', error);
    }
  };

  const handleDirectStatusUpdate = async (newStatus) => {
    if (!window.confirm(`Are you sure you want to change auction status to ${newStatus}?`)) {
      return;
    }

    try {
      setLoading(true);
      await updateAuctionStatus(id, newStatus);
      await loadAuction();
      setSuccessMessage(`✅ Auction status updated to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update status:', error);
      setError('Failed to update auction status');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatuses = async () => {
    try {
      setLoading(true);
      await adminUpdateAllStatuses();
      await loadAuction();
      setSuccessMessage('✅ All auction statuses refreshed');
    } catch (error) {
      console.error('Failed to refresh statuses:', error);
      setError('Failed to refresh auction statuses');
    } finally {
      setLoading(false);
    }
  };

  const validateCounterAmount = () => {
    const amount = parseFloat(counterAmount);
    const currentBid = parseFloat(auction.current_highest_bid);
    
    if (!amount || amount <= 0) {
      return 'Please enter a valid counter amount';
    }
    
    if (amount <= currentBid) {
      return `Counter offer must be higher than current bid (₹${currentBid.toFixed(2)})`;
    }
    
    if (amount > currentBid * 5) {
      return 'Counter offer seems too high. Please check the amount.';
    }
    
    return null;
  };

  const handleDecision = async (decision, counterAmount = null) => {
    if (loading || decisionMade) return;

    if (decision === 'counter') {
      const validationError = validateCounterAmount();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    let confirmMessage = '';
    switch (decision) {
      case 'accept':
        confirmMessage = `Are you sure you want to accept the bid of ₹${auction.current_highest_bid}?`;
        break;
      case 'reject':
        confirmMessage = 'Are you sure you want to reject this bid? This action cannot be undone.';
        break;
      case 'counter':
        confirmMessage = `Are you sure you want to make a counter offer of ₹${counterAmount}?`;
        break;
    }

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = { decision };
      if (counterAmount) {
        data.counter_amount = parseFloat(counterAmount).toFixed(2);
      }
      
      await sellerDecision(id, data);
      
      let message = '';
      switch (decision) {
        case 'accept':
          message = `✅ Bid accepted! Confirmation emails have been sent to both parties.`;
          break;
        case 'reject':
          message = `❌ Bid rejected. The auction has been marked as closed.`;
          break;
        case 'counter':
          message = `💬 Counter offer of ₹${counterAmount} sent to the bidder. They will be notified via email.`;
          break;
      }
      
      setSuccessMessage(message);
      setDecisionMade(true);
      setCounterAmount('');
      
      // Reload data
      setTimeout(() => {
        loadAuction();
        loadCounterOffers();
        loadSellerDashboardData();
      }, 1000);
      
    } catch (error) {
      console.error('Decision processing error:', error);
      let errorMessage = 'Failed to process decision';
      
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

  const getStatusColor = (status) => {
  switch (status) {
    case 'pending':
      return '#ffc107'; 
    case 'active':
      return '#28a745'; 
    case 'ended':
      return '#6c757d'; 
    case 'completed':
      return '#007bff'; 
    case 'cancelled':
      return '#dc3545'; 
    default:
      return '#6c757d'; 
  }
};


  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toFixed(2);
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeRemaining = (endTime) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;
    
    if (diff <= 0) return 'Ended';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

  const getAuctionDisplayStatus = (auction) => {
    const now = new Date();
    const goLiveTime = new Date(auction.go_live_time);
    const endTime = new Date(auction.end_time);

    
    if (auction.status === 'pending' && goLiveTime <= now && now <= endTime) {
      return 'active (live)';
    } else if (auction.status === 'active' && now > endTime) {
      return 'ended (expired)';
    } else if (auction.status === 'pending' && now > endTime) {
      return 'expired';
    }
    
    return auction.status;
  };

  // Loading state
  if (pageLoading) {
    return (
      <div className="seller-decision">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading auction details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !auction) {
    return (
      <div className="seller-decision">
        <div className="error-container">
          <h2>⚠️ Error</h2>
          <p>{error}</p>
          <div style={{ marginTop: '1rem' }}>
            <button onClick={loadAuction} className="btn btn-primary" style={{ marginRight: '1rem' }}>
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

  if (!auction) {
    return (
      <div className="seller-decision">
        <div className="error-container">
          <h2>Auction Not Found</h2>
          <p>The auction you're looking for doesn't exist.</p>
          <button onClick={() => navigate('/')} className="btn btn-primary">
            Back to Auctions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="seller-decision">
      {/* Enhanced Header with Admin Controls */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>🛠️ Seller Decision Panel</h1>
          <p style={{ color: '#6c757d', margin: '0.5rem 0' }}>
            Advanced auction management for {auction.item_name}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={adminMode}
              onChange={(e) => setAdminMode(e.target.checked)}
            />
            Admin Mode
          </label>
          <button 
            onClick={() => setShowAdvancedControls(!showAdvancedControls)}
            className="btn btn-light border-primary text-primary"
          >
            {showAdvancedControls ? '🔽' : '🔼'} Advanced Controls
          </button>
          <button 
            onClick={() => navigate('/')} 
            className="btn btn-secondary"
          >
            ← Back to Auctions
          </button>
        </div>
      </div>

      {/* Dashboard Stats Overview (Admin Mode) */}
      {adminMode && dashboardStats && (
        <div className="dashboard-overview" style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '2rem',
          borderRadius: '12px',
          marginBottom: '2rem'
        }}>
          <h3>📊 Your Seller Dashboard Overview</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <div className="stat-card" style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{dashboardStats.total_auctions || 0}</div>
              <div>Total Auctions</div>
            </div>
            <div className="stat-card" style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{dashboardStats.active_auctions || 0}</div>
              <div>Active Auctions</div>
            </div>
            <div className="stat-card" style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{dashboardStats.completed_auctions || 0}</div>
              <div>Completed</div>
            </div>
            <div className="stat-card" style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>₹{formatCurrency(dashboardStats.total_revenue || 0)}</div>
              <div>Total Revenue</div>
            </div>
            <div className="stat-card" style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{dashboardStats.pending_decisions || 0}</div>
              <div>Pending Decisions</div>
            </div>
          </div>
        </div>
      )}
      {showAdvancedControls && (
        <div className="advanced-controls" style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          marginBottom: '2rem',
          border: '2px solid #e9ecef'
        }}>
          <h3>🔧 Advanced Seller Controls</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            
            <div className="control-group" style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
              <h4>📋 Status Management</h4>
              <p style={{ fontSize: '0.9rem', color: '#6c757d', marginBottom: '1rem' }}>
                Current: <span style={{ color: getStatusColor(auction.status), fontWeight: 'bold' }}>{getAuctionDisplayStatus(auction)}</span>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {['pending', 'active', 'ended', 'completed', 'cancelled'].map(status => (
                  <button
                    key={status}
                    onClick={() => handleDirectStatusUpdate(status)}
                    disabled={auction.status === status || loading}
                    className={`btn ${auction.status === status ? 'btn-success' : 'btn-outline-secondary'}`}
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                  >
                    {auction.status === status ? '✓' : ''} {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group" style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
              <h4>⚡ System Actions</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  onClick={handleRefreshStatuses}
                  disabled={loading}
                  className="btn btn-info"
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                >
                  🔄 Refresh All Statuses
                </button>
                <button
                  onClick={() => { loadAuction(); loadCounterOffers(); loadSellerDashboardData(); }}
                  disabled={loading}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                >
                  📊 Reload All Data
                </button>
              </div>
            </div>

            <div className="control-group" style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
              <h4>📈 Auction Analytics</h4>
              <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                <p><strong>Total Bids:</strong> {bidHistory.length}</p>
                <p><strong>Unique Bidders:</strong> {new Set(bidHistory.map(b => b.bidder.username)).size}</p>
                <p><strong>Bid Range:</strong> ₹{formatCurrency(auction.starting_price)} - ₹{formatCurrency(auction.current_highest_bid)}</p>
                <p><strong>Time Status:</strong> {getTimeRemaining(auction.end_time)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="success-message" style={{
          background: '#d4edda',
          color: '#155724',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          border: '1px solid #c3e6cb'
        }}>
          <h3>Decision Processed Successfully!</h3>
          <p>{successMessage}</p>
        </div>
      )}

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
      <div className="auction-summary" style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>📋 Enhanced Auction Summary</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span className={`status-badge ${auction.status}`} style={{ 
              padding: '0.5rem 1rem', 
              borderRadius: '20px', 
              background: getStatusColor(auction.status), 
              color: 'white',
              fontSize: '0.9rem'
            }}>
              {getAuctionDisplayStatus(auction)}
            </span>
            <span style={{ fontSize: '0.9rem', color: '#6c757d' }}>
              ID: {auction.id}
            </span>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: adminMode ? '1fr 1fr 1fr' : '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <h4>📦 Item Details</h4>
            <p><strong>Item:</strong> {auction.item_name}</p>
            <p><strong>Description:</strong> {auction.description}</p>
            <p><strong>Starting Price:</strong> ₹{formatCurrency(auction.starting_price)}</p>
            <p><strong>Bid Increment:</strong> ₹{formatCurrency(auction.bid_increment)}</p>
          </div>
          
          <div>
            <h4>💰 Current Status</h4>
            <p><strong>Current Bid:</strong> 
              <span style={{ color: '#28a745', fontSize: '1.2rem', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                ₹{formatCurrency(auction.current_highest_bid)}
              </span>
            </p>
            <p><strong>Winner:</strong> {auction.winner?.username || 'No bids yet'}</p>
            <p><strong>Go Live:</strong> {new Date(auction.go_live_time).toLocaleString()}</p>
            <p><strong>End Time:</strong> {new Date(auction.end_time).toLocaleString()}</p>


          </div>

          {adminMode && (
            <div>
              <h4>🔍 Admin Details</h4>
              <p><strong>Created:</strong> {formatDateTime(auction.created_at)}</p>
              <p><strong>Time Status:</strong> {getTimeRemaining(auction.end_time)}</p>
              <p><strong>Database Status:</strong> {auction.status}</p>
              <p><strong>Display Status:</strong> {getAuctionDisplayStatus(auction)}</p>
            </div>
          )}
        </div>
        {auction.winner && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1.5rem',
            background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
            borderRadius: '8px',
            border: '1px solid #dee2e6'
          }}>
            <h3>🏆 Winning Bid Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <p><strong>Winner:</strong> {auction.winner.username}</p>
                <p><strong>Winning Bid:</strong> ₹{formatCurrency(auction.current_highest_bid)}</p>
              </div>
              <div>
                <p><strong>Total Bids:</strong> {bidHistory.length}</p>
                <p><strong>Unique Bidders:</strong> {new Set(bidHistory.map(b => b.bidder.username)).size}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      {adminMode && bidHistory.length > 0 && (
        <div className="bid-history" style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          marginBottom: '2rem'
        }}>
          <h3>📊 Complete Bid History</h3>
          <div className="bid-history-table" style={{ marginTop: '1rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Bidder</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Date & Time</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {bidHistory.slice(0, 10).map((bid, index) => (
                  <tr key={bid.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ fontWeight: index === 0 ? 'bold' : 'normal' }}>
                        {bid.bidder.username}
                        {index === 0 && ' 👑'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: index === 0 ? 'bold' : 'normal', color: index === 0 ? '#28a745' : 'inherit' }}>
                      ₹{formatCurrency(bid.amount)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.9rem' }}>
                      {formatDateTime(bid.timestamp)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        background: index === 0 ? '#28a745' : '#6c757d',
                        color: 'white'
                      }}>
                        {index === 0 ? 'WINNING' : 'OUTBID'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adminMode && recentCounterOffers.length > 0 && (
        <div className="counter-offers-section" style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          marginBottom: '2rem'
        }}>
          <h3>💬 Recent Counter Offers</h3>
          {recentCounterOffers.map(offer => (
            <div key={offer.id} style={{
              padding: '1rem',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              marginTop: '1rem',
              background: '#f8f9fa'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p><strong>To:</strong> {offer.buyer.username}</p>
                  <p><strong>Original Bid:</strong> ₹{formatCurrency(offer.original_bid)}</p>
                  <p><strong>Counter Amount:</strong> ₹{formatCurrency(offer.counter_amount)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p><strong>Status:</strong> <span className={`status-badge ${offer.status}`}>{offer.status}</span></p>
                  <p style={{ fontSize: '0.9rem', color: '#6c757d' }}>{formatDateTime(offer.created_at)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {!decisionMade && auction.winner && auction.status === 'ended' && (
        <div className="decision-actions" style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <h2>⚖️ Make Your Decision</h2>
          <p style={{ marginBottom: '2rem', color: '#6c757d' }}>
            Choose one of the following options for this auction. {adminMode && 'You have admin privileges for enhanced control.'}
          </p>
          
          <div className="decision-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem'
          }}>
            <div className="decision-option" style={{
              border: '2px solid #28a745',
              borderRadius: '12px',
              padding: '1.5rem',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)'
            }}>
              <h3 style={{ color: '#28a745' }}>✅ Accept Bid</h3>
              <p>Accept the current highest bid and complete the sale.</p>
              <div style={{ margin: '1rem 0', fontSize: '1.1rem' }}>
                <p style={{ fontWeight: 'bold' }}>Final Price: ${formatCurrency(auction.current_highest_bid)}</p>
                <p style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                  Profit: ₹{formatCurrency(auction.current_highest_bid - auction.starting_price)}
                </p>
              </div>
              <button 
                className="btn btn-success"
                onClick={() => handleDecision('accept')}
                disabled={loading}
                style={{ width: '100%', marginTop: '1rem', fontSize: '1.1rem', padding: '0.75rem' }}
              >
                {loading ? '⏳ Processing...' : '✅ Accept & Complete Sale'}
              </button>
            </div>

            <div className="decision-option" style={{
              border: '2px solid #dc3545',
              borderRadius: '12px',
              padding: '1.5rem',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%)'
            }}>
              <h3 style={{ color: '#dc3545' }}>❌ Reject Bid</h3>
              <p>Reject the bid and close the auction without a sale.</p>
              <div style={{ margin: '1rem 0' }}>
                <p style={{ fontStyle: 'italic', color: '#721c24' }}>This action cannot be undone.</p>
                <p style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                  Bidder will be notified immediately
                </p>
              </div>
              <button 
                className="btn btn-danger"
                onClick={() => handleDecision('reject')}
                disabled={loading}
                style={{ width: '100%', marginTop: '1rem', fontSize: '1.1rem', padding: '0.75rem' }}
              >
                {loading ? '⏳ Processing...' : '❌ Reject & Close Auction'}
              </button>
            </div>

            <div className="decision-option" style={{
              border: '2px solid #ffc107',
              borderRadius: '12px',
              padding: '1.5rem',
              textAlign: 'center',
              gridColumn: adminMode ? 'span 1' : 'span 2',
              background: 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)'
            }}>
              <h3 style={{ color: '#856404' }}>💬 Make Counter Offer</h3>
              <p>Propose a different price to the highest bidder.</p>
              
              <div style={{ margin: '1.5rem 0' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Counter Offer Amount (₹)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', minWidth: '200px' }}>
                    <span style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#6c757d',
                      fontSize: '1.1rem'
                    }}>₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min={parseFloat(auction.current_highest_bid) + 0.01}
                      value={counterAmount}
                      onChange={(e) => setCounterAmount(e.target.value)}
                      placeholder={`Min: ${(parseFloat(auction.current_highest_bid) + 0.01).toFixed(2)}`}
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.75rem 0.75rem 2rem',
                        border: '2px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '1.1rem',
                        textAlign: 'center'
                      }}
                    />
                  </div>
                  <button 
                    className="btn btn-warning"
                    onClick={() => handleDecision('counter', counterAmount)}
                    disabled={loading || !counterAmount || parseFloat(counterAmount) <= parseFloat(auction.current_highest_bid)}
                    style={{ minWidth: '200px', fontSize: '1.1rem', padding: '0.75rem' }}
                  >
                    {loading ? '⏳ Processing...' : '💬 Send Counter Offer'}
                  </button>
                </div>
              </div>
              
              <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '1rem' }}>
                <div>Current bid: ₹{formatCurrency(auction.current_highest_bid)}</div>
                {counterAmount && parseFloat(counterAmount) > parseFloat(auction.current_highest_bid) && (
                  <div style={{ color: '#28a745', fontWeight: 'bold', marginTop: '0.5rem' }}>
                    ↗️ Increase: ₹{(parseFloat(counterAmount) - parseFloat(auction.current_highest_bid)).toFixed(2)} 
                    ({(((parseFloat(counterAmount) - parseFloat(auction.current_highest_bid)) / parseFloat(auction.current_highest_bid)) * 100).toFixed(1)}%)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {(decisionMade || auction.status !== 'ended') && (
        <div className="status-display" style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center'
        }}>
          <h3>Current Status</h3>
          <span className={`status-badge ${auction.status}`} style={{
            fontSize: '1.4rem',
            padding: '0.75rem 1.5rem',
            borderRadius: '25px',
            background: getStatusColor(auction.status),
            color: 'white',
            display: 'inline-block',
            margin: '1rem 0'
          }}>
            {getAuctionDisplayStatus(auction)}
          </span>
          
          {auction.status === 'completed' && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ color: '#28a745', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                ✅ Sale completed successfully!
              </p>
              <p style={{ color: '#6c757d' }}>
                Both parties have been notified via email with transaction details.
              </p>
              {adminMode && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
                  <p><strong>Final Sale Price:</strong> ₹{formatCurrency(auction.current_highest_bid)}</p>
                  <p><strong>Commission (if applicable):</strong> ₹{formatCurrency(auction.current_highest_bid * 0.05)}</p>
                  <p><strong>Your Net:</strong> ₹{formatCurrency(auction.current_highest_bid * 0.95)}</p>
                </div>
              )}
            </div>
          )}
          
          {auction.status === 'cancelled' && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ color: '#dc3545', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                ❌ Auction cancelled
              </p>
              <p style={{ color: '#6c757d' }}>
                The bidder has been notified that their bid was not accepted.
              </p>
            </div>
          )}
        </div>
      )}

      {adminMode && (
        <div className="admin-footer" style={{
          background: 'linear-gradient(135deg, #495057 0%, #343a40 100%)',
          color: 'white',
          padding: '2rem',
          borderRadius: '12px',
          marginTop: '2rem'
        }}>
          <h3>🔧 Quick Admin Actions</h3>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate(`/auction/${auction.id}`)}
              className="btn btn-outline-light"
            >
              👁️ View Public Auction Page
            </button>
            <button
              onClick={() => window.open(`/api/auctions/${auction.id}/`, '_blank')}
              className="btn btn-outline-light"
            >
              🔗 View API Data
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('Decision page URL copied to clipboard!');
              }}
              className="btn btn-outline-light"
            >
              📋 Copy Page URL
            </button>
            <button
              onClick={() => {
                const auctionData = JSON.stringify(auction, null, 2);
                const blob = new Blob([auctionData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `auction_${auction.id}_data.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn btn-outline-light"
            >
              💾 Export Auction Data
            </button>
          </div>
          
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
            <h4>Debug Information</h4>
            <div style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
              <p>Auction ID: {auction.id} | Status: {auction.status} | Created: {auction.created_at}</p>
              <p>Go Live: {auction.go_live_time} | End: {auction.end_time}</p>
              <p>Winner: {auction.winner?.username || 'None'} | Bids: {bidHistory.length}</p>
              <p>Counter Offers: {recentCounterOffers.length} | Last Updated: {new Date().toISOString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerDecision;
