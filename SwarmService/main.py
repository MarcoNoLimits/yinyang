import logging
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from typing import Optional, List, Dict, Any

# Import compiled swarm engine
from swarm import swarm_engine

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("main")

app = FastAPI(title="YinYang Swarm API Service — Fallen Universe", version="3.0.0")

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
    """Legacy schema — updated char_id to support UUID string."""
    session_id: str
    universe_id: str = FALLEN_UNIVERSE_ID
    char_id: Optional[str] = None
    char_name: Optional[str] = None
    char_personality: Optional[str] = None
    message: str

class ChatRequest(BaseModel):
    """Primary schema used by verify_swarm.py and the Fallen frontend."""
    session_id: str
    universe_id: str = FALLEN_UNIVERSE_ID
    player_input: str
    timeline_context: Optional[str] = ""
    char_id: Optional[str] = None
    char_name: Optional[str] = None
    char_personality: Optional[str] = None
    agent_override: Optional[str] = None
    chat_type: Optional[str] = None


@app.get("/")
def health_check():
    return {"status": "healthy", "service": "yinyang-swarm-engine", "version": "3.0.0"}

@app.post("/chat")
async def chat_swarm(payload: ChatRequest):
    logger.info(f"Received chat request for session {payload.session_id}")
    try:
        # Resolve agent override from chat_type mapping if not explicitly set
        agent_override = payload.agent_override
        if not agent_override and payload.chat_type:
            if payload.chat_type == "NPC_BUILDER":
                agent_override = "PERSONA_BLACKSMITH"
            elif payload.chat_type == "QUEST_DESIGNER":
                agent_override = "WORLDSMITH"
            elif payload.chat_type == "GRAND_ARBITER_SOLO":
                agent_override = "GRAND_ARBITER"

        initial_state = {
            "session_id": payload.session_id,
            "universe_id": payload.universe_id,
            "char_id": payload.char_id,
            "char_name": payload.char_name,
            "char_personality": payload.char_personality,
            "player_input": payload.player_input,
            "timeline_context": payload.timeline_context,
            "agent_override": agent_override,
            
            "extracted_keywords": [],
            "retrieved_lore": [],
            "player_character_ledger": {},
            
            "active_route": "NARRATIVE_DIRECTOR",
            "master_prompt": "",
            
            "scratchpad": "",
            "director_prose": "",
            "director_entity_updates": [],
            "sparks_new_entity": False,
            "agent_metadata": {},
            
            "critic_approved": False,
            "critic_feedback": "",
            "retry_count": 0,
            
            "final_dialogue": "",
            "extracted_summary": "",
            "state_deltas": {}
        }
        
        output_state = swarm_engine.invoke(initial_state)
        
        ledger = output_state.get("player_character_ledger", {})
        char_state = ledger.get("character", {})
        
        # Save active route and scratchpad in session state for reloads
        try:
            from db import get_session_state, update_session_state
            session_data = get_session_state(payload.session_id)
            current_state = session_data.get("current_state", {}) if session_data else {}
            current_state["active_route"] = output_state.get("active_route", "NARRATIVE_DIRECTOR")
            current_state["_scratchpad"] = output_state.get("scratchpad", "")
            if char_state.get("name"):
                current_state["char_id"] = payload.char_id or current_state.get("char_id")
            update_session_state(payload.session_id, payload.universe_id, current_state)
        except Exception as e:
            logger.error(f"Error persisting route/scratchpad in session: {e}")
            
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
            
            # v3 new fields
            "active_route": output_state.get("active_route", "NARRATIVE_DIRECTOR"),
            "scratchpad": output_state.get("scratchpad", ""),
            "agent_metadata": output_state.get("agent_metadata", {}),
            "character_state": char_state
        }
    except Exception as e:
        logger.error(f"Error executing chat graph: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/swarm")
