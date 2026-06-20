import hashlib
import logging

logger = logging.getLogger("lock_manager")

def get_lock_key(key_str: str) -> int:
    """
    Converts a string key (like a universe or session ID) to a signed 64-bit integer
    for use with PostgreSQL advisory locks (which require bigint/64-bit).
    """
    h = hashlib.md5(key_str.encode("utf-8")).digest()
    return int.from_bytes(h[:8], byteorder="big", signed=True)

def acquire_advisory_xact_lock(cur, lock_key_str: str):
    """
    Acquires a transaction-level exclusive advisory lock (pg_advisory_xact_lock)
    via the provided database cursor. The lock remains active for the duration
    of the current transaction and is released automatically on commit/rollback.
    """
    lock_key = get_lock_key(lock_key_str)
    logger.info(f"Acquiring transaction-level advisory lock for: {lock_key_str} (key: {lock_key})")
    cur.execute("SELECT pg_advisory_xact_lock(%s);", (lock_key,))
