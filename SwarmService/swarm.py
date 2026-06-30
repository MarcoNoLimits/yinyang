import logging
import uuid
import json
from typing import List, Dict, Any, TypedDict, Optional
from langgraph.graph import StateGraph, END

# Import custom modules
from db import (
    retrieve_lore_entries, 
    update_entity_state, 
    add_timeline_event, 
    get_timeline_history,
    get_session_state,
    update_session_state,
    get_chat_history,
    push_chat_message,
    sync_ledger_transaction,
    get_entities_by_type,
    get_universe,
    get_player_character,
    get_combat_state,
    upsert_combat_state
)
from agents import (
    run_scanner_agent,
    run_critic_agent,
    run_persona_agent,
    run_chronicler_agent,
    run_soul_forger,
    run_itemizer,
    run_quest_architect,
    run_narrative_director_v3,
    run_worldsmith,
    run_persona_blacksmith,
    run_grand_arbiter
)
from router import classify_intent

logger = logging.getLogger("swarm")

class SwarmState(TypedDict):
    session_id: str
    universe_id: str
    char_id: Optional[str]
    char_name: Optional[str]
    char_personality: Optional[str]
    player_input: str
    agent_override: Optional[str]
    
    extracted_keywords: List[str]
    retrieved_lore: List[Dict[str, Any]]
    timeline_context: str
    player_character_ledger: Dict[str, Any]   # v3: Anti-metagaming ledger
    
    active_route: str                         # v3: Classified route (NARRATIVE_DIRECTOR, etc.)
    master_prompt: str
    
    scratchpad: str                           # v3: Hidden scratchpad text
    director_prose: str                       # User-facing prose
    director_entity_updates: List[Dict[str, Any]]
    sparks_new_entity: bool
    agent_metadata: Dict[str, Any]            # v3: Agent specific JSON metadata/rulings
    
    critic_approved: bool
    critic_feedback: str
    retry_count: int
    
    final_dialogue: str
    
    extracted_summary: str
    state_deltas: Dict[str, Any]

# --- Node Implementation Functions ---

def run_keyword_scanner(state: SwarmState) -> Dict[str, Any]:
    """Scanner Agent Node: Extracts search keywords from input."""
    logger.info("Running Scanner Node...")
    keywords = run_scanner_agent(state["player_input"])
    return {"extracted_keywords": keywords}

def run_lore_librarian(state: SwarmState) -> Dict[str, Any]:
    """Librarian Node: Fetches lore matching keywords from PostgreSQL."""
    logger.info("Running Librarian Node...")
    universe_id = state.get("universe_id", "00000000-0000-0000-0000-000000000001")
    keywords = state.get("extracted_keywords", [])
    lore_entries = retrieve_lore_entries(universe_id, keywords)
    return {"retrieved_lore": lore_entries}

