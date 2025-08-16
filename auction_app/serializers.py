from rest_framework import serializers
from django.contrib.auth.models import User
from django.utils.timezone import localtime
from .models import Auction, Bid, CounterOffer, Notification

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']


class AuctionSerializer(serializers.ModelSerializer):
    seller = UserSerializer(read_only=True)
    winner = UserSerializer(read_only=True)
    is_active = serializers.SerializerMethodField()
    end_time = serializers.SerializerMethodField()

    # Ensure datetime fields are returned in IST
    go_live_time = serializers.SerializerMethodField()
    created_at = serializers.SerializerMethodField()

    class Meta:
        model = Auction
        fields = '__all__'

    def get_is_active(self, obj):
        return obj.is_active()

    def get_end_time(self, obj):
        return localtime(obj.end_time()).strftime("%Y-%m-%d %H:%M:%S")

    def get_go_live_time(self, obj):
        return localtime(obj.go_live_time).strftime("%Y-%m-%d %H:%M:%S")

    def get_created_at(self, obj):
        return localtime(obj.created_at).strftime("%Y-%m-%d %H:%M:%S")


class BidSerializer(serializers.ModelSerializer):
    bidder = UserSerializer(read_only=True)

    class Meta:
        model = Bid
        fields = '__all__'


class CounterOfferSerializer(serializers.ModelSerializer):
    seller = UserSerializer(read_only=True)
    buyer = UserSerializer(read_only=True)

    class Meta:
        model = CounterOffer
        fields = '__all__'


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'

