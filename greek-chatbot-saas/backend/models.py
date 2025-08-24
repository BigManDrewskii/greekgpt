from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy import create_engine
from datetime import datetime

Base = declarative_base()

# Database configuration
DATABASE_URL = "sqlite:///./greek_chatbot.db"

# Create engine
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Subscription details
    subscription_tier = Column(String, default="free")
    subscription_end_date = Column(DateTime)
    monthly_message_limit = Column(Integer, default=100)
    current_month_messages = Column(Integer, default=0)
    
    # Relationships
    chatbots = relationship("Chatbot", back_populates="owner")
    conversations = relationship("Conversation", back_populates="user")
    analytics = relationship("Analytics", back_populates="user")

class Chatbot(Base):
    __tablename__ = "chatbots"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    system_prompt = Column(Text)
    welcome_message = Column(String)
    avatar_url = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Foreign keys
    owner_id = Column(Integer, ForeignKey("users.id"))
    
    # Configuration
    model_config = Column(JSON, default={"model": "gpt-3.5-turbo", "temperature": 0.7})
    knowledge_base = Column(JSON, default={"documents": [], "urls": []})
    custom_instructions = Column(Text)
    
    # Relationships
    owner = relationship("User", back_populates="chatbots")
    conversations = relationship("Conversation", back_populates="chatbot")
    analytics = relationship("Analytics", back_populates="chatbot")

class Conversation(Base):
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, index=True)
    title = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Foreign keys
    user_id = Column(Integer, ForeignKey("users.id"))
    chatbot_id = Column(Integer, ForeignKey("chatbots.id"))
    
    # Relationships
    user = relationship("User", back_populates="conversations")
    chatbot = relationship("Chatbot", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    role = Column(String)  # 'user' or 'assistant'
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Foreign keys
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")

class Analytics(Base):
    __tablename__ = "analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    chatbot_id = Column(Integer, ForeignKey("chatbots.id"), nullable=False)
    event_type = Column(String(50), nullable=False)  # 'message_sent', 'user_engagement', etc.
    event_data = Column(JSON, nullable=True)
    analytics_metadata = Column(JSON, nullable=True)  # Additional metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="analytics")
    chatbot = relationship("Chatbot", back_populates="analytics")

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float)
    currency = Column(String, default="EUR")
    payment_method = Column(String)
    payment_status = Column(String)  # 'pending', 'completed', 'failed'
    stripe_payment_intent_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Create all tables
Base.metadata.create_all(bind=engine)