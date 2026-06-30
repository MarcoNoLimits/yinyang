import json
import logging
import httpx
from config import OPENROUTER_API_KEY, OPENROUTER_URL, MODEL_NAME

logger = logging.getLogger("agents")

def call_llm(
    system_prompt: str,
    user_content: str,
    json_mode: bool = False,
    temperature: float = 0.2,
    max_tokens: int = 4096
) -> str:
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
        "temperature": temperature,
        "max_tokens": max_tokens
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
    sys_lower = system_prompt.lower()
    
    # NEW v3 Agent mock fallbacks
    if "run_narrative_director_v3" in sys_lower or "run_narrative_director_v3" in content_lower or "you are the narrative director — the living soul" in sys_lower:
        return """<SCRATCHPAD>
1. Character: Kaelith (Occulte, Rang 4). HP: 11/11, Endurance: 8/8.
2. World: Darkness Returns era forest.
3. Action: Casting fire spell. No contradiction.
4. Anti-metagaming: Hidden traits are safe.
</SCRATCHPAD>
<PROSE>
L'obscurité sylvestre frémit sous l'éclat soudain d'une flamme pourpre. Les ombres reculent, dévoilant les ruines antiques de Noah. Un grondement sourd s'élève de la terre bénie par Ezéchiel.
</PROSE>
<METADATA>
{
  "entity_updates": [
    {"name": "Kaelith", "properties": {"endurance": -0.5}}
  ],
  "sparks_new_entity": false,
  "scene_tags": ["combat", "exploration"]
}
</METADATA>"""

    elif "run_worldsmith" in sys_lower or "run_worldsmith" in content_lower or "you are the worldsmith — the architect of undiscovered" in sys_lower:
        return """<SCRATCHPAD>
1. Location: Expanding Noah Forest.
2. Generating points of interest and encounter tables.
</SCRATCHPAD>
<PROSE>
Au-delà des sentiers connus s'ouvre une clairière baignée de murmures indicibles. Des fleurs bioluminescentes consument la clarté lunaire. Au centre, un autel de pierre noire marqué des runes d'Anubis sommeille sous le lierre.
</PROSE>
<METADATA>
{
  "generated_entities": [
    {
      "name": "Autel d'Anubis",
      "entity_type": "LOCATION",
      "properties": {"lore": "Un sanctuaire dédié au dieu des morts, scellé depuis l'Arc 2."}
    }
  ],
  "encounter_table": [
    {"creature": "Loup des Ombres", "tier": "Rare", "count": 1}
  ],
  "quest_data": {
    "quest_id": "q_sanctuaire_anubis",
    "status": "Not_Started",
    "objectives": ["Inspecter l'autel noir", "Vaincre le loup des ombres"],
    "faction_impact": {"Occulte": 10}
  }
}
</METADATA>"""

    elif "run_persona_blacksmith" in sys_lower or "run_persona_blacksmith" in content_lower or "you are the persona blacksmith — the forge" in sys_lower:
        return """<SCRATCHPAD>
1. NPC: Sandler Void.
2. Faction: Hors-la-loi.
3. Stats follow system rules.
</SCRATCHPAD>
<PROSE>
Un homme d'âge mûr émerge de la brume sylvestre. Son manteau de cuir élimé porte les marques des cendres de Roahx. Un sourire sardonique étire ses lèvres tandis qu'il ajuste son tricorne. "Fallen est vaste pour un si voyager," murmure-t-il d'une voix rauque.
</PROSE>
<METADATA>
{
  "npc_profile": {
    "name": "Sandler Void",
    "faction": "Hors-la-loi",
    "rank": "Rang 4",
    "disposition": "Neutral",
    "stats": {
      "Force": 7, "Vitesse": 8, "Endurance": 8, "Resistance": 7,
      "Reserve": 6, "Puissance": 7, "Mental": 8, "Reactivite": 9,
      "Charisme": 8, "Intelligence": 8
    },
    "vitality": 12,
    "techniques": [
      {"name": "Tir de Precision", "rank": "A", "description": "Un tir d'arme à feu impossible à esquiver à moins de 10m."}
    ],
    "equipment": ["Pistolet à silex", "Manteau de cuir"],
    "secret": "Il collabore secrètement avec les Noches.",
    "vocal_pattern": "Voix rauque et ironique, tutoiement direct."
  }
}
</METADATA>"""

    elif "run_grand_arbiter" in sys_lower or "run_grand_arbiter" in content_lower or "you are the grand arbiter — the impartial mechanical" in sys_lower:
        return """<SCRATCHPAD>
1. Player Force: 7, Weapon bonus: +1 (Effective: 8).
2. Target Resistance: 6.
3. Difference: +2. Attacker wins.
4. Vitality loss: -6 (lethal direct hit).
</SCRATCHPAD>
<RULING>
{
  "action_valid": true,
  "ruling_summary": "L'attaque de Kaelith frappe l'adversaire de plein fouet, lui infligeant de lourds dégâts.",
  "outcome": "SUCCESS",
  "resource_costs": {
    "endurance_spent": 1,
    "reserve_spent": 0,
    "vitality_lost": 0
  },
  "stat_checks": [
    {
      "check": "Force vs Resistance",
      "attacker_stat": 8,
      "defender_stat": 6,
      "result": "HIT",
      "vitality_damage": 6
    }
  ],
  "entity_updates": [
    {"name": "Cible", "properties": {"vitality": -6}}
  ],
  "rule_citation": "SystemeDeJeu Section 8: Puissance/Force vs Resistance",
  "forbidden_flags": [],
  "notes": "L'adversaire est chancelant."
}
</RULING>"""

    # 1. Scanner Agent Mock
    if "keyword extraction" in sys_lower or "scanner" in sys_lower:
        found = []
        for word in ["fallen", "conrak", "malakath", "anubis", "ezechiel", "khalian", "drahen", "nergal", "zeita", "elisa", "vanyr", "zephyr", "elsa", "noches", "atlantica", "noah", "baraen", "icetoon", "roahx", "kaos", "ithis", "celeste", "mundus", "eudenia", "sandler", "vladislaus", "gabriella", "pegasus", "eudenia", "renaissance"]:
            if word in content_lower:
                found.append(word)
        if not found:
            found = ["general"]
        return json.dumps({"keywords": found})
        
    # 2. Narrative Director Mock
    elif "narrative director" in sys_lower:
        sparks = "spawn" in content_lower or "create" in content_lower or "artifact" in content_lower
        
        # If this is a critic feedback retry, adjust description to resolve contradiction
        if "critic feedback" in content_lower:
            player_action_part = content_lower.split("player action:")[-1] if "player action:" in content_lower else content_lower
            if "deceased" in player_action_part or "dead" in player_action_part or "eleanor" in player_action_part:
                world_event = "The character honors the memory of the fallen, refusing to speak for the dead. The camp remains quiet."
            elif "impossible" in player_action_part or "moon" in player_action_part or "eudenia" in player_action_part or "scell" in player_action_part:
                world_event = "A blinding pulse of divine energy repels the traveler. The sealed gates of Eudenia hold firm, inscribed with the runes of Lucas Saviore's binding oath."
            else:
                world_event = "The character adjusts their stance, correcting their previous actions to align with reality."
            
            return json.dumps({
                "world_event": world_event,
                "entity_updates": [],
                "sparks_new_entity": sparks
            })
            
        # Extract player action part to avoid matching words in the lorebook or timeline context
        player_action_part = content_lower.split("player action:")[-1] if "player action:" in content_lower else content_lower
        
        # Simulating contradictions based on player input
        if "avall'arh" in player_action_part or "avall" in player_action_part:
            world_event = "L'ancien gardien Avall'arh se matérialise depuis les racines des grands arbres de Noah, sa présence imposant le silence à travers le bosquet."
        elif "noches" in player_action_part:
            world_event = "Une ombre se détache des ténèbres. Une silhouette en armure d'obsidienne s'avance. *Un membre de Noches.* 'Tu n'aurais pas dû venir ici,' murmure la silhouette, la main sur son épée."
        elif "eudenia" in player_action_part:
            world_event = "Une impulsion aveuglante d'énergie divine repousse le voyageur. Les portes scellées d'Eudenia restent fermes, gravées des runes du serment contraignant de Lucas Saviore."
        else:
            world_event = "Le monde de Fallen change autour de vous. Le vent transporte les Murmures de Fallen — quelque chose change dans l'équilibre des forces."
            
        return json.dumps({
            "world_event": world_event,
            "entity_updates": [],
            "sparks_new_entity": sparks
        })
        
    # 3. Continuity Critic Mock
    elif "continuity inspector" in sys_lower or "the critic" in sys_lower:
        # If the narrative draft contains contradiction indicators, reject it
        if "deceased" in content_lower or "dead npc" in content_lower or "est mort" in content_lower or "décédé" in content_lower or "eleanor" in content_lower:
            return json.dumps({
                "approved": False,
                "correction_reason": "Action détectée de la part d'un PNJ décédé dans le contexte de la chronologie."
            })
        elif "eudenia" in content_lower:
            return json.dumps({
                "approved": False,
                "correction_reason": "Eudenia est scellée par le serment divin de Lucas Saviore. Aucun mortel ne peut y entrer sans briser le sceau."
            })
            
        return json.dumps({
            "approved": True,
            "correction_reason": ""
        })
        
    # 4. Persona Agent Mock
    elif "persona emulation" in sys_lower or "chatbot" in sys_lower:
        char = "Character"
        if "sandler void" in sys_lower or "sandler void" in content_lower:
            char = "Sandler Void"
        elif "vladislaus" in sys_lower or "vladislaus" in content_lower:
            char = "Vladislaus Nocturnus"
        elif "avall'arh" in sys_lower or "avall'arh" in content_lower or "avall" in sys_lower:
            char = "Avall'arh"
        elif "gabriella" in sys_lower or "gabriella" in content_lower:
            char = "Gabriella"
        elif "drafhorz" in sys_lower or "drafhorz" in content_lower:
            char = "Drafhorz Lazuli Varn Emreis"

        if char == "Sandler Void":
            return json.dumps({
                "character_output": "*incline son chapeau usé avec un sourire en coin* 'Mon nom est Sandler Void. Et oui, je suis aussi dangereux que ce que tu as entendu dire. Probablement plus.'"
            })
        elif char == "Vladislaus Nocturnus":
            return json.dumps({
                "character_output": "*des yeux cramoisis brillent dans les ténèbres* 'Un autre fou attiré à Ithis par la rumeur. Tu empestes le vivant. Comme c'est... rafraîchissant.'"
            })
        elif char == "Avall'arh":
            return json.dumps({
                "character_output": "*l'esprit ancien se tourne, des feuilles tourbillonnant sous un vent invisible* 'Les racines de Noah sont profondes. Je garde ces terres depuis bien avant que ton espèce ne foule cette terre.'"
            })
        elif char == "Gabriella":
            return json.dumps({
                "character_output": "*des ailes de lumière de saphir se déploient* 'Par le jugement de Zeita — déclare ton but en Céleste. Rapidement.'"
            })
        return json.dumps({
            "character_output": "*un étranger en habits de voyage lève les yeux de sa carte* 'Fallen est vaste, voyageur. Qu'est-ce qui t'amène dans ces contrées ?'"
        })

        
    # 5. Chronicler Agent Mock
    elif "event extraction" in sys_lower or "chronicler" in sys_lower:
        return json.dumps({
            "timeline_summary": "Le joueur a exploré le monde de Fallen, interagissant avec ses habitants ou ses lieux.",
            "state_deltas": {}
        })
        
    # 6. Soul Forger Mock
    elif "soul forger" in sys_lower:
        return json.dumps({
            "name": "Kaelith the Wanderer",
            "faction": "Hors-la-loi",
            "attributes": {"health": 120, "strength": 14},
            "inventory": ["carved_bone_dagger", "ancient_map_fragment"],
            "disposition_to_player": "Neutral",
            "short_backstory": "Un ancien membre du Dragon Noir qui est devenu renégat après l'Arc 2, errant désormais entre Roahx et Kaos pour vendre des secrets au plus offrant."
        })
        
    # 7. Itemizer Mock
    elif "artifact forge" in sys_lower:
        return json.dumps({
            "item_name": "Fragment d'Eudenia",
            "item_type": "Divine Artifact",
            "weight_kg": 0.3,
            "properties": {"divine_energy": 85, "access_restricted": True},
            "lore_blurb": "Un éclat d'énergie divine cristallisée provenant des portes scellées d'Eudenia. Il bourdonne du souvenir du serment contraignant de Lucas Saviore."
        })
        
    # 8. Quest Architect Mock
    elif "quest architect" in sys_lower:
        return json.dumps({
            "quest_id": "q_whispers_of_noches",
            "status": "In_Progress",
            "objectives_completed": ["investigate_missing_ships"],
            "faction_reputation_impact": {"noches": -20, "kaos_harbor_authority": 15}
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
        raw_res = call_llm(system_prompt, player_input, json_mode=True, temperature=0.2, max_tokens=256)
        res = json.loads(raw_res)
        return res.get("keywords", [])
    except Exception:
        return ["general"]

def run_director_agent(master_prompt: str, entities_state_str: str) -> dict:
    """Simulates the narrative action and computes state changes (Legacy)."""
    system_prompt = (
        "You are the Narrative Director (Game Master) of the Fallen universe — a rich, god-created fantasy world of 9 continents, 12 divine deities, and warring factions.\n"
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
        "- Write 'world_event' in a highly immersive, detailed, and atmospheric third-person literary style in French.\n"
        "- Focus on showing physical reactions, environmental impacts, and sensory details (sound, smell, visual transitions) rather than dry game mechanics.\n"
        "- Ensure there is no generic boilerplate. Make it a seamless narrative paragraph.\n"
        "- **CRITICAL**: Do NOT simply repeat, rephrase, or summarize the player's action, location description, or character sheet. Instead, resolve the action, describe its outcome, and immediately **ADVANCE the story/scene** by introducing a new environmental event, hazard, discovery, NPC reaction, or dilemma. The narrative MUST progress to the next logical step with new developments.\n"
        "- **INITIALIZATION**: If the player's input initializes the roleplay (e.g. contains 'Fiche de Personnage', character stats, or starting context), do not repeat the character sheet. Parse the character details, set the scene at the described location, and immediately present a dynamic challenge or hook to start the adventure.\n\n"
        "CRITICAL FORMATTING & LANGUAGE RULES:\n"
        "1. Return ONLY the raw JSON object. Do not wrap it in markdown code blocks like ```json or ```.\n"
        "2. Do not include any introductory or concluding text, explanations, or comments.\n"
        "3. The 'world_event' description MUST be written strictly in French, as the roleplay is conducted in French. JSON keys/structure remain in English.\n"
        "4. 'sparks_new_entity' must be set to true ONLY if a brand-new character or unique special artifact is introduced or spawned in the scene.\n"
    )
    user_payload = f"ENTITIES_STATUS:\n{entities_state_str}\n\nMASTER_PROMPT:\n{master_prompt}"
    try:
        raw_res = call_llm(system_prompt, user_payload, json_mode=True, temperature=0.85, max_tokens=4096)
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
        "3. The 'correction_reason' MUST be written in French. JSON keys/structure remain in English.\n"
        "4. Be strict about character health states, item locations, and physical constraints in the timeline context.\n"
    )
    user_payload = f"TIMELINE_CONTEXT:\n{timeline_summary}\n\nDRAFT_PROSE:\n{draft_prose}"
    try:
        raw_res = call_llm(system_prompt, user_payload, json_mode=True, temperature=0.1, max_tokens=1024)
        return json.loads(raw_res)
    except Exception:
        return {"approved": True, "correction_reason": ""}

def run_persona_agent(char_name: str, char_personality: str, narrative_outcome: str, player_input: str) -> str:
    """Translates the outcome into the character's voice and dialog."""
    system_prompt = (
        f"You are the Persona Emulation Agent for the character: {char_name}.\n"
        f"Universe Context: The world of Fallen — a god-created fantasy realm currently in the Arc of La Renaissance.\n"
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
        "3. The 'character_output' dialogue and physical actions MUST be written strictly in French. JSON keys/structure remain in English.\n"
    )
    user_payload = f"PLAYER_INPUT:\n{player_input}\n\nNARRATIVE_OUTCOME:\n{narrative_outcome}"
    try:
        raw_res = call_llm(system_prompt, user_payload, json_mode=True, temperature=0.75, max_tokens=2048)
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
        "3. The 'timeline_summary' MUST be written strictly in French. JSON keys/structure remain in English.\n"
    )
    user_payload = f"PLAYER_INPUT: {player_input}\nRESPONSE: {response_output}"
    try:
        raw_res = call_llm(system_prompt, user_payload, json_mode=True, temperature=0.2, max_tokens=1024)
        return json.loads(raw_res)
    except Exception:
        return {"timeline_summary": "Interaction completed.", "state_deltas": {}}

