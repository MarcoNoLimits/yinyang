import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from typing import Optional, List, Dict, Any

# Import compiled swarm engine
from swarm import swarm_engine

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("main")

app = FastAPI(title="YinYang Swarm API Service — Fallen Universe", version="2.0.0")

# Enable CORS for React frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FALLEN_UNIVERSE_ID = "f0000000-0000-0000-0000-000000000001"

class SwarmRequest(BaseModel):
    """Legacy schema — kept for backwards compatibility."""
    session_id: str
    universe_id: str = FALLEN_UNIVERSE_ID
    char_id: Optional[int] = None
    char_name: Optional[str] = None
    char_personality: Optional[str] = None
    message: str

class ChatRequest(BaseModel):
    """Primary schema used by verify_swarm.py and the Fallen frontend."""
    session_id: str
    universe_id: str = FALLEN_UNIVERSE_ID
    player_input: str
    timeline_context: Optional[str] = ""
    char_id: Optional[int] = None
    char_name: Optional[str] = None
    char_personality: Optional[str] = None


@app.get("/")
def health_check():
    return {"status": "healthy", "service": "yinyang-swarm-engine"}

@app.post("/chat")
async def chat_swarm(payload: ChatRequest):
    logger.info(f"Received chat request for session {payload.session_id}")
    try:
        initial_state = {
            "session_id": payload.session_id,
            "universe_id": payload.universe_id,
            "char_id": payload.char_id,
            "char_name": payload.char_name,
            "char_personality": payload.char_personality,
            "player_input": payload.player_input,
            "timeline_context": payload.timeline_context,
            "extracted_keywords": [],
            "retrieved_lore": [],
            "master_prompt": "",
            "director_prose": "",
            "director_entity_updates": [],
            "sparks_new_entity": False,
            "critic_approved": False,
            "critic_feedback": "",
            "retry_count": 0,
            "final_dialogue": "",
            "extracted_summary": "",
            "state_deltas": {}
        }
        output_state = swarm_engine.invoke(initial_state)
        return {
            "session_id": output_state.get("session_id", payload.session_id),
            "universe_id": output_state.get("universe_id", payload.universe_id),
            "director_prose": output_state.get("director_prose", ""),
            "world_event": output_state.get("director_prose", ""),
            "critic_approved": output_state.get("critic_approved", True),
            "critic_feedback": output_state.get("critic_feedback", ""),
            "final_dialogue": output_state.get("final_dialogue", ""),
            "character_output": output_state.get("final_dialogue", ""),
            "extracted_summary": output_state.get("extracted_summary", ""),
            "retry_count": output_state.get("retry_count", 0),
        }
    except Exception as e:
        logger.error(f"Error executing chat graph: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/swarm")
async def run_swarm(payload: SwarmRequest):
    logger.info(f"Received swarm request for session {payload.session_id}, char {payload.char_name}")
    try:
        # 1. Initialize State
        initial_state = {
            "session_id": payload.session_id,
            "universe_id": payload.universe_id,
            "char_id": payload.char_id,
            "char_name": payload.char_name,
            "char_personality": payload.char_personality,
            "player_input": payload.message,
            
            "extracted_keywords": [],
            "retrieved_lore": [],
            "timeline_context": "",
            
            "master_prompt": "",
            "director_prose": "",
            "director_entity_updates": [],
            "sparks_new_entity": False,
            
            "critic_approved": False,
            "critic_feedback": "",
            "retry_count": 0,
            
            "final_dialogue": "",
            "extracted_summary": "",
            "state_deltas": {}
        }
        
        # 2. Run compiled LangGraph engine
        # Since it runs synchronous functions, we run it directly
        output_state = swarm_engine.invoke(initial_state)
        
        # 3. Format and return output
        return {
            "status": "success",
            "response": {
                "role": "assistant",
                "content": output_state.get("final_dialogue", "..."),
                "world_event": output_state.get("director_prose", "")
            }
        }
    except Exception as e:
        logger.error(f"Error executing swarm graph: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
