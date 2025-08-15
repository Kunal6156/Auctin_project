import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import AuthWrapper from './components/AuthWrapper';
import AuctionCreate from './components/AuctionCreate';
import AuctionRoom from './components/AuctionRoom';
import SellerDecision from './components/SellerDecision';
import AdminPanel from './components/AdminPanel';
import { getAuctions } from './services/api';
import './App.css';

function AuctionApp({ user, onLogout }) {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuctions();
  }, []);

  const loadAuctions = async () => {
    try {
      const data = await getAuctions();
      setAuctions(data);
    } catch (error) {
      console.error('Failed to load auctions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await onLogout();
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <div className="text-lg">Loading auctions...</div>
      </div>
    );
  }

  return (
    <div className="App">
      <nav className="navbar">
        <Link to="/" className="nav-brand">
          Mini Auction System
        </Link>
        <div className="nav-links">
          <Link to="/create" className="btn btn-outline-primary">
            Create Auction
          </Link>
          <Link to="/admin" className="btn btn-outline-primary">
            Admin Panel
          </Link>
          <span style={{ color: 'white', marginRight: '1rem' }}>
            Welcome, {user.username}
          </span>
          <button
            onClick={handleLogout}
            className="btn btn-danger"
          >
            Logout
          </button>
        </div>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={
            <div className="home">
              <h1>Active Auctions</h1>
              {auctions.length === 0 ? (
                <div className="text-center" style={{ padding: '3rem' }}>
                  <p style={{ fontSize: '1.2rem', color: '#6c757d', marginBottom: '1.5rem' }}>
                    No auctions available
                  </p>
                  <Link to="/create" className="btn btn-primary">
                    Create First Auction
                  </Link>
                </div>
              ) : (
                <div className="auctions-grid">
                  {auctions.map(auction => (
                    <div key={auction.id} className="auction-card">
                      <h3>{auction.item_name}</h3>
                      <p style={{ marginBottom: '1rem', color: '#666' }}>
                        {auction.description}
                      </p>
                      <p>
                        <strong>Current Bid:</strong>{' '}
                        <span style={{ color: '#28a745', fontSize: '1.1rem', fontWeight: 'bold' }}>
                          ₹{auction.current_highest_bid || auction.starting_price}
                        </span>
                      </p>
                      <p>
                        <strong>Status:</strong>{' '}
                        <span className={`status-badge ${auction.status}`}>
                          {auction.status}
                        </span>
                      </p>
                      <p style={{ marginBottom: '1.5rem' }}>
                        <strong>Seller:</strong> {auction.seller.username}
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link 
                          to={`/auction/${auction.id}`} 
                          className="btn btn-primary"
                          style={{ flex: 1, textAlign: 'center' }}
                        >
                          View Auction
                        </Link>
                        {auction.seller.id === user.id && auction.status === 'ended' && (
                          <Link 
                            to={`/seller-decision/${auction.id}`} 
                            className="btn btn-warning"
                            style={{ flex: 1, textAlign: 'center' }}
                          >
                            Make Decision
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          } />
          <Route path="/create" element={<AuctionCreate onSuccess={loadAuctions} currentUser={user} />} />
          <Route path="/auction/:id" element={<AuctionRoom currentUser={user} />} />
          <Route path="/seller-decision/:id" element={<SellerDecision currentUser={user} />} />
          <Route path="/admin" element={<AdminPanel currentUser={user} />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthWrapper>
        <AuctionApp />
      </AuthWrapper>
    </Router>
  );
}

export default App;