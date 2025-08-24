import openai
import json
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from models import Chatbot, Conversation, Message
import redis
import os
from datetime import datetime

class GreekChatbotService:
    def __init__(self):
        openai.api_key = os.getenv("OPENAI_API_KEY")
        self.redis_client = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            db=0,
            decode_responses=True
        )
        
        # Greek-specific system prompts
        self.greek_system_prompts = {
            "customer_service": """Είστε ένας φιλικός Ελληνικός βοηθός εξυπηρέτησης πελατών. 
            Μιλάτε απλά και κατανοητά, χωρίς τεχνικούς όρους. 
            Είστε υπομονετικός και βοηθάτε τους χρήστες βήμα-βήμα.
            Απαντάτε πάντα στα Ελληνικά.""",
            
            "business_assistant": """Είστε ένας επαγγελματικός βοηθός για Ελληνικές επιχειρήσεις.
            Παρέχετε σαφείς και χρήσιμες πληροφορίες για επιχειρηματικά θέματα.
            Είστε ευγενικός και επαγγελματικός.""",
            
            "general": """Είστε ένας φιλικός Ελληνικός βοηθός.
            Μιλάτε απλά και κατανοητά για όλους.
            Είστε υπομονετικός και βοηθάτε με κάθε ερώτηση."""
        }

    async def create_chatbot(self, db: Session, user_id: int, chatbot_data: dict) -> Chatbot:
        """Create a new chatbot with Greek-specific configuration"""
        
        # Set default Greek system prompt based on type
        system_prompt = self.greek_system_prompts.get(
            chatbot_data.get('type', 'general'),
            self.greek_system_prompts['general']
        )
        
        if chatbot_data.get('custom_instructions'):
            system_prompt += f"\n\n{chatbot_data['custom_instructions']}"
        
        chatbot = Chatbot(
            name=chatbot_data['name'],
            description=chatbot_data.get('description', ''),
            system_prompt=system_prompt,
            welcome_message=chatbot_data.get('welcome_message', 'Γεια σας! Πώς μπορώ να σας βοηθήσω σήμερα;'),
            owner_id=user_id,
            model_config={
                "model": chatbot_data.get('model', 'gpt-3.5-turbo'),
                "temperature": chatbot_data.get('temperature', 0.7),
                "max_tokens": chatbot_data.get('max_tokens', 500)
            }
        )
        
        db.add(chatbot)
        db.commit()
        db.refresh(chatbot)
        
        return chatbot

    async def generate_response(self, db: Session, chatbot_id: int, message: str, 
                              conversation_id: Optional[int] = None) -> Dict:
        """Generate AI response with Greek context"""
        
        chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        if not chatbot:
            raise ValueError("Chatbot not found")
        
        # Get or create conversation
        if conversation_id:
            conversation = db.query(Conversation).filter(
                Conversation.id == conversation_id,
                Conversation.chatbot_id == chatbot_id
            ).first()
            if not conversation:
                conversation = self._create_conversation(db, chatbot_id, None)
        else:
            conversation = self._create_conversation(db, chatbot_id, None)
        
        # Get conversation history
        messages = db.query(Message).filter(
            Message.conversation_id == conversation.id
        ).order_by(Message.created_at.desc()).limit(10).all()
        
        # Build conversation context
        conversation_history = []
        for msg in reversed(messages):
            conversation_history.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # Add system prompt
        system_message = {
            "role": "system",
            "content": chatbot.system_prompt
        }
        
        # Build messages for OpenAI
        openai_messages = [system_message] + conversation_history + [{
            "role": "user",
            "content": message
        }]
        
        try:
            # Generate response
            response = openai.ChatCompletion.create(
                model=chatbot.model_config.get('model', 'gpt-3.5-turbo'),
                messages=openai_messages,
                temperature=chatbot.model_config.get('temperature', 0.7),
                max_tokens=chatbot.model_config.get('max_tokens', 500)
            )
            
            assistant_message = response.choices[0].message.content
            
            # Save messages
            user_msg = Message(
                conversation_id=conversation.id,
                content=message,
                role="user"
            )
            assistant_msg = Message(
                conversation_id=conversation.id,
                content=assistant_message,
                role="assistant"
            )
            
            db.add(user_msg)
            db.add(assistant_msg)
            db.commit()
            
            # Update conversation
            conversation.updated_at = datetime.utcnow()
            db.commit()
            
            return {
                "response": assistant_message,
                "conversation_id": conversation.id,
                "chatbot_id": chatbot_id
            }
            
        except Exception as e:
            # Fallback response in Greek
            return {
                "response": "Συγγνώμη, αντιμετωπίζω ένα πρόβλημα αυτή τη στιγμή. Παρακαλώ δοκιμάστε ξανά σε λίγα λεπτά.",
                "conversation_id": conversation.id,
                "chatbot_id": chatbot_id,
                "error": str(e)
            }

    def _create_conversation(self, db: Session, chatbot_id: int, user_id: int) -> Conversation:
        """Create a new conversation"""
        import uuid
        
        conversation = Conversation(
            session_id=str(uuid.uuid4()),
            title="Νέα Συζήτηση",
            user_id=user_id,
            chatbot_id=chatbot_id
        )
        
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        
        return conversation

    async def get_chatbot_analytics(self, db: Session, chatbot_id: int, days: int = 30) -> Dict:
        """Get analytics for a chatbot"""
        
        from datetime import datetime, timedelta
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        conversations = db.query(Conversation).filter(
            Conversation.chatbot_id == chatbot_id,
            Conversation.created_at >= start_date
        ).all()
        
        total_messages = 0
        for conversation in conversations:
            messages = db.query(Message).filter(
                Message.conversation_id == conversation.id
            ).count()
            total_messages += messages
        
        return {
            "total_conversations": len(conversations),
            "total_messages": total_messages,
            "average_messages_per_conversation": total_messages / max(len(conversations), 1),
            "period_days": days
        }

    async def update_chatbot_config(self, db: Session, chatbot_id: int, config: dict) -> Chatbot:
        """Update chatbot configuration"""
        
        chatbot = db.query(Chatbot).filter(Chatbot.id == chatbot_id).first()
        if not chatbot:
            raise ValueError("Chatbot not found")
        
        for key, value in config.items():
            if hasattr(chatbot, key):
                setattr(chatbot, key, value)
        
        chatbot.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(chatbot)
        
        return chatbot