async def run_swarm(payload: SwarmRequest):
    logger.info(f"Received swarm request for session {payload.session_id}, char {payload.char_name}")
    try:
        initial_state = {
            "session_id": payload.session_id,
            "universe_id": payload.universe_id,
            "char_id": payload.char_id,
            "char_name": payload.char_name,
            "char_personality": payload.char_personality,
            "player_input": payload.message,
            
            "extracted_keywords": [],
            "retrieved_lore": [],
            "player_character_ledger": {},
            
            "active_route": "NARRATIVE_DIRECTOR",
            "master_prompt": "",
            
            "scratchpad": "",
            "director_prose": "",
            "director_entity_updates": [],
            "sparks_new_entity": False,
            "agent_metadata": {},
            
            "critic_approved": False,
            "critic_feedback": "",
            "retry_count": 0,
            
            "final_dialogue": "",
            "extracted_summary": "",
            "state_deltas": {}
        }
        
        output_state = swarm_engine.invoke(initial_state)
        
        return {
            "status": "success",
            "response": {
                "role": "assistant",
                "content": output_state.get("final_dialogue", "..."),
                "world_event": output_state.get("director_prose", ""),
                "active_route": output_state.get("active_route", "NARRATIVE_DIRECTOR"),
                "scratchpad": output_state.get("scratchpad", "")
            }
        }
    except Exception as e:
        logger.error(f"Error executing swarm graph: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/chat/{session_id}/history")
