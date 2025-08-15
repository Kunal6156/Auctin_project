from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Auction(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('ended', 'Ended'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='auctions')
    item_name = models.CharField(max_length=200)
    description = models.TextField()
    starting_price = models.DecimalField(max_digits=10, decimal_places=2)
    bid_increment = models.DecimalField(max_digits=10, decimal_places=2)
    go_live_time = models.DateTimeField()
    duration_hours = models.IntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    current_highest_bid = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    winner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='won_auctions')
    created_at = models.DateTimeField(auto_now_add=True)
    
    def end_time(self):
        return self.go_live_time + timezone.timedelta(hours=self.duration_hours)
    
    def is_active(self):
        now = timezone.now()
        go_live = self.go_live_time
        end_time = self.end_time()
        if timezone.is_naive(go_live):
            go_live = timezone.make_aware(go_live)
        if timezone.is_naive(end_time):
            end_time = timezone.make_aware(end_time)
        return go_live <= now <= end_time and self.status in ['active', 'pending']
class Bid(models.Model):
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE, related_name='bids')
    bidder = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bids')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']

class CounterOffer(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]
    
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE, related_name='counter_offers')
    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_counter_offers')
    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_counter_offers')
    original_bid = models.DecimalField(max_digits=10, decimal_places=2)
    counter_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE, related_name='notifications')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
