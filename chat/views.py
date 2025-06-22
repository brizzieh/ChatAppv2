from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from django.db.models import Q, Max
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from .models import Message
from django.utils import timezone
import json

User = get_user_model()

@login_required
def chat_view(request):
    # Get all conversations with last message and unread count
    conversations = Message.objects.filter(
        Q(sender=request.user) | Q(recipient=request.user)
    )
    # Annotate with last message timestamp
    conversations = conversations.values('sender', 'recipient').annotate(
        last_message=Max('timestamp')
    ).order_by('-last_message')
    
    participants = []
    for conv in conversations:
        other_user_id = conv['recipient'] if conv['sender'] == request.user.id else conv['sender']
        other_user = User.objects.get(id=other_user_id)
        
        last_message = Message.objects.filter(
            Q(sender=request.user, recipient=other_user) |
            Q(sender=other_user, recipient=request.user)
        ).order_by('-timestamp').first()
        
        unread_count = Message.objects.filter(
            sender=other_user,
            recipient=request.user,
            is_read=False
        ).count()
        
        participants.append({
            'id': other_user.id,
            'username': other_user.username,
            'full_name': other_user.get_full_name(),
            'email': other_user.email,
            'last_message': last_message,
            'unread_count': unread_count
        })
    
    # Get all users for new message modal (excluding current user)
    all_users = User.objects.exclude(id=request.user.id).order_by('username')
    
    return render(request, 'dashboard/chat/index.html', {
        'participants': participants,
        'all_users': all_users
    })

@login_required
def get_unread_count(request):
    unread_count = Message.objects.filter(
        recipient=request.user,
        is_read=False
    ).count()

    return JsonResponse({
        'unread_count': unread_count
    })

@login_required
@require_http_methods(["POST"])
def send_message(request):
    try:
        data = json.loads(request.body)
        
        recipient = get_object_or_404(User, id=data.get('recipient_id'))
        content = data.get('content', '').strip()
        
        if not content:
            return JsonResponse({'status': 'error', 'message': 'Message cannot be empty'}, status=400)
        
        message = Message.objects.create(
            sender=request.user,
            recipient=recipient,
            content=content
        )
        
        return JsonResponse({
            'status': 'success',
            'message_id': message.id,
            'timestamp': message.timestamp.isoformat(),
            'content': message.content,
            'temp_id': data.get('temp_id', ''),
        }, status=201)
    
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

@login_required
def get_messages(request, user_id):
    try:
        other_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({
            'error': 'User not found',
            'status': 404
        }, status=404)

    messages = Message.objects.filter(
        Q(sender=request.user, recipient=other_user) |
        Q(sender=other_user, recipient=request.user)
    ).order_by('timestamp')

    # Mark messages as read
    Message.objects.filter(
        sender=other_user,
        recipient=request.user,
        is_read=False
    ).update(is_read=True)

    messages_data = [{
        'id': message.id,
        'sender_id': message.sender.id,
        'content': message.content,
        'timestamp': message.timestamp.strftime("%b %d, %Y %I:%M %p"),
        'is_read': message.is_read,
        'is_me': message.sender == request.user
    } for message in messages]

    return JsonResponse({
        'messages': messages_data,
        'other_user': {
            'id': other_user.id,
            'username': other_user.username,
            'full_name': other_user.get_full_name(),
        }
    })

@login_required
def search_users(request):
    query = request.GET.get('q', '').strip()
    
    if not query:
        return JsonResponse({'users': []})
    
    # Search by username, first name, last name, or email
    users = User.objects.filter(
        Q(username__icontains=query) |
        Q(first_name__icontains=query) |
        Q(last_name__icontains=query) |
        Q(email__icontains=query)
    ).exclude(id=request.user.id).distinct()[:10]  # Limit to 10 results
    
    users_data = []
    for user in users:
        users_data.append({
            'id': user.id,
            'username': user.username,
            'full_name': user.get_full_name(),
            'email': user.email,
        })
    
    return JsonResponse({'users': users_data})

@login_required
@require_http_methods(["POST"])
def typing_indicator(request):
    data = json.loads(request.body)
    recipient = User.objects.get(id=data['recipient_id'])
    is_typing = data['is_typing']
    
    # In a real implementation, you would store this in cache/database
    return JsonResponse({
        'status': 'success',
        'is_typing': is_typing,
        'sender_id': request.user.id,
        'recipient_id': recipient.id
    })

@login_required
def typing_status(request):
    user_id = request.GET.get('user_id')
    try:
        other_user = User.objects.get(id=user_id)
        # In a real implementation, check if user is typing
        return JsonResponse({
            'is_typing': False,
            'user_id': user_id
        })
    except User.DoesNotExist:
        return JsonResponse({
            'error': 'User not found',
            'status': 404
        }, status=404)

@login_required
@require_http_methods(["POST"])
@csrf_exempt
def mark_read(request, message_id):
    message = Message.objects.get(id=message_id)
    message.is_read = True
    message.save()
    return JsonResponse({'status': 'success'})

@login_required
def get_message_updates(request):
    try:
        user_id = request.GET.get('user_id')
        last_id = request.GET.get('last_id')
        
        if not user_id:
            return JsonResponse({'error': 'user_id parameter is required'}, status=400)
            
        other_user = User.objects.get(id=user_id)
        
        # Base query
        messages = Message.objects.filter(
            Q(sender=request.user, recipient=other_user) |
            Q(sender=other_user, recipient=request.user)
        )
        
        # Filter messages after last_id if provided
        if last_id:
            messages = messages.filter(id__gt=last_id)
        
        messages = messages.order_by('timestamp')
        
        # Mark messages as read
        Message.objects.filter(
            sender=other_user,
            recipient=request.user,
            is_read=False
        ).update(is_read=True)

        messages_data = [{
            'id': message.id,
            'sender_id': message.sender.id,
            'content': message.content,
            'timestamp': message.timestamp.strftime("%b %d, %Y %I:%M %p"),
            'is_read': message.is_read,
            'is_me': message.sender == request.user
        } for message in messages]

        return JsonResponse({
            'messages': messages_data,
            'other_user': {
                'id': other_user.id,
                'username': other_user.username,
                'full_name': other_user.get_full_name(),
            }
        })
        
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
    
@login_required
@require_http_methods(["DELETE"])
def delete_conversation(request, user_id):
    try:
        other_user = User.objects.get(id=user_id)
        # Delete messages both ways
        Message.objects.filter(
            Q(sender=request.user, recipient=other_user) |
            Q(sender=other_user, recipient=request.user)
        ).delete()
        
        return JsonResponse({'status': 'success'})
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)

@login_required
@require_http_methods(["POST"])
def mark_as_unread(request, user_id):
    try:
        other_user = User.objects.get(id=user_id)
        # Mark all messages as unread
        Message.objects.filter(
            sender=other_user,
            recipient=request.user
        ).update(is_read=False)
        
        return JsonResponse({'status': 'success'})
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)