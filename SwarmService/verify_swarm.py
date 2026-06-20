import sys
import logging
import db
import agents

# Force agents to use mock fallback
agents.OPENROUTER_API_KEY = "sk-or-v1-mock-key-for-testing"


# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("verify_swarm")

# Mock database functions to bypass local connection errors
db.retrieve_lore_entries = lambda universe_id, keywords, embedding_vector=None, limit=5: [
    {"title": "Demacian Honor", "content": "Demacian soldiers value honor above life itself.", "keywords": ["demacia", "garen"]}
]
db.update_entity_state = lambda universe_id, name, entity_type, properties, is_alive=True: None
db.get_entity_state = lambda universe_id, name: None
db.add_timeline_event = lambda universe_id, session_id, event_summary, state_delta: None
db.get_timeline_history = lambda universe_id, limit=10: [
    {"event_summary": "A deceased soldier lies in the camp.", "state_delta": {}, "timestamp": "2026-06-20T12:00:00"}
]
db.get_session_state = lambda session_id: {"session_id": session_id, "universe_id": "00000000-0000-0000-0000-000000000001", "current_state": {}}
db.update_session_state = lambda session_id, universe_id, current_state: None
db.sync_ledger_transaction = lambda universe_id, session_id, summary, deltas, player_input, assistant_output: True
db.push_chat_message = lambda session_id, role, content, max_len=40: None
db.get_chat_history = lambda session_id, limit=20: [
    {"role": "user", "content": "Hello Garen"},
    {"role": "assistant", "content": "Greetings, traveler."}
]
db.clear_chat_history = lambda session_id: None
db.get_universe = lambda universe_id: {
    "name": "League of Legends Runeterra",
    "description": "The fantasy universe of Runeterra, including Demacia, Noxus, Ionia, and other factions."
}
db.get_entities_by_type = lambda universe_id, entity_type: (
    [{"name": "Sentinel Vael", "properties": {"description": "A battle-scarred warrior patrolling the keep.", "faction": "Sentinels"}}]
    if entity_type == "NPC" else []
)


# Now import swarm_engine so it gets the mocked db module
from swarm import swarm_engine

def run_test_case(name: str, player_input: str, expected_retry_min: int, expect_approved: bool, char_name=None, char_personality=None, char_id=None):
    logger.info(f"\n--- Running Scenario: {name} ---")
    logger.info(f"Player Input: '{player_input}'")
    
    test_state = {
        "session_id": f"test_session_{name.lower().replace(' ', '_')}",
        "universe_id": "00000000-0000-0000-0000-000000000001",
        "char_id": char_id,
        "char_name": char_name,
        "char_personality": char_personality,
        "player_input": player_input,
        
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
    
    try:
        res = swarm_engine.invoke(test_state)
        
        logger.info(f"Outcome Prose: {res.get('director_prose')}")
        logger.info(f"Critic Approved: {res.get('critic_approved')}")
        logger.info(f"Total Retries: {res.get('retry_count')}")
        logger.info(f"Feedback: '{res.get('critic_feedback')}'")
        logger.info(f"Dialogue: '{res.get('final_dialogue')}'")
        logger.info(f"Chronicler Summary: {res.get('extracted_summary')}")
        
        # Validation checks
        assert res.get("critic_approved") == expect_approved, f"Expected approval state {expect_approved}, got {res.get('critic_approved')}"
        assert res.get("retry_count") >= expected_retry_min, f"Expected at least {expected_retry_min} retries, got {res.get('retry_count')}"
        
        if name == "Companionless Exploration":
            assert res.get("final_dialogue") == "", f"Expected empty dialogue for companionless exploration, got '{res.get('final_dialogue')}'"
        elif name == "Dynamic NPC Dialogue":
            assert "Sentinel Vael" in res.get("final_dialogue", ""), f"Expected Sentinel Vael dialogue, got '{res.get('final_dialogue')}'"
            
        logger.info(f"Scenario '{name}' PASSED.")
        return True
    except Exception as e:
        logger.error(f"Scenario '{name}' FAILED: {e}", exc_info=True)
        return False

def verify_all_scenarios():
    scenarios = [
        {
            "name": "Standard Conversation",
            "player_input": "I offer Garen a cup of hot tea and ask about his homeland.",
            "expected_retry_min": 0,
            "expect_approved": True,
            "char_name": "Garen",
            "char_personality": "Aggressive, patriotic Demacian soldier.",
            "char_id": 1
        },
        {
            "name": "Character Death State Contradiction",
            "player_input": "I command the deceased soldier in the camp to stand up and salute.",
            "expected_retry_min": 1,
            "expect_approved": True,
            "char_name": "Garen",
            "char_personality": "Aggressive, patriotic Demacian soldier.",
            "char_id": 1
        },
        {
            "name": "Impossible Action",
            "player_input": "I jump over the moon in a single leap to escape.",
            "expected_retry_min": 1,
            "expect_approved": True,
            "char_name": "Garen",
            "char_personality": "Aggressive, patriotic Demacian soldier.",
            "char_id": 1
        },
        {
            "name": "Companionless Exploration",
            "player_input": "I look around the dark forest.",
            "expected_retry_min": 0,
            "expect_approved": True,
            "char_name": None,
            "char_personality": None,
            "char_id": None
        },
        {
            "name": "Dynamic NPC Dialogue",
            "player_input": "I approach Sentinel Vael and ask for directions.",
            "expected_retry_min": 0,
            "expect_approved": True,
            "char_name": None,
            "char_personality": None,
            "char_id": None
        }
    ]
    
    success = True
    for s in scenarios:
        case_ok = run_test_case(
            name=s["name"],
            player_input=s["player_input"],
            expected_retry_min=s["expected_retry_min"],
            expect_approved=s["expect_approved"],
            char_name=s.get("char_name"),
            char_personality=s.get("char_personality"),
            char_id=s.get("char_id")
        )
        if not case_ok:
            success = False
            
    if success:
        logger.info("\n===============================")
        logger.info("ALL SWARM RESILIENCE TESTS PASSED!")
        logger.info("===============================")
    else:
        logger.error("\n===============================")
        logger.error("SOME SWARM RESILIENCE TESTS FAILED.")
        logger.error("===============================")
        
    return success

if __name__ == "__main__":
    success = verify_all_scenarios()
    sys.exit(0 if success else 1)
