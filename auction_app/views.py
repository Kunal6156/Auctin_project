import redis
import json
import ssl
import logging
from urllib.parse import urlparse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from decimal import Decimal
from django.shortcuts import render
from django.utils import timezone
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Auction, Bid, CounterOffer, Notification
from .serializers import AuctionSerializer, BidSerializer, CounterOfferSerializer, NotificationSerializer, UserSerializer
from .services import send_confirmation_email, generate_invoice

logger = logging.getLogger(__name__)

# Enhanced Redis client initialization
def get_redis_client():
    try:
        if settings.REDIS_URL.startswith('rediss://'):
            # Parse the URL for SSL connection
            parsed_url = urlparse(settings.REDIS_URL)
            
            redis_client = redis.Redis(
                host=parsed_url.hostname,
                port=parsed_url.port,
                username=parsed_url.username,
                password=parsed_url.password,
                ssl=True,
                ssl_cert_reqs=ssl.CERT_NONE,
                ssl_check_hostname=False,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
                retry_on_timeout=True
            )
        else:
            redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        
        # Test the connection
        redis_client.ping()
        logger.info("Redis connection established successfully")
        return redis_client
        
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        # Return None so we can handle Redis being unavailable
        return None

redis_client = get_redis_client()
channel_layer = get_channel_layer()

def update_auction_statuses():
    """Update auction statuses based on current time"""
    now = timezone.now()
    
    # Activate pending auctions whose go_live_time has arrived
    pending_auctions = Auction.objects.filter(
        status='pending',
        go_live_time__lte=now
    )
    for auction in pending_auctions:
        if auction.end_time() > now:  # Only activate if not already expired
            auction.status = 'active'
            auction.save()
    
    # End active auctions whose end_time has passed
    active_auctions = Auction.objects.filter(
        status='active'
    )
    for auction in active_auctions:
        if auction.end_time() <= now:
            auction.status = 'ended'
            auction.save()
            
            # Notify via WebSocket that auction ended
            try:
                async_to_sync(channel_layer.group_send)(
                    f'auction_{auction.id}',
                    {
                        'type': 'auction_end',
                        'message': {
                            'auction_id': auction.id,
                            'final_bid': str(auction.current_highest_bid or auction.starting_price),
                            'winner': auction.winner.username if auction.winner else None
                        }
                    }
                )
            except Exception as e:
                logger.error(f"Failed to send WebSocket message for auction end: {e}")

def check_admin_or_seller_permissions(user, auction_id=None):
    """Check if user is admin or seller of the auction"""
    if user.is_staff or user.is_superuser:
        return True
    
    if auction_id:
        try:
            auction = Auction.objects.get(id=auction_id, seller=user)
            return True
        except Auction.DoesNotExist:
            return False
    
    return False
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_dashboard(request):
    """Simple seller dashboard - if this function exists"""
    try:
        auctions = Auction.objects.filter(seller=request.user)
        stats = {
            "total": auctions.count(),
            "active": auctions.filter(status='active').count(),
            "completed": auctions.filter(status='completed').count(),
            "pending_decisions": auctions.filter(status='ended', winner__isnull=False).count(),
            "total_revenue": sum(float(a.current_highest_bid or 0) for a in auctions if a.status == 'completed')
        }
        
        # Use the serializer properly
        serializer = AuctionSerializer(auctions, many=True)
        
        return Response({
            "auctions": serializer.data, 
            "stats": stats
        })
    except Exception as e:
        logger.error(f"Seller dashboard error: {e}", exc_info=True)
        return Response({'error': str(e)}, status=500)

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    try:
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists'}, status=400)
        
        if User.objects.filter(email=email).exists():
            return Response({'error': 'Email already exists'}, status=400)
        
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )
        
        token, created = Token.objects.get_or_create(user=user)
        
        return Response({
            'success': True,
            'token': token.key,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'is_staff': user.is_staff,          
                'is_superuser': user.is_superuser  
            }
        })
    
    except Exception as e:
        logger.error(f"Registration error: {e}")
        return Response({'error': str(e)}, status=500)

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def user_login(request):
    try:
        username = request.data.get('username')
        password = request.data.get('password')
        
        user = authenticate(username=username, password=password)
        
        if user:
            token, created = Token.objects.get_or_create(user=user)
            
            return Response({
                'success': True,
                'token': token.key,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'is_staff': user.is_staff,          
                    'is_superuser': user.is_superuser,
                }
            })
        else:
            return Response({'error': 'Invalid credentials'}, status=400)
    
    except Exception as e:
        logger.error(f"Login error: {e}")
        return Response({'error': str(e)}, status=500)

