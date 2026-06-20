import unittest
from unittest.mock import MagicMock, patch
import psycopg2
from db import (
    retrieve_lore_entries,
    push_chat_message,
    get_chat_history,
    clear_chat_history,
    sync_ledger_transaction
)
from lock_manager import get_lock_key

class TestPostgresPersistence(unittest.TestCase):

    @patch('db.get_db_connection')
    def test_retrieve_lore_entries_hybrid(self, mock_get_conn):
        # Mock connection and cursor
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        
        # Mock fetchall return value
        mock_cur.fetchall.return_value = [
            {"title": "Test Entry", "content": "Test content", "keywords": ["test"]}
        ]
        
        # Vector embedding of length 1536
        embedding = [0.1] * 1536
        
        res = retrieve_lore_entries(
            universe_id="00000000-0000-0000-0000-000000000001",
            keywords=["test"],
            embedding_vector=embedding,
            limit=5
        )
        
        # Verify query checks
        self.assertEqual(len(res), 1)
        self.assertTrue(mock_cur.execute.called)
        
        # Check that the execute query contains the UNION hybrid structure
        call_args = mock_cur.execute.call_args[0]
        query_sql = call_args[0]
        self.assertIn("UNION ALL", query_sql)
        self.assertIn("keyword_matches", query_sql)
        self.assertIn("vector_matches", query_sql)

    @patch('db.get_db_connection')
    def test_chat_history_sliding_window(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        
        # Test push_chat_message
        push_chat_message("00000000-0000-0000-0000-000000000002", "user", "Hello World")
        self.assertTrue(mock_cur.execute.called)
        
        # Verify it inserts into session_chat_history and prunes
        sql_calls = [arg[0][0] for arg in mock_cur.execute.call_args_list]
        self.assertTrue(any("INSERT INTO yinyang.session_chat_history" in sql for sql in sql_calls))
        self.assertTrue(any("DELETE FROM yinyang.session_chat_history" in sql for sql in sql_calls))

    @patch('db.get_db_connection')
    def test_sync_ledger_transaction_advisory_locks(self, mock_get_conn):
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        
        # Mock row for SELECT current_state
        mock_cur.fetchone.return_value = ({"hp": 100},)
        
        universe_id = "00000000-0000-0000-0000-000000000001"
        session_id = "00000000-0000-0000-0000-000000000002"
        summary = "Defeated the boss"
        deltas = {"boss": {"entity_type": "NPC", "is_alive": False}}
        player_input = "I attack the boss."
        assistant_output = "The boss is defeated."
        
        success = sync_ledger_transaction(
            universe_id=universe_id,
            session_id=session_id,
            summary=summary,
            deltas=deltas,
            player_input=player_input,
            assistant_output=assistant_output
        )
        
        self.assertTrue(success)
        self.assertFalse(mock_conn.autocommit)
        
        # Verify pg_advisory_xact_lock is called
        sql_calls = [arg[0][0] for arg in mock_cur.execute.call_args_list]
        self.assertTrue(any("pg_advisory_xact_lock" in sql for sql in sql_calls))
        
        # Verify lock key matches md5 conversion
        expected_key = get_lock_key(f"yinyang:universe:{universe_id}:lock")
        lock_call = [args for args in mock_cur.execute.call_args_list if "pg_advisory_xact_lock" in args[0][0]][0]
        self.assertEqual(lock_call[0][1][0], expected_key)
        
        # Verify commit was called
        self.assertTrue(mock_conn.commit.called)

if __name__ == '__main__':
    unittest.main()
