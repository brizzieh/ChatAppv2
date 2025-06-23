from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import User
from django.db.models import Max, Q
from django.db.models.functions import Greatest
from django.utils import timezone
from .models import Profile
from chat.models import Message
import os


# Create your views here.

@login_required
def user_profile(request):
    # Get unread message count
    unread_count = Message.objects.filter(
        recipient=request.user,
        is_read=False
    ).count()
    
    # Get active conversations (users with recent messages)
    active_conversations = User.objects.filter(
        Q(sent_messages__recipient=request.user) |
        Q(received_messages__sender=request.user)
    ).distinct().count()
    
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
    ).annotate(
        last_interaction=Greatest(
            Max('sent_messages__timestamp'),
            Max('received_messages__timestamp')
        )
    ).distinct().order_by('-last_interaction')[:3]
    
    context = {
        'user': request.user,
        'unread_count': unread_count,
        'active_conversations': active_conversations,
        'total_messages': total_messages,
        'recent_messages': recent_messages,
        'recent_contacts': recent_contacts,
        'current_date': timezone.now(),
    }
    
    return render(request, 'dashboard/profile/index.html', context)

@login_required
def edit_profile(request):
    profile, created = Profile.objects.get_or_create(user=request.user)
    
    if request.method == 'POST':
        form_type = request.POST.get('form_type')
        
        if form_type == 'personal_info':
            # Handle avatar upload
            if 'avatar' in request.FILES:
                avatar = request.FILES['avatar']
                # Validate file size (2MB max)
                if avatar.size > 2 * 1024 * 1024:
                    messages.error(request, 'Avatar image too large (max 2MB)')
                else:
                    # Delete old avatar if exists
                    if profile.avatar:
                        old_avatar_path = profile.avatar.path
                        if os.path.exists(old_avatar_path):
                            os.remove(old_avatar_path)
                    profile.avatar = avatar
            
            # Update profile fields
            profile.bio = request.POST.get('bio', '')
            profile.save()
            
            # Update user fields
            request.user.first_name = request.POST.get('first_name', '')
            request.user.last_name = request.POST.get('last_name', '')
            
            # Validate and update email
            new_email = request.POST.get('email', '')
            if new_email and new_email != request.user.email:
                if User.objects.filter(email=new_email).exclude(pk=request.user.pk).exists():
                    messages.error(request, 'This email is already in use.')
                else:
                    request.user.email = new_email
            
            request.user.save()
            messages.success(request, 'Profile updated successfully!')
            return redirect('edit_profile')
        
        elif form_type == 'security':
            # Handle password change
            old_password = request.POST.get('old_password')
            new_password1 = request.POST.get('new_password1')
            new_password2 = request.POST.get('new_password2')
            
            # Validate
            if not request.user.check_password(old_password):
                messages.error(request, 'Your current password was entered incorrectly.')
            elif new_password1 != new_password2:
                messages.error(request, 'New passwords do not match.')
            elif len(new_password1) < 8:
                messages.error(request, 'Password must be at least 8 characters.')
            else:
                request.user.set_password(new_password1)
                request.user.save()
                update_session_auth_hash(request, request.user)
                messages.success(request, 'Password changed successfully!')
                return redirect('edit_profile')
    
    context = {
        'user': request.user,
    }
    return render(request, 'dashboard/profile/edit.html', context)