def run_prompt_weaver(state: SwarmState) -> Dict[str, Any]:
    """Weaver Node: Assembles historical timeline, chat logs, lore, and Character Ledger."""
    logger.info("Running Weaver Node...")
    session_id = state["session_id"]
    universe_id = state.get("universe_id", "f0000000-0000-0000-0000-000000000001")
    char_id = state.get("char_id")
    
    # 1. Fetch rolling chat history from Redis/Postgres
    history = get_chat_history(session_id, limit=6)
    history_str = "\n".join([f"{h['role']}: {h['content']}" for h in history])
    
    # 2. Fetch timeline history context from Postgres
    timeline_events = get_timeline_history(universe_id, limit=5)
    db_timeline_str = "\n".join([f"- {evt['event_summary']}" for evt in timeline_events])

    injected_context = state.get("timeline_context", "") or ""
    if db_timeline_str and injected_context:
        timeline_str = f"{injected_context}\n\n[WORLD TIMELINE]\n{db_timeline_str}"
    elif db_timeline_str:
        timeline_str = db_timeline_str
    elif injected_context:
        timeline_str = injected_context
    else:
        timeline_str = "No events recorded in the timeline yet."
        
    # 3. Format lore
    lore_str = "\n".join([f"[{entry['title']}]: {entry['content']}" for entry in state.get("retrieved_lore", [])])
    
    # 4. Fetch universe setting details
    universe_data = get_universe(universe_id)
    universe_desc = ""
    if universe_data:
        universe_desc = f"UNIVERSE: {universe_data.get('name', 'Unknown')}\nDESCRIPTION: {universe_data.get('description', '')}"
    else:
        universe_desc = "UNIVERSE: Unknown"

    # 5. Fetch active quests
    active_quests = get_entities_by_type(universe_id, "QUEST")
    quests_str = "\n".join([f"- {q['name']}: {q['properties']}" for q in active_quests])
    if not quests_str:
        quests_str = "No active quests."

    # 6. Companion context is optional
    companion_str = ""
    if state.get("char_name"):
        companion_str = f"ACTIVE COMPANION:\nName: {state['char_name']}\nPersonality: {state.get('char_personality', '')}\n\n"

    # 7. Assembling Player Character Ledger (v3 Anti-Metagaming Ledger)
    ledger = {}
    if char_id:
        char_data = get_player_character(universe_id, char_id)
        if char_data:
            faction = char_data.get("faction", "Unknown")
            stats = char_data.get("stats", {})
            points = char_data.get("points", {})
            inventory = char_data.get("inventory", [])
            
            stats_ledger = {}
            for stat_name, stat_val in stats.items():
                category = "normal"
                if faction == "Occulte" and stat_name in ["Puissance", "Réserve"]:
                    category = "strong"
                elif faction == "Sainteté" and stat_name in ["Puissance", "Réserve"]:
                    category = "strong"
                elif faction == "Honneur" and stat_name in ["Force", "Résistance"]:
                    category = "strong"
                elif faction == "Ange" and stat_name in ["Puissance", "Charisme"]:
                    category = "strong"
                elif faction == "Sang-pur" and stat_name in ["Vitesse", "Force"]:
                    category = "strong"
                elif faction == "Viking" and stat_name in ["Force", "Endurance"]:
                    category = "strong"
                elif faction == "Démon" and stat_name in ["Puissance", "Force"]:
                    category = "strong"
                elif faction == "Esprit" and stat_name in ["Réserve", "Réactivité"]:
                    category = "strong"
                
                stats_ledger[stat_name] = {
                    "value": stat_val,
                    "category": category,
                    "visibility": "VISIBLE"
                }
            
            # Base pools and Rank calculations
            base_vit = 10
            xp = points.get("XP", 0)
            if xp >= 50000:
                rank = "Apôtre divin"
                base_vit = 20
            elif xp >= 35000:
                rank = "God Hand"
                base_vit = 18
            elif xp >= 25000:
                rank = "Éveillé"
                base_vit = 16
            elif xp >= 15000:
                rank = "Rang 6 (Élu)"
                base_vit = 14
            elif xp >= 8000:
                rank = "Rang 5"
                base_vit = 12
            elif xp >= 4000:
                rank = "Rang 4"
                base_vit = 11
            elif xp >= 2000:
                rank = "Rang 3"
                base_vit = 11
            else:
                rank = "Rang 2" if xp >= 1000 else "Rang 1"
                base_vit = 10
            
            # Equipment visibility
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
            
            # Techniques from points/inventory
            techniques = points.get("techniques", [])
            if not techniques and isinstance(inventory, list):
                techniques = [item for item in inventory if isinstance(item, dict) and item.get("type") in ["sort", "technique"]]
            
            if not techniques:
                # Heuristic fallback techniques per faction
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

            # Fetch combat state pools
            current_vit = base_vit
            current_end = stats.get("Endurance", 8)
            current_res = stats.get("Réserve", 8)
            
            combat_state = get_combat_state(session_id, char_id)
            if combat_state:
                current_vit = combat_state.get("current_vitality", current_vit)
                current_end = float(combat_state.get("current_endurance", current_end))
                current_res = float(combat_state.get("current_reserve", current_res))
            else:
                # Initialize combat state
                upsert_combat_state(session_id, char_id, current_vit, current_end, current_res)
            
            ledger = {
                "character": {
                    "name": char_data.get("char_name", "Inconnu"),
                    "faction": faction,
                    "rank": rank,
                    "rank_tier": "elu" if "Élu" in rank or "Apôtre" in rank or "Eveille" in rank or "Hand" in rank else "pre-elu",
                    "stats": stats_ledger,
                    "resource_pools": {
                        "vitality": {"current": current_vit, "max": base_vit},
                        "endurance": {"current": current_end, "max": stats.get("Endurance", 8)},
                        "reserve": {"current": current_res, "max": stats.get("Réserve", 8)}
                    },
                    "techniques": techniques_ledger,
                    "equipment": equipment_ledger,
                    "points": {k: v for k, v in points.items() if k not in ["techniques"]},
                    "fortune": char_data.get("fortune", 50000)
                },
                "anti_metagaming_rules": [
                    "NPCs cannot reference HIDDEN techniques/items unless the player has used them in their presence.",
                    "Enemy tactics should be calibrated to the player's VISIBLE stats/resources only."
                ]
            }

    if not ledger:
        # Default fallback ledger
        ledger = {
            "character": {
                "name": state.get("char_name") or "Voyageur",
                "faction": "Hors-la-loi",
                "rank": "Rang 1",
                "stats": {},
                "resource_pools": {
                    "vitality": {"current": 10, "max": 10},
                    "endurance": {"current": 10, "max": 10},
                    "reserve": {"current": 10, "max": 10}
                },
                "techniques": [],
                "equipment": {}
            }
        }

    master_prompt = (
        f"{companion_str}"
        f"UNIVERSE SETTING:\n{universe_desc}\n\n"
        f"ACTIVE QUESTS:\n{quests_str}\n\n"
        f"LOREBOOK DETAILS:\n{lore_str}\n\n"
        f"TIMELINE CONTEXT:\n{timeline_str}\n\n"
        f"RECENT HISTORY:\n{history_str}\n\n"
        f"PLAYER ACTION:\n{state['player_input']}\n"
    )
    
    return {
        "master_prompt": master_prompt, 
        "timeline_context": timeline_str,
        "player_character_ledger": ledger
    }

