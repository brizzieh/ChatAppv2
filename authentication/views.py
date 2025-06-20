from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib import messages

def register_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        confirm_password = request.POST.get('password_confirmation')

        if password != confirm_password:
            messages.error(request, "Passwords do not match.")
            return redirect('register')

        try:
            user = User.objects.create_user(username=username, password=password)
            user.save()
            messages.success(request, "Registration successful! Please login.")
            return redirect('login')
        except Exception as e:
            messages.error(request, f"Registration failed: {str(e)}")
            return redirect('register')

    return render(request, 'auth/register.html')

def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        
        print(f"Attempting to log in user: {username} {password}")  # Debugging line
        if user is not None:
            login(request, user)
            messages.success(request, f"Welcome back, {username}!")
            return redirect('dashboard')
        else:
            messages.error(request, "Invalid username or password.")
            return redirect('login')
            
    return render(request, 'auth/login.html')

def logout_view(request):
    if request.method == 'POST':
        username = request.user.username
        logout(request)
        messages.success(request, f"You've been logged out. See you soon, {username}!")
        return redirect('login')
    return render(request, 'auth/logout.html')