@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def user_logout(request):
    try:
        token = Token.objects.get(user=request.user)
        token.delete()
        return Response({'success': True})
    except Token.DoesNotExist:
        return Response({'error': 'Token not found'}, status=400)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    return Response({
        'id': request.user.id,
        'username': request.user.username,
        'email': request.user.email,
        'is_staff': request.user.is_staff,          
        'is_superuser': request.user.is_superuser
    })

class AuctionViewSet(viewsets.ModelViewSet):
    queryset = Auction.objects.all()
    serializer_class = AuctionSerializer
    
    def get_permissions(self):
        """
        Instantiates and returns the list of permissions that this view requires.
        """
        if self.action == 'list' or self.action == 'retrieve':
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def list(self, request, *args, **kwargs):
        # Update auction statuses before returning list
        update_auction_statuses()
        return super().list(request, *args, **kwargs)
    
    def retrieve(self, request, *args, **kwargs):
        # Update auction statuses before returning single auction
        update_auction_statuses()
        return super().retrieve(request, *args, **kwargs)
    
    def perform_create(self, serializer):
        auction = serializer.save(seller=self.request.user)
        # Check if auction should be active immediately
        if auction.go_live_time <= timezone.now() and auction.end_time() > timezone.now():
            auction.status = 'active'
            auction.save()

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_auction_status(request, auction_id):
    try:
        auction = Auction.objects.get(id=auction_id)
        
        # Check permissions - admin or seller
        if not check_admin_or_seller_permissions(request.user, auction_id):
            return Response({'error': 'Permission denied'}, status=403)
        
        new_status = request.data.get('status')
        
        # Validate status
        valid_statuses = ['pending', 'active', 'ended', 'completed', 'cancelled']
        if new_status not in valid_statuses:
            return Response({'error': 'Invalid status'}, status=400)
        
        old_status = auction.status
        auction.status = new_status
        auction.save()
        
        # Log the status change
        logger.info(f"Auction {auction_id} status changed from {old_status} to {new_status} by {request.user.username}")
        
        # Notify via WebSocket
        try:
            async_to_sync(channel_layer.group_send)(
                f'auction_{auction_id}',
                {
                    'type': 'status_update',
                    'message': {
                        'auction_id': auction_id,
                        'old_status': old_status,
                        'new_status': new_status,
                        'changed_by': request.user.username
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to send status update WebSocket: {e}")
        
        return Response({'success': True, 'status': auction.status})
    
    except Auction.DoesNotExist:
        return Response({'error': 'Auction not found'}, status=404)
    except Exception as e:
        logger.error(f"Update auction status error: {e}")
        return Response({'error': str(e)}, status=500)

# [Place bid function remains the same...]
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def place_bid(request, auction_id):
    try:
        logger.info(f"Place bid attempt for auction {auction_id} by user {request.user.username}")
        
        # Update auction statuses first
        update_auction_statuses()
        
        auction = Auction.objects.get(id=auction_id)
        
        # Check if auction is active (both status and time-based)
        now = timezone.now()
        is_time_active = auction.go_live_time <= now <= auction.end_time()
        
        if auction.status != 'active' or not is_time_active:
            logger.warning(f"Auction {auction_id} is not active. Status: {auction.status}, Time active: {is_time_active}")
            return Response({'error': 'Auction is not active'}, status=400)
        
        if auction.seller == request.user:
            return Response({'error': 'Sellers cannot bid on their own auctions'}, status=400)
        
        bid_amount = Decimal(str(request.data['amount']))
        logger.info(f"Bid amount: {bid_amount}")
        
        # Check Redis for current highest bid (with fallback if Redis is unavailable)
        redis_key = f'auction:{auction_id}:highest_bid'
        redis_highest = None
        
        if redis_client:
            try:
                current_highest = redis_client.get(redis_key)
                redis_highest = Decimal(str(current_highest)) if current_highest else None
                logger.info(f"Redis highest bid: {redis_highest}")
            except Exception as redis_error:
                logger.warning(f"Redis error, falling back to database: {redis_error}")
        
        # Use either Redis value or database value, whichever is higher
        db_highest = auction.current_highest_bid or auction.starting_price
        actual_highest = max(redis_highest or Decimal('0'), db_highest)
        
        logger.info(f"DB highest: {db_highest}, Actual highest: {actual_highest}")
        
        minimum_bid = actual_highest + auction.bid_increment
        if bid_amount < minimum_bid:
            return Response({
                'error': f'Bid must be at least ${minimum_bid}',
                'minimum_bid': str(minimum_bid),
                'current_highest': str(actual_highest)
            }, status=400)
        
        # Create bid
        bid = Bid.objects.create(
            auction=auction,
            bidder=request.user,
            amount=bid_amount
        )
        logger.info(f"Bid created with ID: {bid.id}")
        
        # Update Redis (with error handling)
        if redis_client:
            try:
                redis_client.set(redis_key, str(bid_amount))
                logger.info(f"Redis updated with bid amount: {bid_amount}")
            except Exception as redis_error:
                logger.error(f"Failed to update Redis: {redis_error}")
        
        # Update auction
        previous_winner = auction.winner
        auction.current_highest_bid = bid_amount
        auction.winner = request.user
        auction.save()
        logger.info(f"Auction updated. New highest bid: {bid_amount}")
        
        # Send notifications
        try:
            if previous_winner and previous_winner != request.user:
                Notification.objects.create(
                    user=previous_winner,
                    message=f'You have been outbid on {auction.item_name}',
                    auction=auction
                )
                
                # WebSocket notification to previous winner
                async_to_sync(channel_layer.group_send)(
                    f'user_{previous_winner.id}',
                    {
                        'type': 'new_notification',
                        'message': {
                            'auction_id': auction.id,
                            'item_name': auction.item_name,
                            'new_bid': str(bid_amount),
                            'bidder': request.user.username,
                            'message': f'You have been outbid on {auction.item_name}'
                        }
                    }
                )
            
            Notification.objects.create(
                user=auction.seller,
                message=f'New bid of ${bid_amount} on {auction.item_name}',
                auction=auction
            )
            
            # WebSocket notification to seller
            async_to_sync(channel_layer.group_send)(
                f'user_{auction.seller.id}',
                {
                    'type': 'new_notification',
                    'message': {
                        'auction_id': auction.id,
                        'item_name': auction.item_name,
                        'new_bid': str(bid_amount),
                        'bidder': request.user.username,
                        'message': f'New bid of ${bid_amount} on {auction.item_name}'
                    }
                }
            )
            
            logger.info("Notifications created")
        except Exception as notif_error:
            logger.error(f"Failed to create notifications: {notif_error}")
        
        # Broadcast to WebSocket
        try:
            async_to_sync(channel_layer.group_send)(
                f'auction_{auction_id}',
                {
                    'type': 'bid_update',
                    'message': {
                        'auction_id': auction_id,
                        'highest_bid': str(bid_amount),
                        'bidder': request.user.username,
                        'bid_id': bid.id,
                        'timestamp': bid.timestamp.isoformat()
                    }
                }
            )
            
            # Send to admin monitoring
            async_to_sync(channel_layer.group_send)(
                'admin_monitoring',
                {
                    'type': 'admin_bid_update',
                    'message': {
                        'auction_id': auction_id,
                        'item_name': auction.item_name,
                        'bid_amount': str(bid_amount),
                        'bidder': request.user.username,
                        'seller': auction.seller.username,
                        'timestamp': bid.timestamp.isoformat()
                    }
                }
            )
            
            logger.info("WebSocket messages sent")
        except Exception as ws_error:
            logger.error(f"Failed to send WebSocket message: {ws_error}")
        
        return Response({
            'success': True, 
            'bid_id': bid.id,
            'message': 'Bid placed successfully',
            'new_highest_bid': str(bid_amount),
            'bidder': request.user.username
        }, status=201)
    
    except Auction.DoesNotExist:
        logger.error(f"Auction {auction_id} not found")
        return Response({'error': 'Auction not found'}, status=404)
    except Exception as e:
        logger.error(f"Error in place_bid: {str(e)}", exc_info=True)
        return Response({'error': f'Internal server error: {str(e)}'}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def seller_decision(request, auction_id):
    try:
        auction = Auction.objects.get(id=auction_id, seller=request.user)
        decision = request.data['decision']
        
        if auction.status != 'ended':
            return Response({'error': 'Auction is not ready for decisions'}, status=400)
        
        if decision == 'accept':
            auction.status = 'completed'
            auction.save()
            
            # Send notifications
            if auction.winner:
                Notification.objects.create(
                    user=auction.winner,
                    message=f'Congratulations! Your bid on {auction.item_name} was accepted',
                    auction=auction
                )
                
                # WebSocket notification to winner
                try:
                    async_to_sync(channel_layer.group_send)(
                        f'user_{auction.winner.id}',
                        {
                            'type': 'auction_completed',
                            'message': {
                                'auction_id': auction.id,
                                'item_name': auction.item_name,
                                'final_amount': str(auction.current_highest_bid),
                                'status': 'accepted',
                                'message': f'Congratulations! Your bid on {auction.item_name} was accepted'
                            }
                        }
                    )
                except Exception as e:
                    logger.error(f"Failed to send WebSocket notification: {e}")
                
                # Send confirmation email and generate invoice
                try:
                    send_confirmation_email(auction.seller, auction.winner, auction)
                    generate_invoice(auction)
                except Exception as e:
                    logger.error(f"Failed to send email or generate invoice: {e}")
            
            # Notify all watchers of the auction
            try:
                async_to_sync(channel_layer.group_send)(
                    f'auction_{auction.id}',
                    {
                        'type': 'seller_decision',
                        'message': {
                            'auction_id': auction.id,
                            'decision': 'accepted',
                            'final_amount': str(auction.current_highest_bid),
                            'winner': auction.winner.username if auction.winner else None
                        }
                    }
                )
            except Exception as e:
                logger.error(f"Failed to send auction WebSocket message: {e}")
            
        elif decision == 'reject':
            auction.status = 'cancelled'
            auction.save()
            
            if auction.winner:
                Notification.objects.create(
                    user=auction.winner,
                    message=f'Your bid on {auction.item_name} was rejected',
                    auction=auction
                )
                
                # WebSocket notification to bidder
                try:
                    async_to_sync(channel_layer.group_send)(
                        f'user_{auction.winner.id}',
                        {
                            'type': 'bid_rejected',
                            'message': {
                                'auction_id': auction.id,
                                'item_name': auction.item_name,
                                'bid_amount': str(auction.current_highest_bid),
                                'message': f'Your bid on {auction.item_name} was rejected'
                            }
                        }
                    )
                except Exception as e:
                    logger.error(f"Failed to send WebSocket notification: {e}")
            
            # Notify all watchers
            try:
                async_to_sync(channel_layer.group_send)(
                    f'auction_{auction.id}',
                    {
                        'type': 'seller_decision',
                        'message': {
                            'auction_id': auction.id,
                            'decision': 'rejected',
                            'bid_amount': str(auction.current_highest_bid),
                            'bidder': auction.winner.username if auction.winner else None
                        }
                    }
                )
            except Exception as e:
                logger.error(f"Failed to send auction WebSocket message: {e}")
            
        elif decision == 'counter':
            counter_amount = Decimal(str(request.data['counter_amount']))
            
            if auction.winner:
                counter_offer = CounterOffer.objects.create(
                    auction=auction,
                    seller=auction.seller,
                    buyer=auction.winner,
                    original_bid=auction.current_highest_bid,
                    counter_amount=counter_amount
                )
                
                Notification.objects.create(
                    user=auction.winner,
                    message=f'Counter offer of ${counter_amount} received for {auction.item_name}',
                    auction=auction
                )
                
                # WebSocket notification to buyer
                try:
                    async_to_sync(channel_layer.group_send)(
                        f'user_{auction.winner.id}',
                        {
                            'type': 'counter_offer_received',
                            'message': {
                                'auction_id': auction.id,
                                'counter_offer_id': counter_offer.id,
                                'item_name': auction.item_name,
                                'original_bid': str(counter_offer.original_bid),
                                'counter_amount': str(counter_amount),
                                'seller': auction.seller.username,
                                'message': f'Counter offer of ${counter_amount} received for {auction.item_name}'
                            }
                        }
                    )
                except Exception as e:
                    logger.error(f"Failed to send WebSocket notification: {e}")
                
                # Notify auction watchers
                try:
                    async_to_sync(channel_layer.group_send)(
                        f'auction_{auction.id}',
                        {
                            'type': 'counter_offer',
                            'message': {
                                'auction_id': auction.id,
                                'counter_amount': str(counter_amount),
                                'original_bid': str(counter_offer.original_bid),
                                'buyer': auction.winner.username
                            }
                        }
                    )
                except Exception as e:
                    logger.error(f"Failed to send auction WebSocket message: {e}")
        
        # Send admin notification
        try:
            async_to_sync(channel_layer.group_send)(
                'admin_monitoring',
                {
                    'type': 'admin_seller_decision',
                    'message': {
                        'auction_id': auction.id,
                        'item_name': auction.item_name,
                        'decision': decision,
                        'seller': auction.seller.username,
                        'amount': str(request.data.get('counter_amount', auction.current_highest_bid)),
                        'timestamp': timezone.now().isoformat()
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to send admin WebSocket message: {e}")
        
        return Response({'success': True})
    
    except Auction.DoesNotExist:
        return Response({'error': 'Auction not found'}, status=404)
    except Exception as e:
        logger.error(f"Seller decision error: {e}")
        return Response({'error': str(e)}, status=500)

# New endpoint for sellers to view their auctions with admin-like capabilities
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_auction_dashboard(request):
    """Get seller's auctions with detailed analytics - DEBUG VERSION"""
    try:
        # Get seller's auctions
        seller_auctions = Auction.objects.filter(seller=request.user).order_by('-created_at')
        
        # Update statuses
        update_auction_statuses()
        
        # Calculate basic stats
        stats = {
            'total_auctions': seller_auctions.count(),
            'active_auctions': seller_auctions.filter(status='active').count(),
            'ended_auctions': seller_auctions.filter(status='ended').count(),
            'completed_auctions': seller_auctions.filter(status='completed').count(),
            'cancelled_auctions': seller_auctions.filter(status='cancelled').count(),
            'total_revenue': 0,
            'pending_counter_offers': CounterOffer.objects.filter(seller=request.user, status='pending').count()
        }
        
        # Calculate revenue safely
        for auction in seller_auctions.filter(status='completed'):
            if auction.current_highest_bid:
                stats['total_revenue'] += float(auction.current_highest_bid)
        
        # Serialize auctions using the standard serializer only
        auction_serializer = AuctionSerializer(seller_auctions, many=True)
        auction_data = auction_serializer.data
        
        # Serialize counter offers
        counter_offers = CounterOffer.objects.filter(seller=request.user).order_by('-created_at')[:10]
        counter_offers_serializer = CounterOfferSerializer(counter_offers, many=True)
        
        # Serialize seller
        seller_serializer = UserSerializer(request.user)
        
        return Response({
            'auctions': auction_data,
            'stats': stats,
            'counter_offers': counter_offers_serializer.data,
            'seller': seller_serializer.data
        })
        
    except Exception as e:
        logger.error(f"Seller dashboard error: {e}", exc_info=True)
        return Response({'error': str(e)}, status=500)

# Enhanced counter offer endpoints
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_counter_offer(request, auction_id):
    """Create a counter offer - for sellers only"""
    try:
        auction = Auction.objects.get(id=auction_id, seller=request.user)
        
        if auction.status != 'ended' or not auction.winner:
            return Response({'error': 'Cannot create counter offer for this auction'}, status=400)
        
        counter_amount = Decimal(str(request.data['counter_amount']))
        original_bid = auction.current_highest_bid
        
        if counter_amount <= original_bid:
            return Response({'error': 'Counter offer must be higher than original bid'}, status=400)
        
        # Create counter offer
        counter_offer = CounterOffer.objects.create(
            auction=auction,
            seller=request.user,
            buyer=auction.winner,
            original_bid=original_bid,
            counter_amount=counter_amount
        )
        
        # Create notification for buyer
        Notification.objects.create(
            user=auction.winner,
            message=f'Counter offer of ${counter_amount} received for {auction.item_name}',
            auction=auction
        )
        
        # Send WebSocket notification
        try:
            async_to_sync(channel_layer.group_send)(
                f'user_{auction.winner.id}',
                {
                    'type': 'counter_offer_received',
                    'message': {
                        'auction_id': auction.id,
                        'counter_offer_id': counter_offer.id,
                        'item_name': auction.item_name,
                        'original_bid': str(original_bid),
                        'counter_amount': str(counter_amount),
                        'seller': request.user.username
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to send WebSocket notification: {e}")
        
        return Response({
            'success': True,
            'counter_offer': CounterOfferSerializer(counter_offer).data
        }, status=201)
        
    except Auction.DoesNotExist:
        return Response({'error': 'Auction not found or access denied'}, status=404)
    except Exception as e:
        logger.error(f"Create counter offer error: {e}")
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def respond_counter_offer(request, offer_id):
    try:
        offer = CounterOffer.objects.get(id=offer_id, buyer=request.user)
        
        if offer.status != 'pending':
            return Response({'error': 'Counter offer has already been responded to'}, status=400)
        
        response = request.data['response']
        
        offer.status = 'accepted' if response == 'accept' else 'rejected'
        offer.responded_at = timezone.now()
        offer.save()
        
        if response == 'accept':
            auction = offer.auction
            auction.status = 'completed'
            auction.current_highest_bid = offer.counter_amount
            auction.save()
            
            # Notify seller
            Notification.objects.create(
                user=offer.seller,
                message=f'Your counter offer for {auction.item_name} was accepted',
                auction=auction
            )
            
            # WebSocket notification to seller
            try:
                async_to_sync(channel_layer.group_send)(
                    f'user_{offer.seller.id}',
                    {
                        'type': 'auction_completed',
                        'message': {
                            'auction_id': auction.id,
                            'item_name': auction.item_name,
                            'final_amount': str(offer.counter_amount),
                            'status': 'counter_accepted',
                            'buyer': offer.buyer.username,
                            'message': f'Your counter offer for {auction.item_name} was accepted'
                        }
                    }
                )
            except Exception as e:
                logger.error(f"Failed to send WebSocket notification: {e}")
            
            try:
                send_confirmation_email(auction.seller, auction.winner, auction)
                generate_invoice(auction)
            except Exception as e:
                logger.error(f"Failed to send email or generate invoice: {e}")
                
        else:  # rejected
            # Notify seller
            Notification.objects.create(
                user=offer.seller,
                message=f'Your counter offer for {offer.auction.item_name} was rejected',
                auction=offer.auction
            )
            
            # Mark auction as cancelled
            offer.auction.status = 'cancelled'
            offer.auction.save()
            
            # WebSocket notification to seller
            try:
                async_to_sync(channel_layer.group_send)(
                    f'user_{offer.seller.id}',
                    {
                        'type': 'bid_rejected',
                        'message': {
                            'auction_id': offer.auction.id,
                            'item_name': offer.auction.item_name,
                            'counter_amount': str(offer.counter_amount),
                            'buyer': offer.buyer.username,
                            'message': f'Your counter offer for {offer.auction.item_name} was rejected'
                        }
                    }
                )
            except Exception as e:
                logger.error(f"Failed to send WebSocket notification: {e}")
        
        # Notify auction watchers
        try:
            async_to_sync(channel_layer.group_send)(
                f'auction_{offer.auction.id}',
                {
                    'type': 'counter_offer_response',
                    'message': {
                        'auction_id': offer.auction.id,
                        'response': response,
                        'counter_amount': str(offer.counter_amount),
                        'buyer': offer.buyer.username,
                        'final_status': offer.auction.status
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to send auction WebSocket message: {e}")
        
        # Send admin notification
        try:
            async_to_sync(channel_layer.group_send)(
                'admin_monitoring',
                {
                    'type': 'admin_seller_decision',
                    'message': {
                        'auction_id': offer.auction.id,
                        'item_name': offer.auction.item_name,
                        'decision': f'counter_{response}',
                        'buyer': offer.buyer.username,
                        'seller': offer.seller.username,
                        'amount': str(offer.counter_amount),
                        'timestamp': timezone.now().isoformat()
                    }
                }
            )
        except Exception as e:
            logger.error(f"Failed to send admin WebSocket message: {e}")
        
        return Response({'success': True})
    
    except CounterOffer.DoesNotExist:
        return Response({'error': 'Counter offer not found'}, status=404)
    except Exception as e:
        logger.error(f"Counter offer response error: {e}")
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_counter_offer(request, offer_id):
    """Get counter offer details for buyer response"""
    try:
        offer = CounterOffer.objects.select_related('auction', 'seller', 'buyer').get(
            id=offer_id,
            buyer=request.user
        )
        serializer = CounterOfferSerializer(offer)
        return Response(serializer.data)
    
    except CounterOffer.DoesNotExist:
        return Response({'error': 'Counter offer not found'}, status=404)
    except Exception as e:
        logger.error(f"Get counter offer error: {e}")
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_counter_offers(request):
    """Get all counter offers for the current user"""
    try:
        # Get counter offers where user is buyer
        received_offers = CounterOffer.objects.select_related('auction', 'seller').filter(
            buyer=request.user
        ).order_by('-created_at')
        
        # Get counter offers where user is seller
        sent_offers = CounterOffer.objects.select_related('auction', 'buyer').filter(
            seller=request.user
        ).order_by('-created_at')
        
        received_serializer = CounterOfferSerializer(received_offers, many=True)
        sent_serializer = CounterOfferSerializer(sent_offers, many=True)
        
        return Response({
            'received': received_serializer.data,
            'sent': sent_serializer.data
        })
    
    except Exception as e:
        logger.error(f"Get user counter offers error: {e}")
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_update_all_auction_statuses(request):
    """Manual trigger for updating all auction statuses - admin or seller"""
    try:
        update_auction_statuses()
        
        # Send notification
        async_to_sync(channel_layer.group_send)(
            'admin_monitoring',
            {
                'type': 'admin_auction_status_change',
                'message': {
                    'action': 'bulk_status_update',
                    'triggered_by': request.user.username,
                    'timestamp': timezone.now().isoformat()
                }
            }
        )
        
        return Response({'success': True, 'message': 'All auction statuses updated'})
    except Exception as e:
        logger.error(f"Admin status update error: {e}")
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_get_live_stats(request):
    """Get live statistics for admin dashboard"""
    if not (request.user.is_staff or request.user.is_superuser):
        return Response({'error': 'Permission denied'}, status=403)
    
    try:
        from django.db.models import Count, Sum, Q
        
        now = timezone.now()
        
        # Basic counts
        total_auctions = Auction.objects.count()
        total_users = User.objects.count()
        total_bids = Bid.objects.count()
        
        # Active auctions (more accurate calculation)
        active_count = 0
        all_auctions = Auction.objects.all()
        for auction in all_auctions:
            if auction.is_active():
                active_count += 1
        
        # Recent activity (last 24 hours)
        yesterday = now - timezone.timedelta(hours=24)
        recent_bids = Bid.objects.filter(timestamp__gte=yesterday).count()
        recent_auctions = Auction.objects.filter(created_at__gte=yesterday).count()
        
        # Counter offer stats
        pending_counter_offers = CounterOffer.objects.filter(status='pending').count()
        total_counter_offers = CounterOffer.objects.count()
        
        # Revenue calculation (completed auctions)
        completed_auctions = Auction.objects.filter(status='completed')
        total_revenue = sum(float(auction.current_highest_bid or 0) for auction in completed_auctions)
        
        stats = {
            'total_auctions': total_auctions,
            'active_auctions': active_count,
            'completed_auctions': completed_auctions.count(),
            'cancelled_auctions': Auction.objects.filter(status='cancelled').count(),
            'total_users': total_users,
            'total_bids': total_bids,
            'recent_bids_24h': recent_bids,
            'recent_auctions_24h': recent_auctions,
            'pending_counter_offers': pending_counter_offers,
            'total_counter_offers': total_counter_offers,
            'total_revenue': round(total_revenue, 2),
            'unread_notifications': Notification.objects.filter(is_read=False).count(),
            'timestamp': now.isoformat()
        }
        
        return Response(stats)
        
    except Exception as e:
        logger.error(f"Admin stats error: {e}")
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_notifications(request):
    notifications = Notification.objects.filter(user=request.user, is_read=False)
    serializer = NotificationSerializer(notifications, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, notification_id):
    try:
        notification = Notification.objects.get(id=notification_id, user=request.user)
        notification.is_read = True
        notification.save()
        return Response({'success': True})
    except Notification.DoesNotExist:
        return Response({'error': 'Notification not found'}, status=404)

def index(request):
    return render(request, 'index.html')