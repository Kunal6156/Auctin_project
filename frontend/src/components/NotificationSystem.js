import React, { useState, useEffect, useRef } from 'react';
import { getNotifications, markNotificationRead } from '../services/api';

const NotificationSystem = ({ currentUser, onCounterOfferReceived }) => {
  const [notifications, setNotifications] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [wsConnection, setWsConnection] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (currentUser) {
      loadNotifications();
      setupWebSocketConnection();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [currentUser]);

  const setupWebSocketConnection = () => {
    if (!currentUser) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/notifications/`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Notification WebSocket connected');
        setWsConnection(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing notification WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        console.log('Notification WebSocket disconnected');
        setWsConnection(null);
        
        setTimeout(() => {
          if (currentUser) {
            setupWebSocketConnection();
          }
        }, 5000);
      };

      ws.onerror = (error) => {
        console.error('Notification WebSocket error:', error);
      };

    } catch (error) {
      console.error('Failed to setup WebSocket connection:', error);
    }
  };

  const handleWebSocketMessage = (data) => {
    console.log('Notification WebSocket message:', data);

    switch (data.type) {
      case 'new_notification':
        addNotification({
          id: Date.now(),
          message: data.message.message,
          auction: data.message.auction_id,
          created_at: new Date().toISOString(),
          is_read: false,
          type: 'info'
        });
        break;

      case 'counter_offer_received':
        addNotification({
          id: Date.now(),
          message: data.message.message,
          auction: data.message.auction_id,
          created_at: new Date().toISOString(),
          is_read: false,
          type: 'counter_offer',
          counter_offer_id: data.message.counter_offer_id
        });
        
        if (onCounterOfferReceived) {
          onCounterOfferReceived(data.message);
        }
        break;

      case 'auction_completed':
        addNotification({
          id: Date.now(),
          message: data.message.message,
          auction: data.message.auction_id,
          created_at: new Date().toISOString(),
          is_read: false,
          type: 'success'
        });
        break;

      case 'bid_rejected':
        addNotification({
          id: Date.now(),
          message: data.message.message,
          auction: data.message.auction_id,
          created_at: new Date().toISOString(),
          is_read: false,
          type: 'error'
        });
        break;

      default:
        console.log('Unknown notification type:', data.type);
    }
  };

  const addNotification = (notification) => {
    setNotifications(prev => [notification, ...prev.slice(0, 19)]); 
    setUnreadCount(prev => prev + 1);
    
    if (Notification.permission === 'granted') {
      new Notification('Auction System', {
        body: notification.message,
        icon: '/favicon.ico',
        tag: `auction-${notification.auction}`
      });
    }
  };

  const loadNotifications = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await markNotificationRead(notificationId);
      
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true } 
            : n
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
      
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.is_read);
    
    try {
      await Promise.all(
        unreadNotifications.map(n => markNotificationRead(n.id))
      );
      
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
      
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'counter_offer': return '💬';
      default: return 'ℹ️';
    }
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now - time;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return time.toLocaleDateString();
  };

  useEffect(() => {
    if (currentUser && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [currentUser]);

  if (!currentUser) return null;

  return (
    <div className="notification-system">
    
      <div className="notification-bell" style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => setIsVisible(!isVisible)}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            position: 'relative'
          }}
        >
          🔔
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: '#dc3545',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                fontWeight: 'bold'
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <span
          style={{
            position: 'absolute',
            bottom: '-3px',
            right: '2px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: wsConnection ? '#28a745' : '#dc3545'
          }}
          title={wsConnection ? 'Connected to notifications' : 'Disconnected'}
        />
      </div>

      {isVisible && (
        <div
          className="notification-panel"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            width: '400px',
            maxHeight: '500px',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              padding: '1rem',
              borderBottom: '1px solid #eee',
              background: '#f8f9fa',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <h4 style={{ margin: 0, fontSize: '1.1rem' }}>
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </h4>
            <div>
              <button
                onClick={loadNotifications}
                disabled={isLoading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  marginRight: '0.5rem'
                }}
                title="Refresh notifications"
              >
                🔄
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Mark All Read
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div
            style={{
              maxHeight: '400px',
              overflowY: 'auto'
            }}
          >
            {isLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div>Loading notifications...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6c757d' }}>
                <div>📭</div>
                <div>No notifications yet</div>
              </div>
            ) : (
              notifications.map((notification, index) => (
                <div
                  key={notification.id || index}
                  className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                  style={{
                    padding: '1rem',
                    borderBottom: '1px solid #f0f0f0',
                    background: !notification.is_read ? '#f8f9ff' : 'white',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.id);
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = !notification.is_read ? '#f8f9ff' : 'white';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.9rem',
                        lineHeight: '1.4',
                        marginBottom: '0.25rem',
                        wordWrap: 'break-word'
                      }}>
                        {notification.message}
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: '#6c757d',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>{formatTime(notification.created_at)}</span>
                        {!notification.is_read && (
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#007bff'
                          }} />
                        )}
                      </div>
                      {notification.type === 'counter_offer' && notification.counter_offer_id && (
                        <button
                          style={{
                            marginTop: '0.5rem',
                            padding: '0.25rem 0.5rem',
                            background: '#ffc107',
                            color: '#000',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/counter-offer/${notification.counter_offer_id}`;
                          }}
                        >
                          View Counter Offer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderTop: '1px solid #eee',
                background: '#f8f9fa',
                textAlign: 'center'
              }}
            >
              <button
                onClick={() => setIsVisible(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#6c757d',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}

      {isVisible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setIsVisible(false)}
        />
      )}
    </div>
  );
};

export default NotificationSystem;
