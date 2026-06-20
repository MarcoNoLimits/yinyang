import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import compiled swarm engine
from swarm import swarm_engine

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("main")

app = FastAPI(title="YinYang Swarm API Service", version="1.0.0")

# Enable CORS for React frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SwarmRequest(BaseModel):
    session_id: str
    universe_id: str = "00000000-0000-0000-0000-000000000001"
    char_id: int
    char_name: str
    char_personality: str
    message: str

@app.get("/")
def health_check():
    return {"status": "healthy", "service": "yinyang-swarm-engine"}

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
