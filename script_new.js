// Chatbot Application
class GreekChatbot {
    constructor() {
        // Fixed model for OpenRouter API
        this.model = 'moonshotai/kimi-k2:free';
        
        this.currentChatId = null;
        this.chats = JSON.parse(localStorage.getItem('greek-chatbot-chats')) || {};
        this.settings = JSON.parse(localStorage.getItem('greek-chatbot-settings')) || {
            apiKey: '',
            language: 'el',
            theme: 'light'
        };
        
        // Ensure the model is always set to Moonshot AI Kimi-K2
        this.settings.model = this.model;
        this.controller = null; // AbortController for fetch requests
        
        // Explicitly bind methods that need proper 'this' context
        this.sendMessage = this.sendMessage.bind(this);
        this.updateInputState = this.updateInputState.bind(this);
        this.switchChat = this.switchChat.bind(this);
        this.deleteChat = this.deleteChat.bind(this);
        
        this.init();
    }

    init() {
        this.applyTheme();
        this.setupEventListeners();
        this.renderChatHistory();
        this.createNewChat();
        this.setupMobileMenu();
        this.updateInputState();
        this.loadSettings();
    }

    applyTheme() {
        const theme = this.settings.theme || 'light';
        document.body.setAttribute('data-theme', theme);
    }

    setupEventListeners() {
        const sendBtn = document.getElementById('send-btn');
        const messageInput = document.getElementById('message-input');
        
        if (sendBtn) {
            sendBtn.addEventListener('click', this.sendMessage);
        }
        
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            // Input state
            messageInput.addEventListener('input', () => this.updateInputState());
        }

        // New chat
        const newChatBtn = document.getElementById('new-chat-btn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => this.createNewChat());
        }

