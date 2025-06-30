from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.models import User
from django.db.models import Max, Q
from django.db.models.functions import Greatest
from django.utils import timezone
from .models import Profile
from contacts.models import Contact
import os


# Create your views here.

@login_required
def user_profile(request):
    # Get active contacts (where status is 'accepted' and user is either requester or recipient)
    active_contacts = Contact.objects.filter(
        (Q(requester=request.user) | Q(recipient=request.user)),
        status='accepted'
    ).select_related('requester', 'recipient')
    
    # Extract the other user for each contact
    contact_users = []
    for contact in active_contacts:
        if contact.requester == request.user:
            contact_users.append(contact.recipient)
        else:
            contact_users.append(contact.requester)
    
    # Get other profile data
    total_messages = request.user.sent_messages.count() + request.user.received_messages.count()
    recent_messages = request.user.received_messages.order_by('-timestamp')[:5]
    
    context = {
        'user': request.user,
        'active_contacts': contact_users,
        'total_messages': total_messages,
        'recent_messages': recent_messages,
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
                messages.success(request, 'Password changed successfully!', 'Success')
                return redirect('edit_profile')
    
    context = {
        'user': request.user,
    }
    return render(request, 'dashboard/profile/edit.html', context)