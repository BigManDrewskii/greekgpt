// Greek Chatbot Application
class GreekChatbot {
    constructor() {
        // Fixed model for OpenRouter API
        this.model = 'moonshotai/kimi-k2:free';
        
        this.currentChatId = null;
        this.chats = JSON.parse(localStorage.getItem('greek-chatbot-chats')) || {};
        this.settings = JSON.parse(localStorage.getItem('greek-chatbot-settings')) || {
            apiKey: '',
            language: 'el',
            theme: 'light',
            autoClearHistory: false,
            fontSize: 14,
            chatBubbleStyle: 'rounded',
            showTimestamps: false,
            soundNotifications: false
        };
        
        // Ensure the model is always set to Moonshot AI Kimi-K2
        this.settings.model = this.model;
        this.controller = null; // AbortController for fetch requests
        
        // Explicitly bind methods that need proper 'this' context
        this.sendMessage = this.sendMessage.bind(this);
        this.updateInputState = this.updateInputState.bind(this);
        this.switchChat = this.switchChat.bind(this);
        this.deleteChat = this.deleteChat.bind(this);
        this.searchChats = this.searchChats.bind(this);
        
        this.init();
    }

    init() {
        this.applyTheme();
        this.applyFontSize();
        this.applyChatBubbleStyle();
        this.setupEventListeners();
        this.renderChatHistory();
        this.loadCurrentChat();
        this.setupMobileMenu();
        this.updateInputState();
        this.loadSettings();
    }

    applyTheme() {
        const theme = this.settings.theme || 'light';
        document.body.setAttribute('data-theme', theme);
    }
    
    applyFontSize() {
        const fontSize = this.settings.fontSize || 14;
        document.documentElement.style.setProperty('--font-size-base', `${fontSize}px`);
    }
    
