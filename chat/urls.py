from django.urls import path
from . import views

urlpatterns = [
    path('', views.chat_view, name='chat'),
    path('send/', views.send_message, name='send_message'),
    path('get/<int:user_id>/', views.get_messages, name='get_messages'),
    path('search-users/', views.search_users, name='search_users'),
    path('unread/', views.get_unread_count, name='get_unread_count'),
    path('typing/', views.typing_indicator, name='typing_indicator'),
    path('typing-status/', views.typing_status, name='typing_status'),
    path('mark-read/<int:message_id>/', views.mark_read, name='mark_read'),
    path('updates/', views.get_message_updates, name='message_updates'),
    path('delete/<int:user_id>/', views.delete_conversation, name='delete_conversation'),
    path('mark-unread/<int:user_id>/', views.mark_as_unread, name='mark_as_unread'),
    path('profile/<int:user_id>/', views.view_recipient_profile, name='view_recipient_profile'),
]