async def get_history(session_id: str):
    logger.info(f"Retrieving chat history for session {session_id}")
    try:
        from db import get_chat_history, get_session_state, get_combat_state, get_player_character
        history = get_chat_history(session_id, limit=50)
        
        session_data = get_session_state(session_id)
        char_state = {}
        char_id = None
        active_route = "NARRATIVE_DIRECTOR"
        scratchpad = ""
        
        if session_data:
            universe_id = session_data.get("universe_id")
            current_state = session_data.get("current_state", {})
            char_id = current_state.get("char_id")
            active_route = current_state.get("active_route", "NARRATIVE_DIRECTOR")
            scratchpad = current_state.get("_scratchpad", "")
            
            if char_id:
                combat = get_combat_state(session_id, char_id)
                char_data = get_player_character(universe_id, char_id)
                if char_data:
                    base_vit = 10
                    xp = char_data.get("points", {}).get("XP", 0)
                    if xp >= 50000: base_vit = 20
                    elif xp >= 35000: base_vit = 18
                    elif xp >= 25000: base_vit = 16
                    elif xp >= 15000: base_vit = 14
                    elif xp >= 8000: base_vit = 12
                    elif xp >= 2000: base_vit = 11
                    
                    stats = char_data.get("stats", {})
                    faction = char_data.get("faction", "Unknown")
                    points = char_data.get("points", {})
                    inventory = char_data.get("inventory", [])
                    
                    # 1. stats ledger
                    stats_ledger = {}
                    for stat_name, stat_val in stats.items():
                        category = "normal"
                        if faction == "Occulte" and stat_name in ["Puissance", "Réserve"]: category = "strong"
                        elif faction == "Sainteté" and stat_name in ["Puissance", "Réserve"]: category = "strong"
                        elif faction == "Honneur" and stat_name in ["Force", "Résistance"]: category = "strong"
                        elif faction == "Ange" and stat_name in ["Puissance", "Charisme"]: category = "strong"
                        elif faction == "Sang-pur" and stat_name in ["Vitesse", "Force"]: category = "strong"
                        elif faction == "Viking" and stat_name in ["Force", "Endurance"]: category = "strong"
                        elif faction == "Démon" and stat_name in ["Puissance", "Force"]: category = "strong"
                        elif faction == "Esprit" and stat_name in ["Réserve", "Réactivité"]: category = "strong"
                        
                        stats_ledger[stat_name] = {
                            "value": stat_val,
                            "category": category,
                            "visibility": "VISIBLE"
                        }
                    
                    # 2. equipment ledger
                    equipment_ledger = {
                        "weapon": {"name": "Épée standard", "material": "fer", "visibility": "VISIBLE"},
                        "armor": {"name": "Armure standard", "material": "fer", "visibility": "VISIBLE"},
                        "hidden_items": []
                    }
                    parsed_inventory = []
                    if isinstance(inventory, list):
                        for item in inventory:
                            item_name = item if isinstance(item, str) else item.get("name", "Objet")
                            is_hidden = "secr" in item_name.lower() or "cach" in item_name.lower() or "dague" in item_name.lower()
                            visibility = "HIDDEN" if is_hidden else "VISIBLE"
                            if any(x in item_name.lower() for x in ["épée", "lame", "dague", "bâton", "arc"]):
                                equipment_ledger["weapon"] = {"name": item_name, "material": "acier" if "acier" in item_name.lower() else "fer", "visibility": visibility}
                            elif any(x in item_name.lower() for x in ["armure", "robe", "cuirasse", "tunique"]):
                                equipment_ledger["armor"] = {"name": item_name, "material": "acier" if "acier" in item_name.lower() else "fer", "visibility": visibility}
                            else:
                                parsed_inventory.append({"name": item_name, "visibility": visibility})
                    equipment_ledger["hidden_items"] = [item for item in parsed_inventory if item["visibility"] == "HIDDEN"]
                    
                    # 3. techniques
                    techniques = points.get("techniques", [])
                    if not techniques and isinstance(inventory, list):
                        techniques = [item for item in inventory if isinstance(item, dict) and item.get("type") in ["sort", "technique"]]
                    
                    if not techniques:
                        if faction == "Occulte":
                            techniques = [
                                {"name": "Ombre Mortelle", "rank": "A", "type": "magical", "description": "Projectile d'énergie sombre."},
                                {"name": "Voile de Malakath", "rank": "S", "type": "magical", "description": "Invisibilité totale pendant 3 tours."}
                            ]
                        elif faction == "Sainteté":
                            techniques = [
                                {"name": "Lumière Céleste", "rank": "A", "type": "magical", "description": "Soin de zone moyen."},
                                {"name": "Rayon de Gloire", "rank": "S", "type": "magical", "description": "Rayon laser de magie blanche."}
                            ]
                        else:
                            techniques = [
                                {"name": "Frappe Lourde", "rank": "B", "type": "physical", "description": "Coup surpuissant au corps à corps."}
                            ]
                            
                    tech_names = [t.get("name", "") for t in techniques]
                    from db import get_revealed_techniques
                    revealed_techs = get_revealed_techniques(session_id, tech_names)
                    
                    techniques_ledger = []
                    for tech in techniques:
                        name = tech.get("name", "Sort")
                        visibility = "REVEALED" if name in revealed_techs else "HIDDEN"
                        techniques_ledger.append({
                            "name": name,
                            "rank": tech.get("rank", "B"),
                            "type": tech.get("type", "magical"),
                            "cost": tech.get("cost", {"reserve": 0.5} if tech.get("type") == "magical" else {"endurance": 0.5}),
                            "visibility": visibility,
                            "description": tech.get("description", "")
                        })
                    
                    # 4. resource pools
                    current_vit = base_vit
                    current_end = stats.get("Endurance", 8)
                    current_res = stats.get("Réserve", 8)
                    if combat:
                        current_vit = combat.get("current_vitality", current_vit)
                        current_end = float(combat.get("current_endurance", current_end))
                        current_res = float(combat.get("current_reserve", current_res))
                        
                    char_state = {
                        "name": char_data.get("char_name", "Inconnu"),
                        "faction": faction,
                        "rank": char_data.get("points", {}).get("Rang", "Rang 1"),
                        "stats": stats_ledger,
                        "resource_pools": {
                            "vitality": {"current": current_vit, "max": base_vit},
                            "endurance": {"current": current_end, "max": stats.get("Endurance", 8)},
                            "reserve": {"current": current_res, "max": stats.get("Réserve", 8)}
                        },
                        "techniques": techniques_ledger,
                        "equipment": equipment_ledger,
                        "fortune": char_data.get("fortune", 50000)
                    }
        
        formatted_history = []
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            fe_role = "player" if role == "user" else "director"
            
            formatted_history.append({
                "id": str(uuid.uuid4()),
                "role": fe_role,
                "content": content,
                "timestamp": None
            })
            
        return {
            "history": formatted_history,
            "char_id": char_id,
            "character_state": char_state,
            "active_route": active_route,
            "scratchpad": scratchpad
        }
    except Exception as e:
        logger.error(f"Error retrieving chat history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/{session_id}/clear")
async def clear_history(session_id: str):
    logger.info(f"Clearing chat history for session {session_id}")
    try:
        from db import clear_chat_history
        clear_chat_history(session_id)
        return {"status": "success", "message": f"History cleared for session {session_id}"}
    except Exception as e:
        logger.error(f"Error clearing chat history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