    applyChatBubbleStyle() {
        const style = this.settings.chatBubbleStyle || 'rounded';
        document.documentElement.style.setProperty('--chat-bubble-style', style);
        
        // Apply specific styles based on bubble type
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            chatContainer.classList.remove('rounded-bubbles', 'modern-bubbles', 'classic-bubbles');
            chatContainer.classList.add(`${style}-bubbles`);
        }
    }
    
    updateEmptyHistoryMessage() {
        const emptyMsg = document.getElementById('empty-history-message');
        if (!emptyMsg) return;
        
        if (Object.keys(this.chats).length === 0) {
            emptyMsg.style.display = 'flex';
        } else {
            emptyMsg.style.display = 'none';
        }
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
            messageInput.addEventListener('input', this.updateInputState);
        }
        
        // Setup search functionality
        const searchInput = document.getElementById('chat-search');
        const clearSearchBtn = document.getElementById('clear-search');
        
        if (searchInput) {
            // Debounce search input
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                const value = e.target.value;
                
                // Show/hide clear button
                if (clearSearchBtn) {
                    if (value) {
                        clearSearchBtn.classList.add('visible');
                    } else {
                        clearSearchBtn.classList.remove('visible');
                    }
                }
                
                // Debounce search
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchChats(value);
                }, 300);
            });
            
            // Search keyboard navigation
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchInput.value = '';
                    this.searchChats('');
                    searchInput.blur();
                } else if (e.key === 'Enter') {
                    // Find first visible chat and select it
                    const firstChat = document.querySelector('.chat-item:not(.hidden)');
                    if (firstChat) {
                        const chatId = firstChat.getAttribute('data-chat-id');
                        if (chatId) {
                            this.switchChat(chatId);
                            searchInput.blur();
                        }
                    }
                } else if (e.key === 'ArrowDown') {
                    // Focus on first chat item
                    const firstChat = document.querySelector('.chat-item:not(.hidden)');
                    if (firstChat) {
                        firstChat.focus();
                    }
                }
            });
        }
        
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                if (searchInput) {
                    searchInput.value = '';
                    this.searchChats('');
                    searchInput.focus();
                }
            });
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
        
        // Settings tabs
        const tabButtons = document.querySelectorAll('.modal-tab-btn');
        if (tabButtons) {
            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    // Get the target tab
                    const targetTab = button.getAttribute('data-tab');
                    
                    // Remove active class from all buttons
                    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    
                    // Hide all tabs
                    document.querySelectorAll('.tab-content').forEach(tab => {
                        tab.style.display = 'none';
                    });
                    
                    // Add active class to clicked button
                    button.classList.add('active');
                    
                    // Show the target tab
                    document.getElementById(`${targetTab}-tab`).style.display = 'block';
                });
            });
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
        
        // Toggle switches
        // Auto-clear chat history toggle
        const autoClearToggle = document.getElementById('auto-clear-toggle');
        if (autoClearToggle) {
            autoClearToggle.addEventListener('change', () => {
                this.settings.autoClearHistory = autoClearToggle.checked;
                this.saveSettings();
                
                // Apply auto-clear if enabled
                if (this.settings.autoClearHistory) {
                    this.cleanupOldChats();
                }
            });
        }
        
        // Show timestamps toggle
        const timestampsToggle = document.getElementById('show-timestamps');
        if (timestampsToggle) {
            timestampsToggle.addEventListener('change', () => {
                this.settings.showTimestamps = timestampsToggle.checked;
                this.saveSettings();
                this.updateMessageTimestamps();
            });
        }
        
        // Sound notifications toggle
        const soundToggle = document.getElementById('sound-notifications');
        if (soundToggle) {
            soundToggle.addEventListener('change', () => {
                this.settings.soundNotifications = soundToggle.checked;
                this.saveSettings();
            });
        }
        
        // Font size slider
        const fontSizeSlider = document.getElementById('font-size-slider');
        const fontSizeValue = document.getElementById('font-size-value');
        if (fontSizeSlider && fontSizeValue) {
            fontSizeSlider.addEventListener('input', () => {
                const size = parseInt(fontSizeSlider.value);
                fontSizeValue.textContent = `${size}px`;
                this.settings.fontSize = size;
                this.applyFontSize();
            });
            
            fontSizeSlider.addEventListener('change', () => {
                this.saveSettings();
            });
        }
        
        // Chat bubble style options
        document.querySelectorAll('.chat-style-option').forEach(option => {
            option.addEventListener('click', () => {
                const style = option.getAttribute('data-style');
                
                // Update selected state
                document.querySelectorAll('.chat-style-option').forEach(opt => {
                    opt.setAttribute('aria-selected', 'false');
                });
                option.setAttribute('aria-selected', 'true');
                
                // Update settings
                this.settings.chatBubbleStyle = style;
                this.saveSettings();
                this.applyChatBubbleStyle();
            });
        });

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
        
        if (mobileMenuToggle && sidebar && sidebarOverlay) {
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
        }
    }

    setupMobileMenu() {
        // We'll rely on the HTML/CSS structure for this now
        // Ensure any dynamically added chat items close the sidebar on mobile
        this.addMobileClickHandlers();
    }
    
    addMobileClickHandlers() {
        // Add mobile handlers to all chat items
        document.querySelectorAll('.chat-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    const sidebar = document.querySelector('.sidebar');
                    const sidebarOverlay = document.getElementById('sidebar-overlay');
                    
                    if (sidebar && sidebarOverlay) {
                        sidebar.classList.remove('active');
                        sidebarOverlay.classList.remove('active');
                        document.body.classList.remove('no-scroll');
                    }
                }
            });
        });
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
                            const content = parsed.choices[0]?.delta?.content || '';
                            if (content) {
                                responseText += content;
                                
                                // Update the last message
                                const lastMessage = this.chats[this.currentChatId].messages.pop();
                                lastMessage.content = responseText;
                                this.chats[this.currentChatId].messages.push(lastMessage);
                                
                                // Update UI
                                this.updateLastMessageContent(responseText);
                                this.saveChats();
                            }
                        } catch (e) {
                            console.error('Error parsing streaming response:', e);
                        }
                    }
                }
            }
            
            // Remove typing indicator
            this.removeTypingIndicator();
            
            return responseText;
            
        } catch (error) {
            console.error('API request error:', error);
            this.removeTypingIndicator();
            
            // Check if this was an abort
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
    
    // Load the current chat or create one if none exists
    loadCurrentChat() {
        // Try to load last used chat ID
        const savedChatId = localStorage.getItem('greek-chatbot-current-chat-id');
        
        if (savedChatId && this.chats[savedChatId]) {
            this.currentChatId = savedChatId;
            this.renderCurrentChat();
        } else {
            this.createNewChat();
        }
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
    
    renderChatHistory(searchQuery = '') {
        const historyElement = document.getElementById('chat-history');
        historyElement.innerHTML = '';
        
        // Show empty history message if no chats
        this.updateEmptyHistoryMessage();
        
        // Sort chats by timestamp (newest first)
        const sortedChats = Object.values(this.chats).sort((a, b) => b.timestamp - a.timestamp);
        
        // Filter chats based on search query if provided
        const filteredChats = searchQuery ? 
            sortedChats.filter(chat => {
                // Search in chat title
                const titleMatch = chat.title.toLowerCase().includes(searchQuery.toLowerCase());
                
                // Search in chat messages
                const messagesMatch = chat.messages.some(msg => 
                    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
                );
                
                return titleMatch || messagesMatch;
            }) : sortedChats;
            
        // Show message if no search results
        if (searchQuery && filteredChats.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-search-results';
            noResults.innerHTML = `
                <i class="fa-solid fa-search"></i>
                <p>${this.settings.language === 'el' ? 'Δεν βρέθηκαν αποτελέσματα' : 'No results found'}</p>
                <button class="clear-search-action">
                    ${this.settings.language === 'el' ? 'Καθαρισμός αναζήτησης' : 'Clear search'}
                </button>
            `;
            historyElement.appendChild(noResults);
            
            // Add event listener to clear search button
            const clearSearchBtn = noResults.querySelector('.clear-search-action');
            clearSearchBtn.addEventListener('click', () => {
                const searchInput = document.getElementById('chat-search');
                searchInput.value = '';
                this.searchChats();
            });
            
            return;
        }
        
        // Iterate through filtered chats
        filteredChats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = 'chat-item';
            if (this.currentChatId === chat.id) {
                chatItem.classList.add('active');
            }
            chatItem.setAttribute('data-chat-id', chat.id);
            
            // Create inner structure
            const contentDiv = document.createElement('div');
            contentDiv.className = 'chat-item-content';
            
            // Highlight search term in title if search is active
            if (searchQuery && chat.title.toLowerCase().includes(searchQuery.toLowerCase())) {
                contentDiv.innerHTML = this.highlightText(chat.title, searchQuery);
            } else {
                contentDiv.textContent = chat.title || 'New Chat';
            }
            
            chatItem.appendChild(contentDiv);
            
            // If search query matches message content, show preview
            if (searchQuery) {
                const matchingMessages = chat.messages.filter(msg => 
                    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
                );
                
                if (matchingMessages.length > 0) {
                    // Add message preview
                    const previewDiv = document.createElement('div');
                    previewDiv.className = 'chat-item-preview';
                    
                    // Get first matching message
                    const firstMatch = matchingMessages[0];
                    const matchContent = firstMatch.content;
                    
                    // Create a snippet with highlighted search term
                    const snippet = this.createSearchSnippet(matchContent, searchQuery);
                    previewDiv.innerHTML = snippet;
                    
                    // Add message count badge if multiple matches
                    if (matchingMessages.length > 1) {
                        const badgeSpan = document.createElement('span');
                        badgeSpan.className = 'match-count';
                        badgeSpan.textContent = `+${matchingMessages.length - 1} more`;
                        previewDiv.appendChild(badgeSpan);
                    }
                    
                    chatItem.appendChild(previewDiv);
                }
            }
            
            // Create actions container
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'chat-item-actions';
            
            // Create delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-chat-btn';
            deleteBtn.title = 'Delete conversation';
            deleteBtn.setAttribute('aria-label', 'Delete conversation');
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            
            // Add event to delete button
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering the parent click
                this.deleteChat(chat.id);
            });
            
            actionsDiv.appendChild(deleteBtn);
            chatItem.appendChild(actionsDiv);
            
            // Add click event to chat item
            chatItem.addEventListener('click', () => this.switchChat(chat.id));
            historyElement.appendChild(chatItem);
        });
        
        // Add mobile click handlers to close sidebar on selection
        this.addMobileClickHandlers();
    }
    
    switchChat(chatId) {
        if (!this.chats[chatId]) return;
        
        // Update current chat ID
        this.currentChatId = chatId;
        localStorage.setItem('greek-chatbot-current-chat-id', chatId);
        
        // Update active state in sidebar
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
            if (item.querySelector('.chat-item-content').textContent === this.chats[chatId].title) {
                item.classList.add('active');
            }
        });
        
        // Render the selected chat
        this.renderCurrentChat();
    }
    
    deleteChat(chatId) {
        // Confirm deletion
        const isGreek = this.settings.language === 'el';
        const confirmMsg = isGreek ? 
            'Είστε βέβαιοι ότι θέλετε να διαγράψετε αυτή τη συνομιλία;' : 
            'Are you sure you want to delete this conversation?';
            
        if (confirm(confirmMsg)) {
            // Remove chat from history
            delete this.chats[chatId];
            
            // Update localStorage
            this.saveChats();
            
            // If we deleted the current chat, create a new one or switch to another
            if (chatId === this.currentChatId) {
                const remainingChats = Object.keys(this.chats);
                if (remainingChats.length > 0) {
                    // Switch to the most recent chat
                    const mostRecentChat = Object.values(this.chats)
                        .sort((a, b) => b.timestamp - a.timestamp)[0];
                    this.switchChat(mostRecentChat.id);
                } else {
                    // Create a new chat if no chats remain
                    this.createNewChat();
                }
            } else {
                // Just update the chat history display
                this.renderChatHistory();
            }
        }
    }
    
    renderCurrentChat() {
        if (!this.currentChatId || !this.chats[this.currentChatId]) {
            return;
        }
        
        const chat = this.chats[this.currentChatId];
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
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #667eea;">$1</a>');
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
        // Update empty history message status
        this.updateEmptyHistoryMessage();
    }
    
    openSettings() {
        document.getElementById('settings-modal').style.display = 'block';
        this.loadSettings();
    }
    
    updateMessageTimestamps() {
        // Update all existing messages with/without timestamps
        document.querySelectorAll('.message').forEach(messageEl => {
            const messageId = messageEl.getAttribute('data-message-id');
            if (!messageId) return;
            
            // Find the message in our chats data
            const chat = this.chats[this.currentChatId];
            if (!chat) return;
            
            const message = chat.messages.find(m => m.id === messageId);
            if (!message) return;
            
            const senderEl = messageEl.querySelector('.sender');
            if (!senderEl) return;
            
            if (this.settings.showTimestamps) {
                // Add timestamp if not present
                if (!senderEl.querySelector('.timestamp')) {
                    const timestampEl = document.createElement('div');
                    timestampEl.className = 'timestamp';
                    timestampEl.textContent = this.formatTime(message.timestamp);
                    senderEl.appendChild(timestampEl);
                }
            } else {
                // Remove timestamp if present
                const timestampEl = senderEl.querySelector('.timestamp');
                if (timestampEl) {
                    timestampEl.remove();
                }
            }
        });
    }
    
    playNotificationSound() {
        // Create a simple beep sound
        try {
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(587.33, context.currentTime); // D5 note
            
            const gainNode = context.createGain();
            gainNode.gain.setValueAtTime(0.1, context.currentTime); // Low volume
            gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
            
            oscillator.connect(gainNode);
            gainNode.connect(context.destination);
            
            oscillator.start();
            oscillator.stop(context.currentTime + 0.5);
        } catch (e) {
            console.warn('Audio notification failed:', e);
        }
    }
    
    cleanupOldChats() {
        if (!this.settings.autoClearHistory) return;
        
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        let hasChanges = false;
        
        // Find chats older than 30 days
        Object.keys(this.chats).forEach(chatId => {
            const chat = this.chats[chatId];
            if (chat.timestamp < thirtyDaysAgo) {
                delete this.chats[chatId];
                hasChanges = true;
            }
        });
        
        // If we deleted any chats, save and update UI
        if (hasChanges) {
            this.saveChats();
            
            // If current chat was deleted, create a new one
            if (!this.chats[this.currentChatId]) {
                if (Object.keys(this.chats).length > 0) {
                    // Switch to most recent chat
                    const mostRecentChat = Object.values(this.chats)
                        .sort((a, b) => b.timestamp - a.timestamp)[0];
                    this.switchChat(mostRecentChat.id);
                } else {
                    this.createNewChat();
                }
            }
            
            this.renderChatHistory();
        }
    }
    
    closeSettings() {
        document.getElementById('settings-modal').style.display = 'none';
    }
    
    searchChats(query = '') {
        // Render chat history with search filter
        this.renderChatHistory(query);
    }
    
    highlightText(text, query) {
        if (!query) return text;
        
        const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }
    
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    createSearchSnippet(text, query) {
        if (!query) return '';
        
        const maxLength = 60;
        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerText.indexOf(lowerQuery);
        
        if (index === -1) return text.substring(0, maxLength) + '...';
        
        let start = Math.max(0, index - 20);
        let end = Math.min(text.length, index + query.length + 20);
        
        // Adjust to not cut words
        if (start > 0) {
            while (start > 0 && text[start] !== ' ') {
                start--;
            }
            if (start > 0) start++; // Skip the space
        }
        
        if (end < text.length) {
            while (end < text.length && text[end] !== ' ') {
                end++;
            }
        }
        
        let snippet = text.substring(start, end);
        
        // Add ellipsis if needed
        if (start > 0) snippet = '...' + snippet;
        if (end < text.length) snippet = snippet + '...';
        
        // Highlight the query
        return this.highlightText(snippet, query);
    }
    
    loadSettings() {
        // Set the General tab as active by default
        const defaultTab = document.querySelector('.modal-tab-btn');
        if (defaultTab) {
            defaultTab.click();
        }
        
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
            themePreference.value = this.settings.theme || 'auto';
        }
        
        // Auto-clear history toggle
        const autoClearToggle = document.getElementById('auto-clear-toggle');
        if (autoClearToggle) {
            autoClearToggle.checked = this.settings.autoClearHistory || false;
        }
        
        // Show timestamps toggle
        const timestampsToggle = document.getElementById('show-timestamps');
        if (timestampsToggle) {
            timestampsToggle.checked = this.settings.showTimestamps || false;
        }
        
        // Sound notifications toggle
        const soundToggle = document.getElementById('sound-notifications');
        if (soundToggle) {
            soundToggle.checked = this.settings.soundNotifications || false;
        }
        
        // Font size slider
        const fontSizeSlider = document.getElementById('font-size-slider');
        const fontSizeValue = document.getElementById('font-size-value');
        if (fontSizeSlider && fontSizeValue) {
            const fontSize = this.settings.fontSize || 14;
            fontSizeSlider.value = fontSize;
            fontSizeValue.textContent = `${fontSize}px`;
        }
        
        // Chat bubble style
        const bubbleStyle = this.settings.chatBubbleStyle || 'rounded';
        document.querySelectorAll('.chat-style-option').forEach(option => {
            const style = option.getAttribute('data-style');
            option.setAttribute('aria-selected', style === bubbleStyle ? 'true' : 'false');
        });
    }
    
    saveSettings() {
        // Ensure model is always fixed
        
        // Save to localStorage
        this.saveChats();
        
        // If this was the current chat, create a new one
        if (this.currentChatId === chatId) {
            this.createNewChat();
        }
        
        // Re-render chat history
        this.renderChatHistory();
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
        sidebar.classList.remove('active');
        document.getElementById('sidebar-overlay').classList.remove('active');
        document.body.classList.remove('no-scroll');
    }
});
