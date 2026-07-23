import json
import logging
import asyncio
import httpx
from config import OPENROUTER_API_KEY, OPENROUTER_URL, MODEL_NAME, GEMINI_API_KEY

logger = logging.getLogger("agents")

# Global reusable async client for LLM API calls (reuses TCP / TLS connections)
async_client = httpx.AsyncClient(timeout=180.0)

# Detect if we're targeting a local Ollama instance
_IS_OLLAMA = "localhost" in OPENROUTER_URL or "127.0.0.1" in OPENROUTER_URL
if _IS_OLLAMA:
    logger.info(f"[LLM Config] Targeting LOCAL Ollama at {OPENROUTER_URL} with model '{MODEL_NAME}'")
else:
    logger.info(f"[LLM Config] Targeting OpenRouter at {OPENROUTER_URL} with model '{MODEL_NAME}'")

def clean_json_response(text: str) -> str:
    """Strips markdown wrappers, <think> blocks, and extracts raw JSON.
    
    Handles the Gemma4 pattern where the model may place JSON *inside*
    a <think> block with nothing after it.  Strategy:
      1. Strip markdown fences.
      2. Try to find a JSON object/array in the full text (including think blocks).
      3. If found, return it.  If not, strip think blocks and retry.
    """
    import re
    text = text.strip()

    # --- Step 1: Strip markdown code fences ---
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline:].strip()
        else:
            text = text[3:].strip()
        if text.endswith("```"):
            text = text[:-3].strip()

    # --- Step 2: Try to extract JSON from the full text (think blocks included) ---
    extracted = _find_json_object(text)
    if extracted:
        return extracted

    # --- Step 3: Strip <think> blocks and try again ---
    stripped = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE).strip()
    if stripped:
        extracted = _find_json_object(stripped)
        if extracted:
            return extracted

    # --- Step 4: Last resort — look inside the <think> block itself ---
    think_match = re.search(r"<think>(.*?)</think>", text, flags=re.DOTALL | re.IGNORECASE)
    if think_match:
        extracted = _find_json_object(think_match.group(1))
        if extracted:
            return extracted

    # Nothing found — return whatever text we have so callers can attempt fallback
    return stripped or text


def _find_json_object(text: str) -> str:
    """Return the outermost JSON object or array substring, or empty string."""
    first_brace = text.find("{")
    first_bracket = text.find("[")
    start_idx = -1
    end_char = ""
    if first_brace != -1 and (first_bracket == -1 or first_brace < first_bracket):
        start_idx = first_brace
        end_char = "}"
    elif first_bracket != -1:
        start_idx = first_bracket
        end_char = "]"

    if start_idx != -1:
        end_idx = text.rfind(end_char)
        if end_idx != -1 and end_idx > start_idx:
            return text[start_idx:end_idx + 1]
    return ""