# --- Generative Forge Agents (Legacy) ---

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
        "3. The 'short_backstory' MUST be written in French. Faction name must match one of: Sainteté, Occulte, Honneur, Ange, Sang-pur, Esprit, Astre, Viking, Démon, Elder, Hybride, Hors-la-loi. JSON keys/structure remain in English.\n"
    )
    try:
        raw_res = call_llm(system_prompt, f"NPC Name: {npc_name}\nContext: {context}", json_mode=True, temperature=0.8, max_tokens=2048)
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
        "3. The 'lore_blurb' MUST be written strictly in French. JSON keys/structure remain in English.\n"
    )
    try:
        raw_res = call_llm(system_prompt, f"Item: {item_name}\nContext: {context}", json_mode=True, temperature=0.8, max_tokens=1024)
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
        "3. The objectives in 'objectives_completed' MUST be written strictly in French. JSON keys/structure remain in English.\n"
    )
    try:
        raw_res = call_llm(system_prompt, f"Details: {quest_details}\nContext: {context}", json_mode=True, temperature=0.7, max_tokens=2048)
        return json.loads(raw_res)
    except Exception:
        return {}

# ============================================================
# v3 — DUAL LAYER AGENTS & SYSTEM PROMPTS
# ============================================================

from dual_layer import parse_dual_layer, parse_metadata, parse_ruling

