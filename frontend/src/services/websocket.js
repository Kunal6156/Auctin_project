const getWebSocketBaseUrl = () => {
  if (process.env.REACT_APP_WS_URL) {
    return process.env.REACT_APP_WS_URL;
  }

  if (process.env.NODE_ENV === 'production') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  return 'ws://localhost:8000';
};

export const connectWebSocket = (auctionId, onMessage, maxRetries = 5) => {
  let ws = null;
  let retryCount = 0;
  let reconnectTimer = null;

  const connect = () => {
    const wsUrl = `${getWebSocketBaseUrl()}/ws/auction/${auctionId}/`;
    console.log('Attempting WebSocket connection to:', wsUrl);
    
    try {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        retryCount = 0; // Reset retry count on successful connection
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        
        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && retryCount < maxRetries) {
          retryCount++;
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Exponential backoff
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
          
          reconnectTimer = setTimeout(() => {
            connect();
          }, delay);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      
      if (retryCount < maxRetries) {
        retryCount++;
        const delay = 1000 * retryCount;
        reconnectTimer = setTimeout(connect, delay);
      }
    }
  };

  connect();

  // Return an object that matches the WebSocket interface
  return {
    close: () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Manual close');
      }
    },
    send: (data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    },
    get readyState() {
      return ws ? ws.readyState : WebSocket.CLOSED;
    }
  };
};