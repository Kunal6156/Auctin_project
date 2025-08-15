from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Auction-specific WebSocket for real-time bidding
    re_path(r'ws/auction/(?P<auction_id>\w+)/$', consumers.AuctionConsumer.as_asgi()),
    
    # User-specific WebSocket for notifications
    re_path(r'ws/notifications/$', consumers.UserNotificationConsumer.as_asgi()),
    
    # Admin WebSocket for monitoring
    re_path(r'ws/admin/$', consumers.AdminConsumer.as_asgi()),
]