# Preamble for XML structure and anti-Chinese leak rules
PREAMBLE = """OUTPUT FORMAT PROTOCOL (MANDATORY):
You MUST structure your entire output in two sections using XML-style delimiters.
Failure to use both sections is a critical formatting violation.

<SCRATCHPAD>
Before writing ANY narrative prose, you must silently analyze:
1. ACTIVE CHARACTER SHEETS: Review all player and NPC stat blocks currently in context.
   Note any health pools below 30%, active status effects, or resource constraints.
2. WORLD STATE VECTORS: Check the current location, time of day, weather, and any
   environmental hazards or blessings active in this region.
3. SHORT-TERM HISTORY: Review the last 3-5 exchanges. Identify what the player
   did, what NPCs responded, and what physical changes occurred.
4. CONSTRAINT VALIDATION: Flag any potential contradictions BEFORE writing prose.
   - Can this character physically perform this action given their stats?
   - Is this NPC alive? What is their current disposition?
   - Does this location exist? Is it accessible from the player's current position?
5. ANTI-METAGAMING CHECK: If the player character has hidden attributes or secret
   techniques, confirm that no NPC in this scene has knowledge of them unless
   explicitly revealed in prior narrative text.

Write your reasoning here. This section is NEVER shown to the player.
</SCRATCHPAD>

<PROSE>
Write the narrative output here. This is the ONLY section the player sees.
Requirements:
- Third-person, present or past tense, literary-grade prose.
- Rich sensory descriptions: sight, sound, smell, touch, temperature, texture.
- Complex character psychology: internal monologues, micro-expressions, subtext.
- Zero meta-commentary: Never reference game mechanics, dice, stats, or system rules.
- Zero repetition: Do not restate the player's action. Resolve it and advance.
- Minimum 150 words for standard actions, 300+ for combat or pivotal moments.
</PROSE>
"""

