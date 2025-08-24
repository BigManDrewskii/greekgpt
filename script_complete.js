class GreekChatbot {
    constructor() {
        this.chats = {};
        this.currentChatId = null;
        this.settings = {
            apiKey: '',
            model: 'moonshotai/kimi-k2:free',
            language: 'el',
            theme: 'auto',
            chatBubbleStyle: 'rounded',
            fontSize: 14,
            showTimestamps: false,
            soundNotifications: false,
            autoClearHistory: false
        };
        this.controller = null;
        this.model = 'moonshotai/kimi-k2:free';
        
        this.init();
        
        // Store instance globally for theme change listener
        window.chatbotInstance = this;
    }

    init() {
        this.loadChats();
        this.loadSettings();
        this.setupEventListeners();
        this.loadCurrentChat();
        this.applyTheme();
        this.applyFontSize();
        this.applyChatStyle();
    }

    loadChats() {
        const savedChats = localStorage.getItem('greek-chatbot-chats');
        if (savedChats) {
            try {
                this.chats = JSON.parse(savedChats);
            } catch (e) {
                console.error('Error loading chats:', e);
                this.chats = {};
            }
        }
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('greek-chatbot-settings');
        if (savedSettings) {
            try {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
            } catch (e) {
                console.error('Error loading settings:', e);
            }
        }
    }

    saveChats() {
        localStorage.setItem('greek-chatbot-chats', JSON.stringify(this.chats));
    }

    saveSettings() {
        this.settings.model = this.model;
        localStorage.setItem('greek-chatbot-settings', JSON.stringify(this.settings));
    }

    setupEventListeners() {
        const sendBtn = document.getElementById('send-btn');
        const messageInput = document.getElementById('message-input');
        
        if (sendBtn) {
            sendBtn.addEventListener('click', this.sendMessage.bind(this));
        }
        
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            messageInput.addEventListener('input', this.updateInputState.bind(this));
        }
        
        // Theme toggle button
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            this.toggleTheme();
        });

        document.getElementById('chat-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        document.getElementById('new-chat-btn')?.addEventListener('click', () => {
            this.createNewChat();
        });

        document.getElementById('settings-btn')?.addEventListener('click', () => {
            this.openSettingsModal();
        });

        document.querySelector('.modal-header .close')?.addEventListener('click', () => {
            this.closeSettingsModal();
        });

        document.getElementById('save-api-key')?.addEventListener('click', () => {
            const apiKeyInput = document.getElementById('api-key');
            if (apiKeyInput) {
                this.settings.apiKey = apiKeyInput.value.trim();
                this.saveSettings();
                this.showSettingsSavedMessage('api');
            }
        });

        document.getElementById('language-preference')?.addEventListener('change', (e) => {
            this.settings.language = e.target.value;
            this.saveSettings();
            this.renderChatHistory();
            this.renderCurrentChat();
        });

        document.getElementById('theme-preference')?.addEventListener('change', (e) => {
            this.settings.theme = e.target.value;
            this.saveSettings();
            this.applyTheme();
        });

        document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
            this.toggleMobileMenu();
        });

        document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
            this.closeMobileMenu();
        });
    }

    updateInputState() {
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        
        if (messageInput && sendBtn) {
            const hasText = messageInput.value.trim() !== '';
            sendBtn.disabled = !hasText;
        }
    }

    async sendMessage() {
        try {
            const messageInput = document.getElementById('message-input');
            const message = messageInput.value.trim();
            
            if (!message || !this.currentChatId) return;
            
            this.updateInputState();
            messageInput.value = '';
            
            // Check if this is a reply to an existing message
            const currentActiveReplyId = this.activeReplyId; // Store this before we cancel the reply
            
            if (this.activeReplyId) {
                this.addMessageToChat('user', message, this.activeReplyId);
                this.cancelReply(); // Clear the reply state
            } else {
                this.addMessageToChat('user', message);
            }
            
            await this.getAIResponse(message, currentActiveReplyId);
        } catch (error) {
            console.error('Error sending message:', error);
            this.showError('An error occurred while sending the message');
        }
    }

    addMessageToChat(role, content, parentId = null) {
        if (!this.currentChatId || !this.chats[this.currentChatId]) return;
        
        // Generate a unique message ID
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        const message = {
            id: messageId,
            role: role,
            content: content,
            formattedContent: this.parseMarkdown(content),
            timestamp: Date.now(),
            parentId: parentId,
            threadCollapsed: false
        };
        
        // Add to messages array
        this.chats[this.currentChatId].messages.push(message);
        this.saveChats();
        this.addMessageToUI(message);
        
        if (role === 'user' && 
            this.chats[this.currentChatId].messages.length <= 2 && 
            (this.chats[this.currentChatId].title === 'Νέα Συνομιλία' || 
            this.chats[this.currentChatId].title === 'New Chat')) {
            
            const title = content.length > 30 ? `${content.substring(0, 30)}...` : content;
            this.chats[this.currentChatId].title = title;
            this.saveChats();
            this.renderChatHistory();
        }
    }

    async getAIResponse(message, parentMessageId = null) {
        try {
            this.showTypingIndicator();
            
            // Get conversation history for context
            const chatHistory = this.chats[this.currentChatId].messages || [];
            const messages = [];
            
            // Prepare system message based on language
            const isGreek = this.settings.language === 'el';
            let systemMessage = isGreek ?
                'Είσαι ένας ευγενικός και εξυπηρετικός βοηθός που μιλάει κυρίως ελληνικά. Απαντάς στις ερωτήσεις του χρήστη με σαφή και κατανοητό τρόπο.' :
                'You are a helpful assistant that primarily speaks in English. You answer the user\'s questions clearly and concisely.';
            
            messages.push({ role: 'system', content: systemMessage });
            
            // Check if we're responding in a thread or to a main message
            let recentMessages;
            if (parentMessageId) {
                // Get thread context - collect all messages in this thread
                const threadMessages = this.getThreadMessages(parentMessageId);
                recentMessages = threadMessages.slice(-10); // Keep the thread context limited
            } else {
                // Normal conversation flow - only get top-level messages (no thread replies)
                recentMessages = chatHistory.filter(msg => !msg.parentId).slice(-10);
            }
            
            recentMessages.forEach(msg => {
                messages.push({ role: msg.role, content: msg.content });
            });
            
            // Set up abort controller for timeout
            this.controller = new AbortController();
            const signal = this.controller.signal;
            const timeoutId = setTimeout(() => this.controller.abort(), 30000); // 30 second timeout
            
            try {
                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.settings.apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': window.location.href || 'http://localhost',
                        'X-Title': 'Greek Chatbot'
                    },
                    body: JSON.stringify({
                        model: this.settings.model || 'moonshotai/kimi-k2:free',
                        messages: messages,
                        stream: false,
                        max_tokens: 2000,
                        temperature: 0.7
                    }),
                    signal: signal
                });
                
                clearTimeout(timeoutId);
                this.removeTypingIndicator();
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('API Error:', response.status, errorData);
                    
                    // Handle specific error cases
                    if (response.status === 504 || response.status === 502) {
                        throw new Error(`Gateway Timeout Error (${response.status}). The server took too long to respond.`);
                    } else if (response.status === 429) {
                        throw new Error('Rate limit exceeded. Please try again after a short break.');
                    } else if (response.status === 401) {
                        throw new Error('Invalid API key. Please check your API key in settings.');
                    } else if (errorData.error?.message?.includes('model_not_found')) {
                        throw new Error(`Model not found. The selected AI model may be unavailable. Try a different model.`);
                    } else {
                        throw new Error(`API Error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
                    }
                }
                
                const data = await response.json();
                const aiResponse = data.choices?.[0]?.message?.content || '';
                
                // Add the AI response to the thread if we're in a thread
                if (parentMessageId) {
                    this.addMessageToChat('assistant', aiResponse, parentMessageId);
                } else {
                    this.addMessageToChat('assistant', aiResponse);
                }
                
                // Save the conversation
                await this.saveConversation();
                
            } catch (apiError) {
                this.removeTypingIndicator();
                console.error('API request error:', apiError);
                
                if (apiError.name === 'AbortError') {
                    console.log('Request was aborted');
                    this.showError(isGreek ? 
                        'Η αίτηση ακυρώθηκε.' :
                        'The request was aborted.');
                } else if (apiError.message && apiError.message.includes('timeout')) {
                    this.showError(isGreek ? 
                        'Λήξη χρονικού ορίου αίτησης. Το μοντέλο καθυστερεί στην απόκριση. Παρακαλώ δοκιμάστε ξανά με μικρότερο ερώτημα.' :
                        'Request timeout. The model is taking too long to respond. Please try again with a shorter query.');
                } else if (apiError.message && apiError.message.includes('Gateway Timeout')) {
                    this.showError(isGreek ? 
                        'Σφάλμα χρονικού ορίου διακομιστή. Παρακαλώ δοκιμάστε ξανά αργότερα.' :
                        'Gateway timeout error. Please try again later.');
                } else if (apiError.message && apiError.message.includes('Rate limit')) {
                    this.showError(isGreek ? 
                        'Υπέρβαση ορίου αιτημάτων. Παρακαλώ δοκιμάστε ξανά σε λίγο.' :
                        'Rate limit exceeded. Please try again later.');
                } else if (apiError.message && apiError.message.includes('valid model ID')) {
                    this.showError(isGreek ? 
                        'Μη έγκυρο ID μοντέλου. Παρακαλώ ελέγξτε τις ρυθμίσεις και το API key σας.' :
                        'Invalid model ID. Please check your settings and API key.');
                } else {
                    this.showError(isGreek ? 
                        'Σφάλμα κατά τη λήψη απάντησης. Παρακαλώ δοκιμάστε ξανά.' :
                        'Error getting AI response. Please try again.');
                }
            }
        } catch (error) {
            console.error('Error in getAIResponse:', error);
            this.removeTypingIndicator();
            const isGreek = this.settings.language === 'el';
            this.showError(isGreek ? 
                'Σφάλμα κατά τη λήψη απάντησης. Παρακαλώ δοκιμάστε ξανά.' :
                'Error getting response. Please try again.');
        }
    }

    getCurrentChatMessages() {
        if (!this.currentChatId || !this.chats[this.currentChatId]) return [];
        
        return this.chats[this.currentChatId].messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));
    }

    showTypingIndicator() {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        const isGreek = this.settings.language === 'el';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="sender">Assistant</div>
                <div class="content">
                    <div class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
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

    addMessageToUI(message) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;
        
        // Check if this is a threaded message (has a parent)
        const isThreadedMessage = message.parentId !== null;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role}${isThreadedMessage ? ' threaded-message' : ''}`;
        messageDiv.setAttribute('data-message-id', message.id);
        
        // If message is threaded, add nested class and proper indentation
        if (isThreadedMessage) {
            // Find the parent message element
            const parentMessageEl = document.querySelector(`[data-message-id="${message.parentId}"]`);
            
            // Create thread container if it doesn't exist
            let threadContainer = parentMessageEl.querySelector('.thread-container');
            if (!threadContainer) {
                threadContainer = document.createElement('div');
                threadContainer.className = 'thread-container';
                parentMessageEl.appendChild(threadContainer);
                
                // Add thread controls to parent
                const threadControl = document.createElement('div');
                threadControl.className = 'thread-control';
                threadControl.innerHTML = `
                    <button class="thread-toggle" aria-label="Toggle thread visibility">
                        <i class="fas fa-chevron-down"></i>
                        <span class="thread-count">1</span>
                    </button>
                `;
                parentMessageEl.querySelector('.message-content').appendChild(threadControl);
                
                // Add event listener for thread toggling
                threadControl.querySelector('.thread-toggle').addEventListener('click', () => {
                    this.toggleThreadVisibility(message.parentId);
                });
            } else {
                // Update thread count
                const threadCount = parentMessageEl.querySelector('.thread-count');
                if (threadCount) {
                    const currentCount = parseInt(threadCount.textContent, 10);
                    threadCount.textContent = currentCount + 1;
                }
            }
            
            // Append to thread container instead of main chat
            threadContainer.appendChild(messageDiv);
        } else {
            // This is a root message, append to main chat container
            chatMessages.appendChild(messageDiv);
        }
        
        const timestampHtml = this.settings.showTimestamps ? 
            `<div class="timestamp">${this.formatTime(message.timestamp)}</div>` : '';
        
        if (message.role === 'assistant') {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <div class="sender">Assistant ${timestampHtml}</div>
                    <div class="content rich-text-content">${this.formatMessage(message.content, message.formattedContent)}</div>
                    <div class="message-actions">
                        <button class="reply-btn" aria-label="Reply to this message">
                            <i class="fas fa-reply"></i> Reply
                        </button>
                    </div>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="message-content">
                    <div class="sender">You ${timestampHtml}</div>
                    <div class="content rich-text-content">${this.formatMessage(message.content, message.formattedContent)}</div>
                    <div class="message-actions">
                        <button class="reply-btn" aria-label="Reply to this message">
                            <i class="fas fa-reply"></i> Reply
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Add event listener for reply button
        messageDiv.querySelector('.reply-btn').addEventListener('click', () => {
            this.prepareReply(message.id);
        });
        
        if (!isThreadedMessage) {
            this.scrollToBottom();
        }
    }
    
    // Toggle thread visibility
    toggleThreadVisibility(parentId) {
        const parentMessage = document.querySelector(`[data-message-id="${parentId}"]`);
        if (!parentMessage) return;
        
        const threadContainer = parentMessage.querySelector('.thread-container');
        const threadToggle = parentMessage.querySelector('.thread-toggle i');
        
        if (!threadContainer || !threadToggle) return;
        
        // Update in memory state
        const parentIndex = this.chats[this.currentChatId].messages.findIndex(msg => msg.id === parentId);
        if (parentIndex !== -1) {
            this.chats[this.currentChatId].messages[parentIndex].isCollapsed = 
                !this.chats[this.currentChatId].messages[parentIndex].isCollapsed;
            
            const isCollapsed = this.chats[this.currentChatId].messages[parentIndex].isCollapsed;
            
            // Update UI
            if (isCollapsed) {
                threadContainer.classList.add('collapsed');
                threadToggle.classList.remove('fa-chevron-down');
                threadToggle.classList.add('fa-chevron-right');
            } else {
                threadContainer.classList.remove('collapsed');
                threadToggle.classList.remove('fa-chevron-right');
                threadToggle.classList.add('fa-chevron-down');
            }
            
            this.saveChats();
        }
    }
    
    // Prepare to reply to a message
    prepareReply(messageId) {
        const messageInput = document.getElementById('message-input');
        if (!messageInput) return;
        
        // Find the message we're replying to
        const messageToReply = this.chats[this.currentChatId].messages.find(msg => msg.id === messageId);
        if (!messageToReply) return;
        
        // Set active reply state
        this.activeReplyId = messageId;
        
        // Show reply indicator
        const replyIndicator = document.createElement('div');
        replyIndicator.className = 'reply-indicator';
        replyIndicator.innerHTML = `
            <div class="reply-info">
                <i class="fas fa-reply"></i>
                <span>Replying to ${messageToReply.role === 'assistant' ? 'Assistant' : 'yourself'}</span>
            </div>
            <button class="cancel-reply" aria-label="Cancel reply">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add to input container
        const inputContainer = messageInput.parentNode;
        inputContainer.insertBefore(replyIndicator, messageInput);
        
        // Add event listener for cancel button
        replyIndicator.querySelector('.cancel-reply').addEventListener('click', () => {
            this.cancelReply();
        });
        
        // Focus the input
        messageInput.focus();
    }
    
    // Cancel the current reply
    cancelReply() {
        this.activeReplyId = null;
        const replyIndicator = document.querySelector('.reply-indicator');
        if (replyIndicator) {
            replyIndicator.remove();
        }
    }

    formatMessage(content, formattedContent) {
        if (!content) return '';
        // Use formatted content if available, otherwise use escaped HTML
        return formattedContent || this.escapeHtml(content);
    }

    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Parse and convert markdown to HTML
    parseMarkdown(text) {
        if (!text) return '';
        
        // Replace code blocks with syntax highlighting placeholders
        text = text.replace(/```([\w]*)[\n\r]([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre class="code-block${lang ? ' language-' + lang : ''}"><code>${this.escapeHtml(code.trim())}</code></pre>`;
        });
        
        // Replace inline code
        text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        
        // Replace bold text
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
        
        // Replace italic text
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/_(.*?)_/g, '<em>$1</em>');
        
        // Replace headers (limit to h3-h6 for chat context)
        text = text.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
        text = text.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
        text = text.replace(/^##### (.*?)$/gm, '<h5>$1</h5>');
        text = text.replace(/^###### (.*?)$/gm, '<h6>$1</h6>');
        
        // Replace lists
        text = text.replace(/^\* (.*)$/gm, '<li>$1</li>');
        text = text.replace(/^- (.*)$/gm, '<li>$1</li>');
        text = text.replace(/^\d+\. (.*)$/gm, '<li class="ordered">$1</li>');
        
        // Wrap adjacent list items in ul/ol tags
        text = text.replace(/(<li>.*?<\/li>)\n(?=<li>)/g, '$1');
        text = text.replace(/(<li class="ordered">.*?<\/li>)\n(?=<li class="ordered">)/g, '$1');
        text = text.replace(/((?:<li>.*?<\/li>)+)/g, '<ul>$1</ul>');
        text = text.replace(/((?:<li class="ordered">.*?<\/li>)+)/g, '<ol>$1</ol>');
        
        // Replace links
        text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        
        // Replace paragraphs (double line breaks)
        text = text.replace(/\n\n/g, '</p><p>');
        
        // Wrap in paragraphs if not already wrapped in block elements
        if (!text.match(/^\s*<(p|h[1-6]|ul|ol|pre)/)) {
            text = `<p>${text}</p>`;
        }
        
        return text;
    }

    scrollToBottom() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    // Get all messages in a thread, including parent and child messages
    getThreadMessages(messageId) {
        if (!messageId || !this.currentChatId) return [];
        
        const allMessages = this.chats[this.currentChatId].messages;
        const threadMessages = [];
        
        // Find the message
        const message = allMessages.find(msg => msg.id === messageId);
        if (!message) return [];
        
        // If this is a reply, find the root message
        let rootMessageId = messageId;
        if (message.parentId) {
            rootMessageId = message.parentId;
            // Find the parent message and add it first
            const parentMessage = allMessages.find(msg => msg.id === rootMessageId);
            if (parentMessage) {
                threadMessages.push(parentMessage);
            }
        } else {
            // This is already a root message, add it first
            threadMessages.push(message);
        }
        
        // Add all child messages in chronological order
        this.addChildMessagesToThread(rootMessageId, allMessages, threadMessages);
        
        return threadMessages;
    }
    
    // Helper method to recursively add child messages to a thread
    addChildMessagesToThread(parentId, allMessages, threadMessages) {
        // Find direct children of this message
        const children = allMessages.filter(msg => msg.parentId === parentId);
        
        // Sort children by timestamp and add them to the thread
        children.sort((a, b) => a.timestamp - b.timestamp).forEach(child => {
            threadMessages.push(child);
            // Recursively add any children of this child (nested replies)
            this.addChildMessagesToThread(child.id, allMessages, threadMessages);
        });
    }

    loadCurrentChat() {
        const savedChatId = localStorage.getItem('greek-chatbot-current-chat-id');
        
        if (savedChatId && this.chats[savedChatId]) {
            this.currentChatId = savedChatId;
            this.renderCurrentChat();
        } else {
            this.createNewChat();
        }
    }

    createNewChat() {
        const chatId = Date.now().toString();
        const isGreek = this.settings.language === 'el';
        
        this.chats[chatId] = {
            id: chatId,
            title: isGreek ? 'Νέα Συνομιλία' : 'New Chat',
            timestamp: Date.now(),
            messages: []
        };
        
        this.currentChatId = chatId;
        localStorage.setItem('greek-chatbot-current-chat-id', chatId);
        this.saveChats();
        this.renderChatHistory();
        this.renderCurrentChat();
    }

    renderCurrentChat() {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages || !this.currentChatId || !this.chats[this.currentChatId]) return;

        chatMessages.innerHTML = '';

        if (this.chats[this.currentChatId].messages.length === 0) {
            this.showWelcomeMessage();
        } else {
            this.chats[this.currentChatId].messages.forEach(message => {
                this.addMessageToUI(message);
            });
        }

        this.scrollToBottom();
    }

    showWelcomeMessage() {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'welcome-message';
        
        const isGreek = this.settings.language === 'el';
        welcomeDiv.innerHTML = `
            <h1>${isGreek ? 'Ελληνικό Chatbot' : 'Greek Chatbot'}</h1>
            <p>${isGreek ? 'Ρωτήστε οτιδήποτε στα ελληνικά ή αγγλικά' : 'Ask anything in Greek or English'}</p>
            <div class="example-prompts">
                <button class="prompt-btn" aria-label="${isGreek ? 'Χρήση αυτού του παραδείγματος' : 'Use this example prompt'}">
                    <i class="fa-solid fa-book-open" aria-hidden="true"></i>
                    <span>${isGreek ? 'Εξήγησέ μου την ιστορία της αρχαίας Ελλάδας' : 'Explain the history of ancient Greece'}</span>
                </button>
                <button class="prompt-btn" aria-label="${isGreek ? 'Χρήση αυτού του παραδείγματος' : 'Use this example prompt'}">
                    <i class="fa-solid fa-utensils" aria-hidden="true"></i>
                    <span>${isGreek ? 'Γράψε μια συνταγή για παραδοσιακό μουσακά' : 'Write a recipe for traditional moussaka'}</span>
                </button>
                <button class="prompt-btn" aria-label="${isGreek ? 'Χρήση αυτού του παραδείγματος' : 'Use this example prompt'}">
                    <i class="fa-solid fa-robot" aria-hidden="true"></i>
                    <span>${isGreek ? 'Τι είναι η τεχνητή νοημοσύνη και πώς λειτουργεί;' : 'What is artificial intelligence and how does it work?'}</span>
                </button>
                <button class="prompt-btn" aria-label="${isGreek ? 'Χρήση αυτού του παραδείγματος' : 'Use this example prompt'}">
                    <i class="fa-solid fa-umbrella-beach" aria-hidden="true"></i>
                    <span>${isGreek ? 'Προτείνε μέρη για διακοπές στην Ελλάδα' : 'Suggest vacation spots in Greece'}</span>
                </button>
            </div>
        `;

        chatMessages.appendChild(welcomeDiv);
        
        welcomeDiv.querySelectorAll('.prompt-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const prompts = [
                    'Explain the history of ancient Greece',
                    'Write a recipe for traditional moussaka',
                    'What is artificial intelligence and how does it work?',
                    'Suggest vacation spots in Greece'
                ];
                
                const messageInput = document.getElementById('message-input');
                if (messageInput) {
                    messageInput.value = prompts[index];
                    messageInput.focus();
                }
            });
        });
    }

    renderChatHistory(searchQuery = '') {
        const historyElement = document.getElementById('chat-history');
        if (!historyElement) return;
        
        historyElement.innerHTML = '';
        
        const sortedChats = Object.values(this.chats).sort((a, b) => b.timestamp - a.timestamp);
        
        const filteredChats = searchQuery ? 
            sortedChats.filter(chat => {
                const titleMatch = chat.title.toLowerCase().includes(searchQuery.toLowerCase());
                const messagesMatch = chat.messages.some(msg => 
                    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
                );
                return titleMatch || messagesMatch;
            }) : sortedChats;
        
        if (searchQuery && filteredChats.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-search-results';
            const isGreek = this.settings.language === 'el';
            noResults.innerHTML = `
                <i class="fa-solid fa-search"></i>
                <p>${isGreek ? 'Δεν βρέθηκαν αποτελέσματα' : 'No results found'}</p>
                <button class="clear-search-action">
                    ${isGreek ? 'Καθαρισμός αναζήτησης' : 'Clear search'}
                </button>
            `;
            historyElement.appendChild(noResults);
            return;
        }
        
        if (filteredChats.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-history';
            const isGreek = this.settings.language === 'el';
            emptyDiv.innerHTML = `
                <i class="fa-solid fa-comments" aria-hidden="true"></i>
                <p>${isGreek ? 'Δεν υπάρχουν συνομιλίες ακόμα' : 'No conversations yet'}</p>
                <button class="new-chat-btn">
                    <i class="fa-solid fa-plus" aria-hidden="true"></i>
                    ${isGreek ? 'Νέα Συνομιλία' : 'New Chat'}
                </button>
            `;
            historyElement.appendChild(emptyDiv);
            
            emptyDiv.querySelector('.new-chat-btn').addEventListener('click', () => {
                this.createNewChat();
            });
            return;
        }
        
        filteredChats.forEach(chat => {
            const chatItem = document.createElement('div');
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-chat-btn';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteChat(chat.id);
            });
            
            actionsDiv.appendChild(deleteBtn);
            chatItem.appendChild(actionsDiv);
            
            chatItem.addEventListener('click', () => this.switchChat(chat.id));
            historyElement.appendChild(chatItem);
        });
    }

    switchChat(chatId) {
        if (!this.chats[chatId]) return;
        
        this.currentChatId = chatId;
        localStorage.setItem('greek-chatbot-current-chat-id', chatId);
        
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const chatItem = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (chatItem) {
            chatItem.classList.add('active');
        }
        
        this.renderCurrentChat();
    }

    deleteChat(chatId) {
        if (!chatId || !this.chats[chatId]) return;

        const isGreek = this.settings.language === 'el';
        const confirmMessage = isGreek ? 
            'Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή τη συνομιλία;' :
            'Are you sure you want to delete this conversation?';

        if (confirm(confirmMessage)) {
            delete this.chats[chatId];
            this.saveChats();
            
            if (this.currentChatId === chatId) {
                this.createNewChat();
            }
            
            this.renderChatHistory();
        }
    }

    applyTheme() {
        const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        // Determine theme based on settings or system preference
        let theme = this.settings.theme;
        if (theme === 'auto') {
            theme = prefersDarkMode ? 'dark' : 'light';
        }
        
        // Apply theme to document
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update icon
        const themeIcon = document.getElementById('theme-icon');
        if (themeIcon) {
            if (theme === 'dark') {
                themeIcon.classList.remove('fa-moon');
                themeIcon.classList.add('fa-sun');
            } else {
                themeIcon.classList.remove('fa-sun');
                themeIcon.classList.add('fa-moon');
            }
        }
    }

    showError(message) {
        console.error(message);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.textContent = message;
        
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.appendChild(errorDiv);
            setTimeout(() => errorDiv.remove(), 5000);
        }
    }

    openSettingsModal() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.add('active');
            
            // Load current settings into form elements
            this.loadSettingsIntoForm();
            
            // Setup tab functionality
            this.setupSettingsTabs();
        }
    }
    
    loadSettingsIntoForm() {
        // API Key
        const apiKeyInput = document.getElementById('api-key');
        if (apiKeyInput) {
            apiKeyInput.value = this.settings.apiKey || '';
        }
        
        // Language preference
        const languageSelect = document.getElementById('language-preference');
        if (languageSelect) {
            languageSelect.value = this.settings.language || 'el';
        }
        
        // Theme preference
        const themeSelect = document.getElementById('theme-preference');
        if (themeSelect) {
            themeSelect.value = this.settings.theme || 'auto';
        }
        
        // Font size
        const fontSizeSlider = document.getElementById('font-size');
        const fontSizeValue = document.getElementById('font-size-value');
        if (fontSizeSlider && fontSizeValue) {
            fontSizeSlider.value = this.settings.fontSize || 16;
            fontSizeValue.textContent = `${fontSizeSlider.value}px`;
            
            // Add live update for font size slider
            fontSizeSlider.addEventListener('input', (e) => {
                fontSizeValue.textContent = `${e.target.value}px`;
            });
        }
        
        // Chat style
        const chatStyleOptions = document.querySelectorAll('.chat-style-option');
        const chatStyleInput = document.getElementById('chat-style');
        if (chatStyleOptions.length && chatStyleInput) {
            const activeStyle = this.settings.chatBubbleStyle || 'rounded';
            chatStyleInput.value = activeStyle;
            
            chatStyleOptions.forEach(option => {
                if (option.dataset.style === activeStyle) {
                    option.classList.add('active');
                } else {
                    option.classList.remove('active');
                }
            });
        }
        
        // Show timestamps
        const showTimestampsToggle = document.getElementById('show-timestamps');
        if (showTimestampsToggle) {
            showTimestampsToggle.checked = this.settings.showTimestamps || false;
        }
        
        // Sound notifications
        const enableSoundsToggle = document.getElementById('enable-sounds');
        if (enableSoundsToggle) {
            enableSoundsToggle.checked = this.settings.soundNotifications || false;
        }
        
        // Auto clear history
        const autoClearToggle = document.getElementById('auto-clear-chats');
        if (autoClearToggle) {
            autoClearToggle.checked = this.settings.autoClearHistory || false;
        }
    }

    setupSettingsTabs() {
        // Add click event to tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                
                // Update active states for buttons
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Show corresponding content
                tabContents.forEach(content => {
                    if (content.id === tabName + '-tab') {
                        content.classList.add('active');
                    } else {
                        content.classList.remove('active');
                    }
                });
            });
        });
        
        // Setup style options
        const styleOptions = document.querySelectorAll('.chat-style-option');
        const chatStyleInput = document.getElementById('chat-style');
        
        styleOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Remove active class from all options
                styleOptions.forEach(opt => opt.classList.remove('active'));
                
                // Add active class to clicked option
                option.classList.add('active');
                
                // Update hidden input
                if (chatStyleInput) {
                    chatStyleInput.value = option.getAttribute('data-style');
                }
            });
        });
        
        // Setup toggle password visibility
        const toggleApiKeyBtn = document.getElementById('toggle-api-key');
        const apiKeyInput = document.getElementById('api-key');
        
        if (toggleApiKeyBtn && apiKeyInput) {
            toggleApiKeyBtn.addEventListener('click', () => {
                if (apiKeyInput.type === 'password') {
                    apiKeyInput.type = 'text';
                    toggleApiKeyBtn.querySelector('i').classList.remove('fa-eye');
                    toggleApiKeyBtn.querySelector('i').classList.add('fa-eye-slash');
                } else {
                    apiKeyInput.type = 'password';
                    toggleApiKeyBtn.querySelector('i').classList.remove('fa-eye-slash');
                    toggleApiKeyBtn.querySelector('i').classList.add('fa-eye');
                }
            });
        }
        
        // Add save handlers
        this.setupSettingsSaveHandlers();
    }
    
    setupSettingsSaveHandlers() {
        // General settings
        document.getElementById('save-general')?.addEventListener('click', () => {
            this.settings.language = document.getElementById('language-preference')?.value || this.settings.language;
            this.settings.autoClearHistory = document.getElementById('auto-clear-chats')?.checked || false;
            this.saveSettings();
            this.renderChatHistory();
            this.renderCurrentChat();
            this.showSettingsSavedMessage('general');
        });
        
        // Appearance settings
        document.getElementById('save-appearance')?.addEventListener('click', () => {
            this.settings.theme = document.getElementById('theme-preference')?.value || this.settings.theme;
            this.settings.fontSize = parseInt(document.getElementById('font-size')?.value || '16', 10);
            this.settings.chatBubbleStyle = document.getElementById('chat-style')?.value || 'rounded';
            this.saveSettings();
            this.applyTheme();
            this.applyFontSize();
            this.applyChatStyle();
            this.showSettingsSavedMessage('appearance');
        });
        
        // Chat settings
        document.getElementById('save-chat-settings')?.addEventListener('click', () => {
            this.settings.showTimestamps = document.getElementById('show-timestamps')?.checked || false;
            this.settings.soundNotifications = document.getElementById('enable-sounds')?.checked || false;
            this.saveSettings();
            this.renderCurrentChat();
            this.showSettingsSavedMessage('chat');
        });
        
        // API settings
        document.getElementById('save-api-key')?.addEventListener('click', () => {
            const apiKeyInput = document.getElementById('api-key');
            if (apiKeyInput) {
                this.settings.apiKey = apiKeyInput.value.trim();
                this.saveSettings();
                this.showSettingsSavedMessage('api');
            }
        });
        
        // Close button
        document.getElementById('close-settings')?.addEventListener('click', () => {
            this.closeSettingsModal();
        });
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSettingsModal();
            }
        });
    }
    
    showSettingsSavedMessage(tabName) {
        const tab = document.getElementById(`${tabName}-tab`);
        if (!tab) return;
        
        const existingMsg = tab.querySelector('.settings-saved-message');
        if (existingMsg) existingMsg.remove();
        
        const msg = document.createElement('div');
        msg.className = 'settings-saved-message';
        msg.innerHTML = '<i class="fas fa-check-circle"></i> Οι ρυθμίσεις αποθηκεύτηκαν';
        
        tab.appendChild(msg);
        setTimeout(() => msg.classList.add('show'), 10);
        setTimeout(() => {
            msg.classList.remove('show');
            setTimeout(() => msg.remove(), 500);
        }, 3000);
    }
    
    applyFontSize() {
        document.documentElement.style.setProperty('--font-size-base', `${this.settings.fontSize}px`);
    }
    
    applyChatStyle() {
        document.body.dataset.chatStyle = this.settings.chatBubbleStyle || 'rounded';
    }

    closeSettingsModal() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    toggleMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        
        if (sidebar && sidebarOverlay) {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
            document.body.classList.toggle('no-scroll');
        }
    }
    
    toggleTheme() {
        // Cycle through themes: light → dark → auto
        switch (this.settings.theme) {
            case 'light':
                this.settings.theme = 'dark';
                break;
            case 'dark':
                this.settings.theme = 'auto';
                break;
            case 'auto':
            default:
                this.settings.theme = 'light';
                break;
        }
        
        // Apply the theme immediately
        this.applyTheme();
        
        // Save the new setting
        this.saveSettings();
    }

    closeMobileMenu() {
        const sidebar = document.querySelector('.sidebar');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        
        if (sidebar && sidebarOverlay) {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.classList.remove('no-scroll');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GreekChatbot();
    
    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            const chatbot = window.chatbotInstance;
            if (chatbot && chatbot.settings.theme === 'auto') {
                chatbot.applyTheme();
            }
        });
    }
});

window.addEventListener('resize', () => {
    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth > 768 && sidebar) {
        sidebar.classList.remove('active');
        document.getElementById('sidebar-overlay')?.classList.remove('active');
        document.body.classList.remove('no-scroll');
    }
});
