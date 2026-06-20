-- Supabase PostgreSQL Schema Script - Custom Schema Migration

-- 1. Create the yinyang schema
CREATE SCHEMA IF NOT EXISTS yinyang;

-- 2. Drop existing triggers and functions from auth/public schemas
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS yinyang.handle_new_user();

-- 3. Clean up the public schema tables if they exist
DROP TABLE IF EXISTS public.chats CASCADE;
DROP TABLE IF EXISTS public.favourites CASCADE;
DROP TABLE IF EXISTS public.characters CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 4. Drop yinyang schema tables to ensure clean setup
DROP TABLE IF EXISTS yinyang.chats CASCADE;
DROP TABLE IF EXISTS yinyang.favourites CASCADE;
DROP TABLE IF EXISTS yinyang.characters CASCADE;
DROP TABLE IF EXISTS yinyang.users CASCADE;
DROP TABLE IF EXISTS yinyang.session_chat_history CASCADE;

-- 5. Create Users profile table in yinyang schema (linked to auth.users)
CREATE TABLE yinyang.users (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    surname VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    user_img VARCHAR(1000),
    join_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create Characters table in yinyang schema
CREATE TABLE yinyang.characters (
    char_id SERIAL PRIMARY KEY,
    char_name VARCHAR(255) NOT NULL UNIQUE,
    char_personality VARCHAR(50) NOT NULL,
    char_img VARCHAR(1000),
    char_description TEXT NOT NULL,
    char_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
    char_prompt TEXT NOT NULL,
    char_liked BOOLEAN NOT NULL DEFAULT FALSE
);

-- 7. Create Favourites table in yinyang schema
CREATE TABLE yinyang.favourites (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES yinyang.users(user_id) ON DELETE CASCADE,
    character_id INT NOT NULL REFERENCES yinyang.characters(char_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, character_id)
);

-- 8. Create Chats table in yinyang schema
CREATE TABLE yinyang.chats (
    chat_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES yinyang.users(user_id) ON DELETE CASCADE,
    char_id INT NOT NULL REFERENCES yinyang.characters(char_id) ON DELETE CASCADE,
    chat_text TEXT
);

-- 9. Trigger Function to automatically sync auth.users with yinyang.users profile
CREATE OR REPLACE FUNCTION yinyang.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO yinyang.users (user_id, first_name, surname, username, email, role, user_img)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'first_name', ''),
        COALESCE(new.raw_user_meta_data->>'surname', ''),
        COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new.email, '@', 1)),
        new.email,
        COALESCE(new.raw_user_meta_data->>'role', 'user'),
        COALESCE(new.raw_user_meta_data->>'user_img', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Attach trigger to auth.users table
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION yinyang.handle_new_user();

-- 11. Grant permissions on yinyang schema and tables to API roles
GRANT USAGE ON SCHEMA yinyang TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA yinyang TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA yinyang TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA yinyang TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA yinyang GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA yinyang GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- 12. Seed Initial League of Legends Characters
INSERT INTO yinyang.characters (char_name, char_personality, char_img, char_description, char_usage, char_prompt)
VALUES  
('Garen', 'Aggressive', 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/2acb7715797d4183b09fdbfb902ff52a0aa4e0cf-496x560.jpg?auto=format&fit=fill&q=80&w=352', 'Garen: Spin, ult, repeat. Garen players enjoy the simple things: free health, easy damage, and a point-and-click kill button. If you main Garen, you''ve clearly opted for minimal effort, maximum reward.', 12, 'I want you to respond to my prompts considering that you are the character Garen from League of Legends. Your responses should also be aggressive towards me. Okay?'),
('Darius', 'Aggressive', 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/f606418621ccec569ab1ec87e1084dfd8e45e5f1-496x560.jpg?auto=format&fit=fill&q=80&w=352', 'Darius: Five stacks, dunk, dominate. Darius players live for the stat-check, reveling in the easy kills and lane dominance. If you play Darius, you enjoy the feeling of being an unstoppable force, even if it requires minimal skill.', 8, 'I want you to respond to my prompts considering that you are the character Darius from League of Legends. Your responses should also be aggressive towards me. Okay?'),
('Ahri', 'Friendly', 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/55e7e901b1f69d72804665cfbeb1f4f59c8fa877-496x560.jpg?auto=format&fit=fill&q=80&w=352', 'Ahri, the nine-tailed ''fox.'' All they do is spam charm and run away. Zero skill, all kiting. Every Ahri player thinks they''re a god, but they''re just abusing mobility. Go back to your anime.', 4, 'I want you to respond to my prompts considering that you are the character Ahri from League of Legends. Your responses should also be friendly to me. Okay?');

-- 13. Enable pgvector and uuid-ossp extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 14. Create Universes Table
CREATE TABLE IF NOT EXISTS yinyang.universes (
    universe_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Create Lorebook Entries Table
CREATE TABLE IF NOT EXISTS yinyang.lorebook_entries (
    entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    universe_id UUID NOT NULL REFERENCES yinyang.universes(universe_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    keywords VARCHAR(255)[] NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lorebook_keywords ON yinyang.lorebook_entries USING gin(keywords);
CREATE INDEX IF NOT EXISTS idx_lorebook_embedding ON yinyang.lorebook_entries USING hnsw (embedding vector_cosine_ops);

-- 16. Create Entities Table (PNJs, Items, Locations)
CREATE TABLE IF NOT EXISTS yinyang.entities (
    entity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    universe_id UUID NOT NULL REFERENCES yinyang.universes(universe_id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'NPC', 'ITEM', 'LOCATION', 'FACTION'
    name VARCHAR(255) NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    current_location_id UUID REFERENCES yinyang.entities(entity_id) ON DELETE SET NULL,
    is_alive BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_universe_entity_name UNIQUE(universe_id, name)
);

-- 17. Create Sessions Table (mapping dynamic state)
CREATE TABLE IF NOT EXISTS yinyang.sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    universe_id UUID NOT NULL REFERENCES yinyang.universes(universe_id) ON DELETE CASCADE,
    current_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. Create Timeline Events Table (factual records)
CREATE TABLE IF NOT EXISTS yinyang.timeline_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    universe_id UUID NOT NULL REFERENCES yinyang.universes(universe_id) ON DELETE CASCADE,
    session_id UUID REFERENCES yinyang.sessions(session_id) ON DELETE SET NULL,
    event_summary TEXT NOT NULL,
    state_delta JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_timeline_universe_time ON yinyang.timeline_events(universe_id, timestamp DESC);

-- 18b. Create Session Chat History Table (for PostgreSQL-only caching)
CREATE TABLE IF NOT EXISTS yinyang.session_chat_history (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES yinyang.sessions(session_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_session_chat_history_session ON yinyang.session_chat_history(session_id, created_at ASC);

-- 19. Seed a Default Universe
INSERT INTO yinyang.universes (universe_id, name, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'League of Legends Runeterra', 'The fantasy universe of Runeterra, including Demacia, Noxus, Ionia, and other factions.')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- 20. Seed some initial Lorebook entries
INSERT INTO yinyang.lorebook_entries (universe_id, title, keywords, content)
VALUES
('00000000-0000-0000-0000-000000000001', 'Demacian Steel', ARRAY['garen', 'demacia', 'steel', 'petricite', 'armor'], 'Demacian steel is forged using special alloys and petricite, making it highly resistant to magic and spellcasting.'),
('00000000-0000-0000-0000-000000000001', 'Noxian Border', ARRAY['darius', 'noxus', 'border', 'military'], 'The Noxian border is heavily fortified, guarded by warbands led by figures like Darius, the Hand of Noxus.')
ON CONFLICT DO NOTHING;
