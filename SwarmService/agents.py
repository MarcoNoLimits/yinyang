import json
import logging
import httpx
from config import OPENROUTER_API_KEY, OPENROUTER_URL, MODEL_NAME

logger = logging.getLogger("agents")

def call_llm(system_prompt: str, user_content: str, json_mode: bool = False) -> str:
    """Executes a call to the DeepSeek model via OpenRouter API."""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "YinYang Engine"
    }
    
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "temperature": 0.2
    }
    
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
        
    try:
        # Check if using mock key
        if "sk-or-v1-mock-key" in OPENROUTER_API_KEY:
            return get_mock_fallback(system_prompt, user_content, json_mode)
            
        with httpx.Client(timeout=45.0) as client:
            response = client.post(f"{OPENROUTER_URL}/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.error(f"Error calling OpenRouter LLM: {e}. Falling back to structural mock.")
        return get_mock_fallback(system_prompt, user_content, json_mode)

def get_mock_fallback(system_prompt: str, user_content: str, json_mode: bool) -> str:
    """Provides valid JSON structural fallbacks for testing."""
    content_lower = user_content.lower()
    
    # 1. Scanner Agent Mock
    if "keyword extraction" in system_prompt.lower() or "scanner" in system_prompt.lower():
        found = []
        for word in ["garen", "darius", "ahri", "demacia", "noxus", "steel", "sword", "shield", "spell", "rebellion"]:
            if word in content_lower:
                found.append(word)
        if not found:
            found = ["general"]
        return json.dumps({"keywords": found})
        
    # 2. Narrative Director Mock
    elif "narrative director" in system_prompt.lower():
        sparks = "spawn" in content_lower or "create" in content_lower or "artifact" in content_lower
        
        # If this is a critic feedback retry, adjust description to resolve contradiction
        if "critic feedback" in content_lower:
            player_action_part = content_lower.split("player action:")[-1] if "player action:" in content_lower else content_lower
            if "deceased" in player_action_part or "dead" in player_action_part:
                world_event = "The character honors the memory of the fallen, refusing to speak for the dead. The camp remains quiet."
            elif "impossible" in player_action_part or "moon" in player_action_part:
                world_event = "The character leaps high into the air, but gravity asserts itself, pulling them back down with a dull thud. The moon remains cold and distant."
            else:
                world_event = "The character adjusts their stance, correcting their previous actions to align with reality. The surroundings react with typical environmental physics."
            
            return json.dumps({
                "world_event": world_event,
                "entity_updates": [],
                "sparks_new_entity": sparks
            })
            
        # Extract player action part to avoid matching words in the lorebook or timeline context
        player_action_part = content_lower.split("player action:")[-1] if "player action:" in content_lower else content_lower
        
        # Simulating contradictions based on player input
        if "deceased" in player_action_part or "dead" in player_action_part:
            world_event = "The dead soldier suddenly stands up and speaks. The deceased NPC commands the squad."
        elif "impossible" in player_action_part or "moon" in player_action_part:
            world_event = "The character leaps high, escaping earth's grasp entirely and landing on the lunar surface in a single bound."
        else:
            world_event = "The character performs the action. The surroundings react with typical environmental physics."
            
        return json.dumps({
            "world_event": world_event,
            "entity_updates": [],
            "sparks_new_entity": sparks
        })
        
    # 3. Continuity Critic Mock
    elif "continuity inspector" in system_prompt.lower() or "critic" in system_prompt.lower():
        # If the narrative draft contains contradiction indicators, reject it
        if "dead soldier" in content_lower or "deceased npc" in content_lower:
            return json.dumps({
                "approved": False,
                "correction_reason": "Detected action from a deceased NPC in timeline context."
            })
        elif "lunar surface" in content_lower or "escaping earth's grasp" in content_lower:
            return json.dumps({
                "approved": False,
                "correction_reason": "Action violates physical laws of the universe (impossible jump)."
            })
            
        return json.dumps({
            "approved": True,
            "correction_reason": ""
        })
        
    # 4. Persona Agent Mock
    elif "persona emulation" in system_prompt.lower() or "chatbot" in system_prompt.lower():
        char = "Character"
        if "garen" in content_lower:
            char = "Garen"
        elif "ahri" in content_lower:
            char = "Ahri"
        elif "darius" in content_lower:
            char = "Darius"
        return json.dumps({
            "character_output": f"*{char} stands ready.* 'For my nation! I will face whatever challenges you present.'"
        })
        
    # 5. Chronicler Agent Mock
    elif "event extraction" in system_prompt.lower() or "chronicler" in system_prompt.lower():
        return json.dumps({
            "timeline_summary": "Player engaged in conversation or exploration.",
            "state_deltas": {}
        })
        
    # 6. Soul Forger Mock
    elif "soul forger" in system_prompt.lower():
        return json.dumps({
            "name": "Eldred the Mageseeker",
            "faction": "Mageseekers",
            "attributes": {"health": 120, "strength": 14},
            "inventory": ["magic_dampening_shackles"],
            "disposition_to_player": "Hostile",
            "short_backstory": "A stern magistrate dedicated to securing rogue sorcerers."
        })
        
    # 7. Itemizer Mock
    elif "artifact forge" in system_prompt.lower():
        return json.dumps({
            "item_name": "Shard of Petricite",
            "item_type": "Magic Catalyst",
            "weight_kg": 0.4,
            "properties": {"magic_absorption_capacity": 50},
            "lore_blurb": "A crystalline form of petricite that absorbs mana."
        })
        
    # 8. Quest Architect Mock
    elif "quest architect" in system_prompt.lower():
        return json.dumps({
            "quest_id": "q_mage_escape",
            "status": "In_Progress",
            "objectives_completed": ["find_shackles_key"],
            "faction_reputation_impact": {"mage_rebellion": 5, "demacian_crown": -10}
        })
        
    if json_mode:
        return "{}"
    return "Fallback generic text"

# --- Agent Runners ---

def run_scanner_agent(player_input: str) -> list:
    """Extracts search keywords from the player input."""
    system_prompt = (
        "You are a Keyword Extraction Agent (Entity Scanner) for a fantasy roleplaying engine.\n"
        "Analyze the user's prompt and extract key nouns, locations, items, characters, or events.\n"
        "You MUST output a single, valid JSON object matching this schema exactly:\n"
        "{\n"
        "  \"keywords\": [\"lowercase_keyword_1\", \"lowercase_keyword_2\"]\n"
        "}\n\n"
        "CRITICAL REQUIREMENTS:\n"
        "1. Return ONLY the raw JSON object. Do not wrap it in markdown code blocks like ```json or ```.\n"
        "2. Do not include any pre- or post-conversational text, explanations, or comments.\n"
        "3. The output must be written strictly in English. Do not include any Chinese characters, comments, symbols, or boilerplate. Zero Chinese leakage is allowed.\n"
        "4. If no keywords are found, return {\"keywords\": [\"general\"]}.\n"
    )
    try:
        raw_res = call_llm(system_prompt, player_input, json_mode=True)
        res = json.loads(raw_res)
        return res.get("keywords", [])
    except Exception:
        return ["general"]

def run_director_agent(master_prompt: str, entities_state_str: str) -> dict:
    """Simulates the narrative action and computes state changes."""
    system_prompt = (
        "You are the Narrative Director (Game Master) of an immersive fantasy RPG.\n"
        "Your task is to process the player's action against the current active entities and compute the physical outcome of the scene.\n\n"
        "You MUST output a single, valid JSON object matching this schema exactly:\n"
        "{\n"
        "  \"world_event\": \"<immersive_prose_description_of_scene_outcome>\",\n"
        "  \"entity_updates\": [\n"
        "    {\n"
        "      \"name\": \"Entity Name\",\n"
        "      \"properties\": {\"hp\": -15, \"status\": \"stunned\"}\n"
        "    }\n"
        "  ],\n"
        "  \"sparks_new_entity\": true_or_false\n"
        "}\n\n"
        "PROSE & NARRATIVE INSTRUCTIONS:\n"
        "- Write 'world_event' in a highly immersive, detailed, and atmospheric third-person literary style.\n"
        "- Focus on showing physical reactions, environmental impacts, and sensory details (sound, smell, visual transitions) rather than dry game mechanics.\n"
        "- Ensure there is no generic boilerplate (e.g. do NOT say 'The character performs the action'). Make it a seamless narrative paragraph.\n\n"
        "CRITICAL FORMATTING & LANGUAGE RULES:\n"
        "1. Return ONLY the raw JSON object. Do not wrap it in markdown code blocks like ```json or ```.\n"
        "2. Do not include any introductory or concluding text, explanations, or comments.\n"
        "3. All output must be strictly in English. Do not include any Chinese characters, comments, symbols, or boilerplate.\n"
        "4. 'sparks_new_entity' must be set to true ONLY if a brand-new character or unique special artifact is introduced or spawned in the scene.\n"
    )
    user_payload = f"ENTITIES_STATUS:\n{entities_state_str}\n\nMASTER_PROMPT:\n{master_prompt}"
    try:
        raw_res = call_llm(system_prompt, user_payload, json_mode=True)
        return json.loads(raw_res)
    except Exception:
        return {
            "world_event": "The world moves forward in silence.",
            "entity_updates": [],
            "sparks_new_entity": False
        }

def run_critic_agent(draft_prose: str, timeline_summary: str) -> dict:
    """Audits draft prose against the global timeline for continuity errors."""
    system_prompt = (
        "You are the Continuity Inspector (The Critic) for an interactive fantasy narrative.\n"
        "Your task is to audit the narrative draft prose against the global timeline context and identify any logical contradictions or continuity errors.\n"
        "Examples of contradictions include: dead characters performing actions, using items that were destroyed, performing impossible feats, or ignoring critical world status.\n\n"
        "You MUST output a single, valid JSON object matching this schema exactly:\n"
        "{\n"
        "  \"approved\": true_or_false,\n"
        "  \"correction_reason\": \"<detailed_reason_if_rejected_or_empty_string_if_approved>\"\n"
        "}\n\n"
        "CRITICAL AUDITING & LANGUAGE RULES:\n"
        "1. Return ONLY the raw JSON object. Do not wrap it in markdown code blocks like ```json or ```.\n"
        "2. Do not include any pre- or post-conversational text, explanations, or comments.\n"
        "3. All output must be written strictly in English. Do not include any Chinese characters, comments, symbols, or boilerplate.\n"
        "4. Be strict about character health states, item locations, and physical constraints in the timeline context.\n"
    )
    user_payload = f"TIMELINE_CONTEXT:\n{timeline_summary}\n\nDRAFT_PROSE:\n{draft_prose}"
    try:
        raw_res = call_llm(system_prompt, user_payload, json_mode=True)
        return json.loads(raw_res)
    except Exception:
        return {"approved": True, "correction_reason": ""}

def run_persona_agent(char_name: str, char_personality: str, narrative_outcome: str, player_input: str) -> str:
    """Translates the outcome into the character's voice and dialog."""
    system_prompt = (
        f"You are the Persona Emulation Agent for the character: {char_name}.\n"
        f"Character Personality Profile: {char_personality}\n\n"
        "Your task is to translate the narrative outcome into the character's direct spoken reply and physical micro-actions in response to the situation.\n\n"
        "You MUST output a single, valid JSON object matching this schema exactly:\n"
        "{\n"
        "  \"character_output\": \"<dialogue_and_physical_actions>\"\n"
        "}\n\n"
        "DIALOGUE CONSTRAINTS:\n"
        "- Write in the first-person, fully embodying the character's unique voice, accent, vocabulary, and style.\n"
        "- Format physical micro-actions in asterisks (e.g., *draws their blade* or *sighs heavily*) interspersed within the dialogue.\n"
        "- The dialogue must feel natural, atmospheric, and highly immersive.\n\n"
        "CRITICAL FORMATTING & LANGUAGE RULES:\n"
        "1. Return ONLY the raw JSON object. Do not wrap it in markdown code blocks like ```json or ```.\n"
        "2. Do not include any conversational prefix, suffix, explanations, or comments.\n"
        "3. All output must be strictly in English. Do not include any Chinese characters, comments, symbols, or boilerplate.\n"
    )
    user_payload = f"PLAYER_INPUT:\n{player_input}\n\nNARRATIVE_OUTCOME:\n{narrative_outcome}"
    try:
        raw_res = call_llm(system_prompt, user_payload, json_mode=True)
        res = json.loads(raw_res)
        return res.get("character_output", "...")
    except Exception:
        return "..."

def run_chronicler_agent(player_input: str, response_output: str) -> dict:
    """Summarizes a round of roleplay into an objective update."""
    system_prompt = (
        "You are the Event Extraction Agent (The Chronicler) for a fantasy simulation.\n"
        "Your task is to distill the player transaction and resulting narrative outcome into a single clean summary and key state changes (deltas).\n\n"
        "You MUST output a single, valid JSON object matching this schema exactly:\n"
        "{\n"
        "  \"timeline_summary\": \"<short_objective_summary_of_the_physical_event>\",\n"
        "  \"state_deltas\": {}\n"
        "}\n\n"
        "STATE DELTAS STRUCTURE:\n"
        "- 'state_deltas' is a key-value dictionary mapping modified entity parameters (e.g., {\"player_inventory\": {\"add\": [\"item_name\"]}} or {\"Eldred\": {\"hp\": -15}}).\n\n"
        "CRITICAL FORMATTING & LANGUAGE RULES:\n"
        "1. Return ONLY the raw JSON object. Do not wrap it in markdown code blocks like ```json or ```.\n"
        "2. Do not include any pre- or post-conversational text, explanations, or comments.\n"
        "3. All output must be strictly in English. Do not include any Chinese characters, comments, symbols, or boilerplate.\n"
    )
    user_payload = f"PLAYER_INPUT: {player_input}\nRESPONSE: {response_output}"
    try:
        raw_res = call_llm(system_prompt, user_payload, json_mode=True)
        return json.loads(raw_res)
    except Exception:
        return {"timeline_summary": "Interaction completed.", "state_deltas": {}}

# --- Generative Forge Agents ---

def run_soul_forger(npc_name: str, context: str) -> dict:
    """Assembles a full stats sheet for a new NPC."""
    system_prompt = (
        "You are the Soul Forger (NPC Constructor) for a fantasy RPG.\n"
        "Your task is to generate a comprehensive structural profile for a new NPC.\n\n"
        "You MUST output a single, valid JSON object matching this schema exactly:\n"
        "{\n"
        "  \"name\": \"<NPC Name>\",\n"
        "  \"faction\": \"<Faction Name>\",\n"
        "  \"attributes\": {\"health\": 100, \"strength\": 10},\n"
        "  \"inventory\": [\"item_1\", \"item_2\"],\n"
        "  \"disposition_to_player\": \"Friendly/Neutral/Hostile\",\n"
        "  \"short_backstory\": \"<A concise, compelling backstory in third-person>\"\n"
        "}\n\n"
        "CRITICAL FORMATTING & LANGUAGE RULES:\n"
        "1. Return ONLY the raw JSON object. Do not wrap it in markdown code blocks like ```json or ```.\n"
        "2. Do not include any introductory or concluding text, explanations, or comments.\n"
        "3. All output must be strictly in English. Do not include any Chinese characters, comments, symbols, or boilerplate.\n"
    )
    try:
        raw_res = call_llm(system_prompt, f"NPC Name: {npc_name}\nContext: {context}", json_mode=True)
        return json.loads(raw_res)
    except Exception:
        return {}

def run_itemizer(item_name: str, context: str) -> dict:
    """Constructs technical stats and attributes for a new item card."""
    system_prompt = (
        "You are the Artifact Forge Agent (The Itemizer) for a fantasy RPG.\n"
        "Your task is to create a technical specifications card and description for a newly spawned item.\n\n"
        "You MUST output a single, valid JSON object matching this schema exactly:\n"
        "{\n"
        "  \"item_name\": \"<Item Name>\",\n"
        "  \"item_type\": \"<Item Type/Category>\",\n"
        "  \"weight_kg\": 0.0,\n"
        "  \"properties\": {},\n"
        "  \"lore_blurb\": \"<Atmospheric lore description of the item>\"\n"
        "}\n\n"
        "CRITICAL FORMATTING & LANGUAGE RULES:\n"
        "1. Return ONLY the raw JSON object. Do not wrap it in markdown code blocks like ```json or ```.\n"
        "2. Do not include any pre- or post-conversational text, explanations, or comments.\n"
        "3. All output must be strictly in English. Do not include any Chinese characters, comments, symbols, or boilerplate.\n"
    )
    try:
        raw_res = call_llm(system_prompt, f"Item: {item_name}\nContext: {context}", json_mode=True)
        return json.loads(raw_res)
    except Exception:
        return {}

def run_quest_architect(quest_details: str, context: str) -> dict:
    """Drafts quest objectives and faction standing results."""
    system_prompt = (
        "You are the Quest Architect for a fantasy RPG.\n"
        "Your task is to structure quest objectives, statuses, and faction reputation impacts.\n\n"
        "You MUST output a single, valid JSON object matching this schema exactly:\n"
        "{\n"
        "  \"quest_id\": \"<quest_identifier>\",\n"
        "  \"status\": \"Not_Started/In_Progress/Completed/Failed\",\n"
        "  \"objectives_completed\": [\"objective_1\"],\n"
        "  \"faction_reputation_impact\": {}\n"
        "}\n\n"
        "CRITICAL FORMATTING & LANGUAGE RULES:\n"
        "1. Return ONLY the raw JSON object. Do not wrap it in markdown code blocks like ```json or ```.\n"
        "2. Do not include any pre- or post-conversational text, explanations, or comments.\n"
        "3. All output must be strictly in English. Do not include any Chinese characters, comments, symbols, or boilerplate.\n"
    )
    try:
        raw_res = call_llm(system_prompt, f"Details: {quest_details}\nContext: {context}", json_mode=True)
        return json.loads(raw_res)
    except Exception:
        return {}
