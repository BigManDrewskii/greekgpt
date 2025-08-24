# Greek Chatbot Testing Guide

This document provides a systematic testing procedure to verify all features of the refactored Greek Chatbot interface.

## 1. Initial Setup Testing

- [ ] Verify the application loads correctly with proper styling
- [ ] Confirm the sidebar and main chat area are displayed correctly
- [ ] Check that dark/light mode is applied based on saved preferences
- [ ] Verify the welcome message appears in new chats

## 2. OpenRouter API Integration

- [ ] Open settings modal and ensure API key field exists
- [ ] Add a valid OpenRouter API key
- [ ] Verify the key is saved when clicking "Save" button
- [ ] Check that the key is masked by default with toggle option

## 3. Model Selection

- [ ] Open settings modal and verify all models appear in dropdown:
  - Llama 3.1 8B Instruct
  - GPT-3.5 Turbo
  - Claude 3 Haiku
  - Google Gemini Pro
  - Mistral 7B Instruct
  - Mistral Small
- [ ] Select a different model and save
- [ ] Send a test message to verify the new model is used
- [ ] Verify the model selection persists after page reload

## 4. Streaming Response Testing

- [ ] Send a message requesting a longer response (e.g., "Tell me about Ancient Greece in detail")
- [ ] Verify text appears incrementally rather than all at once
- [ ] Check that the loading indicator disappears when response is complete
- [ ] Test response cancellation by clicking "New Chat" during streaming

## 5. Conversation Management

- [ ] Create multiple new chats by clicking the "New Chat" button
- [ ] Verify all chats appear in the sidebar with correct titles
- [ ] Test renaming a chat by clicking the pencil icon
- [ ] Verify the renamed chat displays the new title
- [ ] Test deleting a chat and confirm it's removed from the sidebar
- [ ] Switch between chats and verify correct messages are displayed

## 6. Language & UI Features

- [ ] Toggle between Greek and English language preference
- [ ] Verify system prompts change language appropriately
- [ ] Test dark/light theme toggle and verify UI updates
- [ ] Check mobile responsiveness by resizing browser window
- [ ] Verify sidebar collapses and menu button appears on mobile width
- [ ] Test clicking on example prompts in the welcome message

## 7. Error Handling

- [ ] Test with invalid API key and verify error message
- [ ] Disconnect from internet and test error handling for network issues
- [ ] Submit empty messages and verify send button is disabled

## 8. Security Testing

- [ ] Verify API key is not exposed in network requests (check Headers)
- [ ] Confirm API key is stored securely in localStorage (encrypted)
- [ ] Test XSS prevention by sending messages with HTML/script tags

## 9. Performance Testing

- [ ] Test with long conversations (10+ messages)
- [ ] Verify scrolling and rendering performance remains smooth
- [ ] Check memory usage during extended usage sessions

## Bug Reporting

If any issues are found during testing, document them with:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable
- Browser/device information
