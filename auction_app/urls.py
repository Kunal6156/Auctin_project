from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'auctions', views.AuctionViewSet)

urlpatterns = [
    # DRF router URLs
    path('api/', include(router.urls)),
    
    # Authentication
    path('api/register/', views.register, name='register'),
    path('api/login/', views.user_login, name='login'),
    path('api/logout/', views.user_logout, name='logout'),
    path('api/profile/', views.get_user_profile, name='profile'),
    
    # Auction operations
    path('api/auctions/<int:auction_id>/bid/', views.place_bid, name='place_bid'),
    path('api/auctions/<int:auction_id>/status/', views.update_auction_status, name='update_auction_status'),
    path('api/auctions/<int:auction_id>/seller-decision/', views.seller_decision, name='seller_decision'),
    
    # Seller dashboard (new - admin-like capabilities for sellers)
    path('api/seller/dashboard/', views.seller_auction_dashboard, name='seller_dashboard'),
    path('api/seller/auctions/<int:auction_id>/counter-offer/', views.create_counter_offer, name='create_counter_offer'),
    
    # Counter offers
    path('api/counter-offers/<int:offer_id>/', views.get_counter_offer, name='get_counter_offer'),
    path('api/counter-offers/<int:offer_id>/respond/', views.respond_counter_offer, name='respond_counter_offer'),
    path('api/counter-offers/', views.get_user_counter_offers, name='get_user_counter_offers'),
    
    # Notifications
    path('api/notifications/', views.get_user_notifications, name='get_notifications'),
    path('api/notifications/<int:notification_id>/read/', views.mark_notification_read, name='mark_notification_read'),
    
    # Admin endpoints (now accessible to sellers for their own auctions)
    path('api/admin/update-statuses/', views.admin_update_all_auction_statuses, name='admin_update_statuses'),
    path('api/admin/stats/', views.admin_get_live_stats, name='admin_live_stats'),
    
    # Frontend
    path('', views.index, name='index'),
]