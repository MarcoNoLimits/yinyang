import json
import re
import logging
from agents import call_llm, clean_json_response, _IS_OLLAMA

logger = logging.getLogger("router")

VALID_ROUTES = {"NARRATIVE_DIRECTOR", "WORLDSMITH", "PERSONA_BLACKSMITH", "GRAND_ARBITER", "SCENARIO_ARCHITECT"}

ROUTER_SYSTEM_PROMPT = """You are the Intent Classification Router for a fantasy RPG narrative engine.

Analyze the player's action and context, then classify the intent into exactly ONE of five categories.

CATEGORIES:
- NARRATIVE_DIRECTOR: Standard gameplay — combat actions, dialogue, exploration, reactions,
  story progression, entering rooms, interacting with known NPCs, using abilities.
  This is the DEFAULT route for any ambiguous input.

- WORLDSMITH: World expansion — the player is entering a NEW area that has not been described,
  requesting a dungeon layout, asking to see what is in an unexplored region, or triggering
  a quest/event module. Keywords: "explore", "what is beyond", "enter the unknown", "new area",
  "dungeon", "quest board", "what quests", "map", "generate area".

- PERSONA_BLACKSMITH: Character creation — the player encounters a new NPC that needs to be
  fully generated (backstory, stats, personality, dialect), or requests faction details,
  or asks "who is this person". Keywords: "who is", "describe this character", "tell me about",
  "new NPC", "faction leader", "merchant", "stranger".

- GRAND_ARBITER: Mechanical adjudication — the player attempts a complex action that requires
  stat validation (combat resolution, skill checks, resource costs), questions a ruling,
  submits a custom technique for validation, or explicitly asks for a rules check.
  Keywords: "can I do this", "attack", "cast", "use technique", "check stats", "validate",
  "how much damage", "is this allowed", "rule check".

- SCENARIO_ARCHITECT: GM/admin scenario creation — the requester is a Game Master building
  new content: a quest, a world event, a newspaper edition (Murmures), or a dungeon module.
  This route is for CREATION, not player play. The input is a GM instruction, not a player
  action within the fiction.
  Keywords: "créer une quête", "générer un événement", "murmures de fallen", "donjon",
  "nouveau scénario", "create quest", "new event", "dungeon layout", "génère un",
  "rédige un", "construis un donjon", "édition du journal", "scénario".

OUTPUT FORMAT:
Return a single JSON object:
{
  "route": "NARRATIVE_DIRECTOR" | "WORLDSMITH" | "PERSONA_BLACKSMITH" | "GRAND_ARBITER" | "SCENARIO_ARCHITECT",
  "reasoning": "<brief_one_sentence_explanation>"
}

CRITICAL RULES:
1. Return ONLY the raw JSON object. No markdown, no code blocks, no commentary.
2. When in doubt, default to NARRATIVE_DIRECTOR.
3. If the player's action contains BOTH narrative and mechanical elements (e.g., "I attack
   the guard with my fire sword"), route to NARRATIVE_DIRECTOR — the Arbiter will be
   consulted separately if stat validation is needed.
4. SCENARIO_ARCHITECT takes priority over WORLDSMITH when the input is clearly a GM creation
   request (uses imperative verbs like "crée", "génère", "construis", "rédige").
5. Do not output any Chinese characters or boilerplate text.
"""

async def classify_intent(master_prompt: str, player_input: str) -> str:
    """
    Classifies player intent and returns the target agent route.
    
    Uses a three-layer strategy:
      1. Call LLM (without json_mode for Ollama to avoid empty responses).
      2. Try to parse JSON from the response.
      3. If JSON fails, scan the raw text for known route names.
    
    Returns one of: NARRATIVE_DIRECTOR, WORLDSMITH, PERSONA_BLACKSMITH, GRAND_ARBITER, SCENARIO_ARCHITECT
    """
    input_lower = player_input.lower()
    scenario_keywords = ["génère", "générer", "crée", "créer", "rédige", "construis", "create quest", "generate quest", "scénario", "murmures"]
    quest_keywords = ["quête", "dungeon", "donjon", "événement", "journal"]
    if any(sk in input_lower for sk in scenario_keywords) and any(qk in input_lower for qk in quest_keywords):
        logger.info("Router deterministic match: SCENARIO_ARCHITECT")
        return "SCENARIO_ARCHITECT"

    user_payload = (
        f"CONTEXT SUMMARY:\n{master_prompt[:2000]}\n\n"
        f"PLAYER ACTION:\n{player_input}"
    )
    
    raw = ""
    try:
        # For Ollama: skip json_mode to avoid empty-response bug with complex prompts.
        # We do our own JSON extraction from the raw text instead.
        use_json_mode = not _IS_OLLAMA
        raw = await call_llm(ROUTER_SYSTEM_PROMPT, user_payload, json_mode=use_json_mode, temperature=0.1, max_tokens=1024)
        
        # If we skipped json_mode, clean the response ourselves
        if _IS_OLLAMA and raw:
            raw = clean_json_response(raw)
        
        if not raw:
            logger.warning("Router received empty LLM response. Defaulting to NARRATIVE_DIRECTOR.")
            return "NARRATIVE_DIRECTOR"
        
        result = json.loads(raw)
        route = result.get("route", "NARRATIVE_DIRECTOR").upper()
        reasoning = result.get("reasoning", "")
        
        # Enforce no Chinese character leakage in the logs
        if re.search(r"[\u4e00-\u9fff]", reasoning):
            reasoning = "Classified under narrative and exploration bounds."
            
        if route not in VALID_ROUTES:
            logger.warning(f"Router returned invalid route '{route}'. Defaulting to NARRATIVE_DIRECTOR.")
            route = "NARRATIVE_DIRECTOR"
        
        logger.info(f"Router classified intent as: {route} | Reason: {reasoning}")
        return route
        
    except json.JSONDecodeError:
        # Fallback: scan raw text for route keywords
        logger.warning(f"Router JSON parse failed. Attempting text-based fallback. Raw: {raw[:300]}")
        return _extract_route_from_text(raw)
        
    except Exception as e:
        logger.error(f"Router classification failed: {e}. Defaulting to NARRATIVE_DIRECTOR. Raw: {raw[:300] if raw else 'N/A'}")
        return "NARRATIVE_DIRECTOR"


def _extract_route_from_text(raw: str) -> str:
    """Fallback: extract a valid route name from unstructured text."""
    upper = raw.upper()
    # Check in priority order (most specific first)
    for route in ["SCENARIO_ARCHITECT", "PERSONA_BLACKSMITH", "GRAND_ARBITER", "WORLDSMITH", "NARRATIVE_DIRECTOR"]:
        if route in upper:
            logger.info(f"Router text-fallback matched: {route}")
            return route
    logger.warning("Router text-fallback found no match. Defaulting to NARRATIVE_DIRECTOR.")
    return "NARRATIVE_DIRECTOR"


