from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('auction_app.urls')),  # all backend API endpoints
    re_path(r'^(?!api/).*$', TemplateView.as_view(template_name="index.html")),  # React SPA fallback
]
