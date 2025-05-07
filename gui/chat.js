document.addEventListener('DOMContentLoaded', function() {
    const chatButton = document.getElementById('chatButton');
    const chatContainer = document.getElementById('chatContainer');
    const closeChat = document.getElementById('closeChat');
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    
    // WebSocket connection
    const ws = new WebSocket(`ws://${window.location.host}`);
    
    ws.onopen = function() {
        console.log('Connected to WebSocket server');
    };
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        addBotMessage(data.text);
    };
    
    ws.onclose = function() {
        console.log('Disconnected from WebSocket server');
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        addBotMessage("Connection error. Please refresh the page.");
    };

    // Open chat when button is clicked
    chatButton.addEventListener('click', function() {
        chatContainer.style.display = 'flex';
    });
    
    // Close chat
    closeChat.addEventListener('click', function() {
        chatContainer.style.display = 'none';
    });
    
    // Send message when button is clicked or Enter is pressed
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    function sendMessage() {
        const message = userInput.value.trim();
        if (message && ws.readyState === WebSocket.OPEN) {
            addUserMessage(message);
            userInput.value = '';
            
            // Send message to server
            ws.send(JSON.stringify({
                text: message
            }));
        }
    }
    
    function addUserMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'user-message');
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function addBotMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'bot-message');
        
        const lines = message.split('\n');
        lines.forEach((line, index) => {
            if (index > 0) messageElement.appendChild(document.createElement('br'));
            messageElement.appendChild(document.createTextNode(line));
        });
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});