def run_intent_router_node(state: SwarmState) -> Dict[str, Any]:
    """Router Node: Classifies player intent into one of four nodes."""
    logger.info("Running Intent Router Node...")
    override = state.get("agent_override")
    if override and override in {"NARRATIVE_DIRECTOR", "WORLDSMITH", "PERSONA_BLACKSMITH", "GRAND_ARBITER"}:
        logger.info(f"Using manual agent override: {override}")
        return {"active_route": override}
    route = classify_intent(state["master_prompt"], state["player_input"])
    return {"active_route": route}

# --- Four Isolated Agent Nodes ---

def run_narrative_director_node(state: SwarmState) -> Dict[str, Any]:
    """Narrative Director Node (v3): Main game loops & actions."""
    logger.info("Running Narrative Director (v3) Node...")
    universe_id = state.get("universe_id", "f0000000-0000-0000-0000-000000000001")
    master_prompt = state["master_prompt"]
    ledger = state["player_character_ledger"]
    
    if state.get("retry_count", 0) > 0:
        master_prompt += f"\n\nCRITIC FEEDBACK: Please adjust. {state['critic_feedback']}"
        
    res = run_narrative_director_v3(master_prompt, "", ledger)
    
    prose = res.get("director_prose", "")
    updates = res.get("director_entity_updates", [])
    sparks = res.get("sparks_new_entity", False)
    
    # Forge spawning triggers
    if sparks:
        logger.info("Forge Tier Triggered: Constructing new assets...")
        npc_data = run_soul_forger("Eldred the Mageseeker", prose)
        if npc_data and "name" in npc_data:
            update_entity_state(universe_id, npc_data["name"], "NPC", npc_data)
            
        item_data = run_itemizer("Shard of Petricite", prose)
        if item_data and "item_name" in item_data:
            update_entity_state(universe_id, item_data["item_name"], "ITEM", item_data)
            
        quest_data = run_quest_architect("Escape from Demacia gate", prose)
        
    return {
        "scratchpad": res.get("scratchpad", ""),
        "director_prose": prose, 
        "director_entity_updates": updates, 
        "sparks_new_entity": sparks,
        "agent_metadata": res.get("agent_metadata", {})
    }

def run_worldsmith_node(state: SwarmState) -> Dict[str, Any]:
    """Worldsmith Node (v3): Maps & environment layout creation."""
    logger.info("Running Worldsmith (v3) Node...")
    universe_id = state.get("universe_id", "f0000000-0000-0000-0000-000000000001")
    master_prompt = state["master_prompt"]
    ledger = state["player_character_ledger"]
    
    if state.get("retry_count", 0) > 0:
        master_prompt += f"\n\nCRITIC FEEDBACK: Please adjust. {state['critic_feedback']}"
        
    res = run_worldsmith(master_prompt, ledger)
    
    prose = res.get("director_prose", "")
    sparks = res.get("sparks_new_entity", False)
    metadata = res.get("agent_metadata", {})
    
    # Save newly generated entities to the db ledger
    if sparks and "generated_entities" in metadata:
        for ent in metadata["generated_entities"]:
            name = ent.get("name")
            ent_type = ent.get("entity_type", "LOCATION")
            if name:
                update_entity_state(universe_id, name, ent_type, ent.get("properties", {}))
                logger.info(f"Worldsmith registered new entity: {name} ({ent_type})")
                
    return {
        "scratchpad": res.get("scratchpad", ""),
        "director_prose": prose,
        "director_entity_updates": [],
        "sparks_new_entity": sparks,
        "agent_metadata": metadata
    }

