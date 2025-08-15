import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from .models import Auction, Bid, CounterOffer, Notification

class AuctionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.auction_id = self.scope['url_route']['kwargs']['auction_id']
        self.room_group_name = f'auction_{self.auction_id}'
        self.user = self.scope.get('user')

        # Join auction room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        # If user is authenticated, also join their personal notification group
        if self.user and self.user.is_authenticated:
            self.user_group_name = f'user_{self.user.id}'
            await self.channel_layer.group_add(
                self.user_group_name,
                self.channel_name
            )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave auction room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        # Leave user notification group if applicable
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )

    # Receive message from WebSocket
    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')
            
            # Handle different message types from client
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': text_data_json.get('timestamp')
                }))
            elif message_type == 'join_auction':
                # Client is joining/rejoining auction
                await self.send_auction_status()
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))

    async def send_auction_status(self):
        """Send current auction status to the client"""
        try:
            auction = await self.get_auction()
            if auction:
                await self.send(text_data=json.dumps({
                    'type': 'auction_status',
                    'message': {
                        'auction_id': auction['id'],
                        'status': auction['status'],
                        'current_highest_bid': str(auction['current_highest_bid'] or auction['starting_price']),
                        'winner': auction['winner']['username'] if auction['winner'] else None,
                        'is_active': auction['is_active']
                    }
                }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Failed to get auction status: {str(e)}'
            }))

    @database_sync_to_async
    def get_auction(self):
        """Get auction data from database"""
        try:
            auction = Auction.objects.select_related('seller', 'winner').get(id=self.auction_id)
            return {
                'id': auction.id,
                'status': auction.status,
                'current_highest_bid': auction.current_highest_bid,
                'starting_price': auction.starting_price,
                'winner': {'username': auction.winner.username, 'id': auction.winner.id} if auction.winner else None,
                'seller': {'username': auction.seller.username, 'id': auction.seller.id},
                'is_active': auction.is_active()
            }
        except Auction.DoesNotExist:
            return None

    # Handler for bid updates
    async def bid_update(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'bid_update',
            'message': message
        }))

    # Handler for auction end
    async def auction_end(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'auction_end',
            'message': message
        }))

    # Handler for seller decision notifications
    async def seller_decision(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'seller_decision',
            'message': message
        }))

    # Handler for counter offer notifications
    async def counter_offer(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'counter_offer',
            'message': message
        }))

    # Handler for counter offer responses
    async def counter_offer_response(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'counter_offer_response',
            'message': message
        }))

    # Handler for general notifications
    async def notification(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'notification',
            'message': message
        }))

    # Handler for auction status updates
    async def auction_status_update(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'auction_status_update',
            'message': message
        }))


class UserNotificationConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for user-specific notifications"""
    
    async def connect(self):
        self.user = self.scope.get('user')
        
        if not self.user or not self.user.is_authenticated:
            await self.close()
            return
            
        self.user_id = self.user.id
        self.room_group_name = f'user_{self.user_id}'

        # Join user notification group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave user notification group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')
            
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': text_data_json.get('timestamp')
                }))
            elif message_type == 'mark_read':
                notification_id = text_data_json.get('notification_id')
                await self.mark_notification_read(notification_id)
                
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))

    @database_sync_to_async
    def mark_notification_read(self, notification_id):
        """Mark notification as read"""
        try:
            notification = Notification.objects.get(
                id=notification_id, 
                user_id=self.user_id
            )
            notification.is_read = True
            notification.save()
            return True
        except Notification.DoesNotExist:
            return False

    # Handler for new notifications
    async def new_notification(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'new_notification',
            'message': message
        }))

    # Handler for counter offer notifications
    async def counter_offer_received(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'counter_offer_received',
            'message': message
        }))

    # Handler for auction completion notifications
    async def auction_completed(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'auction_completed',
            'message': message
        }))

    # Handler for bid rejection notifications
    async def bid_rejected(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'bid_rejected',
            'message': message
        }))


class AdminConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for admin real-time monitoring"""
    
    async def connect(self):
        self.user = self.scope.get('user')
        
        # Check if user is admin/staff
        if not self.user or not self.user.is_authenticated or not (self.user.is_staff or self.user.is_superuser):
            await self.close()
            return
            
        self.room_group_name = 'admin_monitoring'

        # Join admin monitoring group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave admin monitoring group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')
            
            if message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': text_data_json.get('timestamp')
                }))
            elif message_type == 'get_stats':
                await self.send_auction_stats()
                
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))

    async def send_auction_stats(self):
        """Send current auction statistics to admin"""
        try:
            stats = await self.get_auction_stats()
            await self.send(text_data=json.dumps({
                'type': 'auction_stats',
                'message': stats
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'Failed to get stats: {str(e)}'
            }))

    @database_sync_to_async
    def get_auction_stats(self):
        """Get auction statistics from database"""
        from django.utils import timezone
        
        now = timezone.now()
        total_auctions = Auction.objects.count()
        
        # Count truly active auctions
        active_auctions = 0
        pending_auctions = Auction.objects.filter(status='pending')
        for auction in pending_auctions:
            if auction.go_live_time <= now <= auction.end_time():
                active_auctions += 1
        
        active_auctions += Auction.objects.filter(status='active').count()
        
        completed_auctions = Auction.objects.filter(status__in=['completed', 'ended']).count()
        total_bids = Bid.objects.count()
        pending_counter_offers = CounterOffer.objects.filter(status='pending').count()
        
        return {
            'total_auctions': total_auctions,
            'active_auctions': active_auctions,
            'completed_auctions': completed_auctions,
            'total_bids': total_bids,
            'pending_counter_offers': pending_counter_offers,
            'timestamp': now.isoformat()
        }

    # Handler for new auction created
    async def auction_created(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'auction_created',
            'message': message
        }))

    # Handler for new bid placed
    async def admin_bid_update(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'admin_bid_update',
            'message': message
        }))

    # Handler for auction status changes
    async def admin_auction_status_change(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'admin_auction_status_change',
            'message': message
        }))

    # Handler for seller decisions
    async def admin_seller_decision(self, event):
        message = event['message']
        await self.send(text_data=json.dumps({
            'type': 'admin_seller_decision',
            'message': message
        }))