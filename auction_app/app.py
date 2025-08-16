from django.apps import AppConfig

class AuctionAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'auction_app'

from django.contrib import admin
from .models import Auction, Bid, CounterOffer, Notification

@admin.register(Auction)
class AuctionAdmin(admin.ModelAdmin):
    list_display = ['item_name', 'seller', 'status', 'current_highest_bid', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['item_name', 'seller__username']

@admin.register(Bid)
class BidAdmin(admin.ModelAdmin):
    list_display = ['auction', 'bidder', 'amount', 'timestamp']
    list_filter = ['timestamp']

@admin.register(CounterOffer)
class CounterOfferAdmin(admin.ModelAdmin):
    list_display = ['auction', 'seller', 'buyer', 'counter_amount', 'status']
    list_filter = ['status', 'created_at']

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'auction', 'is_read', 'created_at']
    list_filter = ['is_read', 'created_at']