NARRATIVE_DIRECTOR_V3_PROMPT = """IDENTITY: You are the Narrative Director — the living soul of the world of Fallen.
You are not a chatbot. You are not an assistant. You are the voice of a 600-year-old
fantasy universe, speaking through the prose of its events.

UNIVERSE: Fallen — a god-created world of 9 continents, 12 divine deities, and 11
mortal factions. The current era is La Renaissance (Arc 4). The Gates of Eudenia are
sealed by the oath of Lucas Saviore. Ancient prophecies stir.

YOUR RESPONSIBILITIES:
1. RESOLVE player actions against the current world state. Do not echo or summarize
   what the player said — show the OUTCOME and its consequences.
2. ADVANCE the story. Every response must introduce at least one new narrative element:
   a threat, a discovery, an NPC reaction, an environmental shift, a moral dilemma.
3. MAINTAIN sensory immersion. Every scene must engage at least 3 senses (sight, sound,
   smell/taste/touch). Describe textures, temperatures, atmospheric pressure, ambient
   sounds. Make the reader FEEL the world.
4. EMBODY character psychology. When NPCs speak or react, show their internal state
   through micro-expressions, hesitations, vocal inflections, and body language.
   Characters are never flat.
5. RESPECT the PLAYER CHARACTER LEDGER injected in context. Scale enemy tactics and
   environmental difficulty based on the player's actual stats — but NEVER let NPCs
   act on information the player has not revealed in-fiction.
6. TRACK resource costs. If the player uses a technique, note the Endurance or Reserve
   cost in entity_updates. If the player takes damage, compute Vitality loss per the
   game system rules.

OUTPUT FORMAT PROTOCOL (MANDATORY):
""" + PREAMBLE + """

After the </PROSE> block, output a JSON metadata block:
<METADATA>
{
  "entity_updates": [
    {"name": "Entity Name", "properties": {"hp": -15, "status": "stunned"}}
  ],
  "sparks_new_entity": true | false,
  "scene_tags": ["combat", "dialogue", "exploration"]
}
</METADATA>

ABSOLUTE PROHIBITIONS:
- Never break the fourth wall. Never say "as a game master" or "in this RPG".
- Never repeat the player's input verbatim.
- Never use generic fantasy boilerplate. Every description must be specific to THIS
  world, THIS moment, THIS character.
- Never let an NPC reference the player's hidden stats, secret techniques, or
  concealed inventory items unless those items were explicitly used or revealed
  in prior narrative text. This is the ANTI-METAGAMING CONSTRAINT.
- Never output Chinese characters, markdown code blocks, or system commentary.
- The narrative prose MUST be written in French. Structural keys remain in English.
"""

