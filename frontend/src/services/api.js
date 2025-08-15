import axios from 'axios';

const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? window.location.origin
    : 'http://localhost:8000');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth functions
export const register = async (userData) => {
  const response = await api.post('/api/register/', userData);
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
  }
  return response.data;
};

export const login = async (credentials) => {
  const response = await api.post('/api/login/', credentials);
  if (response.data.token) {
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
  }
  return response.data;
};

export const logout = async () => {
  try {
    await api.post('/api/logout/');
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

export const getCurrentUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};

// Check if user is seller (has auctions) or admin
export const canAccessSellerDashboard = () => {
  const user = getCurrentUser();
  return user && (user.is_staff || user.is_superuser || isAuthenticated());
};

// Auction functions
export const getAuctions = async () => {
  const response = await api.get('/api/auctions/');
  return response.data;
};

export const getAuction = async (id) => {
  const response = await api.get(`/api/auctions/${id}/`);
  return response.data;
};

export const createAuction = async (data) => {
  const response = await api.post('/api/auctions/', data);
  return response.data;
};

export const placeBid = async (auctionId, amount) => {
  const response = await api.post(`/api/auctions/${auctionId}/bid/`, {
    amount: amount
  });
  return response.data;
};

export const sellerDecision = async (auctionId, data) => {
  const response = await api.post(`/api/auctions/${auctionId}/seller-decision/`, data);
  return response.data;
};

export const updateAuctionStatus = async (auctionId, status) => {
  const response = await api.post(`/api/auctions/${auctionId}/status/`, { status });
  return response.data;
};

// NEW: Seller Dashboard Functions
export const getSellerDashboard = async () => {
  const response = await api.get('/api/seller/dashboard/');
  return response.data;
};

export const createCounterOffer = async (auctionId, counterAmount) => {
  const response = await api.post(`/api/seller/auctions/${auctionId}/counter-offer/`, {
    counter_amount: counterAmount
  });
  return response.data;
};

// Counter offer functions
export const respondToCounterOffer = async (offerId, response) => {
  const res = await api.post(`/api/counter-offers/${offerId}/respond/`, {
    response: response
  });
  return res.data;
};

export const getCounterOffer = async (offerId) => {
  const response = await api.get(`/api/counter-offers/${offerId}/`);
  return response.data;
};

export const getUserCounterOffers = async () => {
  const response = await api.get('/api/counter-offers/');
  return response.data;
};

// Notification functions
export const getNotifications = async () => {
  const response = await api.get('/api/notifications/');
  return response.data;
};

export const markNotificationRead = async (notificationId) => {
  const response = await api.post(`/api/notifications/${notificationId}/read/`);
  return response.data;
};

// Admin functions (now available to sellers for their auctions)
export const adminUpdateAllStatuses = async () => {
  const response = await api.post('/api/admin/update-statuses/');
  return response.data;
};

export const getAdminStats = async () => {
  const response = await api.get('/api/admin/stats/');
  return response.data;
};

// Enhanced retry functions
export const getAuctionWithRetry = async (id, maxRetries = 3) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await api.get(`/api/auctions/${id}/`);
      return response.data;
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  throw lastError;
};

export const placeBidWithRetry = async (auctionId, amount, maxRetries = 2) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await api.post(`/api/auctions/${auctionId}/bid/`, {
        amount: amount
      });
      return response.data;
    } catch (error) {
      lastError = error;
      // Don't retry on client errors (400-499)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  throw lastError;
};

// NEW: Batch operations for sellers
export const updateMultipleAuctionStatuses = async (updates) => {
  const promises = updates.map(({ auctionId, status }) => 
    updateAuctionStatus(auctionId, status)
  );
  return Promise.allSettled(promises);
};

export const createMultipleCounterOffers = async (offers) => {
  const promises = offers.map(({ auctionId, counterAmount }) =>
    createCounterOffer(auctionId, counterAmount)
  );
  return Promise.allSettled(promises);
};

