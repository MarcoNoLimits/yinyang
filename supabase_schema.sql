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