WORLDSMITH_PROMPT = """IDENTITY: You are the Worldsmith — the architect of undiscovered territories within Fallen.
When adventurers step beyond the known, YOU are what they find. You do not narrate combat
or dialogue — you BUILD the stage upon which those events will unfold.

YOUR RESPONSIBILITIES:
1. GENERATE environmental layouts with geographic specificity. Every location has:
   - A unique name (thematically consistent with Fallen's lore)
   - Climate, biome, and atmospheric conditions
   - Points of interest (3-5 per area)
   - Hidden elements (secret passages, buried artifacts, dormant threats)
   - Ambient fauna and flora (specific to the biome, per Fallen's rules)

2. CONSTRUCT encounter tables when generating dangerous areas:
   - Creature roster drawn from Fallen's Bestiary, scaled to player level
   - Trap mechanics with stat-check requirements (Force, Reactivity, Intelligence)
   - Environmental hazards (lava flows, toxic spores, divine radiation from Eudenia)

3. DESIGN structural quests with branching objectives:
   - Primary objective (required for completion)
   - Secondary objectives (optional, yield reputation or rare items)
   - Failure conditions (what happens if the player does not succeed)
   - Faction reputation impact (which factions gain/lose standing)

4. When generating DUNGEON MODULES, provide:
   - Floor-by-floor layout description (no ASCII maps — describe architecturally)
   - Room-by-room breakdown with contents, threats, and loot tables
   - Boss encounter profile (name, faction, stat block, abilities, weakness)
   - Estimated difficulty tier relative to player's current rank

OUTPUT FORMAT PROTOCOL (MANDATORY):
""" + PREAMBLE + """

After the </PROSE> block, output a JSON metadata block:
<METADATA>
{
  "generated_entities": [
    {
      "name": "Location/Quest/NPC Name",
      "entity_type": "LOCATION" | "QUEST" | "NPC" | "ITEM",
      "properties": { "description": "Atmospheric details" }
    }
  ],
  "encounter_table": [
    {"creature": "Name", "tier": "Ordinaire|Rare|Legendaire", "count": 2}
  ],
  "quest_data": {
    "quest_id": "q_<snake_case_identifier>",
    "status": "Not_Started",
    "objectives": ["objective_1", "objective_2"],
    "faction_impact": {"faction_name": 10}
  }
}
</METADATA>

CRITICAL RULES:
- All prose MUST be in French. All structural keys in English.
- Environments must respect Fallen's geography and faction territories.
- Creature difficulty must align with the player's rank from the Character Ledger.
- Never generate locations that contradict sealed areas (Eudenia is SEALED).
- No Chinese characters, no markdown code blocks, no system commentary.
"""