def run_persona_blacksmith_node(state: SwarmState) -> Dict[str, Any]:
    """Persona Blacksmith Node (v3): NPC sheet generation."""
    logger.info("Running Persona Blacksmith (v3) Node...")
    universe_id = state.get("universe_id", "f0000000-0000-0000-0000-000000000001")
    master_prompt = state["master_prompt"]
    ledger = state["player_character_ledger"]
    
    if state.get("retry_count", 0) > 0:
        master_prompt += f"\n\nCRITIC FEEDBACK: Please adjust. {state['critic_feedback']}"
        
    res = run_persona_blacksmith(master_prompt, ledger)
    
    prose = res.get("director_prose", "")
    sparks = res.get("sparks_new_entity", False)
    metadata = res.get("agent_metadata", {})
    
    if sparks and "npc_profile" in metadata:
        npc = metadata["npc_profile"]
        name = npc.get("name")
        if name:
            update_entity_state(universe_id, name, "NPC", npc)
            logger.info(f"Persona Blacksmith forged NPC: {name}")
            
    return {
        "scratchpad": res.get("scratchpad", ""),
        "director_prose": prose,
        "director_entity_updates": [],
        "sparks_new_entity": sparks,
        "agent_metadata": metadata
    }

def run_grand_arbiter_node(state: SwarmState) -> Dict[str, Any]:
    """Grand Arbiter Node (v3): Mechanics and rules check."""
    logger.info("Running Grand Arbiter (v3) Node...")
    master_prompt = state["master_prompt"]
    ledger = state["player_character_ledger"]
    
    if state.get("retry_count", 0) > 0:
        master_prompt += f"\n\nCRITIC FEEDBACK: Please adjust. {state['critic_feedback']}"
        
    res = run_grand_arbiter(master_prompt, ledger)
    
    return {
        "scratchpad": res.get("scratchpad", ""),
        "director_prose": res.get("director_prose", ""),
        "director_entity_updates": res.get("director_entity_updates", []),
        "sparks_new_entity": False,
        "agent_metadata": res.get("agent_metadata", {})
    }

# --- Critic, Persona, Chronicler & Ledger Guard Nodes ---

def run_continuity_critic(state: SwarmState) -> Dict[str, Any]:
    """Critic Node: Evaluates Director's output for contradictions."""
    logger.info("Running Continuity Critic Node...")
    
    # Bypass Critic if active_route is GRAND_ARBITER or agent_override is GRAND_ARBITER
    active_route = state.get("active_route")
    agent_override = state.get("agent_override")
    if active_route == "GRAND_ARBITER" or agent_override == "GRAND_ARBITER":
        logger.info("Grand Arbiter active. Bypassing Continuity Critic validation.")
        return {
            "critic_approved": True,
            "critic_feedback": "",
            "retry_count": state.get("retry_count", 0)
        }
        
    prose = state["director_prose"]
    timeline = state["timeline_context"]
    
    res = run_critic_agent(prose, timeline)
    approved = res.get("approved", True)
    feedback = res.get("correction_reason", "")
    
    retry_count = state.get("retry_count", 0)
    if not approved:
        retry_count += 1
        logger.warning(f"Critic REJECTED draft (Attempt {retry_count}). Reason: {feedback}")
    else:
        logger.info("Critic APPROVED draft.")
        
    return {
        "critic_approved": approved,
        "critic_feedback": feedback,
        "retry_count": retry_count
    }

