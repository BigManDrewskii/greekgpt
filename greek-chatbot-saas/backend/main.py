from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from models import get_db, engine
from models import Conversation, Message
from chatbot_service import GreekChatbotService
import uuid
from datetime import datetime

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ChatRequest(BaseModel):
    message: str
    session_id: str = None

class ChatResponse(BaseModel):
    response: str
    session_id: str

# Initialize chatbot service
chatbot_service = GreekChatbotService()

@app.get("/")
async def root():
    return {"message": "Greek Chatbot API"}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        # Create or get session
        if not request.session_id:
            session_id = str(uuid.uuid4())
            session = Conversation(session_id=session_id, created_at=datetime.utcnow())
            db.add(session)
            db.commit()
        else:
            session_id = request.session_id
            session = db.query(Conversation).filter(Conversation.session_id == session_id).first()
            if not session:
                session = Conversation(session_id=session_id, created_at=datetime.utcnow())
                db.add(session)
                db.commit()

        # Get response from chatbot
        response_text = chatbot_service.get_response(request.message)
        
        # Save messages
        user_message = Message(
            conversation_id=session.id,
            content=request.message,
            role='user',
            created_at=datetime.utcnow()
        )
        bot_message = Message(
            conversation_id=session.id,
            content=response_text,
            role='assistant',
            created_at=datetime.utcnow()
        )
        
        db.add(user_message)
        db.add(bot_message)
        db.commit()

        return ChatResponse(response=response_text, session_id=session_id)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, db: Session = Depends(get_db)):
    conversation = db.query(Conversation).filter(Conversation.session_id == session_id).first()
    if not conversation:
        return []
    
    messages = db.query(Message).filter(Message.conversation_id == conversation.id).order_by(Message.created_at).all()
    return [{"content": msg.content, "role": msg.role, "timestamp": msg.created_at} for msg in messages]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=3006)