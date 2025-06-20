from django.urls import path
from .views import dashboard
from django.contrib.auth.views import LogoutView



urlpatterns = [
    path('', dashboard, name='dashboard'),
    path('logout/', LogoutView.as_view(), name='logout'),
]