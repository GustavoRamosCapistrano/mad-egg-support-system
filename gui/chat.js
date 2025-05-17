/**
 * Chat Widget Implementation
 * 
 * Features:
 * - Toggleable chat interface
 * - WebSocket communication with server
 * - Message sending/receiving
 * - User/bot message differentiation
 * - Keyboard support (Enter key)
 */

// Wait for DOM to be fully loaded before executing script
document.addEventListener('DOMContentLoaded', function() {
    // ==================================================================
    // DOM Element References
    // ==================================================================
    const chatButton = document.getElementById('chatButton');      // Chat toggle button
    const chatContainer = document.getElementById('chatContainer'); // Main chat container
    const closeChat = document.getElementById('closeChat');      // Chat close button
    const chatMessages = document.getElementById('chatMessages'); // Messages container
    const userInput = document.getElementById('userInput');      // Message input field
    const sendButton = document.getElementById('sendButton');    // Send message button
    
    // ==================================================================
    // WebSocket Connection Setup
    // ==================================================================
    const ws = new WebSocket(`ws://${window.location.host}`); // Connect to current host
    
    /**
     * WebSocket Connection Handlers
     */
    
    // Connection established
    ws.onopen = function() {
        console.log('Connected to WebSocket server');
    };
    
    // Message received from server
    ws.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            addBotMessage(data.text); // Display bot response
        } catch (err) {
            console.error('Error parsing WebSocket message:', err);
            addBotMessage("Error processing message. Please try again.");
        }
    };
    
    // Connection closed
    ws.onclose = function() {
        console.log('Disconnected from WebSocket server');
        addBotMessage("Connection lost. Please refresh to continue chatting.");
    };
    
    // Connection error
    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        addBotMessage("Connection error. Please refresh the page.");
    };

    // ==================================================================
    // UI Event Handlers
    // ==================================================================
    
    /**
     * Toggle chat visibility when button clicked
     */
    chatButton.addEventListener('click', function() {
        chatContainer.style.display = 'flex'; // Show chat container
        userInput.focus(); // Focus input field for immediate typing
    });
    
    /**
     * Close chat when X button clicked
     */
    closeChat.addEventListener('click', function() {
        chatContainer.style.display = 'none'; // Hide chat container
    });
    
    /**
     * Message Submission Handlers
     */
    
    // Send message when button clicked
    sendButton.addEventListener('click', sendMessage);
    
    // Send message when Enter key pressed
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // ==================================================================
    // Core Functions
    // ==================================================================
    
    /**
     * Handles message submission
     * - Validates input
     * - Sends message via WebSocket
     * - Clears input field
     */
    function sendMessage() {
        const message = userInput.value.trim();
        
        // Only send if message exists and connection is open
        if (message && ws.readyState === WebSocket.OPEN) {
            addUserMessage(message); // Display user message locally
            userInput.value = '';   // Clear input field
            
            // Send message to server via WebSocket
            try {
                ws.send(JSON.stringify({
                    text: message,
                    timestamp: new Date().toISOString()
                }));
            } catch (err) {
                console.error('Error sending message:', err);
                addBotMessage("Failed to send message. Please try again.");
            }
        }
    }
    
    /**
     * Adds user message to chat UI
     * @param {string} message - The message text to display
     */
    function addUserMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'user-message');
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        
        // Auto-scroll to bottom of chat
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    /**
     * Adds bot message to chat UI
     * @param {string} message - The message text to display
     * 
     * Handles multi-line messages by preserving line breaks
     */
    function addBotMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'bot-message');
        
        // Split message by newlines and create proper line breaks
        const lines = message.split('\n');
        lines.forEach((line, index) => {
            if (index > 0) {
                messageElement.appendChild(document.createElement('br'));
            }
            messageElement.appendChild(document.createTextNode(line));
        });
        
        chatMessages.appendChild(messageElement);
        
        // Auto-scroll to bottom of chat
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});