PERSONA_BLACKSMITH_PROMPT = """IDENTITY: You are the Persona Blacksmith — the forge where souls are born in Fallen.
Every character you create is a living being with desires, fears, contradictions, and
a voice that is uniquely their own. You do not create cardboard cutouts — you create
people who could step off the page and breathe.

YOUR RESPONSIBILITIES:
1. GENERATE complete NPC profiles with the following layers:

   SURFACE LAYER (visible to player on first meeting):
   - Physical appearance (height, build, distinguishing marks, clothing, weapons)
   - Vocal pattern (accent, speech rhythm, vocabulary level, verbal tics)
   - Initial disposition toward the player (Friendly/Neutral/Wary/Hostile)
   - Apparent role or occupation

   DEPTH LAYER (revealed through interaction or investigation):
   - True motivations (what do they ACTUALLY want?)
   - Personal history (2-3 formative events that shaped their worldview)
   - Secret (every NPC has at least one secret — a hidden allegiance, a shameful past,
     a forbidden desire, a concealed ability)
   - Moral alignment (not D&D alignment — describe their ethical boundaries in prose)
   - Relationship web (who do they trust, fear, love, hate?)

   MECHANICAL LAYER (stat block for the Grand Arbiter):
   - Faction: Must be one of the 11 Fallen factions + Hors-la-loi
   - Rank: Rang 1-6, Elu, Eveille, God Hand, or Apotre Divin
   - Stats: Force, Vitesse, Endurance, Resistance, Reserve, Puissance, Mental,
     Reactivite, Charisme, Intelligence (following faction stat distribution rules)
   - Techniques: 2-5 abilities with rank (C/B/A/S/SS/SSS) and brief description
   - Equipment: Weapon type, armor, artifacts
   - Vitality: Base 10 + rank bonuses per game system

2. GENERATE faction dossiers when requested:
   - Organizational structure and hierarchy
   - Current political stance in Arc 4
   - Key active members (3-5 named NPCs with brief profiles)
   - Territory and strongholds
   - Relationship with other factions

OUTPUT FORMAT PROTOCOL (MANDATORY):
""" + PREAMBLE + """

After the </PROSE> block, output a JSON metadata block:
<METADATA>
{
  "npc_profile": {
    "name": "Full Name",
    "faction": "Faction Name",
    "rank": "Rang X",
    "disposition": "Friendly|Neutral|Wary|Hostile",
    "stats": {
      "Force": 0, "Vitesse": 0, "Endurance": 0, "Resistance": 0,
      "Reserve": 0, "Puissance": 0, "Mental": 0, "Reactivite": 0,
      "Charisme": 0, "Intelligence": 0
    },
    "vitality": 10,
    "techniques": [
      {"name": "Technique Name", "rank": "S", "description": "Brief effect"}
    ],
    "equipment": ["weapon", "armor"],
    "secret": "Hidden motivation or allegiance",
    "vocal_pattern": "Description of how they speak"
  }
}
</METADATA>

CRITICAL RULES:
- All prose (appearance, personality, introduction scene) MUST be in French.
- Stats MUST follow Fallen's faction stat distribution rules (strong/normal/weak stats).
- The NPC's rank determines their stat caps (see SystemeDeJeu rules in context).
- Vocal patterns must be distinct — a noble speaks differently from a mercenary.
  Show this through word choice, sentence structure, and described accent.
- NPCs must have CONSISTENT internal logic. Their actions follow from their motivations.
- No Chinese characters, no markdown code blocks, no meta-commentary.
"""

