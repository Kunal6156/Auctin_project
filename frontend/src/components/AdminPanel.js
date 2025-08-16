import React, { useState, useEffect } from 'react';
import { API_BASE_URL, getAuctions, updateAuctionStatus, getSellerDashboard, adminUpdateAllStatuses } from '../services/api';

const toIST = (isoString) =>
  new Date(isoString).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
  });


const AdminPanel = ({ currentUser }) => {
  const [auctions, setAuctions] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    pending_decisions: 0,
    total_revenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [accessType, setAccessType] = useState('none'); // 'admin', 'seller', or 'none'
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    checkAccess();
  }, [currentUser]);

  useEffect(() => {
    if (hasAccess) {
      loadData();
    }
  }, [hasAccess, accessType]);

  const checkAccess = async () => {
    try {
      setCheckingAuth(true);

      if (!currentUser) {
        setHasAccess(false);
        setAccessType('none');
        setCheckingAuth(false);
        return;
      }

      // Check if user is admin
      if (currentUser.is_staff || currentUser.is_superuser || currentUser.role === 'admin') {
        setHasAccess(true);
        setAccessType('admin');
        setCheckingAuth(false);
        return;
      }

      // Check if user is a seller by checking seller dashboard
      try {
        const sellerData = await getSellerDashboard();

        if (sellerData?.auctions && sellerData.auctions.length > 0) {
          setHasAccess(true);
          setAccessType('seller');
          setCheckingAuth(false);
          return;
        }
      } catch (error) {
        console.log('Error checking seller auctions:', error);
      }


      // No access
      setHasAccess(false);
      setAccessType('none');

    } catch (error) {
      console.error('Failed to check access:', error);
      setHasAccess(false);
      setAccessType('none');
    } finally {
      setCheckingAuth(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (accessType === 'admin') {
        // Admin: Load all auctions
        const data = await getAuctions();
        setAuctions(data);

        // Calculate admin stats
        const now = new Date();
        let activeCount = 0;
        let completedCount = 0;
        let totalRevenue = 0;

        data.forEach(auction => {
          const goLiveTime = new Date(auction.go_live_time);
          const endTime = new Date(auction.end_time);



          const isTimeActive = goLiveTime <= now && now <= endTime;
          const isStatusActive = auction.status === 'active' || (auction.status === 'pending' && isTimeActive);

          if (isStatusActive && isTimeActive) {
            activeCount++;
          } else if (auction.status === 'completed' || auction.status === 'ended') {
            completedCount++;
          }

          if (auction.status === 'completed' && auction.current_highest_bid) {
            totalRevenue += parseFloat(auction.current_highest_bid);
          }
        });

        setStats({
          total: data.length,
          active: activeCount,
          completed: completedCount,
          pending_decisions: data.filter(a => a.status === 'ended' && a.winner).length,
          total_revenue: totalRevenue
        });

      } else if (accessType === 'seller') {
        // Seller: Load only their auctions and dashboard data
        const sellerData = await getSellerDashboard();
        setAuctions(sellerData.auctions || []);
        setStats(sellerData.stats || {
          total: 0,
          active: 0,
          completed: 0,
          pending_decisions: 0,
          total_revenue: 0
        });
      }

    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (auctionId, newStatus) => {
    // permissions check
    const auction = auctions.find(a => a.id === auctionId);

    if (accessType === 'seller' && auction.seller.id !== currentUser.id) {
      alert('You can only modify your own auctions.');
      return;
    }

    if (!window.confirm(`Are you sure you want to change the status to "${newStatus}"?`)) {
      return;
    }

    try {
      await updateAuctionStatus(auctionId, newStatus);
      await loadData(); // Reload to update stats
      setSuccessMessage(`✅ Auction status updated to ${newStatus}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to update auction status:', error);
      alert('Failed to update auction status: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRefreshAllStatuses = async () => {
    if (!window.confirm('This will refresh all auction statuses based on current time. Continue?')) {
      return;
    }

    try {
      setLoading(true);
      await adminUpdateAllStatuses();
      await loadData();
      setSuccessMessage('✅ All auction statuses refreshed successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to refresh statuses:', error);
      setError('Failed to refresh auction statuses: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return parseFloat(amount || 0).toFixed(2);
  };

  const formatDateTime = (dateString) =>
  new Date(dateString).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
  });


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

  const getStatusCssClass = (status) => {
    return status.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[()]/g, '')
      .replace(/[^a-z0-9-]/g, '');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'active': return '#28a745';
      case 'ended': return '#6c757d';
      case 'completed': return '#007bff';
      case 'cancelled': return '#dc3545';
      default: return '#6c757d';
    }
  };

  // Show loading spinner while checking authentication
  if (checkingAuth) {
    return (
      <div className="admin-panel">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <div>
            <div className="loading-spinner"></div>
            <p>Checking permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied if no access
  if (!hasAccess) {
    return (
      <div className="admin-panel">
        <div style={{
          background: 'white',
          padding: '3rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          margin: '2rem'
        }}>
          <h1>🚫 Access Restricted</h1>
          <div style={{ marginTop: '2rem' }}>
            <h2>No Management Access</h2>
            <p style={{ color: '#6c757d', fontSize: '1.1rem', marginBottom: '2rem' }}>
              You need to be an administrator or have active auctions to access this management panel.
            </p>
            <div style={{
              background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
              padding: '2rem',
              borderRadius: '8px',
              marginBottom: '2rem'
            }}>
              <h3>🎯 How to Access:</h3>
              <div style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
                <p><strong>For Sellers:</strong></p>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  <li>📦 Create your first auction</li>
                  <li>📊 Access detailed analytics for your auctions</li>
                  <li>⚙️ Manage your auction statuses</li>
                  <li>💰 Track your sales and revenue</li>
                </ul>
                <p style={{ marginTop: '1rem' }}><strong>For Admins:</strong> Contact system administrator for access.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => window.location.href = '/create-auction'}
                className="btn btn-primary"
                style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}
              >
                🚀 Create Your First Auction
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="btn btn-secondary"
                style={{ fontSize: '1.1rem', padding: '0.75rem 2rem' }}
              >
                🏠 Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-panel">
        <h1>{accessType === 'admin' ? '🔧 Admin Panel' : '📊 Seller Management Panel'}</h1>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
          <div>
            <div className="loading-spinner"></div>
            <p>Loading {accessType === 'admin' ? 'all auctions' : 'your auctions'}...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-panel">
        <h1>{accessType === 'admin' ? '🔧 Admin Panel' : '📊 Seller Management Panel'}</h1>
        <div className="error-container" style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center'
        }}>
          <h2>⚠️ Error</h2>
          <p>{error}</p>
          <button onClick={loadData} className="btn btn-primary">
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      {/* Enhanced Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        background: accessType === 'admin'
          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        color: 'white',
        padding: '2rem',
        borderRadius: '12px'
      }}>
        <div>
          <h1>{accessType === 'admin' ? '🔧 Admin Panel' : '📊 Seller Management Panel'}</h1>
          <p style={{ opacity: 0.9, margin: '0.5rem 0' }}>
            {accessType === 'admin'
              ? 'Complete system administration and monitoring'
              : `Advanced management for your auctions, ${currentUser?.username}`
            }
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {accessType === 'admin' && (
            <button
              onClick={handleRefreshAllStatuses}
              disabled={loading}
              className="btn btn-outline-light"
              style={{ minWidth: '150px' }}
            >
              {loading ? '⏳ Updating...' : '🔄 Refresh All Statuses'}
            </button>
          )}
          <button
            onClick={loadData}
            disabled={loading}
            className="btn btn-outline-light"
          >
            {loading ? '⏳' : '🔄'} Reload
          </button>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div style={{
          background: '#d4edda',
          color: '#155724',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          border: '1px solid #c3e6cb'
        }}>
          {successMessage}
        </div>
      )}

      {/* Enhanced Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          border: '3px solid #e9ecef'
        }}>
          <h3 style={{ color: '#6c757d', marginBottom: '1rem' }}>Total Auctions</h3>
          <p style={{ fontSize: '3rem', fontWeight: 'bold', margin: 0, color: '#495057' }}>
            {stats.total || 0}
          </p>
        </div>

        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          border: '3px solid #28a745'
        }}>
          <h3 style={{ color: '#6c757d', marginBottom: '1rem' }}>Active Auctions</h3>
          <p style={{ fontSize: '3rem', fontWeight: 'bold', margin: 0, color: '#28a745' }}>
            {stats.active_auctions || stats.active || 0}
          </p>
        </div>

        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          border: '3px solid #007bff'
        }}>
          <h3 style={{ color: '#6c757d', marginBottom: '1rem' }}>Completed</h3>
          <p style={{ fontSize: '3rem', fontWeight: 'bold', margin: 0, color: '#007bff' }}>
            {stats.completed_auctions || stats.completed || 0}
          </p>
        </div>

        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          border: '3px solid #ffc107'
        }}>
          <h3 style={{ color: '#6c757d', marginBottom: '1rem' }}>Pending Decisions</h3>
          <p style={{ fontSize: '3rem', fontWeight: 'bold', margin: 0, color: '#ffc107' }}>
            {stats.pending_decisions || 0}
          </p>
        </div>

        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
          border: '3px solid #17a2b8',
          gridColumn: accessType === 'seller' ? 'span 1' : 'auto'
        }}>
          <h3 style={{ color: '#6c757d', marginBottom: '1rem' }}>Total Revenue</h3>
          <p style={{ fontSize: '2.2rem', fontWeight: 'bold', margin: 0, color: '#17a2b8' }}>
            ₹{formatCurrency(stats.total_revenue || 0)}
          </p>
        </div>
      </div>

      {/* Enhanced Auctions Section */}
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <h2>{accessType === 'admin' ? '📋 All System Auctions' : '📦 Your Auctions'}</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{
              background: '#f8f9fa',
              padding: '0.5rem 1rem',
              borderRadius: '20px',
              fontSize: '0.9rem',
              color: '#6c757d'
            }}>
              {auctions.length} {accessType === 'admin' ? 'total auctions' : 'your auctions'}
            </span>
            <button onClick={loadData} className="btn btn-secondary">
              🔄 Refresh
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.95rem'
          }}>
            <thead>
              <tr style={{
                background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                borderBottom: '2px solid #dee2e6'
              }}>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600' }}>ID</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600' }}>Item Name</th>
                {accessType === 'admin' && (
                  <th style={{ padding: '1rem 0.75rem', textAlign: 'left', fontWeight: '600' }}>Seller</th>
                )}
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>Starting Price</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>Current Bid</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'center', fontWeight: '600' }}>Go Live</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'center', fontWeight: '600' }}>End Time</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'center', fontWeight: '600' }}>Display Status</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'center', fontWeight: '600' }}>DB Status</th>
                <th style={{ padding: '1rem 0.75rem', textAlign: 'center', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {auctions.map((auction, index) => (
                <tr key={auction.id} style={{
                  borderBottom: '1px solid #dee2e6',
                  background: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
                }}>
                  <td style={{ padding: '1rem 0.75rem', fontWeight: '600' }}>{auction.id}</td>
                  <td style={{ padding: '1rem 0.75rem', maxWidth: '200px' }}>
                    <div style={{ fontWeight: '500' }}>{auction.item_name}</div>
                    {accessType === 'seller' && auction.needs_decision && (
                      <span style={{
                        background: '#ffc107',
                        color: 'white',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '10px',
                        fontSize: '0.7rem',
                        marginTop: '0.3rem',
                        display: 'inline-block'
                      }}>
                        NEEDS DECISION
                      </span>
                    )}
                  </td>
                  {accessType === 'admin' && (
                    <td style={{ padding: '1rem 0.75rem' }}>{auction.seller.username}</td>
                  )}
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>
                    ₹{formatCurrency(auction.starting_price)}
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>
                    ₹{formatCurrency(auction.current_highest_bid || auction.starting_price)}
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>
                   {toIST(auction.go_live_time)}
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'center', fontSize: '0.85rem' }}>
                    {toIST(auction.end_time)}
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                    <span style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      color: 'white',
                      backgroundColor: getStatusColor(getAuctionDisplayStatus(auction))
                    }}>
                      {getAuctionDisplayStatus(auction)}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                    <span style={{
                      padding: '0.4rem 0.8rem',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      color: 'white',
                      backgroundColor: getStatusColor(auction.status)
                    }}>
                      {auction.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <select
                        value={auction.status}
                        onChange={(e) => handleStatusChange(auction.id, e.target.value)}
                        style={{
                          padding: '0.4rem 0.6rem',
                          border: '1px solid #ddd',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          backgroundColor: 'white'
                        }}
                        disabled={accessType === 'seller' && auction.seller.id !== currentUser?.id}
                      >
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="ended">Ended</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      {accessType === 'seller' && auction.needs_decision && (
                        <button
                          onClick={() => window.location.href = `/seller-decision/${auction.id}`}
                          style={{
                            padding: '0.4rem 0.8rem',
                            background: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          🎯 Decide
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {auctions.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#6c757d'
            }}>
              <h3>📭 {accessType === 'admin' ? 'No auctions found in the system' : 'No auctions found'}</h3>
              <p>
                {accessType === 'admin'
                  ? 'There are currently no auctions in the system.'
                  : "You haven't created any auctions yet."
                }
              </p>
              {accessType === 'seller' && (
                <button
                  onClick={() => window.location.href = '/create-auction'}
                  className="btn btn-primary"
                  style={{ marginTop: '1rem' }}
                >
                  🚀 Create Your First Auction
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer with Access Info */}
      <div style={{
        background: 'linear-gradient(135deg, #495057 0%, #343a40 100%)',
        color: 'white',
        padding: '2rem',
        borderRadius: '12px',
        marginTop: '2rem',
        textAlign: 'center'
      }}>
        <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>
          <strong>Access Level:</strong> {accessType === 'admin' ? '🔧 System Administrator' : '📊 Seller Management'} •
          <strong> Logged in as:</strong> {currentUser?.username} •
          <strong> Last Updated:</strong> {toIST(new Date().toISOString())}
        </p>
        {accessType === 'seller' && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', opacity: 0.7 }}>
            You can manage your own auctions, update statuses, and track performance.
            Admin privileges required for system-wide management.
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