def run_persona_emulator(state: SwarmState) -> Dict[str, Any]:
    """Persona Node: Emulates character voice over approved narrative outcome."""
    logger.info("Running Persona Emulator Node...")
    char_name = state.get("char_name")
    char_personality = state.get("char_personality", "")
    outcome = state["director_prose"]
    player_input = state["player_input"]
    
    if char_name:
        logger.info(f"Emulating companion character: {char_name}")
        dialogue = run_persona_agent(char_name, char_personality, outcome, player_input)
        return {"final_dialogue": dialogue}
        
    # Check if an NPC is speaking in the Director's output
    universe_id = state.get("universe_id", "f0000000-0000-0000-0000-000000000001")
    npcs = get_entities_by_type(universe_id, "NPC")
    
    prose_lower = outcome.lower()
    speaking_npc = None
    
    for npc in npcs:
        npc_name = npc["name"]
        if npc_name.lower() in prose_lower:
            dialogue_indicators = ["say", "yell", "whisper", "shout", "call", "ask", "tell", "speak", "voice", "mutter", "cry"]
            has_dialogue = '"' in outcome or "'" in outcome or any(ind in prose_lower for ind in dialogue_indicators)
            if has_dialogue:
                speaking_npc = npc
                break
                
    if speaking_npc:
        npc_name = speaking_npc["name"]
        npc_props = speaking_npc.get("properties", {})
        npc_personality = npc_props.get("description", npc_props.get("personality", "Neutral NPC"))
        logger.info(f"Dynamic NPC speaker detected: {npc_name}. Emulating NPC persona...")
        dialogue = run_persona_agent(npc_name, npc_personality, outcome, player_input)
        return {"final_dialogue": dialogue}
        
    logger.info("No active companion or speaking NPC. Bypassing persona emulation.")
    return {"final_dialogue": ""}

def run_event_chronicler(state: SwarmState) -> Dict[str, Any]:
    """Chronicler Node: Synthesizes final roleplay exchange into a structured update."""
    logger.info("Running Event Chronicler Node...")
    player_input = state["player_input"]
    final_dialogue = state.get("final_dialogue", "")
    if final_dialogue:
        final_output = f"{state['director_prose']} \n {final_dialogue}"
    else:
        final_output = state['director_prose']
        
    res = run_chronicler_agent(player_input, final_output)
    return {
        "extracted_summary": res.get("timeline_summary", "Interaction complete."),
        "state_deltas": res.get("state_deltas", {})
    }

def run_ledger_guard(state: SwarmState) -> Dict[str, Any]:
    """Ledger Guard Node: Coordinates DB commits and updates combat pools."""
    logger.info("Running Ledger Guard Node...")
    universe_id = state.get("universe_id", "f0000000-0000-0000-0000-000000000001")
    session_id = state["session_id"]
    char_id = state.get("char_id")
    summary = state["extracted_summary"]
    deltas = state["state_deltas"]
    player_input = state["player_input"]
    
    final_dialogue = state.get("final_dialogue", "")
    if final_dialogue:
        assistant_output = f"{state['director_prose']} {final_dialogue}"
    else:
        assistant_output = state['director_prose']
        
    # v3: Mechanical calculations - Update volatile combat pools if resource updates are returned
    metadata = state.get("agent_metadata", {})
    ruling = metadata if state.get("active_route") == "GRAND_ARBITER" else {}
    
    # Extract updates from ruling or standard entity updates
    resource_costs = ruling.get("resource_costs", {})
    entity_updates = state.get("director_entity_updates", [])
    
    if char_id:
        combat_state = get_combat_state(session_id, char_id)
        if combat_state:
            vit = combat_state.get("current_vitality", 10)
            end = float(combat_state.get("current_endurance", 10.0))
            res_pool = float(combat_state.get("current_reserve", 10.0))
            turn = combat_state.get("turn_counter", 0) + 1
            
            # Apply cost adjustments from Arbiter ruling
            vit -= resource_costs.get("vitality_lost", 0)
            end -= resource_costs.get("endurance_spent", 0)
            res_pool -= resource_costs.get("reserve_spent", 0)
            
            # Apply cost adjustments from standard updates if present
            for update in entity_updates:
                if update.get("name") == state.get("char_name"):
                    props = update.get("properties", {})
                    vit += props.get("vitality", props.get("hp", 0))
                    end += props.get("endurance", 0)
                    res_pool += props.get("reserve", 0)
            
            # Enforce floor limits
            vit = max(0, vit)
            end = max(0.0, end)
            res_pool = max(0.0, res_pool)
            
            # Save updated combat state
            upsert_combat_state(
                session_id=session_id,
                char_id=char_id,
                vitality=vit,
                endurance=end,
                reserve=res_pool,
                buffs=combat_state.get("active_buffs", []),
                debuffs=combat_state.get("active_debuffs", []),
                status_effects=combat_state.get("status_effects", []),
                turn_counter=turn
            )
            logger.info(f"Combat state pools updated in LedgerGuard: Vitality={vit}, Endurance={end}, Reserve={res_pool}")

    # Inject the scratchpad into state_delta for logging
    ledger_deltas = deltas.copy()
    if state.get("scratchpad"):
        ledger_deltas["_scratchpad"] = state["scratchpad"]
        
    success = sync_ledger_transaction(
        universe_id=universe_id,
        session_id=session_id,
        summary=summary,
        deltas=ledger_deltas,
        player_input=player_input,
        assistant_output=assistant_output
    )
    
    if success:
        logger.info("Ledger and chat history successfully synchronized in transaction.")
    else:
        logger.warning("Could not execute transaction with lock, falling back to non-locking writes.")
        try:
            add_timeline_event(universe_id, session_id, summary, ledger_deltas)
            if ledger_deltas:
                for key, val in ledger_deltas.items():
                    if isinstance(val, dict) and not key.startswith("_"):
                        update_entity_state(universe_id, key, "MODIFICATION", val)
            push_chat_message(session_id, "user", player_input)
            push_chat_message(session_id, "assistant", assistant_output)
        except Exception as e:
            logger.error(f"Fallback write also failed: {e}")
            
    return {"session_id": session_id}