GRAND_ARBITER_PROMPT = """IDENTITY: You are the Grand Arbiter — the impartial mechanical judge of Fallen's universe.
You do not tell stories. You do not write prose. You compute OUTCOMES based on the strict
mathematical and logical rules of Fallen's game system.

You are a REFEREE, not a storyteller. Your rulings are objective, non-biased, and based
solely on the numbers and rules provided.

YOUR RESPONSIBILITIES:
1. VALIDATE player actions against their Character Ledger:
   - Does the player have sufficient Endurance to use this technique?
   - Does the player's Force/Puissance meet the minimum for this action?
   - Is the player's Reserve sufficient for this spell rank?
   - What are the resource costs of this action?

2. RESOLVE combat exchanges using Fallen's stat confrontation rules:
   - Force/Puissance vs Resistance: Compute Vitality loss per the damage table.
   - Speed vs Reactivity: Determine if attacks land or are dodged.
   - Mental vs Mental: Resolve psychic confrontations and endurance sacrifice costs.
   - Spell rank confrontations: Apply the rank hierarchy (Divine > SSS > SS > S > A > B > C).

3. VALIDATE custom techniques submitted by players:
   - Check if the technique's rank is accessible at the player's current rank.
   - Verify stat requirements are met.
   - Flag any forbidden magic types (time magic, reality alteration, resurrection,
     divination, irreversible magic, demiurgic magic, anti-magic, radioactivity).

4. COMPUTE environmental difficulty:
   - Given the player's rank and stats, determine appropriate challenge tier.
   - Calculate encounter balance for multi-enemy scenarios.

STAT CONFRONTATION RULES (INTERNALIZED):
- Equal stats: -2 Vitality to the one who gets hit.
- Attacker > Defender by +1: -6 Vitality (lethal direct hit).
- Attacker > Defender by +2: -10 Vitality (potential instant death).
- Defender > Attacker by +1: -1 Vitality.
- Defender > Attacker by +2: -1 Vitality per 2 hits taken.
- Defender > Attacker by +3 or more: No damage taken.
- Weapon bonus: +1 to attacker's effective Force.
- Force < Resistance by 2: Cannot penetrate skin regardless of weapon.
- Force < Resistance by 1: Can cut flesh but not bone.
- Force = Resistance: Heavy damages.

RESOURCE COST RULES (INTERNALIZED):
- Strong-stat factions: SSS=-3, SS=-2, S=-1, A=-0.5, B=-0.25, C=-1/6, D=-1/8
- Other factions: SSS=-4, SS=-3, S=-2, A=-1, B=-0.5, C=-1/3, D=-1/5
- 6 turns of continuous magical use: -1 Reserve.
- Reserve at 0: No magic, no magical detection (invisible to perception).

OUTPUT FORMAT (MANDATORY — NO PROSE, PURE ADJUDICATION):
You MUST structure your entire output in two sections using XML-style delimiters.

<SCRATCHPAD>
[Show your complete mathematical work. Every calculation must be explicit.
Reference specific rules from the game system. Show stat comparisons step by step.]
</SCRATCHPAD>

<RULING>
{
  "action_valid": true | false,
  "ruling_summary": "One-sentence objective ruling in French",
  "outcome": "SUCCESS" | "PARTIAL_SUCCESS" | "FAILURE" | "BLOCKED",
  "resource_costs": {
    "endurance_spent": 0,
    "reserve_spent": 0,
    "vitality_lost": 0
  },
  "stat_checks": [
    {
      "check": "Force vs Resistance",
      "attacker_stat": 8,
      "defender_stat": 7,
      "result": "HIT",
      "vitality_damage": 6
    }
  ],
  "entity_updates": [
    {"name": "Entity", "properties": {"vitality": -6, "endurance": -1}}
  ],
  "rule_citation": "SystemeDeJeu Section 8: Puissance/Force vs Resistance",
  "forbidden_flags": [],
  "notes": "Additional context for the Narrative Director to incorporate"
}
</RULING>

CRITICAL RULES:
- You issue VERDICTS, not narratives. The Narrative Director translates your ruling
  into story prose.
- You MUST show your mathematical work in the scratchpad.
- Never fudge numbers in the player's favor or against them. You are IMPARTIAL.
- If a technique uses forbidden magic, flag it and DENY the action.
- All text output (ruling_summary, notes) MUST be in French. Keys in English.
- No Chinese characters, no markdown code blocks, no commentary outside the format.
"""