        // Settings
        const settingsBtn = document.getElementById('settings-btn');
        const closeBtn = document.querySelector('.close');
        
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeSettings());
        }
        
        // API Key toggle
        const toggleApiKeyBtn = document.getElementById('toggle-api-key');
        if (toggleApiKeyBtn) {
            toggleApiKeyBtn.addEventListener('click', () => {
                const apiKeyInput = document.getElementById('api-key');
                if (apiKeyInput) {
                    const type = apiKeyInput.getAttribute('type');
                    apiKeyInput.setAttribute('type', type === 'password' ? 'text' : 'password');
                    const eyeIcon = document.querySelector('#toggle-api-key i');
                    if (eyeIcon) {
                        eyeIcon.className = type === 'password' ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
                    }
                }
            });
        }

        // Save API Key
        const saveApiKeyBtn = document.getElementById('save-api-key');
        if (saveApiKeyBtn) {
            saveApiKeyBtn.addEventListener('click', () => {
                const apiKeyInput = document.getElementById('api-key');
                if (apiKeyInput) {
                    this.settings.apiKey = apiKeyInput.value;
                    this.saveSettings();
                    alert('API key saved successfully!');
                }
            });
        }

        // Example prompts
        document.querySelectorAll('.prompt-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const input = document.getElementById('message-input');
                if (input) {
                    input.value = e.target.textContent;
                    this.updateInputState();
                    this.sendMessage();
                }
            });
        });

        // Language preference
        const langPreference = document.getElementById('language-preference');
        if (langPreference) {
            langPreference.addEventListener('change', (e) => {
                this.settings.language = e.target.value;
                this.saveSettings();
            });
        }

        // Theme preference
        const themePreference = document.getElementById('theme-preference');
        if (themePreference) {
            themePreference.addEventListener('change', (e) => {
                this.settings.theme = e.target.value;
                this.saveSettings();
                this.applyTheme();
            });
        }
        
        // Mobile menu toggle
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        
        // Toggle sidebar on mobile
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
            document.body.classList.toggle('no-scroll');
        });
        
        // Close sidebar when clicking on overlay
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.classList.remove('no-scroll');
        });
        
        // Close sidebar when clicking on chat history item on mobile
        document.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('active');
                    sidebarOverlay.classList.remove('active');
                    document.body.classList.remove('no-scroll');
                }
            });
        });
    }

    setupMobileMenu() {
        // Mobile menu toggle
        const menuToggle = document.createElement('button');
        menuToggle.innerHTML = '☰';
        menuToggle.className = 'mobile-menu-toggle';
        menuToggle.style.cssText = `
            display: none;
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 1001;
            background: #667eea;
            color: white;
            border: none;
            padding: 10px;
            border-radius: 5px;
            font-size: 18px;
        `;
        
        document.body.appendChild(menuToggle);
        
        menuToggle.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.toggle('open');
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            const sidebar = document.querySelector('.sidebar');
            const isClickInsideSidebar = sidebar.contains(e.target);
            const isClickOnToggle = menuToggle.contains(e.target);
            
            if (window.innerWidth <= 768 && !isClickInsideSidebar && !isClickOnToggle) {
                sidebar.classList.remove('open');
            }
        });

        // Show/hide mobile menu button
        window.addEventListener('resize', () => {
            if (window.innerWidth <= 768) {
                menuToggle.style.display = 'block';
            } else {
                menuToggle.style.display = 'none';
                document.querySelector('.sidebar').classList.remove('open');
            }
        });

        // Initial check
        if (window.innerWidth <= 768) {
            menuToggle.style.display = 'block';
        }
    }
    
    updateInputState() {
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        
        if (messageInput && sendBtn) {
            // Enable/disable send button based on text input
            const hasText = messageInput.value.trim() !== '';
            sendBtn.disabled = !hasText;
        }
    }
    
    async sendMessage() {
        try {
            // Get input value
            const messageInput = document.getElementById('message-input');
            const message = messageInput.value.trim();
            
            // Exit if no message
            if (!message) return;
            
            // Clear input
            messageInput.value = '';
            
            // Update input state (disable send button)
            this.updateInputState();
            
            // Add user message to the chat history
            this.addMessageToChat('user', message);
            
            // Generate and display AI response
            await this.getAIResponse(message);
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('An error occurred while sending the message');
        }
    }
    
    addMessageToChat(role, content) {
        if (!this.currentChatId || !this.chats[this.currentChatId]) return;
        
        // Create message object
        const message = {
            role,
            content,
            timestamp: Date.now()
        };
        
        // Add to chat history
        this.chats[this.currentChatId].messages.push(message);
        
        // Save to localStorage
        this.saveChats();
        
        // Add to UI
        this.addMessageToUI(message);
        
        // Generate title for new chats
        if (role === 'user' && 
            this.chats[this.currentChatId].messages.length <= 2 && 
            (this.chats[this.currentChatId].title === 'Νέα Συνομιλία' || 
            this.chats[this.currentChatId].title === 'New Chat')) {
            
            // Truncate long messages for the title
            const title = content.length > 30 ? `${content.substring(0, 30)}...` : content;
            this.chats[this.currentChatId].title = title;
            this.saveChats();
            this.renderChatHistory();
        }
    }
    
    async getAIResponse(message) {
        try {
            // Show typing indicator
            this.showTypingIndicator();
            
            // Create a new AbortController for this request
            this.controller = new AbortController();
            const signal = this.controller.signal;
            
            // Prepare message data
            const messagesHistory = this.getCurrentChatMessages();
            
            // Determine system prompt based on language setting
            const isGreek = this.settings.language === 'el';
            const systemPrompt = isGreek ?
                'Είσαι ένας ευγενικός και εξυπηρετικός βοηθός που απαντά στα ελληνικά. Δίνεις ακριβείς, συνοπτικές απαντήσεις και είσαι πάντα πρόθυμος να βοηθήσεις.' :
                'You are a helpful assistant. Give accurate, concise answers and always be ready to assist.';
            
            // Build messages array
            const messages = [
                {
                    role: 'system',
                    content: systemPrompt
                },
                ...messagesHistory,
                {
                    role: 'user',
                    content: message
                }
            ];
            
            // Check if API key is set
            if (!this.settings.apiKey) {
                this.removeTypingIndicator();
                this.showError(isGreek ? 
                    'Παρακαλώ εισάγετε το API key σας στις ρυθμίσεις.' :
                    'Please enter your API key in the settings.');
                return;
            }
            
            // Call API with streaming
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.settings.apiKey}`,
                    'HTTP-Referer': window.location.href
                },
                body: JSON.stringify({
                    model: this.model,
                    messages,
                    stream: true
                }),
                signal
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API error: ${response.status}`);
            }
            
            // Create message placeholder for streaming
            let responseText = '';
            this.addMessageToChat('assistant', '');
            
            // Read stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                // Decode chunk
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim() !== '');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
            if (error.name === 'AbortError') {
                this.showError(this.settings.language === 'el' ? 
                    'Η αίτηση ακυρώθηκε.' : 
                    'The request was cancelled.');
            } else {
                this.showError(this.settings.language === 'el' ? 
                    `Σφάλμα API: ${error.message}` : 
                    `API Error: ${error.message}`);
            }
            
            return null;
        } finally {
            this.controller = null;
        }
    }
    
    showTypingIndicator() {
        const chatMessages = document.getElementById('chat-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="sender">Assistant</div>
                <div class="typing">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                </div>
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }
    
    removeTypingIndicator() {
        const typingIndicator = document.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    updateLastMessageContent(content) {
        const lastMessage = document.querySelector('#chat-messages .message:last-child .content');
        if (lastMessage) {
            lastMessage.innerHTML = this.formatMessage(content);
            this.scrollToBottom();
        }
    }
    
    getCurrentChatMessages() {
        if (!this.currentChatId || !this.chats[this.currentChatId]) return [];
        
        return this.chats[this.currentChatId].messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }
    
    createNewChat() {
        // Generate a unique ID
        const chatId = Date.now().toString();
        
        // Create new chat object
        this.chats[chatId] = {
            id: chatId,
            title: this.settings.language === 'el' ? 'Νέα Συνομιλία' : 'New Chat',
            timestamp: Date.now(),
            messages: []
        };
        
        // Set as current chat
        this.currentChatId = chatId;
        localStorage.setItem('greek-chatbot-current-chat-id', chatId);
        
        // Save chats
        this.saveChats();
        
        // Render chat history
        this.renderChatHistory();
        this.renderCurrentChat();
    }
}

showTypingIndicator() {
    const chatMessages = document.getElementById('chat-messages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant typing-indicator';
    typingDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
            <div class="sender">Assistant</div>
            <div class="typing">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
                // Update active state
                document.querySelectorAll('.chat-item').forEach(item => {
                    item.classList.remove('active');
                });
                chatElement.classList.add('active');
                
                // Render chat
                this.renderChat(chat.id);
            });
            
            // Add event listener for delete button
            const deleteBtn = chatElement.querySelector('.delete-chat-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const confirmMessage = this.settings.language === 'el' ?
                    'Είστε βέβαιοι ότι θέλετε να διαγράψετε αυτή τη συνομιλία;' :
                    'Are you sure you want to delete this chat?';
                
                if (confirm(confirmMessage)) {
                    // Delete chat
                    delete this.chats[chat.id];
                    this.saveChats();
                    
                    // Create new chat if this was the current chat
                    if (chat.id === this.currentChatId) {
                        this.createNewChat();
                    } else {
                        this.renderChatHistory();
                    }
                }
            });
            
            chatHistory.appendChild(chatElement);
        }
        
        // Handle mobile view
        if (window.innerWidth <= 768) {
            document.querySelector('.sidebar').classList.remove('open');
        }
    }
    
    renderChat(chatId) {
        const chat = this.chats[chatId];
        if (!chat) return;
        
        // Clear chat content
        const chatMessages = document.getElementById('chat-messages');
        chatMessages.innerHTML = '';
        
        // Add welcome message for empty chats
        if (chat.messages.length === 0) {
            const welcomeDiv = document.createElement('div');
            welcomeDiv.className = 'welcome-message';
            
            const isGreek = this.settings.language === 'el';
            
            welcomeDiv.innerHTML = `
                <h2>${isGreek ? 'Καλωσήρθατε στο Ελληνικό Chatbot' : 'Welcome to Greek Chatbot'}</h2>
                <p>${isGreek ? 'Ο βοηθός σας για συνομιλίες στα Ελληνικά και τα Αγγλικά.' : 'Your assistant for conversations in Greek and English.'}</p>
                
                <div class="example-prompts">
                    <h3>${isGreek ? 'Δοκιμάστε μερικές ερωτήσεις:' : 'Try some example prompts:'}</h3>
                    <div class="prompts-container">
                        <button class="prompt-btn">${isGreek ? 'Πες μου μια σύντομη ιστορία για την Αθήνα' : 'Tell me about Athens'}</button>
                        <button class="prompt-btn">${isGreek ? 'Μπορείς να με βοηθήσεις με μια συνταγή;' : 'Can you help me with a Greek recipe?'}</button>
                        <button class="prompt-btn">${isGreek ? 'Διδαξέ με μερικές βασικές ελληνικές φράσεις' : 'Teach me some basic Greek phrases'}</button>
                    </div>
                </div>
            `;
            
            chatMessages.appendChild(welcomeDiv);
            
            // Setup prompt buttons
            welcomeDiv.querySelectorAll('.prompt-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const input = document.getElementById('message-input');
                    input.value = btn.textContent;
                    this.sendMessage();
                });
            });
        } else {
            // Render messages
            for (const message of chat.messages) {
                this.addMessageToUI(message);
            }
        }
        
        this.scrollToBottom();
    }
    
    scrollToBottom() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    formatMessage(content) {
        if (!content) return '';
        
        // Basic formatting for links and line breaks
        return content
            .replace(/\n/g, '<br>')
            .replace(/(https?:\/\/[^\s]+)/g, url => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #667eea;">${url}</a>`);
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return this.settings.language === 'el' ? 'τώρα' : 'just now';
        if (diffMins < 60) return `${diffMins} ${this.settings.language === 'el' ? 'λεπτά πριν' : 'mins ago'}`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)} ${this.settings.language === 'el' ? 'ώρες πριν' : 'hours ago'}`;
        
        // Format date based on language
        const options = { month: 'short', day: 'numeric' };
        return date.toLocaleDateString(this.settings.language === 'el' ? 'el-GR' : 'en-US', options);
    }
    
    showError(message) {
        const chatMessages = document.getElementById('chat-messages');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message assistant';
        errorDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="sender">Assistant</div>
                <div class="content error">${message}</div>
            </div>
        `;
        chatMessages.appendChild(errorDiv);
        this.scrollToBottom();
    }
    
    saveChats() {
        localStorage.setItem('greek-chatbot-chats', JSON.stringify(this.chats));
    }
    
    openSettings() {
        document.getElementById('settings-modal').style.display = 'block';
        this.loadSettings();
    }
    
    closeSettings() {
        document.getElementById('settings-modal').style.display = 'none';
    }
    
    loadSettings() {
        // API key
        const apiKeyInput = document.getElementById('api-key');
        if (apiKeyInput) {
            apiKeyInput.value = this.settings.apiKey || '';
        }
        
        // Language preference
        const languagePreference = document.getElementById('language-preference');
        if (languagePreference) {
            languagePreference.value = this.settings.language || 'el';
        }
        
        // Theme preference
        const themePreference = document.getElementById('theme-preference');
        if (themePreference) {
            themePreference.value = this.settings.theme || 'light';
        }
    }
    
    saveSettings() {
        // Ensure model is always fixed
        this.settings.model = this.model;
        
        // API key
        const apiKeyInput = document.getElementById('api-key');
        if (apiKeyInput) {
            this.settings.apiKey = apiKeyInput.value;
        }
        
        // Language preference
        const languagePreference = document.getElementById('language-preference');
        if (languagePreference) {
            this.settings.language = languagePreference.value;
        }
        
        // Theme preference
        const themePreference = document.getElementById('theme-preference');
        if (themePreference) {
            this.settings.theme = themePreference.value;
            this.applyTheme();
        }
        
        // Save to localStorage
        localStorage.setItem('greek-chatbot-settings', JSON.stringify(this.settings));
        
        // Close settings
        this.closeSettings();
    }
    
    addMessageToUI(message) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}`;
        
        // Generate ID if none exists
        const messageId = message.id || Date.now().toString();
        messageDiv.setAttribute('data-message-id', messageId);
        
        // Add avatar and content based on role
        if (message.role === 'assistant') {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <div class="sender">Assistant</div>
                    <div class="content">${this.formatMessage(message.content)}</div>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="message-content">
                    <div class="sender">You</div>
                    <div class="content">${this.formatMessage(message.content)}</div>
                </div>
            `;
        }
        
        chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }
}

// Initialize the chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GreekChatbot();
});

// Handle window resize
window.addEventListener('resize', () => {
    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth > 768) {
        sidebar.classList.remove('open');
    }
});
