from django.contrib import admin
from django.urls import path, include,re_path
from django.views.generic import TemplateView
from auction_app.views import index

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('auction_app.urls')),
    path('', index, name='index'),
]
urlpatterns += [
    re_path(r'^(?!api/).*$', TemplateView.as_view(template_name="index.html")),
]
