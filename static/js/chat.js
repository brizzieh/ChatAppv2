document.addEventListener("DOMContentLoaded", function () {
  // Helper function to get CSRF token
  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === name + "=") {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  // DOM elements
  const newMessageBtn = document.getElementById("new-message-btn");
  const newMessageModal = document.getElementById("new-message-modal");
  const closeNewMessageModal = document.getElementById(
    "close-new-message-modal"
  );
  const conversationItems = document.querySelectorAll(".conversation-item");
  const messagesContainer = document.getElementById("messages-container");
  const chatUserName = document.getElementById("chat-user-name");
  const chatUserAvatar = document.getElementById("chat-user-avatar");
  const messageInput = document.getElementById("message-input");
  const sendMessageBtn = document.getElementById("send-message");
  const searchUsersInput = document.getElementById("search-users");
  const usersList = document.getElementById("users-list");

  let currentChatUserId = null;
  let isTyping = false;
  let typingTimeout = null;
  let messageUpdateInterval = null;
  let lastMessageId = null;
  const pendingMessages = new Map(); // For tracking temporary messages
  let isSending = false; // Flag to prevent duplicate sends

  // New message modal
  newMessageBtn.addEventListener("click", function () {
    newMessageModal.classList.remove("hidden");
    document.getElementById("search-users").focus();
  });

  closeNewMessageModal.addEventListener("click", function () {
    newMessageModal.classList.add("hidden");
  });

  newMessageModal.addEventListener("click", function (e) {
    if (e.target === newMessageModal) {
      newMessageModal.classList.add("hidden");
    }
  });

  // Conversation item click handler
  conversationItems.forEach((item) => {
    item.addEventListener("click", function () {
      const userId = this.getAttribute("data-user-id");
      currentChatUserId = userId;

      // Highlight selected conversation
      document.querySelectorAll(".conversation-item").forEach((i) => {
        i.classList.remove("bg-gray-100", "bg-gray-100");
      });
      this.classList.add("bg-gray-100", "bg-gray-100");

      // Fetch messages for this user
      fetchMessages(userId);
    });
  });

  // Search users in new message modal
  if (searchUsersInput) {
    searchUsersInput.addEventListener(
      "input",
      debounce(function (e) {
        const query = e.target.value.trim();
        const loadingIndicator = document.getElementById("user-search-loading");

        if (query.length < 2) {
          document.querySelectorAll(".user-item").forEach((item) => {
            item.style.display = "flex";
          });
          return;
        }

        loadingIndicator.classList.remove("hidden");

        fetch(`/chat/search-users/?q=${encodeURIComponent(query)}`)
          .then((response) => response.json())
          .then((data) => {
            const userItems = document.querySelectorAll(".user-item");
            const userIds = data.users.map((user) => user.id.toString());

            userItems.forEach((item) => {
              if (userIds.includes(item.getAttribute("data-user-id"))) {
                item.style.display = "flex";
              } else {
                item.style.display = "none";
              }
            });
          })
          .catch((error) => {
            console.error("Error searching users:", error);
          })
          .finally(() => {
            loadingIndicator.classList.add("hidden");
          });
      }, 500)
    );
  }

  // Handle user selection in new message modal
  if (usersList) {
    usersList.addEventListener("click", function (e) {
      const userItem = e.target.closest(".user-item");
      if (userItem) {
        const userId = userItem.getAttribute("data-user-id");
        newMessageModal.classList.add("hidden");

        const conversationItem = document.querySelector(
          `.conversation-item[data-user-id="${userId}"]`
        );
        if (conversationItem) {
          conversationItem.click();
        } else {
          currentChatUserId = userId;
          fetchMessages(userId);

          const username = userItem.querySelector("h4").textContent;

          const newConversation = document.createElement("div");
          newConversation.className =
            "conversation-item p-3 rounded-lg hover:bg-gray-100  cursor-pointer transition-colors flex items-center mb-2 bg-gray-100 ";
          newConversation.setAttribute("data-user-id", userId);
          newConversation.innerHTML = `
                        <div class="relative mr-3">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(
                              username
                            )}&background=random" 
                                 alt="${username}" 
                                 class="w-10 h-10 rounded-full object-cover">
                            <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white "></span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="font-medium text-gray-900  truncate">${username}</h4>
                            <p class="text-sm text-gray-500  truncate">New conversation</p>
                        </div>
                    `;

          newConversation.addEventListener("click", function () {
            currentChatUserId = userId;
            fetchMessages(userId);

            document.querySelectorAll(".conversation-item").forEach((i) => {
              i.classList.remove("bg-gray-100", "");
            });
            this.classList.add("bg-gray-100", "");
          });

          document
            .getElementById("conversations-container")
            .prepend(newConversation);
        }
      }
    });
  }

  // Send message function with optimistic UI updates
  function sendMessage() {
    const content = messageInput?.value?.trim();
    if (!content || !currentChatUserId || isSending) return;

    isSending = true;
    const tempId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 5)}`;

    // Check for duplicate pending messages
    if (
      Array.from(pendingMessages.values()).some(
        (msg) => msg.content === content
      )
    ) {
      isSending = false;
      return;
    }

    // Create temporary message object
    const tempMessage = {
      id: tempId,
      content: content,
      timestamp: new Date().toISOString(),
      is_me: true,
      is_read: false,
      is_temp: true,
    };

    pendingMessages.set(tempId, tempMessage);
    appendMessage(tempMessage);
    if (messageInput) messageInput.value = "";
    scrollToBottom();

    // Create the request with proper headers
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "X-CSRFToken": getCookie("csrftoken"),
    };

    fetch("send/", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({
        recipient_id: currentChatUserId,
        content: content,
        temp_id: tempId,
      }),
    })
      .then((response) => {
        if (!response.ok)
          throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!data || !data.message_id) {
          throw new Error("Server response missing required fields");
        }
        handleMessageConfirmation(
          tempId,
          data.timestamp,
          data.message_id,
          data.is_read
        );
      })
      .catch((error) => {
        console.error("Error sending message:", error);
        markMessageAsFailed(tempId);
      })
      .finally(() => {
        isSending = false;
      });
  }

  // Handle message confirmation from server
  function handleMessageConfirmation(tempId, timestamp, messageId, isRead) {
    const tempMessage = pendingMessages.get(tempId);
    if (!tempMessage) return;

    const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
    if (tempElement) {
      tempElement.setAttribute("data-message-id", messageId);
      tempElement.classList.remove("message-temporary");

      // Update timestamp
      if (timestamp) {
        const timestampElement =
          tempElement.querySelector(".message-timestamp");
        if (timestampElement) {
          timestampElement.textContent = formatTime(timestamp);
        }
      }

      // Update status icon based on read status
      const statusContainer = tempElement.querySelector(
        ".message-status-container"
      );
      if (statusContainer) {
        statusContainer.innerHTML = isRead
          ? `<span class="message-status flex">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-blue-500 -ml-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                </span>`
          : `<span class="message-status">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                </span>`;
      }
    }

    pendingMessages.delete(tempId);
    lastMessageId = messageId;
  }

  // Mark message as failed in UI
  function markMessageAsFailed(messageId) {
    const messageElement = document.querySelector(
      `[data-message-id="${messageId}"]`
    );
    if (messageElement) {
      messageElement.classList.add("message-failed");
      const statusIcon = messageElement.querySelector(".message-status");
      if (statusIcon) {
        statusIcon.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                `;
      }

      // Add retry button
      const retryButton = document.createElement("button");
      retryButton.className = "ml-2 text-xs text-red-500 hover:text-red-700";
      retryButton.textContent = "Retry";
      retryButton.addEventListener("click", function () {
        const tempId = messageId.replace("temp-", "");
        const tempMessage = pendingMessages.get(tempId);
        if (tempMessage) {
          messageElement.remove();
          sendMessage(tempMessage.content);
        }
      });

      const statusContainer = messageElement.querySelector(
        ".message-status-container"
      );
      if (statusContainer) {
        statusContainer.appendChild(retryButton);
      }
    }
  }

  // Update event listeners to prevent duplicate sends
  sendMessageBtn.addEventListener("click", function (e) {
    e.preventDefault();
    sendMessage();
  });

  messageInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });

  // Typing indicator
  messageInput.addEventListener("input", function () {
    if (!isTyping && currentChatUserId) {
      isTyping = true;
      sendTypingIndicator(true);
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      sendTypingIndicator(false);
    }, 2000);
  });

  function sendTypingIndicator(isTyping) {
    fetch("typing/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: JSON.stringify({
        recipient_id: currentChatUserId,
        is_typing: isTyping,
      }),
    }).catch((error) => {
      console.error("Error sending typing indicator:", error);
    });
  }

  // Check for typing indicators
  function checkTypingIndicators() {
    if (currentChatUserId) {
      fetch(`typing-status/?user_id=${currentChatUserId}`)
        .then((response) => response.json())
        .then((data) => {
          if (data.is_typing) {
            showTypingIndicator();
          } else {
            hideTypingIndicator();
          }
        })
        .catch((error) => {
          console.error("Error checking typing status:", error);
        });
    }
  }

  function showTypingIndicator() {
    let typingIndicator = document.getElementById("typing-indicator");
    if (!typingIndicator) {
      typingIndicator = document.createElement("div");
      typingIndicator.id = "typing-indicator";
      typingIndicator.className =
        "flex items-center mb-2 text-gray-500  text-sm";
      typingIndicator.innerHTML = `
                <div class="typing-indicator mr-2">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                Typing...
            `;
      messagesContainer.appendChild(typingIndicator);
      scrollToBottom();
    }
  }

  function hideTypingIndicator() {
    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  // Fetch messages for a user
  function fetchMessages(userId) {
    // Show loading state
    messagesContainer.innerHTML = `
            <div class="text-center py-8">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                <p class="mt-2 text-gray-500 ">Loading messages...</p>
            </div>
        `;

    fetch(`get/${userId}/`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load messages (status: ${response.status})`
          );
        }
        return response.json();
      })
      .then((data) => {
        if (data.error) {
          throw new Error(data.error);
        }

        currentChatUserId = data.other_user.id;
        const displayName =
          data.other_user.full_name || data.other_user.username;
        chatUserName.textContent = displayName;
        chatUserAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
          displayName
        )}&background=random`;
        chatUserName.href = `profile/${data.other_user.id}/`;

        renderMessages(data.messages);

        // Update last message ID
        if (data.messages.length > 0) {
          lastMessageId = data.messages[data.messages.length - 1].id;
        }

        // Start checking for new messages
        startMessageUpdates();
      })
      .catch((error) => {
        console.error("Fetch error:", error);
        messagesContainer.innerHTML = `
                    <div class="text-center py-8 text-red-500 ">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p class="font-medium">${error.message}</p>
                        <p class="text-sm mt-2">Failed to load messages. Please try again.</p>
                    </div>
                `;
      });
  }

  // Render messages
  function renderMessages(messages) {
    // Clear existing messages but keep temporary ones
    const tempMessages = Array.from(
      messagesContainer.querySelectorAll(".message-temporary")
    );
    messagesContainer.innerHTML = "";
    tempMessages.forEach((msg) => messagesContainer.appendChild(msg));

    if (!messages || messages.length === 0) {
      if (tempMessages.length === 0) {
        messagesContainer.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <p>No messages yet</p>
                    <p class="text-sm mt-1">Start the conversation!</p>
                </div>
            `;
      }
      return;
    }

    // Add all messages with proper date separators
    messages.forEach((message) => {
      if (message && message.id) {
        appendMessage(message);
      }
    });

    scrollToBottom();
  }

  function appendMessage(message) {
    // Validate input
    if (!message || typeof message !== "object") {
      console.error("Invalid message object:", message);
      return;
    }

    // Ensure message.id exists and is a string
    const messageId = message.id ? String(message.id) : `temp-${Date.now()}`;
    const messageDate = message.timestamp
      ? new Date(message.timestamp).toLocaleDateString()
      : "";
    const lastMessageElement = messagesContainer.lastElementChild;
    const lastMessageDate =
      lastMessageElement?.getAttribute("data-message-date");

    try {
      // Check if we need to add a date separator
      if (messageDate && messageDate !== lastMessageDate) {
        const dateElement = document.createElement("div");
        dateElement.className = "flex justify-center my-4";
        dateElement.innerHTML = `
                <span class="px-3 py-1 text-xs text-gray-500 bg-gray-100 rounded-full">
                    ${messageDate}
                </span>
            `;
        messagesContainer.appendChild(dateElement);
      }

      // Safely remove existing message
      const existingMessage = document.querySelector(
        `[data-message-id="${messageId}"]`
      );
      if (existingMessage && existingMessage.parentNode) {
        existingMessage.remove();
      }

      // Create message container
      const messageElement = document.createElement("div");
      messageElement.className = `message-item flex ${
        message.is_me ? "justify-end" : "justify-start"
      } mb-4`;
      messageElement.setAttribute("data-message-id", messageId);
      messageElement.setAttribute("data-message-date", messageDate);

      if (message.is_temp) {
        messageElement.classList.add("message-temporary");
      }

      // Status icon logic with safety checks
      let statusIcon = "";
      if (message.is_me) {
        if (message.is_read) {
          // Double blue ticks for read messages
          statusIcon = `
                <span class="message-status flex">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-green-500 -ml-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                </span>
            `;
        } else {
          // Single gray tick for sent but unread messages
          statusIcon = `
                <span class="message-status">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                </span>
            `;
        }
      }

      // Escape HTML in message content to prevent XSS
      const safeContent =
        typeof message.content === "string" ? message.content : "";

      // Format timestamp safely
      const messageTime = formatTime(message.timestamp) || "";

      // Text message template with safety checks
      messageElement.innerHTML = `
            <div class="max-w-xs lg:max-w-md ${
              message.is_me
                ? "bg-indigo-500 text-white"
                : "bg-gray-200 text-gray-800"
            } rounded-2xl px-4 py-2 ${
        message.is_me ? "rounded-tr-none" : "rounded-tl-none"
      }">
                <div class="text-sm">${safeContent}</div>
                <div class="text-right mt-1 flex items-center justify-end">
                    <span class="text-xs ${
                      message.is_me ? "text-indigo-200" : "text-gray-500"
                    }">
                        ${messageTime}
                    </span>
                    ${
                      message.is_me
                        ? `
                            <span class="message-status-container flex items-center ml-1">
                                <span class="message-status">${statusIcon}</span>
                            </span>
                        `
                        : ""
                    }
                </div>
            </div>
        `;

      // Safely append to container
      if (messagesContainer) {
        messagesContainer.appendChild(messageElement);
      } else {
        console.error("Messages container not found");
        return;
      }
    } catch (error) {
      console.error("Error appending message:", error);
    }
  }

  // Helper function with safety checks
  function formatTime(timestamp) {
    if (!timestamp) return "";

    try {
      const date =
        typeof timestamp === "string" ? new Date(timestamp) : timestamp;
      if (isNaN(date.getTime())) return "";

      // Always use the same format: "MMM DD, YYYY hh:mm AM/PM"
      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return "";
    }
  }

  // Start periodic message updates
  function startMessageUpdates() {
    stopMessageUpdates(); // Clear any existing interval

    // Check for new messages every 2 seconds
    messageUpdateInterval = setInterval(() => {
      if (currentChatUserId) {
        checkForNewMessages();
        checkTypingIndicators();
      }
    }, 2000);
  }

  // Stop periodic updates
  function stopMessageUpdates() {
    if (messageUpdateInterval) {
      clearInterval(messageUpdateInterval);
      messageUpdateInterval = null;
    }
  }

  // Helper function to check scroll position
  function isScrolledToBottom() {
    if (!messagesContainer) return true;
    return (
      messagesContainer.scrollHeight - messagesContainer.clientHeight <=
      messagesContainer.scrollTop + 50
    );
  }

  // Check for new messages since lastMessageId
  function checkForNewMessages() {
    if (!currentChatUserId) return;

    fetch(
      `updates/?user_id=${currentChatUserId}&last_id=${lastMessageId || ""}`
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!data || !data.messages) {
          throw new Error("Invalid response format from server");
        }

        // Safely handle message filtering
        const newMessages = data.messages.filter((message) => {
          try {
            // Skip if message is invalid
            if (!message || !message.id) return false;

            // Convert ID to string if needed
            const messageId = String(message.id);

            // Skip if already displayed
            if (document.querySelector(`[data-message-id="${messageId}"]`)) {
              return false;
            }

            // Skip if this is a pending message we've already handled
            if (messageId.startsWith("temp-")) {
              const tempId = messageId.replace("temp-", "");
              return !pendingMessages.has(tempId);
            }

            return true;
          } catch (error) {
            console.error("Error processing message:", error);
            return false;
          }
        });

        // Safely append new messages
        if (newMessages.length > 0) {
          newMessages.forEach((message) => {
            try {
              appendMessage(message);
            } catch (error) {
              console.error("Error appending message:", error);
            }
          });

          // Update last message ID
          lastMessageId = String(newMessages[newMessages.length - 1].id);

          // Scroll to bottom if not actively scrolling
          if (
            messagesContainer &&
            !messagesContainer.classList.contains("scrolling")
          ) {
            scrollToBottom();
          }
        }
      })
      .catch((error) => {
        console.error("Error checking for new messages:", error);
      });
  }

  // Scroll to bottom of messages
  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: "smooth",
      });
    }
  }

  // Track if user is scrolling
  if (messagesContainer) {
    messagesContainer.addEventListener("scroll", function () {
      messagesContainer.classList.add("scrolling");
      clearTimeout(messagesContainer.scrollTimeout);
      messagesContainer.scrollTimeout = setTimeout(() => {
        messagesContainer.classList.remove("scrolling");
      }, 1000);
    });
  }

  // Debounce function
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Initialize with first conversation if available
  if (conversationItems.length > 0) {
    conversationItems[0].click();
  }

  // Connect to server when page loads
  checkForNewMessages();
});
