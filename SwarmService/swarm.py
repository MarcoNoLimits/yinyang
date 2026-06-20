import logging
import uuid
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
    get_universe
)
from agents import (
    run_scanner_agent,
    run_director_agent,
    run_critic_agent,
    run_persona_agent,
    run_chronicler_agent,
    run_soul_forger,
    run_itemizer,
    run_quest_architect
)

logger = logging.getLogger("swarm")

class SwarmState(TypedDict):
    session_id: str
    universe_id: str
    char_id: Optional[int]
    char_name: Optional[str]
    char_personality: Optional[str]
    player_input: str
    
    extracted_keywords: List[str]
    retrieved_lore: List[Dict[str, Any]]
    timeline_context: str
    
    master_prompt: str
    director_prose: str
    director_entity_updates: List[Dict[str, Any]]
    sparks_new_entity: bool
    
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
    """Weaver Node: Assembles historical timeline, chat logs, and lore into a prompt."""
    logger.info("Running Weaver Node...")
    session_id = state["session_id"]
    universe_id = state.get("universe_id", "f0000000-0000-0000-0000-000000000001")
    
    # 1. Fetch rolling chat history from Redis
    history = get_chat_history(session_id, limit=6)
    history_str = "\n".join([f"{h['role']}: {h['content']}" for h in history])
    
    # 2. Fetch timeline history context from Postgres
    timeline_events = get_timeline_history(universe_id, limit=5)
    db_timeline_str = "\n".join([f"- {evt['event_summary']}" for evt in timeline_events])

    # Preserve any timeline_context injected via the API payload (e.g., by verify_swarm.py
    # or the frontend). This is critical for continuity checks — the Critic must see
    # injected context such as NPC death/MIA status.
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

    master_prompt = (
        f"{companion_str}"
        f"UNIVERSE SETTING:\n{universe_desc}\n\n"
        f"ACTIVE QUESTS:\n{quests_str}\n\n"
        f"LOREBOOK DETAILS:\n{lore_str}\n\n"
        f"TIMELINE CONTEXT:\n{timeline_str}\n\n"
        f"RECENT HISTORY:\n{history_str}\n\n"
        f"PLAYER ACTION:\n{state['player_input']}\n"
    )
    
    return {"master_prompt": master_prompt, "timeline_context": timeline_str}


def run_narrative_director(state: SwarmState) -> Dict[str, Any]:
    """Director Node: Simulates scene action and handles dynamic item/NPC generation (Forge)."""
    logger.info("Running Narrative Director Node...")
    universe_id = state.get("universe_id", "f0000000-0000-0000-0000-000000000001")
    master_prompt = state["master_prompt"]
    
    # If this is a critic retry, inject critic feedback
    if state.get("retry_count", 0) > 0:
        master_prompt += f"\n\nCRITIC FEEDBACK: Please adjust. {state['critic_feedback']}"
        
    res = run_director_agent(master_prompt, "")
    
    prose = res.get("world_event", "")
    updates = res.get("entity_updates", [])
    sparks = res.get("sparks_new_entity", False)
    
    # --- Forge Tier Dynamic Spawning ---
    if sparks:
        logger.info("Forge Tier Triggered: Constructing new assets...")
        # 1. PNJ Constructor (Soul Forger)
        npc_data = run_soul_forger("Eldred the Mageseeker", prose)
        if npc_data and "name" in npc_data:
            update_entity_state(universe_id, npc_data["name"], "NPC", npc_data)
            logger.info(f"Soul Forger successfully registered NPC: {npc_data['name']}")
            
        # 2. Artifact Forge (Itemizer)
        item_data = run_itemizer("Shard of Petricite", prose)
        if item_data and "item_name" in item_data:
            update_entity_state(universe_id, item_data["item_name"], "ITEM", item_data)
            logger.info(f"Artifact Forge successfully registered Item: {item_data['item_name']}")
            
        # 3. Quest Architect (Quest Director)
        quest_data = run_quest_architect("Escape from Demacia gate", prose)
        logger.info(f"Quest Architect synthesized quest update: {quest_data}")
        
    return {
        "director_prose": prose, 
        "director_entity_updates": updates, 
        "sparks_new_entity": sparks
    }

