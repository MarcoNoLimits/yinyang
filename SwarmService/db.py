import psycopg2
from psycopg2.extras import RealDictCursor, Json
import logging
from config import DATABASE_URL

logger = logging.getLogger("db")

def get_db_connection():
    """Returns a connection to the PostgreSQL database.
    
    connect_timeout=3 ensures fast failure when no local DB is available
    (e.g., during testing without Supabase). Without this, each failed
    attempt blocks for the OS default (~4s), making the full swarm pipeline
    take 90+ seconds per request.
    """
    conn = psycopg2.connect(DATABASE_URL, connect_timeout=3)
    return conn

def retrieve_lore_entries(universe_id: str, keywords: list, embedding_vector: list = None, limit: int = 5):
    """
    Retrieves relevant lorebook entries using either keyword array intersection
    or vector similarity (if embedding_vector is provided and pgvector is ready).
    Uses a highly optimized UNION hybrid search to leverage both GIN and vector indexes.
    """
    try:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if embedding_vector and len(embedding_vector) == 1536:
                    # Optimized Hybrid search: GIN keyword index + HNSW cosine similarity index via UNION CTEs
                    query = """
                        WITH keyword_matches AS (
                            SELECT title, content, keywords, embedding, 0 AS match_priority
                            FROM yinyang.lorebook_entries
                            WHERE universe_id = %s AND keywords && %s
                        ),
                        vector_matches AS (
                            SELECT title, content, keywords, embedding, 1 AS match_priority
                            FROM yinyang.lorebook_entries
                            WHERE universe_id = %s AND embedding <=> %s::vector < 0.35
                        )
                        SELECT title, content, keywords
                        FROM (
                            SELECT * FROM keyword_matches
                            UNION ALL
                            SELECT * FROM vector_matches
                            WHERE NOT (keywords && %s)
                        ) combined
                        ORDER BY match_priority ASC, (embedding <=> %s::vector) ASC
                        LIMIT %s;
                    """
                    cur.execute(query, (universe_id, keywords, universe_id, embedding_vector, keywords, embedding_vector, limit))
                else:
                    # Keyword matching only
                    query = """
                        SELECT title, content, keywords 
                        FROM yinyang.lorebook_entries
                        WHERE universe_id = %s AND keywords && %s
                        LIMIT %s;
                    """
                    cur.execute(query, (universe_id, keywords, limit))
                return list(cur.fetchall())
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error retrieving lore entries: {e}")
        return []

def update_entity_state(universe_id: str, name: str, entity_type: str, properties: dict, is_alive: bool = True):
    """
    Upserts an entity state (NPC, ITEM, LOCATION) inside the global ledger.
    """
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                query = """
                    INSERT INTO yinyang.entities (universe_id, entity_type, name, properties, is_alive, updated_at)
                    VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (universe_id, name) 
                    DO UPDATE SET 
                        properties = yinyang.entities.properties || EXCLUDED.properties,
                        is_alive = EXCLUDED.is_alive,
                        updated_at = CURRENT_TIMESTAMP;
                """
                cur.execute(query, (universe_id, entity_type, name, Json(properties), is_alive))
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error updating entity state: {e}")

def get_entity_state(universe_id: str, name: str):
    """Retrieves an entity by name from the ledger."""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT entity_id, entity_type, name, properties, is_alive FROM yinyang.entities WHERE universe_id = %s AND name = %s",
                    (universe_id, name)
                )
                return cur.fetchone()
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error getting entity state: {e}")
        return None

def add_timeline_event(universe_id: str, session_id: str, event_summary: str, state_delta: dict):
    """Adds an objective event record to the global timeline."""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                query = """
                    INSERT INTO yinyang.timeline_events (universe_id, session_id, event_summary, state_delta)
                    VALUES (%s, %s, %s, %s);
                """
                cur.execute(query, (universe_id, session_id, event_summary, Json(state_delta)))
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error adding timeline event: {e}")

def get_timeline_history(universe_id: str, limit: int = 10):
    """Gets the chronological list of event summaries for narrative context."""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT event_summary, state_delta, timestamp 
                    FROM yinyang.timeline_events 
                    WHERE universe_id = %s 
                    ORDER BY timestamp DESC 
                    LIMIT %s;
                """
                cur.execute(query, (universe_id, limit))
                return list(cur.fetchall())
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error getting timeline history: {e}")
        return []

def get_session_state(session_id: str):
    """Retrieves a player session state."""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT session_id, universe_id, current_state FROM yinyang.sessions WHERE session_id = %s", (session_id,))
                return cur.fetchone()
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error getting session state: {e}")
        return None

def update_session_state(session_id: str, universe_id: str, current_state: dict):
    """Upserts session details."""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                query = """
                    INSERT INTO yinyang.sessions (session_id, universe_id, current_state)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (session_id) 
                    DO UPDATE SET 
                        current_state = EXCLUDED.current_state;
                """
                cur.execute(query, (session_id, universe_id, Json(current_state)))
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error updating session state: {e}")

def push_chat_message(session_id: str, role: str, content: str, max_len: int = 40):
    """Pushes a message onto the session's sliding history list in PostgreSQL."""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO yinyang.session_chat_history (session_id, role, content)
                    VALUES (%s, %s, %s);
                    """,
                    (session_id, role, content)
                )
                # Keep only the last max_len messages
                cur.execute(
                    """
                    DELETE FROM yinyang.session_chat_history
                    WHERE id NOT IN (
                        SELECT id FROM yinyang.session_chat_history
                        WHERE session_id = %s
                        ORDER BY created_at DESC, id DESC
                        LIMIT %s
                    ) AND session_id = %s;
                    """,
                    (session_id, max_len, session_id)
                )
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error pushing chat message to DB cache: {e}")

def get_chat_history(session_id: str, limit: int = 20) -> list:
    """Retrieves the recent sliding history list for a session from PostgreSQL."""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT role, content FROM (
                        SELECT id, role, content, created_at FROM yinyang.session_chat_history
                        WHERE session_id = %s
                        ORDER BY created_at DESC, id DESC
                        LIMIT %s
                    ) sub
                    ORDER BY created_at ASC, id ASC;
                    """,
                    (session_id, limit)
                )
                return list(cur.fetchall())
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error getting chat history from DB cache: {e}")
        return []

