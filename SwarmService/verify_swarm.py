"""
Fallen Universe Swarm Verification Script
==========================================
Calls the /chat endpoint for each scenario and verifies the response
has the expected structure. Continuity-test scenarios (3 and 6) additionally
assert that the Critic flagged impossible / dead-NPC actions.
"""

import sys
import json
import logging
import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_URL = "http://localhost:8000"
UNIVERSE_ID = "f0000000-0000-0000-0000-000000000001"   # Fallen universe

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("verify_swarm")

# ---------------------------------------------------------------------------
# Test scenarios — Fallen universe
# ---------------------------------------------------------------------------
SCENARIOS = [
    # ------------------------------------------------------------------
    # Scenario 1: Exploration in Atlantica (companion-less)
    # ------------------------------------------------------------------
    {
        "session_id": "verify-fallen-001",
        "description": "Exploration without companion in Atlantica",
        "payload": {
            "universe_id": UNIVERSE_ID,
            "session_id": "verify-fallen-001",
            "player_input": (
                "Je marche dans les rues de l'Atlantide. "
                "Une silhouette encapuchonnée me fait signe depuis une ruelle."
            ),
            "char_id": None,
            "char_name": None,
            "char_personality": None,
            "timeline_context": "",
        },
        "continuity_check": False,
    },
    # ------------------------------------------------------------------
    # Scenario 2: Encounter with Vladislaus Nocturnus
    # ------------------------------------------------------------------
    {
        "session_id": "verify-fallen-002",
        "description": "Dangerous NPC encounter in Ithis during full moon",
        "payload": {
            "universe_id": UNIVERSE_ID,
            "session_id": "verify-fallen-002",
            "player_input": (
                "Je cherche Vladislaus Nocturnus dans la forêt d'Ithis "
                "sous la pleine lune."
            ),
            "char_id": None,
            "char_name": "Vladislaus Nocturnus",
            "char_personality": (
                "Vampire King de Ithis. Ancien, calculateur, redoutable. "
                "Parle avec courtoisie mais menace plane à chaque mot."
            ),
            "timeline_context": "",
        },
        "continuity_check": False,
    },
    # ------------------------------------------------------------------
    # Scenario 3: Continuity Test — trying to enter Eudenia (SEALED)
    # The Critic MUST flag this action as impossible / lore-violating.
    # ------------------------------------------------------------------
    {
        "session_id": "verify-fallen-003",
        "description": "Continuity check: Eudenia is sealed — action must be corrected by Critic",
        "payload": {
            "universe_id": UNIVERSE_ID,
            "session_id": "verify-fallen-003",
            "player_input": (
                "Je tente de franchir les portes scellées d'Eudenia de force."
            ),
            "char_id": None,
            "char_name": None,
            "char_personality": None,
            "timeline_context": (
                "Eudenia est scellée par décret divin. "
                "Aucun mortel ne peut en franchir les portes. "
                "Statut: SCELLÉ — accès impossible."
            ),
        },
        # Expect the world_event / critic response to contain at least one
        # of these continuity-rejection keywords.
        "continuity_check": True,
        "continuity_keywords": [
            "scellé", "sealed", "impossible", "interdit", "refusé",
            "ne peut pas", "critic", "rejected", "correction",
        ],
    },
    # ------------------------------------------------------------------
    # Scenario 4: Guild Quest — investigate missing ships at Kaos
    # ------------------------------------------------------------------
    {
        "session_id": "verify-fallen-004",
        "description": "Quest investigation at Kaos harbor",
        "payload": {
            "universe_id": UNIVERSE_ID,
            "session_id": "verify-fallen-004",
            "player_input": (
                "Je me rends au port de Kaos pour enquêter sur "
                "la disparition des navires marchands."
            ),
            "char_id": None,
            "char_name": None,
            "char_personality": None,
            "timeline_context": (
                "Plusieurs navires marchands ont disparu près de Kaos. "
                "Dragon Noir est soupçonné d'être impliqué."
            ),
        },
        "continuity_check": False,
    },
    # ------------------------------------------------------------------
    # Scenario 5: Lorebook retrieval — asking about Conrak and hors-la-loi
    # ------------------------------------------------------------------
    {
        "session_id": "verify-fallen-005",
        "description": "Lorebook-driven knowledge query about Conrak",
        "payload": {
            "universe_id": UNIVERSE_ID,
            "session_id": "verify-fallen-005",
            "player_input": (
                "Qui est Conrak et pourquoi les hors-la-loi "
                "le vénèrent-ils tant à Roahx ?"
            ),
            "char_id": None,
            "char_name": None,
            "char_personality": None,
            "timeline_context": "",
        },
        "continuity_check": False,
    },
    # ------------------------------------------------------------------
    # Scenario 6: Continuity Test — interacting with Eleanor (dead NPC)
    # Eleanor is missing/dead from the failed Mozarak expedition (Event 2).
    # The Critic MUST flag any interaction with her as a continuity error.
    # ------------------------------------------------------------------
    {
        "session_id": "verify-fallen-006",
        "description": (
            "Continuity check: Eleanor is missing/dead from failed Event 2 "
            "— Critic must flag"
        ),
        "payload": {
            "universe_id": UNIVERSE_ID,
            "session_id": "verify-fallen-006",
            "player_input": (
                "Je parle à Eleanor et lui demande "
                "où se trouve l'oeil de minuit."
            ),
            "char_id": None,
            "char_name": "Eleanor",
            "char_personality": None,
            "timeline_context": (
                "Eleanor disparue lors de l'expédition de Mozarak. "
                "Statut: MIA/Mort présumé. "
                "L'oeil de minuit non récupéré."
            ),
        },
        # Expect the world_event / critic response to contain at least one
        # of these continuity-rejection keywords.
        "continuity_check": True,
        "continuity_keywords": [
            "disparue", "morte", "dead", "missing", "mia",
            "impossible", "critic", "rejected", "correction",
            "présumé", "oeil de minuit",
        ],
    },
]

