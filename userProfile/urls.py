from django.urls import path
from .views import user_profile, edit_profile

urlpatterns = [
    path('', user_profile, name='user_profile'),
    path('edit/', edit_profile, name='edit_profile')
]