# --- State Machine Graph Creation ---

# Define State Machine
workflow = StateGraph(SwarmState)

# Add Nodes
workflow.add_node("Scanner", run_keyword_scanner)
workflow.add_node("Librarian", run_lore_librarian)
workflow.add_node("Weaver", run_prompt_weaver)
workflow.add_node("Router", run_intent_router_node)

# v3 Isolated Agent Nodes
workflow.add_node("NarrativeDirector", run_narrative_director_node)
workflow.add_node("Worldsmith", run_worldsmith_node)
workflow.add_node("PersonaBlacksmith", run_persona_blacksmith_node)
workflow.add_node("GrandArbiter", run_grand_arbiter_node)

workflow.add_node("Critic", run_continuity_critic)
workflow.add_node("Persona", run_persona_emulator)
workflow.add_node("Chronicler", run_event_chronicler)
workflow.add_node("LedgerGuard", run_ledger_guard)

# Add Edges
workflow.set_entry_point("Scanner")
workflow.add_edge("Scanner", "Librarian")
workflow.add_edge("Librarian", "Weaver")
workflow.add_edge("Weaver", "Router")

# Router dispatches based on active_route
def route_dispatcher(state: SwarmState) -> str:
    route_map = {
        "NARRATIVE_DIRECTOR": "NarrativeDirector",
        "WORLDSMITH": "Worldsmith",
        "PERSONA_BLACKSMITH": "PersonaBlacksmith",
        "GRAND_ARBITER": "GrandArbiter"
    }
    return route_map.get(state.get("active_route"), "NarrativeDirector")

workflow.add_conditional_edges(
    "Router",
    route_dispatcher,
    {
        "NarrativeDirector": "NarrativeDirector",
        "Worldsmith": "Worldsmith",
        "PersonaBlacksmith": "PersonaBlacksmith",
        "GrandArbiter": "GrandArbiter"
    }
)

# All agents route to Critic for validation
workflow.add_edge("NarrativeDirector", "Critic")
workflow.add_edge("Worldsmith", "Critic")
workflow.add_edge("PersonaBlacksmith", "Critic")
workflow.add_edge("GrandArbiter", "Critic")

def critic_retry_router(state: SwarmState) -> str:
    """Routes back to the active agent node if Critic rejects draft, up to 3 retries."""
    if state["critic_approved"] or state.get("retry_count", 0) >= 3:
        return "Persona"
    return route_dispatcher(state)

workflow.add_conditional_edges(
    "Critic",
    critic_retry_router,
    {
        "Persona": "Persona",
        "NarrativeDirector": "NarrativeDirector",
        "Worldsmith": "Worldsmith",
        "PersonaBlacksmith": "PersonaBlacksmith",
        "GrandArbiter": "GrandArbiter"
    }
)

workflow.add_edge("Persona", "Chronicler")
workflow.add_edge("Chronicler", "LedgerGuard")
workflow.add_edge("LedgerGuard", END)

# Compile Graph
swarm_engine = workflow.compile()