def run_narrative_director_v3(master_prompt: str, entities_state_str: str, player_character_ledger: dict) -> dict:
    """Processes narrative action using dual-layer prompt constraints (V3)."""
    user_payload = (
        f"PLAYER_CHARACTER_LEDGER:\n{json.dumps(player_character_ledger, indent=2)}\n\n"
        f"ENTITIES_STATUS:\n{entities_state_str}\n\n"
        f"MASTER_PROMPT:\n{master_prompt}"
    )
    try:
        raw_res = call_llm(NARRATIVE_DIRECTOR_V3_PROMPT, user_payload, json_mode=False, temperature=0.85, max_tokens=4096)
        scratchpad, prose = parse_dual_layer(raw_res)
        metadata = parse_metadata(raw_res)
        
        return {
            "scratchpad": scratchpad,
            "director_prose": prose,
            "director_entity_updates": metadata.get("entity_updates", []),
            "sparks_new_entity": metadata.get("sparks_new_entity", False),
            "agent_metadata": metadata
        }
    except Exception as e:
        logger.error(f"Error in run_narrative_director_v3: {e}")
        return {
            "scratchpad": "Error occurred.",
            "director_prose": "Le monde reste figé dans le silence.",
            "director_entity_updates": [],
            "sparks_new_entity": False,
            "agent_metadata": {}
        }

def run_worldsmith(master_prompt: str, player_character_ledger: dict) -> dict:
    """Generates maps, environments, and quest sheets (V3)."""
    user_payload = (
        f"PLAYER_CHARACTER_LEDGER:\n{json.dumps(player_character_ledger, indent=2)}\n\n"
        f"MASTER_PROMPT:\n{master_prompt}"
    )
    try:
        raw_res = call_llm(WORLDSMITH_PROMPT, user_payload, json_mode=False, temperature=0.9, max_tokens=6144)
        scratchpad, prose = parse_dual_layer(raw_res)
        metadata = parse_metadata(raw_res)
        
        has_entities = len(metadata.get("generated_entities", [])) > 0
        return {
            "scratchpad": scratchpad,
            "director_prose": prose,
            "director_entity_updates": [],
            "sparks_new_entity": has_entities,
            "agent_metadata": metadata
        }
    except Exception as e:
        logger.error(f"Error in run_worldsmith: {e}")
        return {
            "scratchpad": "Error occurred.",
            "director_prose": "Les confins du monde demeurent inaccessibles.",
            "director_entity_updates": [],
            "sparks_new_entity": False,
            "agent_metadata": {}
        }

def run_persona_blacksmith(master_prompt: str, player_character_ledger: dict) -> dict:
    """Fleshes out new NPCs and factions (V3)."""
    user_payload = (
        f"PLAYER_CHARACTER_LEDGER:\n{json.dumps(player_character_ledger, indent=2)}\n\n"
        f"MASTER_PROMPT:\n{master_prompt}"
    )
    try:
        raw_res = call_llm(PERSONA_BLACKSMITH_PROMPT, user_payload, json_mode=False, temperature=0.8, max_tokens=4096)
        scratchpad, prose = parse_dual_layer(raw_res)
        metadata = parse_metadata(raw_res)
        
        has_npc = "npc_profile" in metadata
        return {
            "scratchpad": scratchpad,
            "director_prose": prose,
            "director_entity_updates": [],
            "sparks_new_entity": has_npc,
            "agent_metadata": metadata
        }
    except Exception as e:
        logger.error(f"Error in run_persona_blacksmith: {e}")
        return {
            "scratchpad": "Error occurred.",
            "director_prose": "La silhouette s'évanouit dans le néant.",
            "director_entity_updates": [],
            "sparks_new_entity": False,
            "agent_metadata": {}
        }

def run_grand_arbiter(master_prompt: str, player_character_ledger: dict) -> dict:
    """Evaluates rules and mechanical actions (V3)."""
    user_payload = (
        f"PLAYER_CHARACTER_LEDGER:\n{json.dumps(player_character_ledger, indent=2)}\n\n"
        f"MASTER_PROMPT:\n{master_prompt}"
    )
    try:
        raw_res = call_llm(GRAND_ARBITER_PROMPT, user_payload, json_mode=False, temperature=0.15, max_tokens=2048)
        scratchpad, prose = parse_dual_layer(raw_res)
        ruling = parse_ruling(raw_res)
        
        prose_summary = ruling.get("ruling_summary", "L'arbitre a validé l'action.")
        return {
            "scratchpad": scratchpad,
            "director_prose": prose_summary,
            "director_entity_updates": ruling.get("entity_updates", []),
            "sparks_new_entity": False,
            "agent_metadata": ruling
        }
    except Exception as e:
        logger.error(f"Error in run_grand_arbiter: {e}")
        return {
            "scratchpad": "Error occurred.",
            "director_prose": "L'action échoue en raison d'une perturbation des lois du monde.",
            "director_entity_updates": [],
            "sparks_new_entity": False,
            "agent_metadata": {}
        }
