from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.db.models import Q
from django.contrib.auth.models import User
from chat.models import Message


# Create your views here.
@login_required
def dashboard(request):
    # Get unread message count
    unread_count = Message.objects.filter(
        recipient=request.user,
        is_read=False
    ).count()
    
    # Get active conversations (users with recent messages)
    active_conversations = Message.objects.filter(
        Q(sender=request.user) | Q(recipient=request.user)
    ).values('sender', 'recipient').distinct().count()
    
    # Get total messages
    total_messages = Message.objects.filter(
        Q(sender=request.user) | Q(recipient=request.user)
    ).count()
    
    # Get recent messages (last 5)
    recent_messages = Message.objects.filter(
        Q(sender=request.user) | Q(recipient=request.user)
    ).order_by('-timestamp')[:5]
    
    # Get recent contacts (users with most recent messages)
    recent_contacts = User.objects.filter(
        Q(sent_messages__recipient=request.user) |
        Q(received_messages__sender=request.user)
    ).distinct().order_by('-sent_messages__timestamp', '-received_messages__timestamp')[:3]
    
    context = {
        'unread_count': unread_count,
        'active_conversations': active_conversations,
        'total_messages': total_messages,
        'recent_messages': recent_messages,
        'recent_contacts': recent_contacts,
        'current_date': timezone.now(),
    }
    
    return render(request, 'dashboard/index.html', context)