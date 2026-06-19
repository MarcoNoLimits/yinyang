-- Supabase PostgreSQL Schema Script

-- Drop existing triggers and functions if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop existing tables (order matters due to foreign key constraints)
DROP TABLE IF EXISTS public.chats CASCADE;
DROP TABLE IF EXISTS public.favourites CASCADE;
DROP TABLE IF EXISTS public.characters CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 1. Create Users profile table (linked to auth.users)
CREATE TABLE public.users (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    surname VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    user_img VARCHAR(1000),
    join_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Characters table
CREATE TABLE public.characters (
    char_id SERIAL PRIMARY KEY,
    char_name VARCHAR(255) NOT NULL UNIQUE,
    char_personality VARCHAR(50) NOT NULL,
    char_img VARCHAR(1000),
    char_description TEXT NOT NULL,
    char_usage DOUBLE PRECISION NOT NULL DEFAULT 0,
    char_prompt TEXT NOT NULL,
    char_liked BOOLEAN NOT NULL DEFAULT FALSE
);

-- 3. Create Favourites table (user links to characters)
CREATE TABLE public.favourites (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    character_id INT NOT NULL REFERENCES public.characters(char_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, character_id)
);

-- 4. Create Chats table
CREATE TABLE public.chats (
    chat_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    char_id INT NOT NULL REFERENCES public.characters(char_id) ON DELETE CASCADE,
    chat_text TEXT
);

-- 5. Trigger Function to automatically sync auth.users with public.users profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (user_id, first_name, surname, username, email, role, user_img)
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

-- 6. Trigger attachment to auth.users table
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Seed Initial League of Legends Characters
INSERT INTO public.characters (char_name, char_personality, char_img, char_description, char_usage, char_prompt)
VALUES  
('Garen', 'Aggressive', 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/2acb7715797d4183b09fdbfb902ff52a0aa4e0cf-496x560.jpg?auto=format&fit=fill&q=80&w=352', 'Garen: Spin, ult, repeat. Garen players enjoy the simple things: free health, easy damage, and a point-and-click kill button. If you main Garen, you''ve clearly opted for minimal effort, maximum reward.', 12, 'I want you to respond to my prompts considering that you are the character Garen from League of Legends. Your responses should also be aggressive towards me. Okay?'),
('Darius', 'Aggressive', 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/f606418621ccec569ab1ec87e1084dfd8e45e5f1-496x560.jpg?auto=format&fit=fill&q=80&w=352', 'Darius: Five stacks, dunk, dominate. Darius players live for the stat-check, reveling in the easy kills and lane dominance. If you play Darius, you enjoy the feeling of being an unstoppable force, even if it requires minimal skill.', 8, 'I want you to respond to my prompts considering that you are the character Darius from League of Legends. Your responses should also be aggressive towards me. Okay?'),
('Ahri', 'Friendly', 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/55e7e901b1f69d72804665cfbeb1f4f59c8fa877-496x560.jpg?auto=format&fit=fill&q=80&w=352', 'Ahri, the nine-tailed ''fox.'' All they do is spam charm and run away. Zero skill, all kiting. Every Ahri player thinks they''re a god, but they''re just abusing mobility. Go back to your anime.', 4, 'I want you to respond to my prompts considering that you are the character Ahri from League of Legends. Your responses should also be friendly to me. Okay?');
