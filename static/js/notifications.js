function showMessage(type, title, message, duration = 5000) {
    const container = document.getElementById('message-popup-container');
    if (!container) {
        console.error('Notification container not found');
        return;
    }

    // Create message element with modern styling
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type} mb-3 rounded-xl border p-4 relative overflow-hidden 
        transition-all duration-300 ease-out transform 
        translate-x-8 opacity-0 shadow-lg backdrop-blur-sm
        max-w-md w-full`;

    // Color schemes for different message types
    const colorSchemes = {
        success: {
            bg: 'bg-green-50',
            border: 'border-green-200',
            text: 'text-green-800',
            icon: 'text-green-500',
            progress: 'bg-green-500'
        },
        error: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            text: 'text-red-800',
            icon: 'text-red-500',
            progress: 'bg-red-500'
        },
        warning: {
            bg: 'bg-amber-50',
            border: 'border-amber-200 ',
            text: 'text-amber-800',
            icon: 'text-amber-500',
            progress: 'bg-amber-500'
        },
        info: {
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            text: 'text-blue-800',
            icon: 'text-blue-500',
            progress: 'bg-blue-500'
        }
    };

    // Apply color scheme
    const scheme = colorSchemes[type] || colorSchemes.info;
    messageEl.classList.add(
        scheme.bg, scheme.border, scheme.text
    );

    // Create close button with smooth hover effect
    const closeBtn = document.createElement('button');
    closeBtn.className = `absolute top-3 right-3 ${scheme.icon} hover:opacity-70 
        transition-opacity duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 
        focus:ring-current rounded-full p-1`;
    closeBtn.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
    `;
    closeBtn.setAttribute('aria-label', 'Close notification');

    // Create icon based on type
    let icon;
    switch(type) {
        case 'success':
            icon = `<svg class="w-6 h-6 ${scheme.icon} mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>`;
            break;
        case 'error':
            icon = `<svg class="w-6 h-6 ${scheme.icon} mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>`;
            break;
        case 'warning':
            icon = `<svg class="w-6 h-6 ${scheme.icon} mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>`;
            break;
        default: // info
            icon = `<svg class="w-6 h-6 ${scheme.icon} mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>`;
    }

    // Create progress bar with smooth animation
    const progressBar = document.createElement('div');
    progressBar.className = 'message-progress absolute bottom-0 left-0 h-1 w-full bg-opacity-20';
    progressBar.style.backgroundColor = 'currentColor';
    progressBar.style.opacity = '0.2';

    const progressBarInner = document.createElement('div');
    progressBarInner.className = `message-progress-bar h-full ${scheme.progress} rounded-r-full`;
    progressBarInner.style.width = '100%';
    
    progressBar.appendChild(progressBarInner);

    // Set message content with improved typography
    messageEl.innerHTML = `
        <div class="flex items-start">
            ${icon}
            <div class="flex-1">
                <h3 class="font-semibold text-lg leading-tight">${title}</h3>
                <p class="mt-1 text-sm opacity-90">${message}</p>
            </div>
        </div>
    `;

    // Add close button and progress bar
    messageEl.appendChild(closeBtn);
    messageEl.appendChild(progressBar);

    // Add to container (prepend to show newest on top)
    container.prepend(messageEl);

    // Show animation
    setTimeout(() => {
        messageEl.classList.remove('translate-x-8', 'opacity-0');
        messageEl.classList.add('translate-x-0', 'opacity-100');
    }, 10);

    // Animate progress bar
    setTimeout(() => {
        progressBarInner.style.transition = `width ${duration/1000}s linear`;
        progressBarInner.style.width = '0%';
    }, 50);

    // Close button event
    closeBtn.addEventListener('click', () => {
        removeMessage(messageEl);
    });

    // Auto-remove after duration
    let timeoutId;
    if (duration > 0) {
        timeoutId = setTimeout(() => {
            removeMessage(messageEl);
        }, duration);
    }

    // Pause on hover
    messageEl.addEventListener('mouseenter', () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            progressBarInner.style.transition = 'none';
            progressBarInner.style.width = '100%';
        }
    });

    messageEl.addEventListener('mouseleave', () => {
        if (duration > 0) {
            const remainingWidth = parseFloat(progressBarInner.style.width) / 100;
            const remainingTime = duration * remainingWidth;
            
            progressBarInner.style.transition = `width ${remainingTime/1000}s linear`;
            progressBarInner.style.width = '0%';
            
            timeoutId = setTimeout(() => {
                removeMessage(messageEl);
            }, remainingTime);
        }
    });

    function removeMessage(el) {
        el.classList.add('translate-x-8', 'opacity-0');
        setTimeout(() => {
            el.remove();
        }, 300);
    }
}

// Make available globally
window.showMessage = showMessage;