def run_continuity_critic(state: SwarmState) -> Dict[str, Any]:
    """Critic Node: Evaluates Director's output for contradictions."""
    logger.info("Running Continuity Critic Node...")
    prose = state["director_prose"]
    timeline = state["timeline_context"]
    
    res = run_critic_agent(prose, timeline)
    approved = res.get("approved", True)
    feedback = res.get("correction_reason", "")
    
    retry_count = state.get("retry_count", 0)
    if not approved:
        retry_count += 1
        logger.warn(f"Critic REJECTED draft (Attempt {retry_count}). Reason: {feedback}")
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
        
    # If no companion character is provided, check if an NPC is speaking in the Director's output
    universe_id = state.get("universe_id", "f0000000-0000-0000-0000-000000000001")
    npcs = get_entities_by_type(universe_id, "NPC")
    
    prose_lower = outcome.lower()
    speaking_npc = None
    
    for npc in npcs:
        npc_name = npc["name"]
        if npc_name.lower() in prose_lower:
            # Does the prose contain quotes or indicators of dialogue/speech?
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
    """Ledger Guard Node: Coordinates DB commits under PostgreSQL Advisory Lock."""
    logger.info("Running Ledger Guard Node...")
    universe_id = state.get("universe_id", "f0000000-0000-0000-0000-000000000001")
    session_id = state["session_id"]
    summary = state["extracted_summary"]
    deltas = state["state_deltas"]
    player_input = state["player_input"]
    
    final_dialogue = state.get("final_dialogue", "")
    if final_dialogue:
        assistant_output = f"{state['director_prose']} {final_dialogue}"
    else:
        assistant_output = state['director_prose']
        
    # Run the ledger synchronization in a single PostgreSQL transaction
    # with an advisory lock.
    success = sync_ledger_transaction(
        universe_id=universe_id,
        session_id=session_id,
        summary=summary,
        deltas=deltas,
        player_input=player_input,
        assistant_output=assistant_output
    )
    
    if success:
        logger.info("Ledger and chat history successfully synchronized in transaction.")
    else:
        logger.warn("Could not execute transaction with lock, falling back to non-locking writes.")
        # Fallback write without lock/transaction if lock fails/raises
        try:
            add_timeline_event(universe_id, session_id, summary, deltas)
            
            if deltas:
                for key, val in deltas.items():
                    if isinstance(val, dict):
                        update_entity_state(universe_id, key, "MODIFICATION", val)
                        
            push_chat_message(session_id, "user", player_input)
            push_chat_message(session_id, "assistant", assistant_output)
            
            session_data = get_session_state(session_id)
            current_state = session_data.get("current_state", {}) if session_data else {}
            current_state.update(deltas)
            update_session_state(session_id, universe_id, current_state)
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
workflow.add_node("Director", run_narrative_director)
workflow.add_node("Critic", run_continuity_critic)
workflow.add_node("Persona", run_persona_emulator)
workflow.add_node("Chronicler", run_event_chronicler)
workflow.add_node("LedgerGuard", run_ledger_guard)

# Add Edges
workflow.set_entry_point("Scanner")
workflow.add_edge("Scanner", "Librarian")
workflow.add_edge("Librarian", "Weaver")
workflow.add_edge("Weaver", "Director")
workflow.add_edge("Director", "Critic")

def critic_router(state: SwarmState):
    """Routes back to Director if Critic rejects draft, unless max retries reached."""
    if state["critic_approved"] or state.get("retry_count", 0) >= 3:
        return "Persona"
    return "Director"

workflow.add_conditional_edges(
    "Critic",
    critic_router,
    {
        "Persona": "Persona",
        "Director": "Director"
    }
)

workflow.add_edge("Persona", "Chronicler")
workflow.add_edge("Chronicler", "LedgerGuard")
workflow.add_edge("LedgerGuard", END)

# Compile Graph
swarm_engine = workflow.compile()