// WebSocket helper functions
export const createWebSocketConnection = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('token');
    const wsUrl = token ? `${url}?token=${token}` : url;
    
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket connection timeout'));
    }, options.timeout || 5000);
    
    ws.onopen = () => {
      clearTimeout(timeout);
      resolve(ws);
    };
    
    ws.onerror = (error) => {
      clearTimeout(timeout);
      reject(error);
    };
  });
};

// API health check
export const checkApiHealth = async () => {
  try {
    const response = await api.get('/api/auctions/?page=1&page_size=1');
    return { status: 'healthy', responseTime: Date.now() };
  } catch (error) {
    return { 
      status: 'unhealthy', 
      error: error.message,
      code: error.response?.status 
    };
  }
};

// Batch operations
export const batchMarkNotificationsRead = async (notificationIds) => {
  const promises = notificationIds.map(id => markNotificationRead(id));
  return Promise.allSettled(promises);
};

// Real-time data fetching
export const getAuctionRealTimeData = async (auctionId) => {
  try {
    const [auction, notifications] = await Promise.all([
      getAuction(auctionId),
      getNotifications()
    ]);
    
    return {
      auction,
      notifications: notifications.filter(n => n.auction === parseInt(auctionId)),
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching real-time data:', error);
    throw error;
  }
};

// NEW: Seller-specific real-time data
export const getSellerRealTimeData = async () => {
  try {
    const [dashboard, notifications, counterOffers] = await Promise.all([
      getSellerDashboard(),
      getNotifications(),
      getUserCounterOffers()
    ]);
    
    return {
      dashboard,
      notifications,
      counterOffers,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching seller real-time data:', error);
    throw error;
  }
};

// Analytics functions for sellers
export const getSellerAnalytics = async (timeframe = '30d') => {
  try {
    const dashboard = await getSellerDashboard();
    const now = new Date();
    const timeframeDays = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
    const startDate = new Date(now - timeframeDays * 24 * 60 * 60 * 1000);
    
    // Calculate analytics from dashboard data
    const analytics = {
      totalRevenue: dashboard.stats.total_revenue || 0,
      totalAuctions: dashboard.stats.total_auctions || 0,
      successRate: 0,
      averageBidValue: 0,
      topPerformingAuctions: [],
      recentActivity: []
    };
    
    if (dashboard.auctions && dashboard.auctions.length > 0) {
      const completedAuctions = dashboard.auctions.filter(a => a.status === 'completed');
      analytics.successRate = (completedAuctions.length / dashboard.auctions.length) * 100;
      
      if (completedAuctions.length > 0) {
        const totalValue = completedAuctions.reduce((sum, auction) => 
          sum + parseFloat(auction.current_highest_bid || 0), 0);
        analytics.averageBidValue = totalValue / completedAuctions.length;
      }
      
      // Top performing auctions by final bid amount
      analytics.topPerformingAuctions = completedAuctions
        .sort((a, b) => parseFloat(b.current_highest_bid || 0) - parseFloat(a.current_highest_bid || 0))
        .slice(0, 5);
        
      // Recent activity (auctions created in timeframe)
      analytics.recentActivity = dashboard.auctions
        .filter(auction => new Date(auction.created_at) >= startDate)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    return analytics;
  } catch (error) {
    console.error('Error fetching seller analytics:', error);
    throw error;
  }
};

// Error handling wrapper
export const withErrorHandling = (apiFunction) => {
  return async (...args) => {
    try {
      return await apiFunction(...args);
    } catch (error) {
      // Log error details
      console.error('API Error:', {
        function: apiFunction.name,
        args,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      // Re-throw with additional context
      const enhancedError = new Error(
        error.response?.data?.error || error.message || 'An unexpected error occurred'
      );
      enhancedError.originalError = error;
      enhancedError.status = error.response?.status;
      throw enhancedError;
    }
  };
};