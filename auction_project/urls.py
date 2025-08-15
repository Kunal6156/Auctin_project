from django.contrib import admin
from django.urls import path, include
from django.views.generic import TemplateView
from auction_app.views import index

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('auction_app.urls')),
    path('', index, name='index'),
]