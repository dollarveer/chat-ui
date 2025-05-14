// WebSocket connection for real-time messaging
const socket = new WebSocket('ws://localhost:8080/public/websocket.php');

// Handle incoming messages
socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    const decrypted = decryptMessage(msg.content); // Decrypt using encrypt.js
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'new');
    messageElement.innerHTML = `
        <span>${decrypted}</span>
        <span class="timestamp">${msg.sent_at}</span>
    `;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Auto-scroll to bottom
    if (msg.user_id !== getCurrentUserId()) {
        markMessageAsRead(msg.message_id);
    }
};

// Send a message
function sendMessage() {
    const input = document.getElementById('message-input');
    const sessionId = document.querySelector('input[name="session_id"]').value;
    const message = input.value.trim();
    if (message) {
        const encrypted = encryptMessage(message); // Encrypt using encrypt.js
        const data = {
            session_id: sessionId,
            user_id: getCurrentUserId(),
            content: encrypted
        };
        socket.send(JSON.stringify(data));
        input.value = ''; // Clear input
    }
}

// Get current user ID (assumes it's stored in a hidden input or session)
function getCurrentUserId() {
    return document.querySelector('input[name="user_id"]').value || '<?php echo $_SESSION["user_id"]; ?>';
}

// Mark message as read
function markMessageAsRead(messageId) {
    fetch('/chat_controller.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', message_id: messageId })
    });
}

// Handle form submission
document.querySelector('.chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
});

// Typing indicator
let typingTimeout;
document.getElementById('message-input').addEventListener('input', () => {
    clearTimeout(typingTimeout);
    socket.send(JSON.stringify({ action: 'typing', session_id: document.querySelector('input[name="session_id"]').value }));
    typingTimeout = setTimeout(() => {
        socket.send(JSON.stringify({ action: 'stop_typing', session_id: document.querySelector('input[name="session_id"]').value }));
    }, 1000);
});

// Handle typing indicator from others
socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const typingIndicator = document.querySelector('.typing-indicator');
    if (data.action === 'typing') {
        typingIndicator.innerHTML = '<span></span><span></span><span></span> Someone is typing...';
    } else if (data.action === 'stop_typing') {
        typingIndicator.innerHTML = '';
    } else {
        // Existing message handling
        const msg = data;
        const decrypted = decryptMessage(msg.content);
        const messagesDiv = document.getElementById('messages');
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'new');
        messageElement.innerHTML = `
            <span>${decrypted}</span>
            <span class="timestamp">${msg.sent_at}</span>
        `;
        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        if (msg.user_id !== getCurrentUserId()) {
            markMessageAsRead(msg.message_id);
        }
    }
};

// Initial load of messages
function loadMessages(sessionId) {
    fetch(`/chat_controller.php?session_id=${sessionId}`, {
        method: 'GET'
    })
    .then(response => response.json())
    .then(messages => {
        const messagesDiv = document.getElementById('messages');
        messagesDiv.innerHTML = '';
        messages.forEach(msg => {
            const decrypted = decryptMessage(msg.content);
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            if (msg.read_status) messageElement.classList.add('read');
            messageElement.innerHTML = `
                <span>${decrypted}</span>
                <span class="timestamp">${msg.sent_at}</span>
            `;
            messagesDiv.appendChild(messageElement);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

// Load messages when page loads
document.addEventListener('DOMContentLoaded', () => {
    const sessionId = document.querySelector('input[name="session_id"]').value;
    loadMessages(sessionId);
});