def clear_chat_history(session_id: str):
    """Clears history from PostgreSQL cache for a session."""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM yinyang.session_chat_history WHERE session_id = %s;",
                    (session_id,)
                )
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error clearing chat history: {e}")

def sync_ledger_transaction(universe_id: str, session_id: str, summary: str, deltas: dict, player_input: str, assistant_output: str) -> bool:
    """
    Synchronizes the shared timeline ledger, updates entity states,
    saves chat history, and updates session state in a single PostgreSQL transaction
    using pg_advisory_xact_lock on the universe_id.
    """
    try:
        conn = get_db_connection()
        conn.autocommit = False
        try:
            with conn.cursor() as cur:
                # 1. Acquire transaction-level advisory lock on the universe
                from lock_manager import acquire_advisory_xact_lock
                lock_key_str = f"yinyang:universe:{universe_id}:lock"
                acquire_advisory_xact_lock(cur, lock_key_str)
                
                # 2. Ensure session exists and fetch current state
                cur.execute(
                    "SELECT current_state FROM yinyang.sessions WHERE session_id = %s FOR UPDATE;",
                    (session_id,)
                )
                row = cur.fetchone()
                current_state = {}
                if row:
                    current_state = row[0] if isinstance(row[0], dict) else {}
                
                # Update current state with deltas
                current_state.update(deltas)
                
                cur.execute(
                    """
                    INSERT INTO yinyang.sessions (session_id, universe_id, current_state)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (session_id) 
                    DO UPDATE SET current_state = EXCLUDED.current_state;
                    """,
                    (session_id, universe_id, Json(current_state))
                )
                
                # 3. Write objective timeline event
                cur.execute(
                    """
                    INSERT INTO yinyang.timeline_events (universe_id, session_id, event_summary, state_delta)
                    VALUES (%s, %s, %s, %s);
                    """,
                    (universe_id, session_id, summary, Json(deltas))
                )
                
                # 4. Update database entities if deltas contain explicit status changes
                if deltas:
                    for name, val in deltas.items():
                        if isinstance(val, dict):
                            entity_type = val.get("entity_type", "NPC")
                            is_alive = val.get("is_alive", True)
                            cur.execute(
                                """
                                INSERT INTO yinyang.entities (universe_id, entity_type, name, properties, is_alive, updated_at)
                                VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                                ON CONFLICT (universe_id, name) 
                                DO UPDATE SET 
                                    properties = yinyang.entities.properties || EXCLUDED.properties,
                                    is_alive = EXCLUDED.is_alive,
                                    updated_at = CURRENT_TIMESTAMP;
                                """,
                                (universe_id, entity_type, name, Json(val), is_alive)
                            )
                
                # 5. Save Chat history to database cache
                # User message
                cur.execute(
                    """
                    INSERT INTO yinyang.session_chat_history (session_id, role, content)
                    VALUES (%s, 'user', %s);
                    """,
                    (session_id, player_input)
                )
                # Assistant message
                cur.execute(
                    """
                    INSERT INTO yinyang.session_chat_history (session_id, role, content)
                    VALUES (%s, 'assistant', %s);
                    """,
                    (session_id, assistant_output)
                )
                
                # Maintain sliding window (max_len = 40)
                cur.execute(
                    """
                    DELETE FROM yinyang.session_chat_history
                    WHERE id NOT IN (
                        SELECT id FROM yinyang.session_chat_history
                        WHERE session_id = %s
                        ORDER BY created_at DESC, id DESC
                        LIMIT 40
                    ) AND session_id = %s;
                    """,
                    (session_id, session_id)
                )
                
            conn.commit()
            logger.info("Ledger and chat history successfully synchronized in transaction.")
            return True
        except Exception as tx_err:
            conn.rollback()
            logger.error(f"Transaction failed, rolling back: {tx_err}")
            raise tx_err
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error in sync_ledger_transaction: {e}")
        return False

def get_entities_by_type(universe_id: str, entity_type: str) -> list:
    """Retrieves all entities of a specific type in a universe."""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT name, properties FROM yinyang.entities WHERE universe_id = %s AND entity_type = %s",
                    (universe_id, entity_type)
                )
                return list(cur.fetchall())
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error getting entities by type: {e}")
        return []

def get_universe(universe_id: str) -> dict:
    """Retrieves universe details by ID."""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT name, description FROM yinyang.universes WHERE universe_id = %s",
                    (universe_id,)
                )
                return cur.fetchone()
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error getting universe details: {e}")
        return None

