import re
import json
import logging
from typing import Tuple, Dict, Any

logger = logging.getLogger("dual_layer")

SCRATCHPAD_PATTERN = re.compile(
    r"<SCRATCHPAD>(.*?)</SCRATCHPAD>",
    re.DOTALL | re.IGNORECASE
)
PROSE_PATTERN = re.compile(
    r"<PROSE>(.*?)</PROSE>",
    re.DOTALL | re.IGNORECASE
)
METADATA_PATTERN = re.compile(
    r"<METADATA>(.*?)</METADATA>",
    re.DOTALL | re.IGNORECASE
)
RULING_PATTERN = re.compile(
    r"<RULING>(.*?)</RULING>",
    re.DOTALL | re.IGNORECASE
)

def parse_dual_layer(raw_output: str) -> Tuple[str, str]:
    """
    Splits raw LLM output into (scratchpad, prose) layers.
    
    Returns:
        Tuple of (scratchpad_text, prose_text).
        If markers are missing, the entire output (minus any metadata/ruling blocks)
        is treated as prose, and scratchpad is empty.
    """
    scratchpad_match = SCRATCHPAD_PATTERN.search(raw_output)
    prose_match = PROSE_PATTERN.search(raw_output)
    
    scratchpad = scratchpad_match.group(1).strip() if scratchpad_match else ""
    
    if prose_match:
        prose = prose_match.group(1).strip()
    else:
        # If no prose markers, clean raw output by removing scratchpad, metadata and ruling blocks
        prose = raw_output
        prose = SCRATCHPAD_PATTERN.sub("", prose)
        prose = METADATA_PATTERN.sub("", prose)
        prose = RULING_PATTERN.sub("", prose)
        prose = prose.strip()
        if not scratchpad_match:
            logger.warning("No <SCRATCHPAD> or <PROSE> markers found in LLM output. Using cleaned raw output as prose.")

    return scratchpad, prose

def parse_metadata(raw_output: str) -> Dict[str, Any]:
    """
    Extracts and parses the JSON metadata block inside <METADATA>...</METADATA>.
    
    Returns a dict with extracted metadata.
    """
    match = METADATA_PATTERN.search(raw_output)
    if not match:
        return {}
    
    json_str = match.group(1).strip()
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse METADATA JSON block: {e}. Raw content: {json_str}")
        # Try a regex cleanup for markdown wrapper if model added it
        clean_json_str = re.sub(r"^```json\s*|```$", "", json_str, flags=re.MULTILINE | re.IGNORECASE).strip()
        try:
            return json.loads(clean_json_str)
        except Exception:
            return {}

def parse_ruling(raw_output: str) -> Dict[str, Any]:
    """
    Extracts and parses the JSON ruling block inside <RULING>...</RULING>.
    
    Returns a dict with extracted ruling details.
    """
    match = RULING_PATTERN.search(raw_output)
    if not match:
        # Fallback: if not wrapped in RULING, see if the whole output is just JSON
        try:
            cleaned = raw_output.strip()
            cleaned = SCRATCHPAD_PATTERN.sub("", cleaned).strip()
            cleaned = re.sub(r"^```json\s*|```$", "", cleaned, flags=re.MULTILINE | re.IGNORECASE).strip()
            return json.loads(cleaned)
        except Exception:
            return {}
            
    json_str = match.group(1).strip()
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse RULING JSON block: {e}. Raw content: {json_str}")
        clean_json_str = re.sub(r"^```json\s*|```$", "", json_str, flags=re.MULTILINE | re.IGNORECASE).strip()
        try:
            return json.loads(clean_json_str)
        except Exception:
            return {}
