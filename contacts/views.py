from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render, get_object_or_404
from django.views.decorators.http import require_http_methods
from django.contrib.auth import get_user_model
from .models import Contact, Notification
from django.template.loader import render_to_string
from django.db import models
import json

User = get_user_model()

@login_required
def contact_list_view(request):
    # Show contacts where user is either requester or recipient and status is accepted
    contacts = Contact.objects.filter(
        (models.Q(requester=request.user) | models.Q(recipient=request.user)),
        status='accepted'
    ).select_related('requester', 'recipient')
    
    # Get the other user for each contact
    contact_users = []
    for contact in contacts:
        if contact.requester == request.user:
            contact_users.append(contact.recipient)
        else:
            contact_users.append(contact.requester)
    
    # Show pending requests received
    pending_requests = Contact.objects.filter(
        recipient=request.user,
        status='pending'
    ).select_related('requester')
    
    all_users = User.objects.exclude(id=request.user.id)
    contact_user_ids = [user.id for user in contact_users]
    
    return render(request, 'dashboard/contacts/contact_list.html', {
        'contacts': contacts,
        'contact_users': contact_users,
        'pending_requests': pending_requests,
        'all_users': all_users,
        'contact_user_ids': contact_user_ids,
    })

@login_required
@require_http_methods(["POST"])
def add_contact(request):
    try:
        data = json.loads(request.body)
        contact_id = data.get('contact_id')
        
        if not contact_id:
            return JsonResponse({'status': 'error', 'message': 'No contact ID provided'}, status=400)
            
        if contact_id == str(request.user.id):
            return JsonResponse({'status': 'error', 'message': 'Cannot add yourself'}, status=400)

        contact_user = get_object_or_404(User, id=contact_id)
        
        # Check if request already exists in either direction
        existing_request = Contact.objects.filter(
            (models.Q(requester=request.user, recipient=contact_user) |
            models.Q(requester=contact_user, recipient=request.user))
        ).first()
        
        if existing_request:
            if existing_request.status == 'pending':
                if existing_request.requester == request.user:
                    return JsonResponse({'status': 'info', 'message': 'Request already sent'})
                else:
                    return JsonResponse({'status': 'info', 'message': 'This user has already sent you a request'})
            elif existing_request.status == 'accepted':
                return JsonResponse({'status': 'info', 'message': 'Already connected'})
            elif existing_request.status == 'rejected':
                return JsonResponse({'status': 'info', 'message': 'Request was previously rejected'})
        
        # Create new request
        contact = Contact.objects.create(
            requester=request.user,
            recipient=contact_user,
            status='pending'
        )
        
        # Create notification for the recipient
        Notification.objects.create(
            user=contact_user,
            message=f"{request.user.username} sent you a contact request",
            contact_request=contact
        )
        
        return JsonResponse({
            'status': 'success',
            'message': 'Contact request sent'
        })
        
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@login_required
@require_http_methods(["POST"])
def respond_to_request(request):
    try:
        data = json.loads(request.body)
        request_id = data.get('request_id')
        action = data.get('action')  # 'accept' or 'reject'
        
        if not request_id or not action:
            return JsonResponse({'status': 'error', 'message': 'Missing parameters'}, status=400)
        
        contact_request = get_object_or_404(
            Contact,
            id=request_id,
            recipient=request.user,
            status='pending'
        )
        
        if action == 'accept':
            contact_request.status = 'accepted'
            message = 'Contact request accepted'
            
            # Create notification for the sender
            Notification.objects.create(
                user=contact_request.requester,
                message=f"{request.user.username} accepted your contact request"
            )
            
        elif action == 'reject':
            contact_request.status = 'rejected'
            message = 'Contact request rejected'
        else:
            return JsonResponse({'status': 'error', 'message': 'Invalid action'}, status=400)
        
        contact_request.save()
        
        return JsonResponse({
            'status': 'success',
            'message': message,
            'action': action
        })
        
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    
    
@login_required
@require_http_methods(["POST"])
def remove_contact(request):
    try:
        data = json.loads(request.body)
        user_id = data.get('user_id')
        
        if not user_id:
            return JsonResponse({'status': 'error', 'message': 'No user ID provided'}, status=400)
            
        contact_user = get_object_or_404(User, id=user_id)
        
        # Delete the contact relationship in both directions
        Contact.objects.filter(
            (models.Q(requester=request.user, recipient=contact_user) |
             models.Q(requester=contact_user, recipient=request.user)),
            status='accepted'
        ).delete()
        
        return JsonResponse({
            'status': 'success',
            'message': 'Contact removed successfully'
        })
        
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)