async def call_llm(
    system_prompt: str,
    user_content: str,
    json_mode: bool = False,
    temperature: float = 0.2,
    max_tokens: int = 4096,
    _caller_max_tokens_override: bool = False
) -> str:
    """Executes an asynchronous call to the LLM model (either Gemini or OpenRouter) with exponential backoff retries."""
    if GEMINI_API_KEY:
        # Route to Gemini API
        model_to_use = MODEL_NAME
        if not model_to_use.startswith("gemini-"):
            model_to_use = "gemini-2.5-flash"
            
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_to_use}:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_content}]
                }
            ],
            "systemInstruction": {
                "parts": [{"text": system_prompt}]
            },
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }
        if json_mode:
            payload["generationConfig"]["responseMimeType"] = "application/json"
            
        max_retries = 5
        base_delay = 0.5  # seconds
        
        for attempt in range(max_retries + 1):
            try:
                response = await async_client.post(
                    url,
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
                try:
                    res_content = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if json_mode:
                        res_content = clean_json_response(res_content)
                    return res_content
                except (KeyError, IndexError) as parse_err:
                    logger.error(f"Error parsing Gemini response: {data}. Error: {parse_err}")
                    raise httpx.RequestError(f"Unexpected response structure from Gemini API: {parse_err}")
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                if attempt == max_retries:
                    logger.error(f"Error calling Gemini LLM after {max_retries} retries: {e}. Falling back.")
                    raise RuntimeError(f"Gemini LLM call failed: {e}")
                
                delay = base_delay * (2 ** attempt)
                if isinstance(e, httpx.HTTPStatusError):
                    status_code = e.response.status_code
                    if status_code in (429, 503):
                        retry_after = e.response.headers.get("Retry-After")
                        if retry_after:
                            try:
                                delay = max(float(retry_after), 1.0)
                            except ValueError:
                                pass
                        else:
                            delay = max(delay, 2.0 * (attempt + 1))
                
                logger.warning(f"Gemini LLM call failed with {e}. Retrying in {delay:.2f}s (Attempt {attempt+1}/{max_retries})...")
                await asyncio.sleep(delay)
    else:
        # Route to OpenRouter API (Legacy / Fallback)
        headers = {
            "Content-Type": "application/json"
        }
        if OPENROUTER_API_KEY and OPENROUTER_API_KEY != "ollama":
            headers["Authorization"] = f"Bearer {OPENROUTER_API_KEY}"
            headers["HTTP-Referer"] = "http://localhost:8000"
            headers["X-Title"] = "YinYang Engine"
        
        payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            "temperature": temperature,
            "max_tokens": max(max_tokens, 1024) if _IS_OLLAMA else max_tokens
        }
        
        if json_mode and not _IS_OLLAMA:
            payload["response_format"] = {"type": "json_object"}
        
        # Keep model loaded in GPU memory between requests (10 minute idle timeout)
        if _IS_OLLAMA:
            payload["keep_alive"] = "30m"
            
        # Check if using mock key
        if "sk-or-v1-mock-key" in OPENROUTER_API_KEY:
            return get_mock_fallback(system_prompt, user_content, json_mode)

        max_retries = 5
        base_delay = 0.5  # seconds
        
        for attempt in range(max_retries + 1):
            try:
                response = await async_client.post(
                    f"{OPENROUTER_URL}/chat/completions",
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
                res_content = data["choices"][0]["message"]["content"].strip()
                if json_mode:
                    if _IS_OLLAMA:
                        logger.info(f"[Ollama raw before cleanup ({len(res_content)} chars)]: {res_content[:500]}")
                    res_content = clean_json_response(res_content)
                return res_content
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                if attempt == max_retries:
                    logger.error(f"Error calling OpenRouter LLM after {max_retries} retries: {e}. Falling back.")
                    return get_mock_fallback(system_prompt, user_content, json_mode)
                
                delay = base_delay * (2 ** attempt)
                if isinstance(e, httpx.HTTPStatusError):
                    status_code = e.response.status_code
                    if status_code == 429:
                        retry_after = e.response.headers.get("Retry-After")
                        if retry_after:
                            try:
                                delay = max(float(retry_after), 1.0)
                            except ValueError:
                                pass
                        else:
                            delay = max(delay, 2.0 * (attempt + 1))
                
                logger.warning(f"OpenRouter LLM call failed with {e}. Retrying in {delay:.2f}s (Attempt {attempt+1}/{max_retries})...")
                await asyncio.sleep(delay)

def get_mock_fallback(system_prompt: str, user_content: str, json_mode: bool) -> str:
    """No mock fallbacks — always calls the real LLM."""
    raise RuntimeError(
        "LLM call failed and no mock fallback is configured. "
        "Check your OPENROUTER_API_KEY and network connectivity."
    )

# --- Agent Runners ---

async def run_scanner_agent(player_input: str) -> list:
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
        raw_res = await call_llm(system_prompt, player_input, json_mode=True, temperature=0.2, max_tokens=1024)
        res = json.loads(raw_res)
        return res.get("keywords", [])
    except Exception:
        return ["general"]

async def run_director_agent(master_prompt: str, entities_state_str: str) -> dict:
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
        raw_res = await call_llm(system_prompt, user_payload, json_mode=True, temperature=0.85, max_tokens=4096)
        return json.loads(raw_res)
    except Exception:
        return {
            "world_event": "The world moves forward in silence.",
            "entity_updates": [],
            "sparks_new_entity": False
        }

async def run_critic_agent(draft_prose: str, timeline_summary: str) -> dict:
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
        raw_res = await call_llm(system_prompt, user_payload, json_mode=True, temperature=0.1, max_tokens=1024)
        return json.loads(raw_res)
    except Exception:
        return {"approved": True, "correction_reason": ""}

async def run_persona_agent(char_name: str, char_personality: str, narrative_outcome: str, player_input: str) -> str:
    """Translates the outcome into the character's voice and dialogue."""
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
        raw_res = await call_llm(system_prompt, user_payload, json_mode=True, temperature=0.75, max_tokens=2048)
        res = json.loads(raw_res)
        return res.get("character_output", "...")
    except Exception:
        return "..."

async def run_chronicler_agent(player_input: str, response_output: str) -> dict:
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
        raw_res = await call_llm(system_prompt, user_payload, json_mode=True, temperature=0.2, max_tokens=1024)
        return json.loads(raw_res)
    except Exception:
        return {"timeline_summary": "Interaction completed.", "state_deltas": {}}

# --- Generative Forge Agents (Legacy) ---

async def run_soul_forger(npc_name: str, context: str) -> dict:
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
        raw_res = await call_llm(system_prompt, f"NPC Name: {npc_name}\nContext: {context}", json_mode=True, temperature=0.8, max_tokens=2048)
        return json.loads(raw_res)
    except Exception:
        return {}

async def run_itemizer(item_name: str, context: str) -> dict:
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
        raw_res = await call_llm(system_prompt, f"Item: {item_name}\nContext: {context}", json_mode=True, temperature=0.8, max_tokens=1024)
        return json.loads(raw_res)
    except Exception:
        return {}

async def run_quest_architect(quest_details: str, context: str) -> dict:
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
        raw_res = await call_llm(system_prompt, f"Details: {quest_details}\nContext: {context}", json_mode=True, temperature=0.7, max_tokens=2048)
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
7. ADVERSARIAL COMBAT INTENSITY (NPCs MUST PUT UP A REAL FIGHT): Opponents are lethal and highly active.
   - Enemies do NOT act as passive targets that simply take damage. They fight to win.
   - Enemies must use tactical intelligence: they actively dodge, parry, invoke magical shields/barriers, execute counters, and exploit the player's status or resource weaknesses (e.g., attacking when the player has low endurance or magical reserve).
   - Scale difficulty dynamically: regular minions are standard challenges, but elite guards, deities, and boss encounters (such as Vladislaus, Gabriella, or the Gods) must feel significantly stronger than the player. They will use superior stats, chain SS/SSS techniques, and force the player to fight defensively, utilize clever combos, or retreat.
8. UNIFIED NARRATIVE PROSE: The prose block must fully incorporate both the environmental narration, the physical actions, and all dialogues of the NPCs. Do not leave the NPC's speech or response to a separate block. Everything must flow cohesively within the French prose.

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
mathematical and logical rules of Fallen's game system as defined in the SystemeDeJeu below.

You are a REFEREE, not a storyteller. Your rulings are objective, non-biased, and based
solely on the numbers and rules provided in the scene description.

==========================================================================
SYSTEME DE JEU — FALLEN (RÈGLES OFFICIELLES — VERSION COMPLÈTE INTÉGRÉE)
==========================================================================

■ VITALITÉ (Points de vie)
- Base 10 pour tout le monde.
- Rang 3/4 : +1 vitalité max (→ 11). Rang 5 : +1 (→ 12). Rang 6 Élu : +2 (→ 14).
- Éveillé : +2 (→ 16). God Hand : +2 (→ 18). Apôtre Divin : +2 (→ 20).

■ CONFRONTATION Force/Puissance vs Résistance (Section 8)
- Résistance = Attaque : perte de -2 en vitalité.
- Attaque > Résistance de +1 : -6 vitalité (frappe mortelle directe).
- Attaque > Résistance de +2 : -10 vitalité (mort directe dans certains cas).
- Résistance > Attaque de +1 : -1 vitalité.
- Résistance > Attaque de +2 : -1 vitalité par 2 attaques encaissées.
- Résistance > Attaque de +3 ou plus : AUCUN dégât.
- Bonus arme tranchante : +1 à la Force effective de l'attaquant.
- Force < Résistance de 2 : Impossible de transpercer la peau.
- Force < Résistance de 1 : Peut trancher la chair, pas les os.
- Force = Résistance : Dégâts importants.

■ CONFRONTATION DE SORTS/TECHNIQUES (Section 9)
• Ordre de supériorité : Divin > SSS > SS > S > A > B > C
• Cas général — Puissance/Force égale :
  - Deux sorts du même rang s'annulent mutuellement.
  - Si l'un a 2 rangs de plus (ex: Rang A vs Rang C), le rang A gagne sans match.
  - Obligatoirement Rang S minimum pour annuler un Rang S.
• Cas spéciaux RANG SUPRÉMATIE :
  - Un sort Rang SS bat TOUT sort inférieur à SS peu importe la puissance.
  - Un sort Rang SSS bat TOUT sort inférieur à SSS peu importe la puissance.
  - Un sort DIVIN bat tout.
• Puissance/Force de l'un = autre -1 : Il faut 2 sorts du moins puissant vs 1 sort du plus puissant. En 1v1, la puissance supérieure gagne (sauf ss/sss).
• Puissance/Force de l'un = autre -2 : Le plus puissant gagne sans problème.
• ANNULATION MUTUELLE : Deux techniques du MÊME rang qui s'affrontent directement s'annulent totalement. Aucun dégât de technique sur les utilisateurs. Seulement les actions physiques qui suivent sont résolues.
• SUPRÉMATIE DE RANG : Rang S contre Rang A → le Rang S détruit complètement le Rang A. L'utilisateur du Rang A ne reçoit aucune protection de sa technique.

■ RESSOURCES — ENDURANCE (techniques physiques)
• Factions Force forte + Honneur + Hors-la-loi :
  SSS=-3, SS=-2, S=-1, A=-0.5, B=-0.25, C=-1/6, D=-1/8
• Autres factions :
  SSS=-4, SS=-3, S=-2, A=-1, B=-0.5, C=-1/3, D=-1/5
- 6 tours d'efforts physiques continus : -1 endurance.
- Endurance à 0 : Le personnage s'évanouit.

■ RESSOURCES — RÉSERVE MAGIQUE (sorts)
• Factions Puissance forte (Occulte, Sainteté, Ange, etc.) :
  SSS=-3, SS=-2, S=-1, A=-0.5, B=-0.25, C=-1/6, D=-1/8
• Autres factions :
  SSS=-4, SS=-3, S=-2, A=-1, B=-0.5, C=-1/3, D=-1/5
- 6 tours de magie continue : -1 réserve.
- Réserve à 0 : Impossible d'utiliser la magie, invisible à la perception.

■ ATTAQUES DE BASE
- Rang D. Même règles que ci-dessus pour l'endurance.
- P10 = F10 (égalité). Si écart de 1 : 2 attaques du plus faible = 1 attaque du plus fort. Écart de 2+ : le plus fort gagne sans contestation.
- Une attaque de base perd TOUJOURS face à une technique si la différence est de 2 ou moins en faveur de la technique.

■ PORTÉE DES SORTS
  Rang C: 10m | Rang B: 20m | Rang A: 50m | Rang S: 100m (250/500m pour Élu).
  SS: 1000m (stat d'attaque >11 requis). SSS: 2000m (stat 15 minimum).

■ COOLDOWNS STANDARD
  Rang C/D: 1 tour | Rang B: 2 tours | Rang A: 3 tours | Rang S: 5 tours.

■ INVOCATIONS
- Rang S min. Durée max 7 tours.
- Stats Rang S invocation : 39/50 (+10 max sur stats). Une stat limitée à 8/8.
- Invocation S : 2 attaques S, le reste A.
- Non-Élu : 1 invocation Rang S max sur le terrain.

■ TECHNIQUES DE BOOST
- Boost Rang A : +1 sur 3 stats max. Boost Rang S : +2 sur 2-3 stats ou +1 sur 5 stats.
- Pas de boost SS/SSS. Durée max 7 tours. Impossible de cumuler des boosts.

■ RÉACTIVITÉ vs VITESSE (Section 10)
- Réactivité < Vitesse de -1 : peut réagir mais difficilement, sans marge de manœuvre.
- Mouvements complexes/feintes : nécessite éléments extérieurs si réac inférieure.

■ TECHNIQUES MENTALES (Section 11)
- Mental égal : la cible s'en rend compte, peut sacrifier 1 pt endurance pour se défaire.
- Mental inférieur de 1 : sacrifice de 4 pts endurance pour résister (si INT >= lanceur-1).
- Mental inférieur de 2 : sacrifice de 8 pts endurance (si INT = lanceur).

■ STATISTIQUES DES RANGS (Factions 6 rangs)
- Rang 1-2 : Stats faibles 5, normales 6, fortes 7.
- Rang 3-4 : Stats faibles 7, normales 8, fortes 9. Vitalité max 11.
- Rang 5 : Stats faibles 8, normales 9, fortes 10. Vitalité max 12.
- Rang 6 (Élu) : Stats faibles 9, normales 10, fortes 11. Vitalité max 14.
- Éveillé : Stats faibles 11, normales 12, fortes 13. Vitalité max 16.
- God Hand : Stats faibles 14, normales 15, fortes 16. Vitalité max 18.
- Apôtre Divin : Stats faibles 18, normales 19, fortes 20. Vitalité max 20.

■ GÉNÉRAUX
- Vitesse d'un sort = Puissance de l'individu -1.
- Vitesse d'un saut = Force -1. Vitesse de chute = Vitesse de saut -3.
- Résistance > Attaque de 3+ : Aucune dégât, peu importe le rang (exception restrictions spécifiques de sorts).
- Une différence de 1 dans un affrontement de statistique = victoire du supérieur.
- Une différence de 2 = victoire écrasante, quels que soient les rangs.

==========================================================================
FIN DES RÈGLES OFFICIELLES
==========================================================================

YOUR RESPONSIBILITIES:
1. READ STATS EXACTLY AS DECLARED:
   - CRITICAL: Use the Force, Résistance, Puissance, and all other stats EXACTLY as stated
     in the scene description. If the player declares Force 11, compute with 11. Period.
   - If a character sheet is provided use it. If not, work purely from the text.
   - NEVER invent, estimate, or substitute a stat that wasn't explicitly given.

2. APPLY RANK SUPREMACY BEFORE COMPUTING DAMAGE:
   - Resolve all technique rank clashes FIRST, before any stat calculations.
   - Rank S vs Rank A → Rank S DESTROYS Rank A instantly. Rank A user has zero protection.
   - Rank S vs Rank S → MUTUAL CANCELLATION. Both techniques negate each other. No technique
     damage to either user. Only follow-up physical actions are resolved.

3. RESOLVE ALL EXCHANGES STEP BY STEP (DETAILED MATHEMATICAL ANALYSIS):
   - List every confrontation in order: technique clashes first, then stat confrontations.
   - Show each calculation explicitly in the SCRATCHPAD, explaining exactly how stats like Force, Résistance, or Puissance interact under Section 8 and Section 9 (e.g., Attaque > Résistance, Puissance difference, etc.).
   - Explicitly detail the impact of any active status effects (e.g., Brûlure, Gelé) or buffs/debuffs on the final numbers.

4. MANDATORY MECHANICAL EXPLANATION & SUMMARY:
   - In the "notes" field, provide a clear, step-by-step mechanical explanation in French of what transpired between the combatants (e.g. why an attack failed to penetrate defense, why a spell was canceled or overwhelmed, how status modifiers ticked, and exactly how resources changed).
   - Summarize the current battlefield state: who is standing, their remaining Vitality, Endurance, and Reserve, and active conditions.

5. NO SHEET REQUIRED:
   - If no character sheet is provided, adjudicate solely from what is described in the scene.
   - Do not refuse or delay because a stat is missing — if it's not stated, note it as "non fourni"
     and estimate based on the described rank/level if available, or skip that sub-check.

OUTPUT FORMAT (MANDATORY):
<SCRATCHPAD>
[Show all mathematical work step by step. Reference exact rule citations from the SystemeDeJeu above.]
</SCRATCHPAD>

<RULING>
{
  "action_valid": true | false,
  "ruling_summary": "One-sentence objective ruling in French",
  "outcome": "SUCCESS" | "PARTIAL_SUCCESS" | "FAILURE" | "BLOCKED" | "ANNULATION_MUTUELLE",
  "resource_costs": {
    "endurance_spent": 0,
    "reserve_spent": 0,
    "vitality_lost": 0
  },
  "stat_checks": [
    {
      "check": "Force vs Résistance",
      "attacker_name": "Fafnir",
      "attacker_stat": 11,
      "defender_name": "The Sunless",
      "defender_stat": 9,
      "result": "HIT",
      "vitality_damage": 6,
      "rule": "Attaque > Résistance de +2 → -10 PV"
    }
  ],
  "technique_resolutions": [
    {
      "attacker_technique": "Pulse Rang S",
      "defender_technique": "Lames d'air Rang A",
      "resolution": "SUPREMATIE: Rang S détruit Rang A. Lames annulées.",
      "rule": "Section 9: Ordre de supériorité S > A"
    }
  ],
  "entity_updates": [
    {"name": "The Sunless", "properties": {"vitality": -10}}
  ],
  "rule_citation": "SystemeDeJeu Section 9 — Confrontation de sorts et techniques",
  "forbidden_flags": [],
  "notes": "Résumé complet de la situation après l'échange."
}
</RULING>

CRITICAL RULES:
- VERDICTS ONLY. No narrative prose. No storytelling.
- Show every calculation. Be impartial.
- If a technique uses forbidden magic, flag it and DENY the action.
- All text values (ruling_summary, notes, resolution) MUST be in French. Keys in English.
- No Chinese characters, no markdown code blocks, no commentary outside the format.
"""

# ============================================================
# SCENARIO ARCHITECT — Content Forge (v3)
# Generates: Quêtes, Événements, Murmures, Donjons
# Fast-path agent: bypasses Scanner / Librarian / Weaver / Router
# ============================================================

SCENARIO_ARCHITECT_PROMPT = """IDENTITY: You are the Scenario Architect — the supreme Game Master and narrative engineer of the world of Fallen.
You are not a storyteller reacting to player actions. You are a CREATOR building the stage itself:
the quests players chase, the events that shake continents, the newspapers that spread rumours,
and the dungeons that bury legends.

LORE GROUNDING GUIDELINES:
You MUST ground every scenario strictly in the geography, pantheon, factions, and events of the Fallen universe. Avoid generic fantasy tropes. Do not invent new gods, factions, or main cities. Instead, weave the content around:
- Continents & Zones:
  * Kaos: Continent of warriors and honor, home to noble houses like the Silvester.
  * Baraen: Arid continent of sands and the Astre faction. Features the city of Faubourg, Mornia, Mirea, and the cursed city of Rezopia. A massive pyramid city has recently emerged between Rezopia and Faubourg.
  * Roahx: Wild mercenary continent under the season of Vulcain (heavy volcanic activity and lava flows). Cities like Miroslava and Maboule.
  * Icetoon: Frozen Norse continent of Vikings and Jarls. Features Ford-Odin (Nord, Est, Ouest) and the clan Ragnvald. A giant draconic silhouette was recently sighted in the western frozen seas.
  * Ithis: Cursed magical continent of darkness, occult dungeons, werewolves, and the forbidden forest of Vianum (deadly during full moon).
  * Mozarak: Volcanic continent of sulfur, magma pits, and demonic cults/temples.
  * Al-Far: Céleste island of maritime traders. Currently suffering from ship disappearances and raids from Rasmus.
  * Atlantica: The sea-continent of mages and towers.
  * Sacror: Céleste holy continent of angels.
- Pantheon:
  * Conrak: God of fortune and luck (white hair, golden mask, worshipped in Roahx by mercenaries and thieves).
  * Malakath: God of witchcraft, curses, and deceit (shadowy form, worshipped in occult fortresses).
  * Anubis: jackal-headed God of death, souls, and mummification.
  * Ézéchiel: God of glory, light, and magic (golden eyes, red hair).
  * Khālian: Moon goddess of shapeshifters (scaley tail, white hair).
  * Drahen: Proud god of courage and honor (golden irises).
- Active Narrative Hooks: Use these to connect your quests/events:
  * The disappearance of commercial ships from Kaos in the seas towards Al-Far.
  * The mysterious pyramid city that emerged in Baraen.
  * The massive dragon spotted in the western ice fields of Icetoon.
  * Rasmus's continuous raids on Al-Far.
  * The dangerous full-moon anomalies in the forest of Vianum (Ithis).

CONTENT TYPE DETECTION (read the request carefully and select ONE):
▸ QUÊTE    — A player-facing mission with objectives, roles, and rewards.
▸ ÉVÉNEMENT — A large-scale world event with phases, guilds, and public consequences.
▸ MURMURE  — An edition of the in-world newspaper "Les Murmures de Fallen" (Faits Divers + Enquêtes).
▸ DONJON   — A multi-floor dungeon crawl with rooms, traps, a boss, and a loot table.

""" + PREAMBLE + """

After the </PROSE> block, output a JSON metadata block:
<METADATA>
{
  "content_type": "QUÊTE" | "ÉVÉNEMENT" | "MURMURE" | "DONJON",

  // ── QUÊTE fields (omit for other types) ──────────────────────────────
  "quest_id": "q_<snake_case_unique_identifier>",
  "title": "...",
  "danger_level": "☠️☠️☠️",
  "zone": "Nom de la région ou du continent",
  "participants": {
    "count": 4,
    "roles": ["protecteur", "kidnappeur"]
  },
  "objectives": [
    {
      "faction": "Protecteurs",
      "goal": "...",
      "success_condition": "...",
      "failure_condition": "..."
    }
  ],
  "gm_notes": "<hidden mechanics, branching paths, secret conditions — never shown to players>",
  "rewards": {
    "pe": 2500,
    "xp": 2500,
    "pr": 210,
    "pn": 2100,
    "po_jo": "25.000.000 PO et JO",
    "items": [
      "Pack (2 Nectar de vigueur, 2 sang rouges, 1 sang du Griffon, 1Sang de L'Ekhidna)",
      "2 Talismans dragon"
    ],
    "special_gain": "1 Loup du givre (Super rare)" | null,
    "appreciation": "Tu as prouvé ta valeur, en 1 contre plusieurs avec en plus un poids mort. Je suis fan."
  },
  "special_rules": [],

  // ── ÉVÉNEMENT fields (omit for other types) ───────────────────────────
  "event_id": "evt_<snake_case>",
  "title": "...",
  "scope": "LOCAL" | "REGIONAL" | "MONDIAL",
  "location": "...",
  "participating_guilds": [],
  "phases": [
    {
      "phase": 1,
      "name": "Prémices",
      "description": "...",
      "player_notes": "...",
      "deadline": ""
    }
  ],
  "possible_outcomes": [
    {
      "outcome": "Succès",
      "condition": "...",
      "world_impact": "..."
    },
    {
      "outcome": "Échec",
      "condition": "...",
      "world_impact": "..."
    }
  ],
  "gm_notes": "...",
  "participation_rules": [],

  // ── MURMURE fields (omit for other types) ────────────────────────────
  "edition": "Première édition" | "Deuxième édition" | "...",
  "faits_divers": [
    {
      "region": "Kaos",
      "headline": "...",
      "body": "..."
    }
  ],
  "enquetes": [
    {
      "headline": "...",
      "body": "...",
      "quest_hook": true | false,
      "linked_quest_id": "" | null
    }
  ],

  // ── DONJON fields (omit for other types) ─────────────────────────────
  "donjon_id": "dnj_<snake_case>",
  "title": "...",
  "danger_level": "☠️☠️☠️☠️",
  "recommended_participants": 4,
  "zone": "...",
  "floors": [
    {
      "floor": 1,
      "name": "...",
      "description": "...",
      "environmental_hazard": "...",
      "rooms": [
        {
          "id": "R1",
          "name": "...",
          "threats": "...",
          "loot": "...",
          "trap": "" | null,
          "stat_check": "" | null
        }
      ]
    }
  ],
  "boss": {
    "name": "...",
    "faction": "...",
    "rank": "Rang 5",
    "stats": {
      "Force": 10, "Vitesse": 9, "Endurance": 10, "Resistance": 9,
      "Reserve": 8, "Puissance": 9, "Mental": 8, "Reactivite": 9,
      "Charisme": 7, "Intelligence": 8
    },
    "vitality": 12,
    "techniques": [
      {"name": "...", "rank": "S", "description": "..."}
    ],
    "weakness": "...",
    "loot_table": []
  },
  "completion_rewards": {
    "pe": 2500,
    "xp": 2500,
    "pr": 210,
    "pn": 2100,
    "po_jo": "25.000.000 PO et JO",
    "items": [],
    "special_gain": "1 Loup du givre (Super rare)" | null,
    "appreciation": "..."
  }
}
</METADATA>

CONTENT GENERATION RULES:
QUÊTE:
- Prose must open with an immersive contextual paragraph then clearly state objectives per faction/role.
- Always include at least one secret branching condition in gm_notes.
- Danger level must align with the stat tiers described in the Fallen game system.
- Rewards must include:
  * pe: Evolution/Energy points (usually 500 to 5000 based on danger).
  * xp: Experience points (proportional to pe).
  * pr: Relation/Reputation points (usually 50 to 500).
  * pn: Notoriety points (usually 100 to 3000).
  * po_jo: Gold coins & gems (written as string, e.g. "500.000 PO et JO").
  * items: List of custom items, potions, packs (e.g. "Pack (2 Nectar de vigueur, 2 sang rouges)").
  * special_gain: Optional rare item or mount (like "1 Loup du givre (Super rare)").
  * appreciation: Short personal commentary from the GM/entity evaluating the action.

ÉVÉNEMENT:
- Announcement prose must be epic, atmospheric, written as a public proclamation (like an admin post on a forum RP).
- Include minimum 2 phases (Prémices + Déroulement). Add a third phase for world-scale events.
- Possible outcomes must have real, permanent world_impact (political shifts, faction reputation changes, NPC deaths).
- participation_rules must mirror the real constraints seen in Scenarios.md (deadlines, zone restrictions, etc.).

MURMURE:
- Write in the distinctive Murmures de Fallen voice: journalistic but with personality, slight irony, warmth.
- Minimum 3 Faits Divers entries spanning at least 3 different regions.
- Minimum 2 Enquêtes entries. At least one must have quest_hook: true.
- Enquêtes entries should be mysterious and incomplete — they hint at deeper lore threads.

DONJON:
- Minimum 3 floors. Boss is always on the final floor.
- Each floor must have 2–4 rooms with at least one having a trap or stat_check.
- Boss stats must follow Fallen's faction stat distribution rules and rank tier caps.
- Environmental hazards must be immersive and interact with player stats (e.g., toxic spores reduce Reserve, heat requires Force checks).
- The lore_intro in the PROSE section must be 2 atmospheric paragraphs that could be read aloud to players.

ABSOLUTE PROHIBITIONS:
- Never break the fourth wall. Never reference "the game" or "the system".
- All prose (PROSE block) MUST be in French. Structural JSON keys remain in English.
- No Chinese characters, no markdown code blocks inside the METADATA, no system commentary.
- Never invent factions, locations, or deity names that contradict the established Fallen lore above.
- The SCRATCHPAD must verify: does the content_type match the request? Are all mandatory fields present?
"""

async def run_narrative_director_v3(master_prompt: str, entities_state_str: str, player_character_ledger: dict) -> dict:
    """Processes narrative action using dual-layer prompt constraints (V3)."""
    user_payload = (
        f"PLAYER_CHARACTER_LEDGER:\n{json.dumps(player_character_ledger, indent=2)}\n\n"
        f"ENTITIES_STATUS:\n{entities_state_str}\n\n"
        f"MASTER_PROMPT:\n{master_prompt}"
    )
    try:
        raw_res = await call_llm(NARRATIVE_DIRECTOR_V3_PROMPT, user_payload, json_mode=False, temperature=0.85, max_tokens=4096)
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

async def run_worldsmith(master_prompt: str, player_character_ledger: dict) -> dict:
    """Generates maps, environments, and quest sheets (V3)."""
    user_payload = (
        f"PLAYER_CHARACTER_LEDGER:\n{json.dumps(player_character_ledger, indent=2)}\n\n"
        f"MASTER_PROMPT:\n{master_prompt}"
    )
    try:
        raw_res = await call_llm(WORLDSMITH_PROMPT, user_payload, json_mode=False, temperature=0.9, max_tokens=6144)
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

async def run_persona_blacksmith(master_prompt: str, player_character_ledger: dict) -> dict:
    """Fleshes out new NPCs and factions (V3)."""
    user_payload = (
        f"PLAYER_CHARACTER_LEDGER:\n{json.dumps(player_character_ledger, indent=2)}\n\n"
        f"MASTER_PROMPT:\n{master_prompt}"
    )
    try:
        raw_res = await call_llm(PERSONA_BLACKSMITH_PROMPT, user_payload, json_mode=False, temperature=0.8, max_tokens=4096)
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

async def run_grand_arbiter(player_input: str, player_character_ledger: dict = None) -> dict:
    """Evaluates rules and mechanical actions. Works with or without a character sheet."""
    # Build a lean payload — no DB context, just the raw scene description + optional sheet
    if player_character_ledger:
        ledger_section = f"FICHE PERSONNAGE (si disponible):\n{json.dumps(player_character_ledger, indent=2, ensure_ascii=False)}\n\n"
    else:
        ledger_section = "FICHE PERSONNAGE : Non fournie — adjudication basée uniquement sur le texte.\n\n"

    user_payload = (
        f"{ledger_section}"
        f"DESCRIPTION DE LA SCÈNE / ACTION À ARBITRER:\n{player_input}"
    )
    try:
        raw_res = await call_llm(GRAND_ARBITER_PROMPT, user_payload, json_mode=False, temperature=0.15, max_tokens=2048)
        scratchpad, prose = parse_dual_layer(raw_res)
        ruling = parse_ruling(raw_res)
        
        # Build a detailed, formatted referee verdict report card
        outcome = ruling.get("outcome", "SUCCESS")
        valid = "VALIDE" if ruling.get("action_valid", True) else "INVALIDE"
        ruling_summary = ruling.get("ruling_summary", "L'arbitre a validé l'action.")
        rule_citation = ruling.get("rule_citation", "Règles générales de Fallen")
        notes = ruling.get("notes", "Aucune note additionnelle.")
        
        costs = ruling.get("resource_costs", {})
        vit_lost = costs.get("vitality_lost", 0)
        end_spent = costs.get("endurance_spent", 0)
        res_spent = costs.get("reserve_spent", 0)
        
        stat_checks = ruling.get("stat_checks", [])
        stat_checks_str = ""
        if stat_checks:
            for chk in stat_checks:
                stat_checks_str += f"- **{chk.get('check', 'Confrontation')}** : Attaquant `{chk.get('attacker_stat')}` vs Défenseur `{chk.get('defender_stat')}` → **{chk.get('result', 'RÉSULTAT')}** (Dégâts: -{chk.get('vitality_damage', 0)} PV)\n"
        else:
            stat_checks_str = "- Aucun test de statistique direct enregistré.\n"
            
        verdict_card = f"""### ⚖️ VERDICT DU GRAND ARBITRE
 
**Statut de l'action :** `{valid}` | **Résultat :** `{outcome}`
 
**Résumé :** *{ruling_summary}*
 
---
 
#### 📊 ANALYSE TECHNIQUE (SCRATCHPAD)
{scratchpad}
 
---
 
#### ⚔️ TESTS DE STATISTIQUES & IMPACTS
* **Modifications de ressources :**
  * Vitalité perdue : `-{vit_lost} PV`
  * Endurance consommée : `-{end_spent}`
  * Réserve magique consommée : `-{res_spent}`
* **Confrontations de Statistiques :**
{stat_checks_str}
 
**Citation de Règle :** *{rule_citation}*
**Notes de l'Arbitre :** *{notes}*"""

        return {
            "scratchpad": scratchpad,
            "director_prose": verdict_card,
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


# ============================================================
# TECHNIQUE FORGE AGENT — Technique Validator & Restriction Engine
# Validates player/NPC technique submissions against:
#   • Validation.md — rank restrictions, technique-type rules
#   • SystemeDeJeu.md — confrontation, cooldowns, boost limits, generalities
# ============================================================

TECHNIQUE_FORGE_PROMPT = """IDENTITY: You are the Technique Forge — the supreme validator and arbiter of technique design for the world of Fallen.
You are not a storyteller. You are a precision engineer of rules. Every technique submitted to you is measured against the complete canon of Fallen's restriction system.
Your verdicts are final, impartial, and mechanically rigorous.

==========================================================================
RÈGLES DE VALIDATION DES TECHNIQUES — FALLEN (SOURCE: Validation.md)
==========================================================================

■ NOTE GÉNÉRALE SUR L'ADAPTATION DES RANGS
Un type de technique n'est pas verrouillé à un seul rang. Les paramètres ci-dessous (portée, durée, préparation, cooldown) sont ceux du rang de référence. Toute technique d'un type déclinée à un autre rang doit adapter ses paramètres selon la grille de Restrictions Générales.

■ RESTRICTIONS GÉNÉRALES PAR RANG
• Rang C :
  - Quantité maximale : 1 par tour.
  - Sort de zone : Préparation 1 tour | Portée 10m | Durée 3 tours | Réutilisation après 3 tours.
  - Confrontation : Inefficace contre des cibles de résistance supérieure ou égale.
• Rang B :
  - Quantité maximale : 3 max.
  - Sort de zone : Préparation instantanée | Portée 20m | Durée 3 tours.
  - Dégâts : varient selon la résistance adverse.
• Rang A :
  - Quantité maximale : 5 max.
  - Sort de zone : Préparation instantanée | Portée 50m | Durée 3 tours | Réutilisation après 3 tours.
  - Dégâts : varient selon la résistance adverse.
• Rang S :
  - Quantité maximale : 10 max.
  - Sort de zone : Préparation 2 tours | Portée 100m | Durée 3 tours | Réutilisation après 5 tours.
  - Dégâts : varient selon la résistance adverse.

■ COOLDOWNS STANDARD (SystemeDeJeu Section 5)
  Rang C/D : 1 tour | Rang B : 2 tours | Rang A : 3 tours | Rang S : 5 tours.
  Cette règle s'applique à TOUS les sorts de Rang C, y compris les sorts de zone.
  Les types de technique spécifiques (Portail, Télékinésie, Contrôle Mental, Illusion, etc.) peuvent avoir des cooldowns plus longs que le standard — ces exceptions sont intentionnelles et listées explicitement dans les blocs de types ci-dessous.

■ PRÉPARATION
  Rang C, B, A : Instantanée (pas de tour de chargement).
  Rang S : 2 tours de chargement obligatoires.
  EXCEPTION: Sort de zone Rang C → 1 tour de préparation.

■ PORTÉE STANDARD DES SORTS
  Rang C: 10m | Rang B: 20m | Rang A: 50m | Rang S: 100m.
  SS: 1000m (stat d'attaque >11 requis). SSS: 2000m (stat 15 minimum).

■ TYPES DE TECHNIQUES SPÉCIFIQUES

→ ILLUSION (Réf: Rang S)
  Préparation: 2 tours | Couverture: 100m (+10m/amélioration) | Durée: 3 tours (+1/amélioration) | CD: 6 tours.
  Effets contraignants: Inefficace contre mental > vôtre | Inefficace contre rang supérieur.
  Détection: Mental égal → cible s'en rend compte immédiatement. INT supérieure de +2 (même rang) → peut voir la supercherie.
  Libération: Sacrifice d'endurance (voir SystemeDeJeu Section 11).

→ CONTRÔLE MENTAL (Réf: Rang A)
  Préparation: Instantanée | Portée: 50m (+10m/amélioration) | Durée: 3 tours (+1/amélioration) | CD: 5 tours.
  Effets: Inefficace contre mental > vôtre | Inefficace contre rang supérieur.
  Détection: Idem Illusion. Libération: Sacrifice d'endurance.

→ INTIMIDATION (Réf: Rang A)
  Préparation: Instantanée | Portée: 50m (+10m/amélioration) | Durée: 3 tours (+1/amélioration) | CD: 3 tours.
  Effets: Inefficace contre mental OU puissance >= vôtre | Inefficace contre rang supérieur.
  Contraintes: Contact visuel obligatoire | Ciblage unique.

→ CHARISME TECHNIQUE (Réf: Rang A)
  Portée: 50m (+10m/amélioration) | Durée: 3 tours | CD: 3 tours.
  Effets: Inefficace contre rang supérieur | Contact visuel obligatoire | Ciblage unique.
  Inefficace si mental adversaire >= votre Charisme. Un Charisme égal n'est pas affecté.
  Libération: voir SystemeDeJeu.

→ ENTRAVE (Tous rangs)
  Inefficace contre résistance >= vôtre. Vitesse de l'entrave: Puissance - 1.
  Libération: Force > Puissance → libération facile | Force = Puissance → -1 Endurance | Force < Puissance de 2+ → impossible.
  Non fatal contre cibles de résistance >= vôtre.

→ SPEEDBLITZ / DÉPLACEMENT (Réf: Rang S)
  Préparation: 2 tours | Portée: 20m (+10m/amélioration, max 50m) | CD: 5 tours.
  Inefficace contre réactivité >= vôtre.
  Réac inférieure de 1 + INT supérieure de 2 → peut lire vos mouvements.
  Réac inférieure de 1 + INT supérieure de 1 → surpris la première fois uniquement.

→ PORTAIL (Réf: Rang A)
  Préparation: Instantanée | Portée: 50m (+10m/amélioration) | Durée: 3 tours (+1/amélioration) | CD: 5 tours.
  Max 2 portails simultanés. Vitesse des portails: Puissance - 1. Impossible d'accéder à un lieu non visité.

→ TÉLÉPORTATION (Réf: Rang A)
  Préparation: Instantanée | Portée (combat): 50m (+10m/amélioration) | CD: 5 tours.
  Déploiement sur la zone nécessaire. Lieu non visité inaccessible.
  Téléportation à distance: soi + un objet/personne. Téléportation d'une cible distante: contact physique requis.
  Droit à une seule téléportation par activation. GLOBAL: Limité à 1 action de téléportation tous les 3 tours (SystemeDeJeu Section 12).

→ DÉMOLÉCULARISATION / DÉMATÉRIALISATION (Réf: Rang S)
  Préparation: 2 tours | Durée: 3 tours.
  Inefficace contre sorts psychiques | Inefficace contre sorts de type opposé ou désintégration.
  Impossible d'attaquer en état immatériel.

→ PROTECTION / BARRIÈRE (Réf: Rang A)
  Préparation: Instantanée | Couverture max: 50m (+10m/amélioration) | Durée: 3 tours (+1/amélioration) | CD: 3 tours.
  Inefficace contre puissance/force > votre Puissance.
  Inefficace contre sorts d'un adversaire de rang supérieur.
  Inefficace contre sorts de rang supérieur et puissance équivalente.
  Inefficace contre sorts psychiques.
  Techniques de même rang ET même puissance: annulation mutuelle avec la barrière.

→ BOOST (Réf: Rang A minimum)
  Boost Rang A : +1 sur 3 stats max. Boost Rang S : +2 sur 2-3 stats ou +1 sur 5 stats max.
  Pas de boost SS ou SSS possible.
  Malus équivalent au boost sur les stats boostées à la fin de la technique (sauf armures Honneur).
  Impossible de cumuler des sorts de boost. Durée max: 7 tours.
  Un boost ne permet pas de dépasser les limites de rang (sauf Limit Break).

→ GUÉRISON / SOIN (Réf: Rang S)
  Préparation: 2 tours | Portée: ~5m | Durée: 3 tours (+1/amélioration) | Conditions: Usage unique par RP.
  Soigne 1 personne (+1/amélioration). Stoppe toute hémorragie à l'activation.
  Régénère +4 en vitalité par tour | +3 en endurance (non continue).

→ CRÉATION ÉLÉMENTAIRE / CRÉATURES (Réf: Rang A)
  Préparation: Instantanée | Durée: 3 tours (+1/amélioration) | CD: 5 tours.
  Force et Résistance = votre Puissance. Vitesse = Puissance - 1. Réactivité = la vôtre.

→ CLONES (Réf: Rang S)
  Préparation: 2 tours | Durée: 3 tours.
  Stats des clones = vos stats - 1. Nombre: 1 clone (2 max après amélioration).
  Avec 2 clones: vos stats - 2. Aucune capacité magique pour les clones.

→ INVOCATION (Réf: Rang S — Usage unique par RP)
  Préparation: 2 tours | Durée: 3 tours (+1/amélioration) | Durée max absolue: 7 tours.
  Rang S invocation: 2 attaques S max, reste A. Max 1 invocation Rang S pour non-Élu (2 pour Élu, 3 pour God Hand).
  Stats Rang S invocation: 39/50 (+10 max). Une stat limitée à 8/8.

→ TÉLÉKINÉSIE (Réf: Rang A)
  Préparation: Instantanée | Portée: 50m (+10m/amélioration) | Durée: 3 tours (+1/amélioration) | CD: 5 tours.
  Sans dégâts: inefficace sur résistance >= vôtre. Avec dégâts: varient selon résistance adverse.

==========================================================================
RÈGLES DE CONFRONTATION MENTALE (SystemeDeJeu Section 11)
==========================================================================
• Vitesse d'une attaque mentale = Mental - 1.
• Mental égal: cible s'en rend compte, sacrifice de 1 pt endurance pour résister.
• Mental inférieur de 1 (M11 vs M10): cible peut résister si INT >= lanceur-1, coût 4 pts endurance.
• Mental inférieur de 2 (M11 vs M9): résistance si INT = lanceur, coût 8 pts endurance.
• Confrontation psychique vs psychique: le plus puissant mental l'emporte (même règle que Puissance vs Puissance).
• Sacrifices d'endurance pour résister sont PERMANENTS pour le reste du RP.

==========================================================================
RÈGLES GÉNÉRALES DE CONFRONTATION (SystemeDeJeu Sections 8 & 9)
==========================================================================
• Ordre de supériorité des rangs: Divin > SSS > SS > S > A > B > C.
• Même rang + même puissance: annulation mutuelle.
• Écart de 2 rangs (ex: A vs C): rang supérieur gagne sans match.
• Sort Rang SS: bat TOUT sort inférieur à SS quelle que soit la puissance.
• Sort Rang SSS: bat TOUT sort inférieur à SSS quelle que soit la puissance.
• Puissance = autre - 1: il faut 2 sorts du plus faible vs 1 sort du plus fort.
• Puissance = autre - 2: le plus puissant gagne sans contestation.
• Résistance > Attaque de +3 ou plus: AUCUN dégât.
• Déviation sans technique: force >= attaque requise. Coût en endurance permanent (1 pt Rang C, 2 Rang B, 3 Rang A). Impossible de dévier Rang S+.

==========================================================================
RÈGLES TECHNIQUES DE BOOST (SystemeDeJeu Section 5)
==========================================================================
• Boost minimum Rang A. Boosts SS/SSS interdits.
• Malus permanents après utilisation (sauf armures Honneur).
• Cumul de boosts interdit.
• Durée max 7 tours même amélioré.
• Ne peut pas dépasser les caps de rang (sauf Limit Break).

==========================================================================
RESTRICTIONS DE CARACTÈRE — STATISTIQUES & RANGS
==========================================================================
• Rang 1-2 (factions 6 rangs): Stats faibles ≤5, normales ≤6, fortes ≤7.
• Rang 3-4: Stats faibles ≤7, normales ≤8, fortes ≤9.
• Rang 5: Stats faibles ≤8, normales ≤9, fortes ≤10.
• Rang 6 (Élu): Stats faibles ≤9, normales ≤10, fortes ≤11.
• Éveillé: Stats faibles ≤11, normales ≤12, fortes ≤13.
• God Hand: Stats faibles ≤14, normales ≤15, fortes ≤16.
• Apôtre Divin: Stats faibles ≤18, normales ≤19, fortes ≤20.
• Achat de sorts: Rang C=500XP | B=1000XP | A=2000XP | S=3000XP | SS=5000XP (Éveillé min) | SSS=10000XP (God Hand min).
• Amélioration ordinaire: 1000XP (portée ou durée +1). Amélioration spéciale: 3000XP (rang du sort +1).
• Amélioration Rang SS: 6000XP ordinaire | Rang SSS: 9000XP (pas d'amélioration spéciale).

==========================================================================
FIN DES RÈGLES DE VALIDATION
==========================================================================

MAGIC CONTEXT (optional — provided before the techniques list when relevant):
If a MAGIC CONTEXT block is provided at the top of the user input, it describes the character's magic system, energy type, or faction-specific rules. Take this into account when evaluating confrontation conditions and effect legality. It does NOT override the rank restriction grid.

YOUR RESPONSIBILITIES:

1. VALIDATE EACH SUBMITTED TECHNIQUE INDEPENDENTLY:
   - Techniques are submitted as a numbered list (TECHNIQUE 1, TECHNIQUE 2, etc.).
   - Analyze each technique separately. Do not merge or confuse parameters between techniques.
   - For each: read name, rank, type, parameters (préparation, portée, durée, cooldown), and effects.
   - Cross-reference every parameter against the appropriate rule block above.
   - Flag ANY parameter that exceeds, contradicts, or is missing from the rule grid.

2. CHECK CHARACTER RESTRICTIONS (if sheet provided):
   - Verify technique rank is purchasable (XP cost feasibility).
   - Verify stat caps are not exceeded by any boost the technique grants.
   - Verify the total count of techniques of each rank across the full submission does not exceed the quantité maximale.

3. APPLY CONFRONTATION RULES TO DECLARED EFFECTS:
   - Verify confrontation conditions match the canon rule for the technique type.
   - Flag conditions that are more lenient than canon (overpowered).
   - Flag required conditions that are absent.

4. GENERATE A VERDICT PER TECHNIQUE:
   - APPROVED: All parameters within spec.
   - CORRECTED: One or more parameters adjusted. Provide corrected version.
   - REJECTED: Fundamentally incompatible; cannot be fixed by parameter adjustment alone.

5. PROPOSE CORRECTED VERSION (if CORRECTED or REJECTED):
   - Provide a fully compliant alternative with all corrected parameters.
   - Explain each correction with a specific rule citation.

OUTPUT FORMAT (MANDATORY):
<SCRATCHPAD>
[For EACH technique in order: type identified → rank restrictions applied → parameters checked → confrontation conditions verified → verdict computed. Label each block clearly: "TECHNIQUE 1 — [name]", "TECHNIQUE 2 — [name]", etc.]
</SCRATCHPAD>

<RULING>
{
  "verdicts": [
    {
      "technique_index": 1,
      "verdict": "APPROVED" | "CORRECTED" | "REJECTED",
      "technique_name": "Nom de la technique",
      "declared_rank": "C" | "B" | "A" | "S" | "SS" | "SSS",
      "technique_type": "Illusion | Boost | Barrière | Entrave | etc.",
      "violations": [
        {
          "parameter": "cooldown | préparation | portée | durée | effet | quantité | stat_cap | etc.",
          "declared_value": "valeur soumise",
          "allowed_value": "valeur autorisée par les règles",
          "rule_citation": "Validation.md §X / SystemeDeJeu §Y",
          "severity": "MINOR" | "MAJOR" | "CRITICAL"
        }
      ],
      "confrontation_checks": [
        {
          "condition": "Inefficace contre mental supérieur",
          "status": "PRESENT" | "MISSING" | "TOO_LENIENT" | "CORRECT",
          "note": "Explication si problème détecté"
        }
      ],
      "character_restrictions": {
        "rank_compatible": true | false,
        "quantity_within_limit": true | false,
        "stat_cap_respected": true | false,
        "xp_cost_note": "Coût en XP calculé si applicable"
      },
      "corrected_technique": {
        "préparation": "...",
        "portée": "...",
        "durée": "...",
        "cooldown": "...",
        "effets_ajustés": ["..."],
        "paramètres_modifiés": ["Liste des champs corrigés"]
      },
      "correction_rationale": "Explication détaillée en français, avec citations de règles précises.",
      "admin_notes": "Commentaires supplémentaires pour l'administrateur validateur."
    }
  ]
}
</RULING>

CRITICAL RULES:
- VERDICTS ONLY. No narrative prose. No storytelling.
- The "verdicts" array MUST contain one entry per submitted technique, in order.
- All text values (correction_rationale, admin_notes, violation notes) MUST be in French. JSON keys remain in English.
- Always cite the exact rule source (Validation.md or SystemeDeJeu Section number).
- If the technique type is not listed in the type reference blocks above, apply the Restrictions Générales par Rang and flag the type as "non répertorié".
- Never approve a technique that grants confrontation immunity where the canon requires vulnerability.
- No Chinese characters, no markdown code blocks, no commentary outside the format.
"""


def _build_verdict_card(v: dict, scratchpad: str, index: int, total: int) -> str:
    """Renders a single verdict dict into a markdown verdict card."""
    verdict = v.get("verdict", "UNKNOWN")
    technique_name = v.get("technique_name", "Technique inconnue")
    declared_rank = v.get("declared_rank", "?")
    violations = v.get("violations", [])
    correction_rationale = v.get("correction_rationale", "")
    corrected = v.get("corrected_technique")
    admin_notes = v.get("admin_notes", "")

    verdict_icon = {"APPROVED": "✅", "CORRECTED": "⚠️", "REJECTED": "❌"}.get(verdict, "❓")
    header_idx = f" [{index}/{total}]" if total > 1 else ""

    # Violations block
    if violations:
        violations_str = ""
        for viol in violations:
            sev = viol.get("severity", "MINOR")
            sev_icon = {"MINOR": "🔵", "MAJOR": "🟠", "CRITICAL": "🔴"}.get(sev, "⚪")
            violations_str += (
                f"  {sev_icon} **{viol.get('parameter', '?')}** : "
                f"`{viol.get('declared_value', '?')}` → autorisé: `{viol.get('allowed_value', '?')}` "
                f"*(règle: {viol.get('rule_citation', '?')})*\n"
            )
    else:
        violations_str = "  Aucune violation détectée.\n"

    # Corrected version block
    if corrected and isinstance(corrected, dict):
        corrected_str = "\n".join(
            f"  • **{k}** : `{val}`" for k, val in corrected.items() if k != "paramètres_modifiés"
        )
        modified = corrected.get("paramètres_modifiés", [])
        corrected_block = f"\n#### 🔧 VERSION CORRIGÉE\n{corrected_str}\n\n*Paramètres modifiés: {', '.join(modified) if modified else 'N/A'}*"
    else:
        corrected_block = ""

    # Character restrictions block
    char_checks = v.get("character_restrictions", {})
    char_block = ""
    if char_checks:
        char_block = (
            f"\n#### 👤 RESTRICTIONS DE PERSONNAGE\n"
            f"  • Rang compatible: `{'OUI' if char_checks.get('rank_compatible', True) else 'NON'}`\n"
            f"  • Quantité dans les limites: `{'OUI' if char_checks.get('quantity_within_limit', True) else 'NON'}`\n"
            f"  • Caps de stat respectés: `{'OUI' if char_checks.get('stat_cap_respected', True) else 'NON'}`\n"
        )
        if char_checks.get("xp_cost_note"):
            char_block += f"  • XP: *{char_checks['xp_cost_note']}*\n"

    card = (
        f"### {verdict_icon} FORGE DE TECHNIQUE{header_idx} — {verdict}\n\n"
        f"**Technique :** `{technique_name}` | **Rang :** `{declared_rank}` | "
        f"**Type :** `{v.get('technique_type', 'Non identifié')}`\n\n"
        f"---\n\n"
        f"#### ⚠️ VIOLATIONS\n{violations_str}"
        f"{char_block}"
        f"{corrected_block}\n\n"
        + (f"**Justification :** *{correction_rationale}*\n\n" if correction_rationale else "")
        + (f"**Notes Admin :** *{admin_notes}*\n\n" if admin_notes else "")
    )
    return card


async def run_technique_forge(
    techniques: list[str] | str,
    player_character_ledger: dict = None,
    magic_context: str = None,
) -> dict:
    """Validates one or more technique submissions against Fallen's full restriction ruleset.

    Args:
        techniques: A single technique description (str) or a list of technique descriptions.
                    Each entry should include name, rank, type, parameters, and effects.
        player_character_ledger: Optional character sheet dict for stat cap and quantity checks.
        magic_context: Optional free-text block describing the character's magic system,
                       energy type, or faction-specific rules. Prepended to the payload.

    Returns:
        Standard agent dict. director_prose contains one verdict card per technique.
        agent_metadata contains the full verdicts array.
    """
    # Normalise to list
    if isinstance(techniques, str):
        technique_list = [techniques]
    else:
        technique_list = list(techniques)

    total = len(technique_list)

    # Build the magic context block
    if magic_context and magic_context.strip():
        magic_block = f"=== MAGIC CONTEXT ===\n{magic_context.strip()}\n====================\n\n"
    else:
        magic_block = ""

    # Build the character sheet block
    if player_character_ledger:
        ledger_section = (
            f"FICHE PERSONNAGE (pour vérification des restrictions de rang et de quantité):\n"
            f"{json.dumps(player_character_ledger, indent=2, ensure_ascii=False)}\n\n"
        )
    else:
        ledger_section = "FICHE PERSONNAGE : Non fournie — restrictions de rang non vérifiables sur la fiche.\n\n"

    # Build numbered techniques block
    techniques_block = ""
    for i, tech in enumerate(technique_list, 1):
        techniques_block += f"--- TECHNIQUE {i} ---\n{tech.strip()}\n\n"

    user_payload = (
        f"{magic_block}"
        f"{ledger_section}"
        f"TECHNIQUES À VALIDER ({total} technique{'s' if total > 1 else ''}):\n\n"
        f"{techniques_block}"
    )

    # Scale max_tokens with the number of techniques
    max_tokens = min(3072 + (total - 1) * 1024, 8192)

    try:
        raw_res = await call_llm(
            TECHNIQUE_FORGE_PROMPT,
            user_payload,
            json_mode=False,
            temperature=0.1,
            max_tokens=max_tokens,
        )
        scratchpad, _ = parse_dual_layer(raw_res)
        ruling = parse_ruling(raw_res)

        # Support both the new array format and single-verdict fallback
        verdicts_list = ruling.get("verdicts")
        if not verdicts_list:
            # LLM returned a single-object ruling — wrap it
            verdicts_list = [ruling]

        # Build one card per technique
        if total > 1:
            all_cards = f"## 🔨 FORGE DE TECHNIQUES — {total} TECHNIQUES SOUMISES\n\n"
            all_cards += f"#### 📊 ANALYSE GLOBALE (SCRATCHPAD)\n{scratchpad}\n\n---\n\n"
        else:
            all_cards = f"#### 📊 ANALYSE (SCRATCHPAD)\n{scratchpad}\n\n---\n\n"

        for i, v in enumerate(verdicts_list, 1):
            all_cards += _build_verdict_card(v, scratchpad, i, total)
            if i < len(verdicts_list):
                all_cards += "\n---\n\n"

        return {
            "scratchpad": scratchpad,
            "director_prose": all_cards,
            "director_entity_updates": [],
            "sparks_new_entity": False,
            "agent_metadata": {"verdicts": verdicts_list, "total": total},
        }

    except Exception as e:
        logger.error(f"Error in run_technique_forge: {e}")
        return {
            "scratchpad": "Error occurred.",
            "director_prose": "La Forge est temporairement hors ligne. Veuillez réessayer.",
            "director_entity_updates": [],
            "sparks_new_entity": False,
            "agent_metadata": {},
        }


async def run_scenario_architect(master_prompt: str) -> dict:
    """
    Generates a Fallen universe scenario module: Quête, Événement, Murmure, or Donjon.
    Fast-path agent — receives raw GM request without full pipeline context.
    """
    try:
        raw_res = await call_llm(
            SCENARIO_ARCHITECT_PROMPT,
            master_prompt,
            json_mode=False,
            temperature=0.88,
            max_tokens=6144
        )
        scratchpad, prose = parse_dual_layer(raw_res)
        metadata = parse_metadata(raw_res)

        content_type = metadata.get("content_type", "QUÊTE")
        has_content = any(
            k in metadata
            for k in ["quest_id", "event_id", "edition", "donjon_id"]
        )

        return {
            "scratchpad": scratchpad,
            "director_prose": prose,
            "director_entity_updates": [],
            "sparks_new_entity": has_content,
            "agent_metadata": metadata,
            "content_type": content_type
        }
    except Exception as e:
        logger.error(f"Error in run_scenario_architect: {e}")
        return {
            "scratchpad": "Error occurred.",
            "director_prose": "Le scénario ne peut être forgé en ce moment. Les runes du destin sont instables.",
            "director_entity_updates": [],
            "sparks_new_entity": False,
            "agent_metadata": {},
            "content_type": "UNKNOWN"
        }