# ---------------------------------------------------------------------------
# Required top-level keys every /chat response must contain
# ---------------------------------------------------------------------------
EXPECTED_RESPONSE_FIELDS = [
    "session_id",
    "universe_id",
    "director_prose",
    "critic_approved",
    "final_dialogue",
    "extracted_summary",
    "world_event",
]


# ---------------------------------------------------------------------------
# Runner helpers
# ---------------------------------------------------------------------------

def _check_continuity(response_data: dict, keywords: list[str]) -> bool:
    """
    Return True if any of the supplied keywords appear (case-insensitive)
    in the world_event, critic_feedback, or director_prose fields.
    """
    haystack = " ".join([
        str(response_data.get("world_event", "")),
        str(response_data.get("critic_feedback", "")),
        str(response_data.get("director_prose", "")),
        str(response_data.get("final_dialogue", "")),
    ]).lower()

    return any(kw.lower() in haystack for kw in keywords)


def run_scenario(scenario: dict) -> bool:
    """Execute one scenario against /chat and validate the response."""
    sid = scenario["session_id"]
    desc = scenario["description"]
    payload = scenario["payload"]

    logger.info("")
    logger.info("=" * 60)
    logger.info(f"  Scenario : {sid}")
    logger.info(f"  Desc     : {desc}")
    logger.info(f"  Input    : {payload['player_input']}")
    logger.info("=" * 60)

    url = f"{BASE_URL}/chat"

    try:
        resp = requests.post(url, json=payload, timeout=180)
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        logger.error(
            f"[{sid}] FAILED — cannot connect to {url}. "
            "Make sure the SwarmService is running on http://localhost:8000."
        )
        return False
    except requests.exceptions.HTTPError as exc:
        logger.error(f"[{sid}] FAILED — HTTP error: {exc} | body: {resp.text[:500]}")
        return False
    except Exception as exc:
        logger.error(f"[{sid}] FAILED — unexpected error: {exc}", exc_info=True)
        return False

    try:
        data = resp.json()
    except json.JSONDecodeError:
        logger.error(f"[{sid}] FAILED — response is not valid JSON: {resp.text[:500]}")
        return False

    # ---- Structural check ------------------------------------------------
    missing = [f for f in EXPECTED_RESPONSE_FIELDS if f not in data]
    if missing:
        logger.error(f"[{sid}] FAILED — missing fields in response: {missing}")
        logger.error(f"  Full response: {json.dumps(data, ensure_ascii=False)[:800]}")
        return False

    logger.info(f"[{sid}] critic_approved  : {data.get('critic_approved')}")
    logger.info(f"[{sid}] critic_feedback  : {data.get('critic_feedback', '')[:200]}")
    logger.info(f"[{sid}] director_prose   : {data.get('director_prose', '')[:200]}")
    logger.info(f"[{sid}] final_dialogue   : {data.get('final_dialogue', '')[:200]}")
    logger.info(f"[{sid}] extracted_summary: {data.get('extracted_summary', '')[:200]}")
    logger.info(f"[{sid}] world_event      : {data.get('world_event', '')[:200]}")

    # ---- Continuity check (Scenarios 3 & 6) ------------------------------
    if scenario.get("continuity_check"):
        keywords = scenario.get("continuity_keywords", [])
        flagged = _check_continuity(data, keywords)
        if not flagged:
            logger.error(
                f"[{sid}] FAILED — Critic did NOT flag this continuity violation! "
                f"Expected one of {keywords} in the response."
            )
            logger.error(
                f"  world_event     : {data.get('world_event', '')[:400]}"
            )
            logger.error(
                f"  critic_feedback : {data.get('critic_feedback', '')[:400]}"
            )
            return False
        logger.info(
            f"[{sid}] Continuity violation correctly flagged by Critic. ✓"
        )

    logger.info(f"[{sid}] PASSED ✓")
    return True


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def verify_all_scenarios() -> bool:
    logger.info("")
    logger.info("╔══════════════════════════════════════════════════════╗")
    logger.info("║   Fallen Universe Swarm Verification — 6 Scenarios  ║")
    logger.info("╚══════════════════════════════════════════════════════╝")
    logger.info(f"  Universe ID : {UNIVERSE_ID}")
    logger.info(f"  Base URL    : {BASE_URL}")
    logger.info("")

    results = {}
    for scenario in SCENARIOS:
        ok = run_scenario(scenario)
        results[scenario["session_id"]] = ok

    logger.info("")
    logger.info("━" * 60)
    logger.info("  FALLEN UNIVERSE SWARM VERIFICATION — SUMMARY")
    logger.info("━" * 60)

    all_passed = True
    for sid, ok in results.items():
        status = "PASSED ✓" if ok else "FAILED ✗"
        logger.info(f"  {sid}  →  {status}")
        if not ok:
            all_passed = False

    logger.info("━" * 60)

    if all_passed:
        logger.info("  ALL FALLEN UNIVERSE SWARM TESTS PASSED!")
    else:
        logger.error("  SOME FALLEN UNIVERSE SWARM TESTS FAILED.")

    logger.info("━" * 60)
    logger.info("")

    return all_passed


if __name__ == "__main__":
    success = verify_all_scenarios()
    sys.exit(0 if success else 1)
