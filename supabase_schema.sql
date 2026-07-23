-- Supabase PostgreSQL Schema Script - Custom Schema Migration
-- Universe: Fallen - A multilingual fantasy RPG world created by gods

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
DROP TABLE IF EXISTS public.player_characters CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 4. Drop yinyang schema tables to ensure clean setup
DROP TABLE IF EXISTS yinyang.chats CASCADE;
DROP TABLE IF EXISTS yinyang.favourites CASCADE;
DROP TABLE IF EXISTS yinyang.characters CASCADE;
DROP TABLE IF EXISTS yinyang.player_characters CASCADE;
DROP TABLE IF EXISTS yinyang.non_player_characters CASCADE;
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

-- 6. Enable pgvector and uuid-ossp extensions (needed before table creation)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 7. Create Universes Table
CREATE TABLE IF NOT EXISTS yinyang.universes (
    universe_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create Player Characters table (universe-aware, replaces generic characters)
CREATE TABLE IF NOT EXISTS yinyang.player_characters (
    char_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES yinyang.users(user_id) ON DELETE CASCADE,
    universe_id UUID NOT NULL REFERENCES yinyang.universes(universe_id) ON DELETE CASCADE,
    char_name VARCHAR(255) NOT NULL,
    faction VARCHAR(100) NOT NULL,
    stats JSONB NOT NULL DEFAULT '{"Force": 0, "Vitesse": 0, "Endurance": 0, "Résistance": 0, "Réserve": 0, "Puissance": 0, "Mental": 0, "Réactivité": 0, "Charisme": 0, "Intelligence": 0}'::jsonb,
    points JSONB NOT NULL DEFAULT '{"PE": 0, "XP": 0, "PR": 0, "PM": 0, "PB": 0, "PN": 0, "PU": 0}'::jsonb,
    inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
    fortune BIGINT NOT NULL DEFAULT 50000,
    blessings TEXT[] DEFAULT '{}',
    avatar_url VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Create Chats table (references player_characters)
CREATE TABLE yinyang.chats (
    chat_id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES yinyang.users(user_id) ON DELETE CASCADE,
    char_id UUID NOT NULL REFERENCES yinyang.player_characters(char_id) ON DELETE CASCADE,
    chat_text TEXT
);

-- 10. Trigger Function to automatically sync auth.users with yinyang.users profile
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

-- 11. Attach trigger to auth.users table
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION yinyang.handle_new_user();

-- 12. Grant permissions on yinyang schema and tables to API roles
GRANT USAGE ON SCHEMA yinyang TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA yinyang TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA yinyang TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA yinyang TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA yinyang GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA yinyang GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- 13. Create Lorebook Entries Table
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

-- 14. Create Entities Table (NPCs, Items, Locations, Factions, Guilds, Deities)
CREATE TABLE IF NOT EXISTS yinyang.entities (
    entity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    universe_id UUID NOT NULL REFERENCES yinyang.universes(universe_id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'NPC', 'ITEM', 'LOCATION', 'FACTION', 'GUILD', 'DEITY'
    name VARCHAR(255) NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    current_location_id UUID REFERENCES yinyang.entities(entity_id) ON DELETE SET NULL,
    is_alive BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_universe_entity_name UNIQUE(universe_id, name)
);

-- 14b. Create Non-Player Characters (PNJs) Table (Gods, Legendary, general NPCs)
CREATE TABLE IF NOT EXISTS yinyang.non_player_characters (
    npc_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    universe_id UUID NOT NULL REFERENCES yinyang.universes(universe_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    npc_type VARCHAR(50) NOT NULL DEFAULT 'NPC', -- 'NPC', 'GOD', 'LEGENDARY', 'DEITY'
    faction VARCHAR(100),
    stats JSONB NOT NULL DEFAULT '{"Force": 0, "Vitesse": 0, "Endurance": 0, "Résistance": 0, "Réserve": 0, "Puissance": 0, "Mental": 0, "Réactivité": 0, "Charisme": 0, "Intelligence": 0}'::jsonb,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    image_url VARCHAR(1000),
    current_location_id UUID REFERENCES yinyang.entities(entity_id) ON DELETE SET NULL,
    is_alive BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_universe_npc_name UNIQUE(universe_id, name)
);
CREATE INDEX IF NOT EXISTS idx_npcs_universe_name ON yinyang.non_player_characters(universe_id, name);

-- 15. Create Sessions Table (mapping dynamic state)
CREATE TABLE IF NOT EXISTS yinyang.sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    universe_id UUID NOT NULL REFERENCES yinyang.universes(universe_id) ON DELETE CASCADE,
    current_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Create Timeline Events Table (factual records)
CREATE TABLE IF NOT EXISTS yinyang.timeline_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    universe_id UUID NOT NULL REFERENCES yinyang.universes(universe_id) ON DELETE CASCADE,
    session_id UUID REFERENCES yinyang.sessions(session_id) ON DELETE SET NULL,
    event_summary TEXT NOT NULL,
    state_delta JSONB NOT NULL DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_timeline_universe_time ON yinyang.timeline_events(universe_id, timestamp DESC);

-- 17. Create Session Chat History Table (for PostgreSQL-only caching)
CREATE TABLE IF NOT EXISTS yinyang.session_chat_history (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES yinyang.sessions(session_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_session_chat_history_session ON yinyang.session_chat_history(session_id, created_at ASC);

-- ============================================================
-- SEED: FALLEN UNIVERSE
-- ============================================================

-- 18. Seed the Fallen Universe (fixed UUID for deterministic referencing)
INSERT INTO yinyang.universes (universe_id, name, description)
VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'Fallen',
    'Fallen est un univers riche de fantasy, créé par les dieux et gouverné par 12 divinités. Son histoire de plus de 600 ans s''étend sur 4 arcs : La Grande Guerre (Arc 1), Darkness Returns (Arc 2), The New Order (Arc 3) et La Renaissance (Arc 4, l''ère actuelle). Le monde fait face à une prophétie ancienne selon laquelle les portes d''Eudenia s''ouvriront à nouveau, menaçant de déclencher un nouveau conflit divin. Onze factions divisent les races mortelles : Sainteté (mages saints), Occulte (sorcerers), Honneur (warriors), Ange (angels), Sang-pur (vampires), Esprit (nature spirits), Astre (desert nomads), Viking (Nordic warriors), Démon (demons), Elder (ancient beings) et Hybride (hybrids).'
)
ON CONFLICT (universe_id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- ============================================================
-- SEED: LOREBOOK ENTRIES FOR FALLEN
-- Sequential UUIDs: f0000000-0000-0000-0000-0000000001xx
-- ============================================================

INSERT INTO yinyang.lorebook_entries (entry_id, universe_id, title, keywords, content)
VALUES

(
    'f0000000-0000-0000-0000-000000000101',
    'f0000000-0000-0000-0000-000000000001',
    'Arc 1 : La Grande Guerre',
    ARRAY['arc 1', 'grande guerre', 'histoire', 'aslan', 'reisha', 'exodus', 'vayne', 'ichigo', 'amy', 'akeno', 'andres', 'heros'],
    'L’Immortal touchait à son apogée, les champions des différentes factions s’affrontaient avec honneur et rage pour espérer s’élever au rang de vainqueur. Mais cette édition ne devait pas s’achever comme les précédentes. Car, dans les profondeurs oubliées du monde, un être qu’aucun mortel ne croyait réel ouvrit les yeux : le Dragon Divin, incarnation de la colère pure des anciens temps. Sa naissance, dit-on, fut un châtiment divin, la matérialisation de la discorde des dieux eux-mêmes. D’un battement d’ailes, il fit trembler les montagnes du Graal. D’un souffle incandescent, il réduisit les forêts de l’Ouest en cendres. Les mers elles-mêmes bouillonnaient sous sa fureur. Ce n’était plus un simple adversaire, mais une apocalypse vivante, un fléau dont l’existence menaçait l’équilibre même de Fallen. L’Immortal fut interrompu dans le chaos : la compétition n’avait plus de sens, car aucune faction n’aurait survécu si le dragon triomphait. Alors, pour la première fois depuis la Genèse, les peuples de Fallen s’unirent. Les Elfes guidés par leurs archers, les Nains armés de marteaux runiques, les Géants dressés comme des remparts vivants, les Hommes portés par la ferveur de leurs chants guerriers… Même les créatures les plus fières des ténèbres d''Ithis acceptèrent de marcher côte à côte. De cette guerre naquirent des noms que les bardes chantent encore comme : 𝐀𝐬𝐥𝐚𝐧 𝐕𝐚𝐧 𝐁𝐥𝐮𝐞 le plus grand des mages ; 𝐑𝐞𝐢𝐬𝐡𝐚 𝐀𝐭𝐥𝐚𝐬 la légende des honneurs ; 𝐄𝐱𝐨𝐝𝐮𝐬 𝐍𝐞́𝐦𝐞́𝐬𝐢𝐬 le maître des arts occultes ; 𝐕𝐚𝐲𝐧𝐞 𝐕𝐞𝐫𝐝𝐞𝐫𝐤𝐚𝐲𝐧𝐞 et 𝐈𝐜𝐡𝐢𝐠𝐨 𝐊𝐮𝐫𝐨𝐬𝐚𝐤𝐢 le duo de héros des ténèbres ; 𝐋𝐢𝐠𝐡𝐭𝐭𝐰𝐢𝐫𝐥𝐬 𝐀𝐦𝐲 la grande & sage reine fée ; 𝐀𝐤𝐞𝐧𝐨 𝐃. 𝐅𝐫𝐢𝐦𝐬 le sorcier intrépide ; 𝐀𝐧𝐝𝐫𝐞𝐬 𝐝𝐞 𝐅𝐨𝐥𝐥𝐨𝐧𝐨𝐬𝐚 l''excentrique mancien et bien d''autres. Mais il fallut plus que la bravoure des héros : les dieux eux-mêmes intervinrent. Conrak bénit les armes des mortels, Ezéchiel guida les vents, Élisa soigna les combattants dans la tourmente. Sous cette alliance sacrée, Le Dragon divin fut finalement terrassé après une bataille qui dura cent jours et cent nuits. Son corps, dit-on, se changea en montagne, scellé par les flammes divines. - ******La victoire fut amère****** : Fallen portait les cicatrices de cette guerre, et l’Immortal fut suspendu. Les dieux jugèrent que les peuples avaient besoin de paix plus que de compétition. Ainsi débuta une ère où, pour la première fois, les races vécurent côte à côte sous une fragile harmonie. Mais la paix, dans Fallen, n’est jamais qu’un mirage… Car déjà, dans l’ombre, d’autres menaces se préparaient à surgir.'
),
(
    'f0000000-0000-0000-0000-000000000102',
    'f0000000-0000-0000-0000-000000000001',
    'Arc 2 : Darkness Returns',
    ARRAY['arc 2', 'darkness returns', 'histoire', 'dragon noir', 'chaos', 'ombre'],
    '# [𝐈𝐧𝐭𝐫𝐨𝐝𝐮𝐜𝐭𝐢𝐨𝐧 - 𝐅𝐢𝐧 𝐝𝐞 𝐥''𝐚𝐫𝐜 𝐃𝐚𝐫𝐤𝐧𝐞𝐬𝐬 𝐑𝐞𝐭𝐮𝐫𝐧''𝐬] Lectrices, lecteurs, à travers les épopées que nous ne cesserons de vous chanter, glaner en chaque tirade, une étoile perçant les cieux, et offrant aux plus exigeants l’éclat de nos remerciements. L’entrée n’a pas d’importance. Vous, qui êtes convié au festin du temps. Ne regardons guère ce qui a commencé. Faisons fi de plats intéressants, d’évènements fades, d’une surcharge que vos yeux ne voudraient plus dévorer plus amplement encore. Seuls les mets vous seront donnés, car ils sont ceux que vous méritez. Premièrement, la terre des anges ne saurait se retenir du festin chronologique dont nous nous préparons à faire l’offrande. Terre des anges fut le spectacle d’une escarmouche tonitruante. Les nuages, cotons des cieux, éprouvaient l’immense puissance de d’êtres ancestraux à Fallen ! Des anges, des mages, des chevaliers, tous, choisis des dieux d’une façon à la fois pleine de bile et pourtant d’espoir, se liguèrent contre un dragon afin de l’empêcher de laisser en ruine la merveilleuse cité des Chérubins ! Histoire gracieuse trouva sa conclusion à l’intérieur du pacifisme d’un des anges qui retint les attaques de tous !... Si facilement oublié. Peu satisfait ? Continuer de défiler cette délicieuse frise chronologique, que vos babines ne salivent plus à l’entente du ruissellement de la connaissance. - ******Le monde ne fut plus aussi simple et innocent que nous le pensions. Premiers habitants de Fallen, premiers fouleurs de terre, peuple gorgeant 𝗖𝗼𝗿𝗻𝘂𝗺, se voyaient investiguer de toute part. Ce continent fut le semeur des graines du chaos, un véritable jardin de catastrophes taillées habilement par ses malicieux résidents afin de plonger Fallen dans un situation bien plus que défavorable ! En tandem, 𝐏𝐚𝐫𝐮𝐦𝐢𝐬, un culte vouant une adoration extrême à Ezéchiel, et l’organisation du 𝐃𝐫𝐚𝐠𝐨𝐧 𝐍𝐨𝐢𝐫, un groupe de mercenaires, menèrent la dance de la destruction au plus profond de Fallen ! Chaque lieu était touché ! C’était comme si rien n’était à l’abri des ténèbres... Mais si Fallen trouve son homonyme dans la chute, heureusement, des héros furent prêts à nous sauver. Les plus puissants de Fallen, chacun se réunit, le courage en main, l’ardeur dans la trachée****** : ils ne pouvaient échouer. La victoire ne racheta pas les pertes, mais nous donna à tous la connaissance. Quel prix... - ******Nous apprîmes que certains ne désiraient en vérité pas la guerre ! Malgré les interventions de la régente du lieu, l''impératrice 𝐃𝐞𝐯𝐫𝐚. Ô, mais ne vous ai-je pas demandé ce qui vint véritablement apporter la balance dans le combat de nos héros ? Simplicité même vous sera offert****** : le véritable souverain reprit son trône ! Devra fut déchue ! Parumis ? Vaincu ! Et les anciens, acceptant la cohabitation. - ******Les plus attentifs sauront cependant, que le dessert de notre récit, ne sera pas aux goûts de tous. Dragon Noir, 𝐍𝐨𝐜𝐡𝐞𝐬, 𝐥𝐞𝐬 𝐅𝐚𝐮𝐜𝐡𝐞𝐮𝐫𝐬 et bien d''autres****** : la vérité est de plus amer, les guildes noires sont encore vivantes, et bien portantes. Héros nordiques ne seront pas oubliés ! La défaite du 𝐒𝐞𝐫𝐩𝐞𝐧𝐭 𝐌𝐨𝐧𝐝𝐞 par de valeureux vikings, se doit d''être noté. Alors. Qu’avez vu dégluti de notre conte ? Voudriez-vous sauver Fallen ? Ou le condamner ? Le choix est le vôtre, moi, Je ne puis faire que vous regarder.'
),
(
    'f0000000-0000-0000-0000-000000000103',
    'Arc 3 : The New Order',
    ARRAY['arc 3', 'new order', 'histoire', 'politique', 'factions', 'guildes'],
    'Lorsque le soleil étendait ses rayons d’or sur Fallen, chaque parcelle du monde semblait s’illuminer de mille teintes. Les mers reflétaient l’azur du ciel, les vents transportaient une brise douce qui caressait la peau comme une bénédiction. Les vagues s’échouaient sur les plages avec délicatesse, s’entremêlant au sable dans une danse guidée par Ezéchiel lui-même. Tout semblait parfait, presque divin, comme si la création se parait de sa plus belle harmonie. Au cœur de ce décor idyllique avançait une silhouette féminine. Ses pas étaient lents, rythmés, presque solennels, et chaque mouvement dessinait une symphonie silencieuse entre elle et son ombre qui s’étirait au sol. Ses cheveux bleutés flottaient au gré du vent, se mêlant à l’éclat de la mer. Son corps, sculpté dans une grâce intemporelle, se drapait d’étoffes légères aux nuances violettes et marines. À travers elle, beauté et mystère se confondaient, donnant l’impression qu’aucun mortel ne pouvait véritablement lui appartenir. Alors que ses yeux se perdaient dans l’immensité de l’horizon, un détail brisa l’harmonie. Au loin, parmi les flots, se dessinait une silhouette fragile. Là où la mer engloutissait ses victimes, une enfant gisait, à moitié immergée, recroquevillée sur elle-même, comme abandonnée par le monde. La scène contrastait brutalement avec la quiétude environnante : une innocence sur le point d’être avalée par l’océan. Sans hésiter, la silhouette se précipita dans les eaux tumultueuses. Chaque vague semblait la repousser, mais son élan n’en fut que plus puissant. Le temps suspendit sa course lorsque, dans un ultime effort, elle parvint à saisir l’enfant et la souleva hors de l’abîme. Dans ses bras, la petite paraissait irréelle, aussi délicate qu’un souffle de lumière, et leurs ombres projetées au sol ne formaient plus qu’une, agrémentées d’ailes saphir émergeant de son dos. Une chimère née de la rencontre du ciel et de la mer. C’est alors que deux autres silhouettes se dressèrent derrière elle. Leur présence se fondait dans une blancheur presque aveuglante, leur aura se détachant du monde comme une émanation divine. Dans ce silence, un poids invisible semblait envelopper la scène, comme si le destin venait de se révéler. L’enfant n’était pas une simple naufragée. Elle portait en elle une marque singulière, invisible à l’œil profane mais éclatante aux regards initiés : celle des élus. Une marque prophétique, annonciatrice de renouveau, qui conférait à son porteur le pouvoir de remodeler Fallen et d’y instaurer un nouvel ordre. Ainsi, au sein des flots et de la lumière, venait de naître le présage d’une ère nouvelle.'
),
(
    'f0000000-0000-0000-0000-000000000104',
    'f0000000-0000-0000-0000-000000000001',
    'Arc 4 : La Renaissance (L''Ère Actuelle)',
    ARRAY['arc 4', 'renaissance', 'ere actuelle', 'lucas saviore', 'eudenia', 'prophetie', 'portes'],
    'Cinq siècles se sont écoulés depuis la disparition des « Dirigeants », ces incarnations mortelles des anciens dieux, chargées jadis d’apporter équilibre et justice à Fallen. Leur départ avait marqué la fin d’une ère, et pour beaucoup, le début d’un âge d’or. En apparence, le monde avait trouvé la paix. Seules quelques guildes noires comme les 𝐍𝐨𝐜𝐡𝐞𝐬 continuaient de semer le trouble dans l’ombre, sans jamais parvenir à ébranler l’ordre établi. Mais cette tranquillité ne pouvait durer éternellement. Tout bascula lorsqu’un mystérieux continent apparut dans les cieux, flottant comme un mirage au-dessus de la mer céleste. Il ne s’agissait ni d’une illusion, ni d’un territoire oublié : c’était 𝐄𝐮𝐝𝐞𝐧𝐢𝐚, la légendaire terre des dieux. Les peuples de Fallen crurent d’abord au retour des divinités. Mais très vite, une vérité glaçante fut révélée : Eudenia était vide. Ni dieux. Ni héros. Rien que des terres divines laissées à l’abandon… et chargées d’une énergie mystérieuse. Ceux qui s’y aventuraient revenaient transformés : plus puissants, plus rapides, presque inhumains. Comme touchés par une essence divine. Cette découverte fit naître une véritable course à la puissance. Rois, seigneurs de guerre, mages et bandits se ruèrent vers ces terres pour revendiquer une part du pouvoir sacré. Beaucoup en revinrent changés. D’autres… ne revinrent jamais. Peu à peu, de nouveaux tyrans virent le jour. Des êtres prétendant être les successeurs légitimes des dieux, se proclamant divinités vivantes. Des empires tombèrent, des civilisations s’effondrèrent. Fallen sombra dans sa période la plus noire depuis la Grande Guerre : une ère de conflits sans fin, de conquêtes, de massacres, où la seule loi était celle du plus fort. Mais c’est dans les ténèbres que naissent les véritables lumières. Un enfant vit le jour. Fils d’une simple fermière et d’un être inconnu, il grandit loin du tumulte, ignorant son destin. À l’âge adulte, guidé par une force intérieure, il révéla sa véritable nature : un demi-dieu, porteur de la véritable lumière divine. Son nom, 𝐋𝐮𝐜𝐚𝐬 𝐒𝐚𝐯𝐢𝐨𝐫𝐞. Rassemblant autour de lui dix compagnons qui devinrent les dix premiers 𝐀𝐩𝐨̂𝐭𝐫𝐞𝐬 𝐝𝐢𝐯𝐢𝐧𝐬, il entreprit de libérer Fallen du chaos. Ensemble, ils renversèrent les faux dieux, détruisirent les cultes corrompus, et scellèrent les portes d’Eudenia, empêchant quiconque d’y accéder à nouveau. Le calme revint. Mais pas sans séquelles. Durant les cent années suivantes, un culte naquit autour de ce héros. Des temples furent bâtis, son nom chanté comme celui d’un nouveau messie. En parallèle, les anciens cultes, dédiés aux véritables dieux, reprirent de la vigueur. Certains affirment que les dieux ne sont pas morts, mais qu’ils préparent leur retour. D’autres disent que les imposteurs enfermés à Eudenia complotent leur libération. Aujourd’hui, Fallen est à nouveau en paix… mais pour combien de temps ? Car une ancienne prophétie refait surface. Elle annonce que les portes d’Eudenia s’ouvriront à nouveau. Et avec elles, un nouveau cycle de guerre, de miracles… et de chutes.'
),
(
    'f0000000-0000-0000-0000-000000000105',
    'f0000000-0000-0000-0000-000000000001',
    'Conrak - Dieu de la fortune et de la chance',
    ARRAY['conrak', 'fortune', 'chance', 'prosperite', 'divinite', 'dieu', 'roahx', 'pantheon', 'chef'],
    ', Dieu de la fortune, de la prospérité et de la chance Dieu de la fortune, de la prospérité et de la chance. Le chef du Panthéon Parmi toutes les divinités qui peuplent le panthéon de Fallen, Conrak est sans doute l’une des plus priées, invoquées et adulées. Il n’est pas difficile d’en comprendre la raison : qui refuserait les faveurs de la fortune, de la prospérité et de la chance ? Maître absolu des hasards, attributaire d’opportunités inattendues comme de coups du sort implacables, il se révèle à la fois un bienfaiteur recherché et une menace redoutée. Sa réputation est telle que même ceux qui ne l’honorent pas par des offrandes choisissent néanmoins de ne pas le défier, évitant ainsi d’attirer sur eux la malchance que son courroux peut déchaîner. Conrak est souvent représenté vêtu d’une armure d’or fin, ornée de toisons écarlates qui rappellent autant la noblesse de sa fonction que la flamboyance de son influence. Son visage est presque toujours caché par un masque doré, symbole de mystère et de pouvoir, car nul ne peut véritablement saisir ses intentions ni prédire ses faveurs. Pourtant, derrière ce masque, sa véritable apparence est connue des mythes : celle d’un homme d’une beauté rare, aux cheveux aussi blancs que la neige immaculée, et aux yeux d’un azur éclatant, semblable aux saphirs les plus purs. Bien qu’il soit prié par de nombreux marchands, nobles et souverains qui espèrent accroître leurs richesses et leur puissance, ce sont paradoxalement les hors-la-loi qui lui vouent le plus grand culte. À Roahx, Conrak est presque une divinité tutélaire. Mercenaires, assassins, voleurs, contrebandiers et aventuriers intrépides murmurent son nom dans l’espoir d’obtenir cette once de chance qui pourrait renverser une situation désespérée. Et il leur répond. Car parmi les dieux, Conrak est sans doute celui qui interagit le plus directement avec le monde des mortels. Nombre d’histoires relatent ses apparitions soudaines auprès de ses adorateurs les plus fervents : un masque brillant dans la nuit, une silhouette dorée marchant parmi les vivants, une main invisible modifiant le cours des dés. Ainsi, Conrak demeure l’incarnation du destin capricieux : il offre la richesse comme il peut la reprendre en un souffle, bénit les audacieux comme il maudit les téméraires. Sa faveur, aussi imprévisible qu’un lancer de dés, est ce qui fait de lui la divinité la plus courtisée, mais aussi la plus redoutée de Fallen.'
),
(
    'f0000000-0000-0000-0000-000000000106',
    'f0000000-0000-0000-0000-000000000001',
    'Malakath - Dieu des bannis et des malédictions',
    ARRAY['malakath', 'maledictions', 'sorcellerie', 'fourberie', 'divinite', 'dieu', 'occulte', 'forteresses', 'bannis'],
    ', Dieu des bannis et des malédictions Dieu de la Sorcellerie et de la Fourberie Là où la vérité se tord, où les serments se murmurent dans la langue des serpents ; où la magie ne guérit pas mais corrompt, Malakath sourit. Il ne vient jamais en plein jour. Il ne parle jamais à haute voix. Malakath, dieu des arcanes obscures et des esprits retors, est celui que l’on invoque dans les recoins obscurs, là où les torches vacillent et où les mots prennent des formes interdites. Son culte est ancien, mais jamais officiel. Il se transmet par les grimoires scellés, les pactes gravés dans le sang, les murmures échangés entre sorciers dans les couloirs des cinq forteresses de la faction occulte. Là, ses fidèles — sorciers, alchimistes, invocateurs — le vénèrent non pour sa bonté, mais pour sa puissance. Car Malakath ne promet rien : il propose, il suggère, il offre des chemins que nul autre dieu n’ose tracer. Ses adorateurs le représentent sous des formes changeantes : parfois silhouette indistincte, parfois créature inhumaine à la forme indescriptible ,parfois silhouette encapuchonnée aux yeux multiples, parfois simple ombre sur un mur. Mais tous s’accordent sur un détail : ses yeux, emplis de ténèbres insondables, semblent lire les pensées avant qu’elles ne soient formulées. Dans les forteresses, ses autels sont dissimulés derrière des bibliothèques, sous des dalles, ou dans des chambres sans fenêtres. On y brûle des encens aux parfums trompeurs, on y trace des cercles de sel noir, et l’on y récite des prières qui ne sont jamais les mêmes deux fois. Car Malakath aime le changement, la ruse, la variation. Il récompense ceux qui savent détourner les lois de la magie, ceux qui transforment les sorts en pièges, les pactes en armes. Mais il punit sans pitié ceux qui le servent sans comprendre. Car pour lui, l’ignorance est le plus grand des crimes. Dans les grimoires interdits, on trouve cette mise en garde : Malakath ne prend pas votre âme ; il vous laisse croire qu’elle est encore vôtre. Ainsi règne Malakath, dieu des secrets et des illusions, maître des chemins détournés. Il ne demande pas la foi — il exige la finesse. Et dans les cinq forteresses, son nom est gravé non dans la pierre, mais dans les esprits.'
),
(
    'f0000000-0000-0000-0000-000000000107',
    'f0000000-0000-0000-0000-000000000001',
    'Anubis - Dieu des morts',
    ARRAY['anubis', 'morts', 'ames', 'gardien', 'juge', 'divinite', 'dieu', 'impartial', 'au-dela'],
    ', Dieu des morts Dans les lieux les plus obscurs de ce monde, là où les vivants n’osent poser le pied, s’avance l’Ombre au regard de braise. Son nom est murmuré par les vents funéraires : Anubis. Maître des sentiers qui mènent aux royaumes souterrains, il règne sans partage sur les morts et les ombres. Son culte embrase ce monde comme un feu discret mais inextinguible, et son cœur bat au rythme des murmures des vivants et des mourants. Nul peuple ne l''adore en particulier ; pourtant tous le vénèrent, car tous finiront par passer par son impitoyable jugement. Il ne se plie à nul rite des hommes ni à ceux des autres dieux de Fallen ; sa justice est sienne, et sienne seule. Aux morts, il offre l’éternité : il embaume leur chair pour qu’aucune corruption n’ose les atteindre, lave leurs cœurs des fardeaux terrestres, puis les soumet à la pesée sacrée, où chaque âme dévoile son poids véritable. Aux dignes, il tend la main et comble leurs tables d’offrandes sacrées. Aux indignes, il refuse toute lumière. Son corps est celui d’un homme, mais sa tête est celle du chacal nocturne. Peu de vivants l’ont vu ; ses apparitions, rares et furtives, se tissent dans le silence des charniers, au clair de lune. Les anciens l’appellent "L''inévitable" : jamais ne vous croyez à hors de portée de ses mains car, aussi vrai que ce monde n''est point éternel, votre heure viendra un jour, tout immortel que vous pensiez être. Réputé grincheux, avare et inflexible, il ne s’attarde que pour accomplir sa mission : guider les âmes. Et dans leurs prières nocturnes, les revenants lui demandent la faveur suprême — pouvoir errer dans le monde des vivants, intouchables et libres.'
),
(
    'f0000000-0000-0000-0000-000000000108',
    'f0000000-0000-0000-0000-000000000001',
    'Ézéchiel - Dieu de gloire et de la pureté',
    ARRAY['ezechiel', 'gloire', 'purete', 'magie blanche', 'mages', 'divinite', 'dieu', 'saintete'],
    ', Dieu de gloire et de la pureté Dans les rouleaux dorés conservés au cœur des temples des mages, les sages relatent l’histoire de leur dieu et maître à l''éclat subjuguant : Ézéchiel, ainsi nommé, connu comme la magnificence incarnée. Aux mages tombés dans l’âpreté des combats, il accordait le salut et la délivrance. Sa lumière, implacable, effaçait toute trace du mal. Par un simple frôlement de sa tunique sacrée, il guérissait les maux et bénissait les cœurs d’une pureté immuable. Aux généreux, il offrait gloire et prospérité—physique, mentale et spirituelle. Aux semeurs de mal, il opposait la rigueur et la justice implacable. Longtemps il erra sur la terre sainte, observant le monde qu’il façonna, avec ses frères divins, de ses propres mains. Sa chevelure flamboyante et ses yeux d’or faisaient songer à l’astre du jour au zénith, tandis que son aura radieuse éclairait royaumes et mers. Maître de la course du soleil, il nourrissait la vie même, affrontant l’œuvre inverse de son frère et ennemi suprême — divinité des ombres et des secrets, qui répandait malheur et discorde dans les cœurs des hommes. Aux femmes et aux enfants, Ézéchiel accordait paix et bonheur, veillant sur eux tel un rempart de lumière. Mais nul ne pouvait le convoquer sans noblesse : seuls les cœurs sincères trouvaient grâce à ses yeux. Et aux plus doués, aux plus pieux, aux plus puissants des mages, touchant du doigt la divinité, il apparaissait parfois, leur accordant enseignement et sagesse. Le scribe consigne aussi ses paroles immortelles : > « Brillez à la lueur de l’or, afin que je vous couvre d’une richesse infinie… Soyez aussi radieux que le soleil qui berce le ciel éthéré, et illuminez le monde obscur. » Car Ézéchiel n’était pas seulement gardien : il était le Créateur des arts magiques, maître incontesté des arts blancs, des forces élémentaires et de l’enchantement. Son pouvoir, infini et inépuisable, modelait la réalité elle-même. Messager des astres, il annonçait les cataclysmes et guidait les peuples. Sa beauté transcendait toutes les divinités, et son charisme imposait le respect des plus fiers. Ainsi se termine ce chapitre des Chroniques de l’Atlantide : Ézéchiel, divinité de gloire et de pureté, Maître absolu des arts lumineux, flambeau des âges et gardien du savoir.'
),
(
    'f0000000-0000-0000-0000-000000000109',
    'f0000000-0000-0000-0000-000000000001',
    'Khālian - Déesse de la métamorphose et de la lune',
    ARRAY['khalian', 'metamorphose', 'lune', 'lycanthropes', 'divinite', 'deesse', 'ithis', 'loups-garous'],
    ', Déesse de la métamorphose et de la lune La lune, maîtresse des marées et souffle secret des océans, exerce son influence jusque dans les cœurs des hommes. Parfois — dit-on — un éclat furtif de son pouvoir frappe certains êtres d’une folie énigmatique. Réalité ou légende ? Nul ne saurait trancher… sauf peut-être Khālìan elle-même. Déesse de la Lune, sa puissance s’éveille pleinement à la nuit tombée sur Fallen. Alors, mieux vaut pour les imprudents ne pas contrarier sa faction : envers ceux qui menacent les siens, elle se montre inébranlable. Forgeuse de diversité et entourée des créatures les plus étranges, elle est également la maîtresse absolue de la Métamorphose. « Ni vue ni connue » — nul adage ne lui sied mieux. Depuis les temps anciens, nombre d''artistes énamourés la représentent sous les traits d’une femme d’une envoûtante beauté : ses jambes, couvertes d’écailles iridescentes telles celles d’un serpent, se terminent par des pieds humains ; ses mains, fines et graciles, s’arment de griffes acérées ; son visage, encadré par de longs cheveux blancs striés de mèches aux teintes de l’univers, reste auréolé de mystère. Sa véritable apparence ? Aucun œil mortel ne l’a jamais contemplée, dit-on. Ou, peut-être, que ceux ainsi bénis se gardent bien d''en parler... Ses pouvoirs paraissent simples à qui ne sait les voir… mais leur profondeur échappe à toute mesure. Khālìan glisse entre l’ombre et la lumière, alliant le venin à la douceur. Stratège et protectrice, elle mène les siens à la victoire, veillant à leur unité dans chacune des quêtes qu’ils entreprennent. « La nuit, je vous guide dans ce monde grâce à mon astre lunaire. Le jour, mes regards vous accompagnent. »'
),
(
    'f0000000-0000-0000-0000-000000000110',
    'f0000000-0000-0000-0000-000000000001',
    'Drahen - Dieu du courage et de la sagesse',
    ARRAY['drahen', 'courage', 'sagesse', 'guerriers', 'divinite', 'dieu', 'honneur', 'kaos'],
    ', Dieu du courage et de la sagesse Je suis l''incarnation de la noblesse Divine et l''essence même de tous désirs. Je suis la personnification de l''orgueil, car pour moi, nul n''est au dessus. Si mon cœur est rempli d''amour, aussi incommensurable que l''infini de l''univers quel qu''il soit, mon orgueil surpasse largement l''amour que je porte à ma personne. Vous l''avez toujours pris pour de la bravoure et de l''audace, mais je ne pu vous le reprocher, car ignares que vous êtes, vous pensez qu''il existe une bravoure pouvant surpasser les limites du réel. Je vous ai toujours observé vous fourvoyer sur la force de votre courage et l''audace dont vous faites preuve. Je vous ai vu y croire plus que personne en ce monde. Et alors, mon amour a pris le dessus, ne voulant vous voir périr pour une telle ignorance, je vous ai accordé ma grace. À mon image vous avez été conçus, et vous êtes mes représentants dans cet univers conçu des mains célestes, alors n''oubliez pas que vous êtes mon reflet au regard du monde. Plonger dans l''enfer terrestre en arborant tous votre courage et votre audace, surpasser vos limites en oubliant votre douleur, car ceci est l''essence même de votre existence. Qui je suis?? Ne cherchez pas à savoir, car jamais vous ne pourrez comprendre. De mes iris dorés je vois tout, et de mon trône j''accorde ma grâce aux valeureux. Ne pensez échapper à ma colère lorsque vous bafouez mon honneur, car même si je ne dis rien, mon frère Anubis vous amènera à moi, et à ce moment, vous verrez..'
),
(
    'f0000000-0000-0000-0000-000000000111',
    'f0000000-0000-0000-0000-000000000001',
    'Nergal - Déesse de la corruption et du pouvoir',
    ARRAY['nergal', 'corruption', 'pouvoir', 'demons', 'divinite', 'deesse', 'demon', 'mundus', 'mal'],
    ', Déesse de la corruption et du pouvoir « Lorsque les ombres croissent et que les flammes se penchent vers la terre, C’est le souffle de Nergal qui effleure la nuque des vivants. Car dans chaque acte de cruauté, dans chaque trahison qui germe, Coule une goutte de son venin. » Dans les entrailles de Fallen, là où la lumière s’éteint et où les échos se font murmures, s’étend le domaine de Nergal. Nulle muraille ne protège de son influence : elle se glisse dans les serments comme dans les cauchemars, corrompant toute volonté assez faible pour céder à sa promesse de puissance. C’est d’elle que naissent les élans de malveillance des démons ; elle en est la source et l’inspiratrice. Mais sa faveur n’est jamais gratuite : quiconque la défie, ternit son nom ou ose lui tourner le dos, se voit offrir un supplice à la mesure de son arrogance. Sa magie noire ne frappe pas seulement la chair : elle invoque les peurs les plus intimes, les façonne en visions tangibles et les laisse consumer l’âme jusqu’à ce qu’il ne reste plus que cendres. Nergal n’est pas seulement déesse du Pouvoir : elle est le Pouvoir incarné. Elle exige que tout plie sous sa volonté et que nul ne respire hors de son contrôle. Même les seigneurs démoniaques les plus fiers se courbent devant elle, non par loyauté, mais parce qu’ils ont goûté à sa colère et savent qu’il n’existe ni refuge ni oubli pour qui a trahi sa reine. Ses apparitions dans le monde des vivants sont rares, mais chaque venue porte le sceau d’un châtiment. Un mot d’elle, et les pierres se fendent ; un geste, et l’esprit se brise. Les scribes anciens racontent que les cieux eux-mêmes pâlissent lorsqu’elle foule le sol de Fallen. Les fresques et statues la montrent telle qu’elle aime être vue : silhouette sculpturale, drapée dans une combinaison sombre comme l’abîme, révélant autant qu’elle dissimule ; longues mèches bleu sarcelles, cascade spectrale qui encadre deux cornes fièrement dressées ; et surtout, ces yeux sombres, incandescents, qui percent au‑delà de la chair pour sonder le cœur. Dans les temples dissimulés aux regards des profanes, ses prêtres gravent encore cette mise en garde : « Ne daigne point exiger en l’invoquant : Car c’est toujours elle qui ouvre la porte, et toujours elle qui la referme. » - ******Ainsi demeure Nergal****** : immuable, souveraine, et éternellement avide de soumission.'
),
(
    'f0000000-0000-0000-0000-000000000112',
    'f0000000-0000-0000-0000-000000000001',
    'Zeita - Déesse de la raison et du jugement',
    ARRAY['zeita', 'raison', 'jugement', 'celeste', 'anges', 'divinite', 'deesse', 'ange', 'lois'],
    ', Déesse de la raison et du jugement On dit qu’elle fut la première à tracer dans l’argile encore vierge la ligne droite — symbole immuable de justice. Première des Muses, souffle originel qui inspira non seulement les poètes et les sculpteurs, mais aussi les bâtisseurs de lois et les gardiens des cités, Zeita est la lumière qui ordonne, le verbe qui équilibre, le regard qui ne vacille jamais. À travers tout Fallen, ses temples se dressent comme des phares de marbre, mais c’est sur Céleste que sa présence se déploie avec majesté : chaque ville y possède un sanctuaire consacré à la Muse des Lois. Leurs coupoles reflètent le soleil, leurs escaliers s’ouvrent vers les places publiques comme pour inviter les peuples à gravir les marches de la raison. Des jardins silencieux les entourent, où l’eau des fontaines répète inlassablement la musique de l’équité. Les quelques Anges qui, élus parmi les élus, ont aperçu son apparition divine, racontent avoir vu une beauté dont aucun peintre, aucun poète, ne peut approcher la vérité : un éclat ne blessany point, mais obligeant qui le contemple à se voir tel qu’il est — sans artifice, sans ombre où se cacher. Ils racontent encore qu’en sa présence, le cœur coupable se serre, et que l’innocent respire comme au premier matin du monde. Dans chaque salle de jugement, sa statue siège à hauteur des regards, drapée de lumière. Quelque fois les magistrats sentent son souffle invisible sur leur nuque, et les coupables, la morsure d’un regard qui pénètre au‑delà des mots. Sous ses yeux de pierre, la voix vacille si elle ment ; la main tremble si elle signe l’injustice. On raconte que parfois, à l’instant où le juge hésite, un rai de soleil vient frapper le visage de pierre, et que la réponse se lit dans l’ombre ou la clarté laissée par ce rayon. - ******Zeita est l’incorruptible****** : elle écoute avant de parler, observe avant d’agir. Sa raison est comme l’eau claire qui polit les pierres — patiente, constante, inarrêtable. Sa justice, elle, ressemble au feu discret du forgeron : elle façonne, purifie, mais peut aussi consumer l’impur. À ses yeux, la colère est un nuage qui trouble la vision ; la vérité, un astre que l’on ne peut contempler qu’avec un esprit calme et droit. Dans les hymnes anciens, on chante encore : « Tant que Zeita tiendra le flambeau, Nulle nuit ne s’assiéra sur le trône de la Loi. Tant que sa main pèsera les cœurs, La balance ne ploiera ni à l’or, ni à la peur. » Où son nom est prononcé, l’ombre se retire, et chaque mot devient serment.'
),
(
    'f0000000-0000-0000-0000-000000000113',
    'f0000000-0000-0000-0000-000000000001',
    'Élisa - Déesse de la nature',
    ARRAY['elisa', 'nature', 'esprits', 'esprit', 'noah', 'divinite', 'deesse', 'foret', 'protectrice'],
    ', Déesse de la nature Élisa est l’âme pure et immuable de la nature, la souveraine invisible dont la main modèle les forêts, les rivières et les vastes prairies. Protectrice de la faction Esprit, elle est à la fois le cœur battant et le bouclier de ce peuple qui, depuis d’innombrables générations, fait de la nature non pas un simple abri, mais une alliée sacrée. Sous son regard dorée comme le soleil — miroir énigmatique de son esprit —, ils apprennent à aimer, respecter et défendre tout ce qui croît et respire. Bienveillante comme la pluie qui abreuve, Élisa se montre aussi implacable que la foudre qui frappe l’arbre malade : les fautes, même les plus minimes, ne trouvent aucun pardon si elles trahissent l’équilibre du monde. Mais à ceux qui se montrent dignes, qui vivent en harmonie avec ses lois, elle offre des présents d’une valeur inestimable : terres fertiles, saisons clémentes, ou encore la bénédiction d’une prospérité douce et durable. Ses temples, rares et discrets, se fondent dans le paysage au point de sembler avoir poussé de la terre elle-même. On les reconnaît à leurs colonnades enlacées de lierre, à leurs bassins où dort une eau limpide et aux chants d’oiseaux qui s’y abritent comme en un refuge inviolable. Là, les fidèles déposent des offrandes de fleurs, de graines ou de fruits, car tout ce qui appartient à la nature peut revenir à Élisa. Les récits anciens disent que, lorsqu’elle marche parmi les siens, ses pas ne laissent nulle empreinte sur le sol : seule une fragrance de fleurs nouvelles, et un silence apaisé, témoignent de son passage. Pourtant, si la nature est souillée, ses yeux se voilent d’un éclat dur, et les bois s’assombrissent autour d’elle, signe que la sentence approche : alors, nul abri en ce monde ne saura vous épargner son courroux.'
),
(
    'f0000000-0000-0000-0000-000000000114',
    'f0000000-0000-0000-0000-000000000001',
    'Vanyr - Dieu de la volonté et des limites',
    ARRAY['vanyr', 'volonte', 'limites', 'guerriers', 'combat', 'divinite', 'dieu', 'honneur', 'force'],
    ', Dieu de la volonté et des limites « Il n’est ni clémence, ni douceur dans ses mains, Seulement la forge brûlante où se trempent les plus dures âmes. » Écoute bien, voyageur, car ce que je vais te dire ne se répète pas à la légère. Vanir, ce nom qui claque comme un bouclier sur la pierre, n’a cure de couronnes ni de révérences. Ses cheveux, écarlates comme le ciel au déclin d’une bataille, annoncent le sang versé ; son corps, ciselé comme une arme ancienne, n’existe que pour la guerre. Ne le crois pas vertueux, ne l’imagine pas haranguant les troupes, drapé dans l’honneur fragile des héros : il méprise l’illusion de la gloire comme il méprise la mort. Pour lui, le trépas n’est qu’un frisson passager, un craquement d’os, un souffle éteint dans le vacarme des lames. Ce qu’il cherche, c’est la force pure, brute, sans fard, dans toutes ses formes — et malheur à qui confond celà avec la brutalité vide. Sombre et farouche, solitaire comme un loup sur la neige, Vanir ignore jusqu’au langage de l’amitié. On le dépeint vêtu d’une armure qui n’est pas seulement de métal, mais de fierté et de gloire pétrifiées ; ses larges épaules portent le poids de guerres oubliées. De son visage, aucune chanson ne dira la beauté : seuls deux yeux, rougeoyants comme des braises, traversent l’âme et figent le sang dans les veines. On lui prête des pouvoirs si vastes qu’ils pourraient renverser royaumes et faire vibrer les cieux. Mais il les dédaigne : frapper sans risque, dit-il, est une faiblesse ; écraser d’un geste nie l’art du combat. Il n’accorde d’estime qu’à ceux qui défient leurs propres limites, qu’à ceux qui dansent avec l’adrénaline au bord du gouffre. Ni duels d’orgueil ni massacres faciles ne sauraient acheter son regard. Pour lui, la volonté de vivre n’est qu’une étincelle ; se dépasser soi-même, là réside le feu qui l’intéresse. Vanir n’est ni juge ni arbitre : il siège sur son trône de fer et de silence, la tête basse, yeux clos, observant sans paraître voir. Pourtant… quand vous sentirez, sur votre nuque, la caresse glacée des doigts de l’Aurore, levez‑vous et combattez : vous avez reçu sa bénédiction. Ainsi vont les histoires de Vanir, le Dieu de la Volonté et des Limites. Guerrier immobile au cœur de mille batailles, colosse qui ne plie devant aucun adversaire. Mais qui, dans ce monde, peut dire où s’arrête la légende et où commence la vérité ?'
),
(
    'f0000000-0000-0000-0000-000000000115',
    'f0000000-0000-0000-0000-000000000001',
    'Zëphyr - Dieu de la pensée, des arts et de l''adaptation',
    ARRAY['zephyr', 'pensee', 'arts', 'adaptation', 'baraen', 'astre', 'divinite', 'dieu', 'conrak', 'amy', 'nomades'],
    ', Dieu de la pensée, des arts et de l''adaptation Fils de Amy, reine des fées au verbe délicat, et de Conrak, dieu de la bonne fortune et de la chance, la légende, réelle ou fausse, raconte que Zëphyr naquit sous un ciel fendu par un augure sombre. Une calamité ancienne avançait sur les terres, prête à se déchaîner sur le monde... Mais au moment précis où il poussa son premier cri, un vent nouveau se leva. Porté par la chance paternelle et la grâce maternelle, il repoussa la menace au‑delà des confins connus, et l’on dit que ce souffle protecteur erre encore dans les lieux où l’on murmure son nom. D’abord demi‑dieu, l''on raconte également que l''ascension du héros de Fallen se passa lors des âges sombres, après lesquels il fut accueilli au sein du panthéon de ce monde. Dorénavant protecteur des penseurs et des créateurs, il veille sur les artistes, les savants, les conteurs et les rêveurs. Plus jeune des dieux, oui, mais pas moins adoré: son culte fleurit dans les villes commerçantes comme dans les académies, mais nulle part sa dévotion n’est plus ardente que chez la faction des Astres, nomades du désert de Baraen. Dans les nuits tièdes constellées, leurs bardes chantent que Zëphyr, au sortir de ces temps qui bouleversèrent tous les peuples, leur illumina vers la reconstruction de leur peuple et d''un avenir radieux. On le représente comme un jeune homme aux traits changeants, drapé d’étoffes aux teintes mouvantes, portant tantôt pinceau, compas ou plume — trois visages d’un même geste : créer. Ses yeux, couleur d’horizon après l’orage, semblent toujours guetter l’instant où il faudra se réinventer. Dans les tentes sacrées de Baraen, on répète encore l’adage qu’il laissa à leurs ancêtres : « Ce n’est pas la force qui sauve, mais l’art de se métamorphoser. »'
),
(
    'f0000000-0000-0000-0000-000000000116',
    'f0000000-0000-0000-0000-000000000001',
    'Elsa - Déesse des mers et des océans',
    ARRAY['elsa', 'mers', 'oceans', 'pirates', 'marins', 'divinite', 'deesse', 'capricieuse', 'tempete'],
    ', Déesse des mers et des océans Il n’est pas rare d’apercevoir, sur les rivages de Fallen, quelques âmes perdues ou rêveuses — autochtones et voyageurs — fixer l’horizon au delà grandes eaux salées. Les mers portent, au creux de leurs vagues tantôt douces et miroitantes, tantôt farouches et déchaînées, un fardeau de songes : aventures et espérances, regrets et inquiétudes… Mais dans chacune de leurs humeurs couve toujours le péril. Car sur ces eaux règne Elsa, personnification même du Caprice. Protectrice farouche des enfants des abysses, elle façonne son royaume au gré des vents qu’elle module comme une mélodie cruelle et enjouée. Les siens l’adorent comme une mère, mais leur culte nourrit une rivalité tenace avec ceux que l’on nomme, avec un certain mépris, les sans‑branchies. Ces derniers, pour se concilier ses faveurs, doivent offrir présents somptueux et hommages coûteux. Pourtant, la belle déesse est aussi lunatique que redoutable. La fureur qui brûle dans ses yeux trouve son écho dans l’arme éternellement en ses mains : un sceptre‑trident, capable — si la fantaisie l’en prend — de faire sombrer des flottes entières. Et nul ne s’étonnerait qu’elle commande de telles tempêtes, aux côtés de son allié funeste : le Kraken. Les représentations les plus répandues chez pirates et enfants des eaux la montrent sous les traits d’une sirène à la beauté sans égale : yeux couleur cinabre, longue chevelure d’or semblable à des algues solaires, et corps sinople recouvert d’écailles irisées. Séductrice accomplie, comme ses filles, les légendes lui prêtent autant d’amants que de colères, de romances que de tragédies sanglantes. D’aucuns refusent pourtant de figer ses traits sur la toile, craignant de trahir sa perfection. Ils préfèrent la suggérer par l’image de l’écume gracile contre les rochers ou celle, redoutable, de vagues voraces engloutissant navires et équipages dans un mugissement de lion des profondeurs. Au cœur de la cité engloutie s’élève son plus grand temple, gardé par la noble race des ondins, ses fidèles dévoués. Selon la tradition, seules les jeunes femmes d’une pureté irréprochable peuvent en devenir les prêtresses les plus éminentes. Rares sont les peuples à lui vouer un culte officiel, mais tous la respectent : nul marin ne sait quand il devra affronter la mer, et il vaut mieux alors compter sur les grâces de la déesse capricieuse. Pirates et navigateurs entretiennent pour elle autels et sanctuaires dans chaque port et sur chaque navire. Quant aux femmes des côtes, désireuses de protéger un frère, un fils ou un époux parti voguer sur les flots, elles suivent un rite ancien : couper leurs cheveux, les mêler à du sel, les brûler dans une coupelle dédiée, puis répandre les cendres dans l’onde. Mais les sirènes, messagères moqueuses de la déesse, rient souvent de ces prières maladroites, car elles savent qu’il faut bien plus que cela pour apaiser Elsa… qui se plaît à contempler les sacrifices offerts en son nom.'
),
(
    'f0000000-0000-0000-0000-000000000117',
    'f0000000-0000-0000-0000-000000000001',
    'Noah - Le Continent Vert',
    ARRAY['noah', 'continent vert', 'foret', 'nature', 'esprit', 'avall arh', 'esprits'],
    'NOAH est une grande forêt (à 80%) annexée par le Peuple des esprits depuis l''ère des divinités. C''est une étendue boisée, relativement grande, constituée d''un ou plusieurs peuplements d''arbres, arbustes et arbrisseaux, et aussi d''autres plantes indigènes associées. Ils existent Quelques villages qui s’éparpillent sur les arbres aux alentours, surtout près des lacs et des cours d’eau. D’autres sont à deux pas des mines, où les villageois travaillent parfois. Cette terre est relativement calme et les difficultés sont plutôt rares. Les paysages sont enchanteurs a NOAH, terre qui doit son nom aux nuances des herbes folles qui dansent sous la brise, certaines ayant des propriétés curatives. De nombreuses fleurs des champs viennent ajouter des touches de couleur à ce tableau. Elles sont toutes plus belles les unes les autres, et portent un parfum délicat sur tout le territoire. Les voyageurs apprécient ces panoramas lumineux et s’attardent souvent en haut d’une butte ou d’une colline, pour la dévaler à vive allure dans un trait enfantin. La végétation est vive, abondante et loin de manquer d''eau. En passant par les sentiers battus , l''on remarque sur les côtés des fougères pouvant atteindre un mètre de hauteur , ainsi que des orties et ronces ou poussaient des mûres . Les arbres , les chênes , les hêtres se dressaient fièrement ; d''après des légendes , certains étaient vieux de plusieurs siècles . Cet endroit grouille de faune et de flore , un vrai sanctuaire naturel . Les habitants de ce continent se partagent, selon leur habitat, en espèces différentes. S''il existe des esprits solitaires et isolés, beaucoup d''elfes des campagnes vivent dans les forêts (souvent ils adoptent un arbre. De ce fait l’arbre et son hôte deviennent synonymes), dans les prairies, les collines et les grottes à flan de montagne. Il y en a qui vivent dans les Îles enchantées, dans les domaines sous-marins, dans les mers, les lacs, les rivière. Enfin il y a les esprits domestiques ; ceux qui hantent les maisons (Farfadets et autres). Les modes de vie diffèrent également qu''il s''agisse de familles resserrées sur elles-mêmes, de communautés organisées hiérarchiquement (souvent installées dans les montagne ) ou d''esprits indépendants et solitaires. Les souterrains, les catacombes et les anciennes carrières sont un endroit de prédilection pour les esprits. La nuit ces montagne sont souvent illuminées par une nuée de lucioles'
),
(
    'f0000000-0000-0000-0000-000000000118',
    'f0000000-0000-0000-0000-000000000001',
    'Baraen - Le Continent des Exilés',
    ARRAY['baraen', 'desert', 'exiles', 'nomades', 'astre', 'zephyr', 'yrvaeh', 'rezopia', 'faubourg'],
    'Le Désert est source de fantasmes de la part de tout individu ayant soif de voyages et de mystères. Ceux qu’ils gardent en son sein sont multiples, tout comme le nombre de pyramides qu’il comporte, certaines enfouies depuis des Ères et des Ères, fruits d’une ancienne civilisation aujourd’hui disparu. Auparavant territoire neutre, le Désert a été annexé il y a très longtemps par les Humains, les nécessités de l’époque rendant ce choix judicieux. Il s’agissait, en réalité, de protéger la race contre les Vampires notamment. La chose fonctionna et une véritable communauté se développa, dans un idéal commun qui fut ébranlé à l’aube de l''ère des dieux. La géographie du Désert est encore aujourd’hui incertaine. À cause des tempêtes de sable, les dunes se transforment et se déplacent, si bien que les essais de cartographie ont été infructueux jusque là. Il arrive à des pyramides de disparaître, à d’autres d’apparaître. Bien entendu, certains lieux sont beaucoup plus durables que d’autres. De façon générale, les Humains ont apprivoisé le Désert, un Désert qui pardonne difficilement aux autres peuples. Plusieurs temples se trouvent éparpillés dans l’immensité du paysage, certains menant à des cavités souterraines permettant le repos. Le climat glacial de la nuit et brûlant du jour n’est pas la seule cause de décès, bien au contraire. De terribles créatures se cachent sous le sable, vivant à l’intérieur même des dunes et se nourrissant des proies faciles et exténuées qui passent à leurs côtés. Certains périmètres sont mortels car poser un pied à l’intérieur de ces derniers signifie disparaître pour de bon, entraîné dans le sable par d’immondes bêtes assoiffées de chair et de sang. Les Humains connaissent ces zones, les repèrent grâces aux édifices et au ciel, grâce à l’ombre portée et à la position des oasis qui, curieusement, ne connaissent d’aucun changement. À un endroit particulier du Désert, en son centre, se trouve ce qui est appelé communément « La Cité Maudite », une parcelle de plusieurs kilomètres sur laquelle se dressent un vaste empire. Ceux qui y sont allés n’en sont jamais revenus et autour de la zone se dressent un certain nombre de pancartes indiquant clairement aux aventuriers de passer leur chemin. La mort est imminente, même pour un Souverain, car les créatures qui y sont regroupées, inconnues au demeurant, n’ont ni maître ni loi... il paraît. Dans le Désert, il est possible de trouver plusieurs petits villages ou tribus de nomade souvent habités par une poignée d''humains. Certains sont néanmoins vides, ne servant qu’aux voyageurs, afin qu’ils puissent trouver un toit où se reposer. D’autres sont plutôt peuplés. Des caravanes parcourent souvent les dunes, trainées par des dromadaires ou des chameaux. Certaines zones sont des campements de fortune, habitant plusieurs tentes dont les tissus sont généralement malmenés par le climat. Depuis la guerre un royaume et une cité y ont même vu le jour.'
),
(
    'f0000000-0000-0000-0000-000000000119',
    'f0000000-0000-0000-0000-000000000001',
    'Icetoon - Le Continent de Glace',
    ARRAY['icetoon', 'glace', 'gele', 'vikings', 'nordique', 'ford-odin', 'sten', 'gunnar', 'tournoi'],
    'Icetoon est un endroit qui a su garder sa part de mystère qui fait inévitablement son charme. Cet endroit est une immense « cuvette » naturelle recouverte d’une épaisse couverture de neige l’année durant. Il s’agissait autrefois d’un lagon d’eau mais la glace s’est doucement formée et aujourd’hui, elle recouvre toute l’étendue d’eau au point d’en faire une véritable patinoire. Autour de ce lac, c’est toute la nature qui semble s’être cristallisée pour devenir éternelle, les roches et les arbres, ils ne cessent pas de grandir et semble même particulièrement bien se développer là où la température est au plus faible mais est recouverte de glace, il existe également un petit pays de guerrier. La neige cesse rarement de s’évader des gros nuages blancs semblables à la fumée d’une gigantesque cheminée mais cela n’empêche également pas la faune de s’y être développée, souvent de petits rongeurs qui aiment autant glisser sur leur banquise de fortune à plat ventre que de plonger avec talent dans les zones morcelées voir déjà fracturées et qui laisse place à des points d’eau à ciel ouvert. Ainsi, si certains ne viennent que pour pêcher, d’autres plantent la lame de leur arme dans leurs épaisses bottes et défient les lois de l’apesanteur en accomplissant bien des prouesses ou tout simplement pour s’amuser, en couple ou entre amis. En effet, vers la partie nord, la glace forme de véritables conduites en zigzag, pentes et autres loopings qui permettent aux plus habiles quelques parties de luge très agréables pour passer le temps. Cependant comme chaque lieu en ces terres et plus particulièrement en ce continent dévasté, chaque endroit garde sa part de secrets. Si on ne sait d’où vient ce climat hivernal et doux à un équilibre parfait pour profiter des bienfaits des sports de glace tout en ne mourant pas de froid, il est aussi question de ce qui se trouve sous la glace. En effet, la population s’accorde à penser que quelque chose ou plutôt quelqu’un se cacherait sous ce berceau et que la glace serait le toit d’un cocon qu’il se serait créé bien au-delà dans les profondeurs de cet ancien lagon. On en sait cependant peu, personne n’est assez fou pour plonger vu la température de l’eau et ceux qui s’y sont tentés sans subir l’hypothermie racontent qu’en suivant ces étranges castors à long poil, un tunnel se laisse découvrir mais la noirceur des lieux empêche toute reconnaissance. Voilà bien un mystère qui mériterait d’être découvert. D’autant plus qu’il parait que sous cet endroit se trouve de véritables galeries souterraines mais ce n’est qu’une rumeur, évidemment.'
),
(
    'f0000000-0000-0000-0000-000000000120',
    'f0000000-0000-0000-0000-000000000001',
    'Atlantica - Le Continent Ancien',
    ARRAY['atlantica', 'ancien', 'avance', 'civilisation', 'pegasus', 'michael black', 'guilde'],
    'Ancienne capitale du continent, Atlantide est aujourd’hui un pays à part entière, s’étant détaché de son passé glorieux pour devenir un symbole d’équilibre entre érudition et pouvoir mystique. Ce territoire d’un éclat inégalé est baigné d’une lumière étrange, constante et douce, comme si les astres eux-mêmes s’inclinaient devant sa magnificence. Ici, le jour et la nuit ne sont que des concepts : recréés magiquement, ils rythment les journées avec une harmonie presque irréelle. Le pays est entièrement contenu sous une immense bulle invisible, constituée d’une magie pure, d’origine inconnue. Cette barrière impénétrable maintient une atmosphère idéale et repousse les eaux environnantes, offrant aux visiteurs l’illusion d’un monde suspendu au milieu des flots. Capitale mystique appelée "Atlan" par les Mages, la cité regorge de bâtiments d''une blancheur éclatante et d''une architecture presque fluide. La tradition raconte que seul le gouverneur possède le pouvoir de faire apparaître ou disparaître cette bulle, faisant de lui un être respecté autant que craint. Autour de cette cité centrale, s’étendent de vastes plateaux vierges et rocheux, vestiges de temps immémoriaux. Jadis théâtre de savoirs partagés, d’échanges entre peuples et de festivités baignées par l’astre roi, Atlantide reste une terre de fascination et de rêve.'
),
(
    'f0000000-0000-0000-0000-000000000121',
    'f0000000-0000-0000-0000-000000000001',
    'Roahx - Le Continent Sauvage',
    ARRAY['roahx', 'sauvage', 'mercenaires', 'hors-la-loi', 'conrak', 'sandler void'],
    'La Terre de Roahx est une vaste forêt (40%) verdoyantes, annexées par le Peuple des humains et certaines créatures depuis des Eres. Ils sont nombreux à vouloir vivre au sein de l''immense foret de Roahx, réputées pour sa tranquillité ainsi que pour la douceur du climat. Cependant, il n’est guère aisé de s’installer en ces lieux, car les humains cherchent avant tout à préserver les étendues sauvages. Quelques villages et bourgs s’éparpillent aux quatre coins de Roahx, surtout près des lacs, des cours d’eau et du littoral. Il existe également des Terres Arides qui sont un large territoire semblant n’être en réalité qu’un désert de roches et de lave séchée. Pour autant, d’où que l’individu qui osera fouler son sol se trouvera, il verra le Volcan Ardent. La montagne paraîtra plus ou moins éloignée mais plus les pas de l’imprudent se rapprocheront, plus la roche fera place au magma séché. La zone devient alors particulièrement dangereuse car la région était, à la base, composée de différentes petites montagne, le sol se trouvant à des mètres de là. La lave a bouché les cavités mais, parfois, la matière craque sous le pied et son possesseur tombe simplement dans les gouffres dissimulés. Aussi, certains trous dans le sol laissent de temps en temps échapper de la fumée bouillante pressurisée à une vitesse qui ne permet pas de l’éviter. Il est donc recommandé de faire particulièrement attention à son itinéraire. Le ciel y est souvent menaçant, recouvert de la fumée émanant du Volcan ou de nuages à l’allure mauvaise. Le Volcan Ardent et ses alentours sont un secteur à la fois dangereux et prisé par les « touristes » puisqu’il comporte une zone de végétation au milieu de laquelle des sources d’eau chaude trouvent leur place. Endroit paradisiaque, il existe depuis des Ères et des Ères, bien avant que le peuple annexe le territoire. Auparavant, les individus aimaient s’y rendre en toute liberté durant la saison propice mais ce n’est plus possible à présent car les Mercenaires en font payer l’accès. Le volcan ardent entre en éruption de manière cyclique, lors d’une saison bien précise. De ce fait, il n’y a aucune surprise quant à la colère du volcan. Juste avant la période des éruptions, les Animaux Ailés viennent sur les Terres Arides pour y pondre leurs œufs qui sont ensuite recouverts de lave. Les créatures les laissent en paix puisque le commerce des œufs leur rapporte énormément. Sur les Terres Arides se trouvent la grande cité de Sandora, assez éloignée du Volcan pour ne pas être touchée par ses éruptions. De même, plusieurs petits villages sont en construction dans la région.'
),
(
    'f0000000-0000-0000-0000-000000000122',
    'f0000000-0000-0000-0000-000000000001',
    'Kaos - Le Continent des Braves',
    ARRAY['kaos', 'braves', 'guerriers', 'honneur', 'arthur thirsk', 'guilde', 'silvester', 'disparitions'],
    'Fertiles et accueillantes, le gigantesque continent qu''on finit par surnommer la terre des hommes au cours des ans dû à la domination de cette race lors des dernières décennies représente un magnifique endroit. Scindé en maintenant dix royaumes distincts et quelques rares contrées neutres depuis la guerre divine, ce site de tourisme incontournable trouve sa richesse dans la diversité de sa démographie. Forêt septentrionale, montagnes ou volcans, il faudrait se concentrer sur les royaumes pour saisir les principaux fondements. Ces derniers se nomment Vlagos, Illusia, Valguanide, Andromeda pour les plus anciens puis viennent les nouveaux royaumes que sont Aragorn, Avalon, Clovara, Mirasdur, Miryos et Azeroth. Mais on peut aussi noter la Forêt de Jarvild, site incontournable.'
),
(
    'f0000000-0000-0000-0000-000000000123',
    'f0000000-0000-0000-0000-000000000001',
    'Ithis - Le Continent Maudit',
    ARRAY['ithis', 'maudit', 'vianum', 'loups-garous', 'pleine lune', 'khalian', 'chevelure blanche'],
    'Ithis est un vaste territoire annexé par les créatures surnaturelles , durant le début de l''ère des dieux. Le conseil céleste n’a donc aucune emprise sur ce lieu qu’il peut, bien évidemment, fouler mais a ses risques et périls. Vaste étendue de montagnes rocheuses, de foret et de zones volcanique , Ithis doit son nom à la dangerosité de l’endroit, une dangerosité qui n’avait guère besoin de la présence des créatures sur ces terres pour être effective. Le paysage est particulièrement difficile. Ceux qui s’y rendent n’en reviennent pas forcément car les créatures monstrueuses sont nombreuses à y roder. C’est une région particulièrement propice aux bêtes mythiques, aux Dragons millénaires et autres faunes indomptables. De plus, il y fait presque tout le temps nuit, ce fait n’aidant absolument pas ceux qui doivent s’y rendre à retrouver leur chemin. Elle sont subdivisées en villes différentes chacune sous l''égide d''un clan précis . Les bannières de ces clans sont généralement représentés par une race fixe ..mais pas seulement. ..elle peut compter en son sein aussi bien d''autres races issues d''autres petits clans'
),
(
    'f0000000-0000-0000-0000-000000000124',
    'f0000000-0000-0000-0000-000000000001',
    'Les Forteresses des Sorciers',
    ARRAY['forteresses', 'sorciers', 'occulte', 'malakath', 'altheor mornveil', 'forkroy', 'magie'],
    '. Elle n''est pas seulement une bâtisse ; c''est une légende vivante, le monument le plus grand, le plus célèbre et le plus connu de Fallen. Autrefois le siège principal du Conseil de l''Ombre, elle est aujourd''hui une sentinelle imposante, dont la silhouette hérissée de tours se découpe sur l''horizon des frontières continentales, un témoignage de l''histoire et de la puissance arcanique. Chacune des multiples tours de Forkroy abrite des anciens sorciers de Fallen, des figures vénérables dont la longévité et la sagesse sont légendaires. Ces occultes ne sont pas seulement des résidents ; ce sont les gardiens vivants des connaissances et des sorts oubliés, leurs chambres des bibliothèques de magie à elles seules. Leurs âges avancés ne signifient pas une diminution de leur pouvoir, mais une profondeur et une maîtrise des arts magiques que peu peuvent égaler, ce qui rend chaque rencontre avec eux imprévisible. Les couloirs de Forkroy ne sont pas de simples passages ; ils sont des labyrinthes enchantés, protégés par des entités connues sous le nom d''Amaras. Ces êtres ne sont pas de chair et de sang, mais des manifestations éthérées de protection complexes, imprégnées d''une volonté farouche de défendre la forteresse. Ils sont des gardiens silencieux et impénétrables aux illusions terrifiantes, rendant toute progression complexe et périlleuse pour les intrus. Au cœur de l''illustre Forteresse de Forkroy ne se trouve pas un simple artefact, mais un lieu sacré d''une puissance inégalée : le Mausolée des Arcanes. Ce n''est pas un monument de pierre, mais une constellation éthérée d''âmes, le dépôt ultime de l''héritage magique des sorciers. Imaginez une vaste chambre, voûtée, où la lumière vacille et danse. Au lieu de tombes, l''air est rempli de milliers d''orbes lumineux, chacun vibrant d''une couleur et d''une intensité uniques. Ces orbes ne sont autres que les essences cristallisées des sorciers primitifs envoyés par Malakath. Leur pure énergie magique convergent et persistent formant le rouage de la complexité des labyrinthes et la source de la puissance des Amaras. Les sorciers de Forkroy disent fièrement à quiconque qui peut les entendre que le Mausolée des Arcanes est le plus puissant des artefacts de toutes les forteresses, car il ne confère pas un pouvoir spécifique, mais l''accès à la somme totale de ceux reconnus à Forkroy. L''accès à une telle puissance n''est pas donné à la légère. Voilà pourquoi il est exclusivement réservé au maitre du lieu ainsi qu’à sa petite cour.'
),
(
    'f0000000-0000-0000-0000-000000000125',
    'f0000000-0000-0000-0000-000000000001',
    'Cornum - Le Continent Noir',
    ARRAY['cornum', 'noir', 'chaos', 'origine', 'corruption', 'memento'],
    '- ****◾ Vue d''ensemble**** : Le continent jusque là caché du monde, se présente de loin comme un vaste territoire bondée par une immense végétation, à la manière du continent des esprits. Cette vaste étendue végétale arbore tout de même un relief montagneux. En s''aventurant davantage au coeur du territoire, on y découvre plusieurs plaines mais surtout une zone à la constitution assez surprenante et peu commune. En effet, une partie de l''île est constituée de magnifiques cristaux d''énergies naturelles. Globalement, Cornum est un continent reluisant par sa richesse et sa structure, attirant nombre de personnes souhaitant découvrir cette immensité.'
),
(
    'f0000000-0000-0000-0000-000000000126',
    'f0000000-0000-0000-0000-000000000001',
    'Céleste - Le Paradis des Cieux',
    ARRAY['celeste', 'cieux', 'paradis', 'anges', 'ange', 'zeita', 'gabriella', 'nuages'],
    'Céleste est un grand et beau monde. Depuis sa création, il est illuminé par la puissance des dieux (selon eux) et ne connaît que le jour. La flore est magnifique et l''architecture est essentiellement composée d''immenses tours dont certaines pouvant atteindre 5000m. Les Terres Céleste sont de vastes plaines verdoyantes, annexées par le Peuple des Anges depuis des Ères, sous le règne des dieux primordiaux. Ils sont nombreux à vouloir vivre au sein des immenses cités de Céleste, réputées pour leur tranquillité ainsi que pour la douceur du climat. Il existe également des lacs et des cours d’eau . Les Terres de Céleste sont relativement calmes et les difficultés sont plutôt rares, si ce n’est que quelques individus mal intentionnés franchissent parfois les frontières avant d’être frappés par la Magie présente en ces lieux. Les paysages sont enchanteurs a Céleste, terres qui doivent leur nom aux nuances divines. De nombreuses fleurs des champs viennent ajouter des touches de couleur à ce tableau. Elles sont toutes plus belles les unes les autres, et portent un parfum délicat sur tout le territoire. Le temps est éternellement radieux, sur les Terres de Céleste. Le ciel ne semble jamais entaché du moindre nuage et le territoire n’essuie aucune averse, pas même quelques gouttes ou flocons. Pourtant, la végétation est vive, abondante et loin de manquer d’eau. La terre est d’ailleurs particulièrement fertile. Céleste comprend 4 grandes cités chacune dirigée par un archange faisant partie du conseil et chaque cité comprend ses propres lois. Cependant toutes les 4 cités reçoivent leurs instructions et directives du quartier général.'
),
(
    'f0000000-0000-0000-0000-000000000127',
    'f0000000-0000-0000-0000-000000000001',
    'Mundus - L''Enfer Souterrain',
    ARRAY['mundus', 'enfer', 'souterrain', 'demons', 'demon', 'nergal', 'azrael kaun', 'roder'],
    'Mundus est un vaste territoire annexé par les Entités Démoniaque depuis la grande création. Le conseil céleste n’a donc aucune emprise sur ce lieu qu’il peut, bien évidemment, fouler mais à ses risques et périls. Vaste étendue de montagnes rocheuses, Mundus doit son nom à la dangerosité de l’endroit, une dangerosité qui n’avait guère besoin de la présence démoniaque sur ces terres pour être effective. Le paysage est particulièrement difficile. S’il existe des endroits plats, ils semblent avoir été conçus pour tromper les visiteurs imprudents, cherchant de quoi se reposer. En effet, les lieux les moins dangereux sont sans doute les hauteurs. Mundus n’est certainement pas la zone la plus adaptée pour un voyage touristique. Ceux qui s’y rendent n’en reviennent pas forcément car les créatures monstrueuses sont nombreuses à y rôder. C’est une région particulièrement propice aux bêtes mythiques, aux Dragons millénaires et autres faunes indomptables. De plus, il y fait presque tout le temps nuit, ce fait n’aidant absolument pas ceux qui doivent s’y rendre pour retrouver leur chemin. Cela étant, il semble que les Démons de hauts rangs n’aient aucun mal à se repérer dans Mundus. Le lieu est particulièrement fourni en cavités, certaines donnant dans des dédales et passages secrets fabriqués durant une ère que très peu de vivants connaissent réellement. Pénétrer ici équivaut donc soit à se faire dévorer par un monstre, soit à se faire calciner par la température ambiante. Il a été néanmoins conclu que les créatures surnaturelles pourraient fouler les terres démoniaques sans encombre ( cela ne veut pas dire qu''elles s''y rendront de leurs propres chefs , NON. Ils auront besoin de l''appui d''un démon ). La flore est très peu présente voir inexistante au sein de Mundus qui n’est en aucun cas un territoire économiquement viable. Cela étant, les Démons n’ont que faire de l’agriculture étant donné qu’ils sont à même de se téléporter via des portails. Les denrées sont donc amenées dans les propriétés par cet intermédiaire. L’endroit est coupé en deux par un gouffre qui semble sans fond. Il en a pourtant un, composé de lave qui s’écoule à des kilomètres de la surface. Il n’est pas rare de sacrifier des individus en son sein, si bien que des centaines de squelettes sont répandus en contrebas.'
),
(
    'f0000000-0000-0000-0000-000000000128',
    'f0000000-0000-0000-0000-000000000001',
    'Eudenia - La Terre des Dieux',
    ARRAY['eudenia', 'terre des dieux', 'scellee', 'lucas saviore', 'prophetie', 'portes'],
    '## ■ Vue d’ensemble : Eudenia n’est plus ce qu’elle était. Autrefois pure, magnifique et inviolée, elle n’est aujourd’hui que l’écho sacré d’un monde divin déserté. Les nuages bénis persistent, mais leurs formes sont distordues, leurs couleurs tachées par les croyances mal comprises de ceux qui ont osé y entrer. Le ciel, autrefois azuré, se teinte désormais d’une lumière changeante, instable, comme si l’équilibre du lieu cherchait à se maintenir malgré la corruption rampante. Les royaumes des dieux, bien qu’abandonnés, subsistent. Leur splendeur s’est figée, transformée par la présence de mortels ayant survécu à leur passage. Certains lieux brillent toujours, d''autres se sont obscurcis, infectés par les traces des nouveaux arrivants. Ce qui était autrefois vivant, divin, est aujourd’hui un sanctuaire éteint où résonne la mémoire des véritables dieux.'
),
(
    'f0000000-0000-0000-0000-000000000129',
    'f0000000-0000-0000-0000-000000000001',
    'La Mer Tyrannique',
    ARRAY['mer tyrannique', 'ocean', 'elsa', 'pirates', 'marins', 'navires'],
    'Elle fut surnommée ainsi par les habitants des continents pour une raison évidente : peu s’engageant dans ses eaux en revenaient indemnes. En réalité, hormis les Sirènes qui sont maîtresses des Océans, les seuls peuples à la connaître parfaitement sont les sorciers et les voyageurs ayant annexé un territoire en son sein. Pour autant, même ces derniers restent prudents lorsqu’ils naviguent sur la Mer Maudite car le niveau de l’eau varie énormément d’un point à un autre. Si certains endroits sont profonds, d’autres, la majorité, ne comportent que quelques mètres d’eau. Le sol marin est composé de rochers qui, généralement, se cachent juste en dessous de la surface, attendant que la coque d’un bateau vienne s’encastrer dessus. Si, parfois, leur pointé dépasse, elle reste le plus souvent dissimulée par le brouillard ou la pluie qui s’abat sur toute la zone. En effet, le climat de la Mer Tyrannique est un des pires qui soit. Il mouille le corps des navigateurs jusqu’à la moelle et une odeur nauséabonde s’engouffre souvent dans les navires, comme un hymne à leur état de moisissure future. Des carcasses de flottes entières sont ballotées par les vagues déchaînées et des créatures marines aux dents aiguisées attendent patiemment quiconque tomberait à la Mer. S’il est rare que les Sirènes soient la cause des naufrages en ce lieu, cela peut néanmoins arriver. La Mer Tyrannique est pauvre en îles de forte taille. La plupart sont des cailloux de quelques mètres que les marins peuvent espérer rejoindre à la nage lorsque leur bateau coule. Pourtant, il serait vain d’espérer survivre car les petites îles ne comportent généralement pas de vie, ni de faune ni de flore, si ce n’est des créatures et plantes particulièrement dangereuses. Certaines zones de la Mer Tyrannique restent inexplorées, cachant des mystères qui perdent tous ceux essayant de les découvrir. Cet endroit sent la mort à plein nez, la torture et la souffrance. Il est d’ailleurs fréquent que lorsque la pluie cesse, ne laissant les voyageurs qu’avec le brouillard, des cris affreux se fassent entendre quelques mètres plus loin, raisonnant en échos sur les rochers arides des alentours. - ****■ Niveau de dangerosité**** : 17/20 Tous les peuples des Terres de Fallen peuvent naviguer dans les eaux de la Mer Tyrannique. Pourtant, si elle a été nommée ainsi, ce n’est guère pour rien. En effet, elle est plutôt difficile et il faut être un navigateur expérimenté, ayant pleine connaissance du climat et de l’environnement afin de pouvoir survivre à sa fureur. Bien entendu, sous la surface, les créatures marines sont reines bien que le courant y soit particulièrement puissant. La Mer Tyrannique est une zone particulièrement dangereuse. Contrairement aux apparences, le niveau de la Mer est plutôt bas et des rochers se cachent dans ses eaux, si bien qu’il n’est pas rare de voir les navires s’y encastrer, emportés par le courant. Le brouillard est également l’ennemi de quiconque ne connait pas parfaitement l’endroit car il cache toute visibilité. Les îles se trouvant dans cette zone sont, pour la plupart, dénuées de la moindre fertilité, ce qui conduit à une mort certaine les aventuriers s’y étant échoués. Certaines sont plus accueillantes mais, généralement, déjà annexées par des peuples qui, eux, ne le sont pas. Il n’est pas rare que la Mer Tyrannique recrache sur les plages les débris des navires qu’elle a avalé et les corps de ceux qui ont péri en son sein, lorsqu’ils ne se font pas dévorer par les créatures marines.'
),
(
    'f0000000-0000-0000-0000-000000000130',
    'f0000000-0000-0000-0000-000000000001',
    'Guilde Pegasus',
    ARRAY['pegasus', 'guilde', 'atlantica', 'michael black', 'ambassadrice', 'legale', 'atlantide'],
    'La guilde la plus grande et la plus influente d''Atlantica. Michael Black en est le Maître de Guilde. Pegasus s''occupe de la défense du pays et dispose d''une trésorerie de plus de 25 milliards de pièces d''or. Elle compte 100 membres.'
),
(
    'f0000000-0000-0000-0000-000000000131',
    'f0000000-0000-0000-0000-000000000001',
    'Guilde Sight of Hope',
    ARRAY['sight of hope', 'soh', 'guilde', 'havre de paix', 'hinerza van blue', 'justice', 'legale', 'ambassadrice'],
    'Sight Of Hope est une guilde légale ambassadrice située à Havre de Paix. Menée par le Maître Hinerza Van Blue, elle a pour mission de maintenir la justice et une paix durable dans le monde, prévenant les conflits d''ordre mondial.'
),
(
    'f0000000-0000-0000-0000-000000000132',
    'f0000000-0000-0000-0000-000000000001',
    'Noches - La Guilde Sombre',
    ARRAY['noches', 'guilde', 'sombre', 'clandestine', 'ombre', 'clandestines'],
    'Une guilde clandestine et sombre opérant dans l''ombre de Fallen. Bien qu''illégale, elle reste l''une des organisations les plus influentes et mystérieuses, dont les dirigeants et membres sont tenus secrets.'
),
(
    'f0000000-0000-0000-0000-000000000133',
    'f0000000-0000-0000-0000-000000000001',
    'Dragon Noir - L''Organisation de Mercenaires',
    ARRAY['dragon noir', 'mercenaires', 'chaos', 'arc 2', 'darkness returns', 'guilde'],
    'Organisation de mercenaires qui s''est illustrée par le chaos semé durant l''Arc 2 (Darkness Returns). Bien que son influence ait diminué, elle reste active dans les zones sombres du monde.'
),
(
    'f0000000-0000-0000-0000-000000000134',
    'f0000000-0000-0000-0000-000000000001',
    'Système de Points du Jeu (PE, XP, PR, PM, PB, PN, PU)',
    ARRAY['pe', 'xp', 'pr', 'pm', 'pb', 'pn', 'pu', 'points', 'systeme', 'evolution', 'reputation', 'moralite', 'benediction', 'noblesse', 'unite'],
    'Le système de jeu repose sur sept types de points : PE (évolution), XP (expérience combat), PR (réputation), PM (moralité), PB (bénédiction divine), PN (noblesse), et PU (unité de faction). Les caractéristiques de combat comprennent la Force, Vitesse, Endurance, Résistance, Réserve, Puissance, Mental, Réactivité, Charisme et Intelligence, notées sur 60.'
),
(
    'f0000000-0000-0000-0000-000000000135',
    'f0000000-0000-0000-0000-000000000001',
    'Les 15 Grandes Puissances',
    ARRAY['grandes puissances', 'classement', 'puissants', 'rezvenia', 'drafhorz', 'kaars', 'avall arh', 'gabriella', 'cecilia', 'caellan', 'riffen', 'altheor', 'yrvaeh', 'vladislaus', 'azrael', 'sten', 'augusta', 'sandler', 'arthur'],
    'Classement des 15 Grandes Puissances de Fallen : 1. Drafhorz Lazuli Varn Emreis (Elder), Empereur de Rezvenia. 2. Kaars Agius (Hybride), vainqueur de Thars. 3. Avall''arh (Esprit), Gardien Suprême de Noah. 4. Gabriella (Ange), arme ultime de Céleste. 5. Cécilia Varn Emreis (Elder), Princesse de Rezvenia. 6. Caellan Atlas (Honneur), Protecteur de Valguanide. 7. Riffen Carsarius (Sainteté), Maître des Dix Cercles de Sacror. 8. Altheor Mornveil (Occulte), Maître de Forkroy. 9. Yrvaeh Cload (Astre), Maître de la plus puissante guilde de Baraen. 10. Vladislaus Nocturnus (Sang-pur), Roi Vampire. 11. Azrael Kaun (Démon), Roder de Mundus. 12. Sten Ragnvald (Viking), Jarl de Ford-Odin Nord. 13. Augusta Brown (Sans-faction), Seigneur d''Al-Far. 14. Sandler Void (Hors-la-loi), l''aventurier le plus célèbre. 15. Arthur Thirsk (Honneur), Maître de la plus puissante guilde de Kaos.'
),
(
    'f0000000-0000-0000-0000-000000000136',
    'f0000000-0000-0000-0000-000000000001',
    'Murmures - Événements Mondiaux Actuels',
    ARRAY['murmures', 'evenements', 'nouvelles', 'monde', 'silvester', 'rina', 'azuris', 'rasmus', 'pyramides', 'dragon', 'enfant'],
    '# [ 𝐌𝐔𝐑𝐌𝐔𝐑𝐄𝐒 𝐃𝐄 𝐅𝐀𝐋𝐋𝐄𝐍 ] - ******Distributeur****** : Il est de sortie, le plus grand journal qui récapitule l''actualité dans le monde de Fallen. Lisez le vite, car les nouvelles n''attendent pas ! Des siècles après, le journal "Murmures de Fallen" a atteint les sommets du monde. Sis à Pergal, c''est LE JOURNAL MONDIAL qui vous tient informé de tout ce qui se passe. Tout en étant gratuit, il est source de connaissances inestimables. Que ce soit de l''information, des nouvelles, des découvertes exclusifs, le journal "Murmures de Fallen" vous procurera ce qu''il faut savoir pour bien vivre. Alors plongez dans les pages, et informez vous e temps réel ! ## [ 𝐏𝐑𝐄𝐌𝐈𝐄𝐑𝐄 𝐄𝐃𝐈𝐓𝐈𝐎𝐍 𝐃𝐔 𝐉𝐎𝐔𝐑𝐍𝐀𝐋 "𝐋𝐄𝐒 𝐌𝐔𝐑𝐌𝐔𝐑𝐄𝐒" ] Bonjour à tous et à toutes ! Un petit moment s''est déjà écoulé depuis les dernières nouvelles, alors sans plus tarder, voici les dernières murmu– Ah. Ahem. Pardonnez, force de l''habitude. Non plus les murmures, notez, mais bel et bien le tout nouveau Journal de Fallen ! Et rassurez vous, vous ne regretterez pas les mortes murmures, bien au conttaire : des ragots les plus croustillants aux rumeurs les plus intriguantes, rien n''échappera à nos plumes les plus aiguisées. Et par soucis d''organisation, cette édition naissante sera subdivisée en deux sections : - ******La section "Faits divers"****** : potins, racontards, nouvelles diverses et variées... Tout ce qui fait jaser sur la place du marché ou dans les arrières cours se trouvera ici - ******La section "Enquêtes"****** : mystérieux évènements, étranges disparitions, déroulements incompréhensibles... Tout ce qui nécessite une inquisition, au jugé de notre bon personnel, sera rassemblé ici. Suivre les fils des divers mystères peuvent bien souvent conduire à moults quêtes ou trames à importances variables. ________________________________________ - ****### 🗒️ 𝗙𝗔𝗜𝗧𝗦 𝗗𝗜𝗩𝗘𝗥𝗦**** : - ******𝐊𝐚𝐨𝐬****** : - Une joyeuse nouvelle ici, une grande fête est organisée par les Silvester, nobles de Kaos, pour fêter la retrouvaille de leur enfant disparu. Ripaille et boissons à volonté ! - ******𝐁𝐚𝐫𝐚𝐞𝐧****** : - La princesse de Faubourg, son altesse Rina Dyëqnar et Valden Marchal, Sénateur & fils du Grand Consul de Mornia ont récemment célébré leur union maritale au cours du cérémonie grandiose. Longue vie au noble couple ! - ******𝐑𝐨𝐚𝐡𝐱****** : - Azuris Van Blue, membre du conseil Triasmus se rend à Miroslava en compagnie de Nash Van Blue, actuel Maître de la guilde Qilin... Des rumeurs disent qu''un grand coup se prépare. - Nash Atlas, autre membre du conseil de Triasmus, et Salomon Daughtry le dirigeant de Mirea sont en visite à Maboule pour raison diplomatique, ajoutant un énième élément à la liste des nombreux déplacements de l''Atlas ces derniers temps. - Vulcain (saison de Roahx) s''annonce assez violent, les premières éruptions laissant présager une coulée de lave importante et très rapide. Mais n''ayez crainte, tous les territoires à proximité prennent les dispositions nécessaires - ******𝐈𝐜𝐞𝐭𝐨𝐨𝐧****** : - Le Ford-Odin Nord organise un tournoi de combat à but divertissant. Bien qu''il ne s''agisse pas d''un championnat, nombre de candidats semblent excités de montrer leurs capacités. - ******𝐈𝐭𝐡𝐢𝐬****** : - C''est la pleine lune en Ithis. Il est vivement recommandé d''éviter la forêt de Vianum pour les non habitués, sous réserve d''apparaître sous forme de délicieux steak a la table d''un louveteau qui ne se contrôle pas. - ****### 🔎 𝐄𝐍𝐐𝐔𝐄̂𝐓𝐄𝐒**** : - Rasmus, le second du Jarl Gunnar de Ford Odin-Est, a récemment entamé des excursions de pillage visant principalement Al-Far. Bien que n''étant pour le moment que de simples expéditions de pillage très souvent repoussées, il semblerait que le Jarl vise un autre mystérieux objectif à en juger par le déploiement continu de ses troupes. • Disparition de navires de Kaos. Depuis quelques mois plusieurs navires de commerce disparaissent en mer sans laisser de trace. Les autorités de Kaos ont décidé de réagir conjointement et d''envoyer des patrouilles fréquentes en mer pour découvrir ce qui se passe mais jusque là, chou blanc. • En rapport au point précédent, Al-Far a envoyé plusieurs navires patrouiller également sur les routes commerciales de Kaos. L''île semble directement impliquée dans cette affaire. • Apparition d''une étrange silhouette dans les mers gelées d''Icetoon du côté Ouest. Les témoins disent qu''elle était draconique. Le Jarl a aussitôt interdit l''accès à cette zone comme s''il souhaitait éviter qu''on en sache plus. • La cité maudite fait des vagues : une personne en est ressortie ! Tout du moins d''après les propos de nombres de témoins, et les descriptions semblent concorder : un gamin à la chevelure blanche et au visage pâle. Nul ne sait cependant où il est passé, ni ce qu''il est devenu. • Un événement inédit vient de se produire à Baraen entre Rezopia, la cité maudite et Faubourg : une cité composée d''un ensemble de pyramides vient d''émerger du sable ! Elle est immense et pour le moment personne n''ose s''en approcher. Elle dégage à la fois une aura majestueuse et sinistre... ______________________________________ Et voilà c''est tout pour aujourd''hui, nous vous disons à bientôt pour de nouvelles informations !! ## [ 𝐏𝐑𝐄𝐌𝐈𝐄𝐑𝐄 𝐄𝐃𝐈𝐓𝐈𝐎𝐍 𝐃𝐔 𝐉𝐎𝐔𝐑𝐍𝐀𝐋 "𝐋𝐄𝐒 𝐌𝐔𝐑𝐌𝐔𝐑𝐄𝐒" ] Bonjour à tous et à toutes ! Un petit moment s''est déjà écoulé depuis les dernières nouvelles, alors sans plus tarder, voici les dernières murmu– Ah. Ahem. Pardonnez, force de l''habitude. Non plus les murmures, notez, mais bel et bien le tout nouveau Journal de Fallen ! Et rassurez vous, vous ne regretterez pas les mortes murmures, bien au conttaire : des ragots les plus croustillants aux rumeurs les plus intriguantes, rien n''échappera à nos plumes les plus aiguisées. Et par soucis d''organisation, cette édition naissante sera subdivisée en deux sections : - ******La section "Faits divers"****** : potins, racontards, nouvelles diverses et variées... Tout ce qui fait jaser sur la place du marché ou dans les arrières cours se trouvera ici - ******La section "Enquêtes"****** : mystérieux évènements, étranges disparitions, déroulements incompréhensibles... Tout ce qui nécessite une inquisition, au jugé de notre bon personnel, sera rassemblé ici. Suivre les fils des divers mystères peuvent bien souvent conduire à moults quêtes ou trames à importances variables. ________________________________________ - ****### 🗒️ 𝗙𝗔𝗜𝗧𝗦 𝗗𝗜𝗩𝗘𝗥𝗦**** : - ******𝐊𝐚𝐨𝐬****** : - Une joyeuse nouvelle ici, une grande fête est organisée par les Silvester, nobles de Kaos, pour fêter la retrouvaille de leur enfant disparu. Ripaille et boissons à volonté ! - ******𝐁𝐚𝐫𝐚𝐞𝐧****** : - La princesse de Faubourg, son altesse Rina Dyëqnar et Valden Marchal, Sénateur & fils du Grand Consul de Mornia ont récemment célébré leur union maritale au cours du cérémonie grandiose. Longue vie au noble couple ! - ******𝐑𝐨𝐚𝐡𝐱****** : - Azuris Van Blue, membre du conseil Triasmus se rend à Miroslava en compagnie de Nash Van Blue, actuel Maître de la guilde Qilin... Des rumeurs disent qu''un grand coup se prépare. - Nash Atlas, autre membre du conseil de Triasmus, et Salomon Daughtry le dirigeant de Mirea sont en visite à Maboule pour raison diplomatique, ajoutant un énième élément à la liste des nombreux déplacements de l''Atlas ces derniers temps. - Vulcain (saison de Roahx) s''annonce assez violent, les premières éruptions laissant présager une coulée de lave importante et très rapide. Mais n''ayez crainte, tous les territoires à proximité prennent les dispositions nécessaires - ******𝐈𝐜𝐞𝐭𝐨𝐨𝐧****** : - Le Ford-Odin Nord organise un tournoi de combat à but divertissant. Bien qu''il ne s''agisse pas d''un championnat, nombre de candidats semblent excités de montrer leurs capacités. - ******𝐈𝐭𝐡𝐢𝐬****** : - C''est la pleine lune en Ithis. Il est vivement recommandé d''éviter la forêt de Vianum pour les non habitués, sous réserve d''apparaître sous forme de délicieux steak a la table d''un louveteau qui ne se contrôle pas. - ****### 🔎 𝐄𝐍𝐐𝐔𝐄̂𝐓𝐄𝐒**** : - Rasmus, le second du Jarl Gunnar de Ford Odin-Est, a récemment entamé des excursions de pillage visant principalement Al-Far. Bien que n''étant pour le moment que de simples expéditions de pillage très souvent repoussées, il semblerait que le Jarl vise un autre mystérieux objectif à en juger par le déploiement continu de ses troupes. • Disparition de navires de Kaos. Depuis quelques mois plusieurs navires de commerce disparaissent en mer sans laisser de trace. Les autorités de Kaos ont décidé de réagir conjointement et d''envoyer des patrouilles fréquentes en mer pour découvrir ce qui se passe mais jusque là, chou blanc. • En rapport au point précédent, Al-Far a envoyé plusieurs navires patrouiller également sur les routes commerciales de Kaos. L''île semble directement impliquée dans cette affaire. • Apparition d''une étrange silhouette dans les mers gelées d''Icetoon du côté Ouest. Les témoins disent qu''elle était draconique. Le Jarl a aussitôt interdit l''accès à cette zone comme s''il souhaitait éviter qu''on en sache plus. • La cité maudite fait des vagues : une personne en est ressortie ! Tout du moins d''après les propos de nombres de témoins, et les descriptions semblent concorder : un gamin à la chevelure blanche et au visage pâle. Nul ne sait cependant où il est passé, ni ce qu''il est devenu. • Un événement inédit vient de se produire à Baraen entre Rezopia, la cité maudite et Faubourg : une cité composée d''un ensemble de pyramides vient d''émerger du sable ! Elle est immense et pour le moment personne n''ose s''en approcher. Elle dégage à la fois une aura majestueuse et sinistre... ______________________________________ Et voilà c''est tout pour aujourd''hui, nous vous disons à bientôt pour de nouvelles informations !!'
),
(
    'f0000000-0000-0000-0000-000000000137',
    'f0000000-0000-0000-0000-000000000001',
    'Événement : La Vengeance des Bannis',
    ARRAY['vengeance des bannis', 'evenement', 'bannis', 'vengeance', 'simulation', 'test'],
    'La Vengeance des Bannis était un test de simulation de l''académie de Fallen pour tester la nouvelle génération de combattants et de héros.'
),
(
    'f0000000-0000-0000-0000-000000000138',
    'f0000000-0000-0000-0000-000000000001',
    'Événement : Une Expédition de Tous les Dangers',
    ARRAY['expedition', 'mozarak', 'eleanor', 'oeil de minuit', 'echec', 'artefact', 'mission'],
    'Une expédition de tous les dangers : expédition sur Mozarak visant à sauver Eleanor et récupérer l''Œil de Minuit, un artefact très puissant. L''expédition s''est soldée par un échec total.'
),
(
    'f0000000-0000-0000-0000-000000000139',
    'f0000000-0000-0000-0000-000000000001',
    'Héros Clés de l''Arc 1',
    ARRAY['aslan van blue', 'reisha atlas', 'exodus nemesis', 'vayne verderkay', 'ichigo kurosaki', 'amy', 'reine fee', 'akeno frims', 'andres follonosa', 'heros', 'arc 1', 'grande guerre'],
    'Les héros légendaires de la Grande Guerre (Arc 1) comprennent Aslan Van Blue (le plus grand mage), Reisha Atlas (légende des honneurs), Exodus Némésis (maître des arts occultes), Vayne Verderkayne et Ichigo Kurosaki (le duo des ténèbres), Lighttwirls Amy (reine fée et mère de Zëphyr), Akeno D. Frims (sorcier intrépide) et Andres de Follonosa (mancien excentrique).'
)

ON CONFLICT (entry_id) DO UPDATE SET
    universe_id = EXCLUDED.universe_id,
    title = EXCLUDED.title,
    keywords = EXCLUDED.keywords,
    content = EXCLUDED.content;

-- ============================================================
-- SEED: ENTITIES FOR FALLEN
-- Sequential UUIDs: f0000000-0000-0000-0000-0000000002xx
-- ============================================================

-- ---- LOCATION ENTITIES ----
INSERT INTO yinyang.entities (entity_id, universe_id, entity_type, name, properties, current_location_id)
VALUES
(
    'f0000000-0000-0000-0000-000000000200',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Noah',
    '{"description": "Le continent vert — composé à 80% de forêts anciennes, domaine de la faction Esprit sous la protection d''Avall''arh et de la déesse Élisa.", "climate": "forêt tempérée", "faction": "Esprit"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000201',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Baraen',
    '{"description": "Le continent des exilés — un vaste désert de sable, terre des nomades Astre vouant un culte à Zëphyr. Lieu d''apparition récent d''une mystérieuse cité de pyramides.", "climate": "désert aride", "faction": "Astre"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000202',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Icetoon',
    '{"description": "Le continent de glace — terre des Vikings, région de glaciers, toundra et tempêtes de neige. Organise actuellement un grand tournoi de combat.", "climate": "arctique", "faction": "Viking"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000203',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Atlantica',
    '{"description": "Le continent ancien — berceau d''une civilisation avancée, d''érudition et de pouvoir. Siège de la prestigieuse guilde Pegasus.", "climate": "tempéré", "faction": "mixte"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000204',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Roahx',
    '{"description": "Le continent sauvage — territoire de forêts verdoyantes et de terres arides de lave près du Volcan Ardent, peuplé de mercenaires et de hors-la-loi.", "climate": "varié", "faction": "Hors-la-loi"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000205',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Kaos',
    '{"description": "Le continent des braves — terre de culture martiale et d''honneur guerrier, patrie des guerriers de l''Honneur et d''Arthur Thirsk.", "climate": "tempéré", "faction": "Honneur"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000206',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Ithis',
    '{"description": "Le continent maudit — dominé par la terrifiante forêt de Vianum. Les lycanthropes et créatures de la lune y rôdent librement pendant la pleine lune.", "climate": "forêt sombre", "faction": "aucune"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000207',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Les Forteresses des Sorciers',
    '{"description": "Cinq puissantes forteresses dédiées à l''étude des arcanes interdits et de la magie occulte de Malakath.", "climate": "varié", "faction": "Occulte"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000208',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Cornum',
    '{"description": "Le continent noir — terre corrompue et chaotique, considérée comme le point de départ des plus grandes catastrophes de l''histoire de Fallen.", "climate": "dévasté", "faction": "aucune"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000209',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Céleste',
    '{"description": "Le paradis des cieux — royaume divin au-dessus des nuages célestes, patrie des anges et domaine de Zeita, déesse de la justice.", "climate": "céleste", "faction": "Ange"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000210',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Mundus',
    '{"description": "L''enfer souterrain — royaume obscur sous les profondeurs de Fallen dirigé par la déesse de la corruption Nergal, d''où proviennent les démons.", "climate": "infernal", "faction": "Démon"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000211',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Eudenia',
    '{"description": "La terre des dieux — territoire divin jadis scellé par le demi-dieu Lucas Saviore. Ses portes s''ouvriront à nouveau selon la prophétie.", "climate": "divin", "faction": "aucune"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000212',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Havre de Paix',
    '{"description": "Ville souveraine et port d''attache de la guilde Sight of Hope, symbole de justice et de coexistence pacifique.", "climate": "tempéré", "faction": "mixte"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000213',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Rezopia',
    '{"description": "Cité située dans le désert de Baraen, à proximité de la mystérieuse cité de pyramides ayant récemment émergé.", "climate": "désert aride", "faction": "Astre"}'::jsonb,
    'f0000000-0000-0000-0000-000000000201'
),
(
    'f0000000-0000-0000-0000-000000000214',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Ford-Odin Nord',
    '{"description": "Région majeure d''Icetoon gouvernée par le Jarl Sten Ragnvald, accueillant le grand tournoi de combat.", "climate": "arctique", "faction": "Viking"}'::jsonb,
    'f0000000-0000-0000-0000-000000000202'
),
(
    'f0000000-0000-0000-0000-000000000215',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Ford-Odin Est',
    '{"description": "Région d''Icetoon sous l''autorité du Jarl Gunnar Drekarson. Les troupes y mènent des raids contre Al-Far.", "climate": "arctique", "faction": "Viking"}'::jsonb,
    'f0000000-0000-0000-0000-000000000202'
),
(
    'f0000000-0000-0000-0000-000000000216',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Al-Far',
    '{"description": "Cité gouvernée par Augusta Brown, subissant actuellement les assauts des pillards vikings menés par Rasmus.", "climate": "tempéré", "faction": "aucune"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000217',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Valguanide',
    '{"description": "Le domaine et bastion de la faction Honneur, protégé par le vaillant Caellan Atlas.", "climate": "tempéré", "faction": "Honneur"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000218',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Miroslava',
    '{"description": "Cité vers laquelle se dirigent actuellement Azuris Van Blue et Nash Van Blue pour un grand projet diplomatique ou secret.", "climate": "inconnu", "faction": "inconnue"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000219',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Rezvenia',
    '{"description": "L''empire majestueux dirigé par l''Empereur Drafhorz Lazuli Varn Emreis, patrie des puissants Elders.", "climate": "varié", "faction": "Elder"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000220',
    'f0000000-0000-0000-0000-000000000001',
    'LOCATION', 'Mozarak',
    '{"description": "Lieu de tous les dangers et théâtre de l''expédition manquée visant à sauver Miss Eleanor et trouver l''Œil de Minuit.", "climate": "dangereux", "faction": "inconnue"}'::jsonb,
    NULL
)

ON CONFLICT (entity_id) DO UPDATE SET
    universe_id = EXCLUDED.universe_id,
    entity_type = EXCLUDED.entity_type,
    name = EXCLUDED.name,
    properties = EXCLUDED.properties,
    current_location_id = EXCLUDED.current_location_id;

-- ---- FACTION ENTITIES ----
INSERT INTO yinyang.entities (entity_id, universe_id, entity_type, name, properties, current_location_id)
VALUES
(
    'f0000000-0000-0000-0000-000000000221',
    'f0000000-0000-0000-0000-000000000001',
    'FACTION', 'Sainteté',
    '{"description": "Mages saints maîtrisant la magie blanche sous la bénédiction d''Ézéchiel, dieu de la pureté.", "patron_deity": "Ézéchiel", "alignment": "saint"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000222',
    'f0000000-0000-0000-0000-000000000001',
    'FACTION', 'Occulte',
    '{"description": "Sorciers et alchimistes pratiquant les magies interdites et obscures dans les cinq forteresses dédiées à Malakath.", "patron_deity": "Malakath", "alignment": "sombre"}'::jsonb,
    'f0000000-0000-0000-0000-000000000207'
),
(
    'f0000000-0000-0000-0000-000000000223',
    'f0000000-0000-0000-0000-000000000001',
    'FACTION', 'Honneur',
    '{"description": "Chevaliers et guerriers dévoués à la bravoure et à la discipline, inspirés par Drahen et Vanyr.", "patron_deity": "Drahen / Vanyr", "alignment": "loyal"}'::jsonb,
    'f0000000-0000-0000-0000-000000000205'
),
(
    'f0000000-0000-0000-0000-000000000224',
    'f0000000-0000-0000-0000-000000000001',
    'FACTION', 'Ange',
    '{"description": "Anges de Céleste, émissaires divins de la justice et exécuteurs des lois célestes de la déesse Zeita.", "patron_deity": "Zeita", "alignment": "divin"}'::jsonb,
    'f0000000-0000-0000-0000-000000000209'
),
(
    'f0000000-0000-0000-0000-000000000225',
    'f0000000-0000-0000-0000-000000000001',
    'FACTION', 'Sang-pur',
    '{"description": "Vampires de sang pur, lignée ancienne et noble régnant sous l''autorité du roi vampire Vladislaus Nocturnus.", "alignment": "sombre noble"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000226',
    'f0000000-0000-0000-0000-000000000001',
    'FACTION', 'Esprit',
    '{"description": "Esprits sylvestres et elfes vivant en harmonie avec la nature sur le continent de Noah, sous l''aile d''Élisa.", "patron_deity": "Élisa", "alignment": "naturel"}'::jsonb,
    'f0000000-0000-0000-0000-000000000200'
),
(
    'f0000000-0000-0000-0000-000000000227',
    'f0000000-0000-0000-0000-000000000001',
    'FACTION', 'Astre',
    '{"description": "Nomades du désert de Baraen vouant un culte au dieu Zëphyr, experts en survie et en adaptation.", "patron_deity": "Zëphyr", "alignment": "neutre"}'::jsonb,
    'f0000000-0000-0000-0000-000000000201'
),
(
    'f0000000-0000-0000-0000-000000000228',
    'f0000000-0000-0000-0000-000000000001',
    'FACTION', 'Viking',
    '{"description": "Guerriers farouches du continent d''Icetoon, habitués aux pillages et vouant un culte à la bravoure et au combat.", "alignment": "chaotique guerrier"}'::jsonb,
    'f0000000-0000-0000-0000-000000000202'
),
(
    'f0000000-0000-0000-0000-000000000229',
    'f0000000-0000-0000-0000-000000000001',
    'FACTION', 'Démon',
    '{"description": "Créatures démoniaques issues de Mundus, propageant le venin et la corruption de la déesse Nergal.", "patron_deity": "Nergal", "alignment": "maléfique"}'::jsonb,
    'f0000000-0000-0000-0000-000000000210'
),
(
    'f0000000-0000-0000-0000-000000000230',
    'f0000000-0000-0000-0000-000000000001',
    'FACTION', 'Elder',
    '{"description": "Êtres ancestraux dotés d''une longévité et d''une puissance colossale, représentés par la famille Varn Emreis de Rezvenia.", "alignment": "ancien neutre"}'::jsonb,
    'f0000000-0000-0000-0000-000000000219'
),
(
    'f0000000-0000-0000-0000-000000000231',
    'f0000000-0000-0000-0000-000000000001',
    'FACTION', 'Hybride',
    '{"description": "Êtres de sang mêlé combinant les traits de plusieurs factions, dont le plus illustre est Kaars Agius.", "alignment": "variable"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000232',
    'f0000000-0000-0000-0000-000000000001',
    'FACTION', 'Hors-la-loi',
    '{"description": "Individus vivant en marge du système des factions et des royaumes, particulièrement bénis par Conrak à Roahx.", "patron_deity": "Conrak", "alignment": "chaotique libre"}'::jsonb,
    'f0000000-0000-0000-0000-000000000204'
)

ON CONFLICT (entity_id) DO UPDATE SET
    universe_id = EXCLUDED.universe_id,
    entity_type = EXCLUDED.entity_type,
    name = EXCLUDED.name,
    properties = EXCLUDED.properties,
    current_location_id = EXCLUDED.current_location_id;

-- ---- NPC ENTITIES: THE 15 GRANDES PUISSANCES ----
INSERT INTO yinyang.entities (entity_id, universe_id, entity_type, name, properties, current_location_id)
VALUES
(
    'f0000000-0000-0000-0000-000000000233',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Drafhorz Lazuli Varn Emreis',
    '{"description": "L''actuel Empereur de Rezvenia. Le plus puissant individu de Fallen, dont les millénaires d''expérience le placent au sommet des Grandes Puissances.", "faction": "Elder", "rank": 1, "title": "Empereur de Rezvenia"}'::jsonb,
    'f0000000-0000-0000-0000-000000000219'
),
(
    'f0000000-0000-0000-0000-000000000234',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Kaars Agius',
    '{"description": "L''homme qui a éliminé Thars, une menace de rang Fléau. Second personnage le plus puissant de Fallen.", "faction": "Hybride", "rank": 2, "title": "Vainqueur de Thars"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000235',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Avall'arh',
    '{"description": "Le Gardien Suprême de Noah. Un esprit sylvestre d''une force incommensurable incarnant la volonté d''Élisa.", "faction": "Esprit", "rank": 3, "title": "Gardien Suprême de Noah"}'::jsonb,
    'f0000000-0000-0000-0000-000000000200'
),
(
    'f0000000-0000-0000-0000-000000000236',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Gabriella',
    '{"description": "Surnommée l''arme ultime de Céleste, elle est la seule ange capable d''utiliser les trésors divins célestes.", "faction": "Ange", "rank": 4, "title": "Arme Ultime de Céleste"}'::jsonb,
    'f0000000-0000-0000-0000-000000000209'
),
(
    'f0000000-0000-0000-0000-000000000237',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Cécilia Varn Emreis',
    '{"description": "Princesse de Rezvenia, fille de l''Empereur Drafhorz et détentrice d''un pouvoir colossal.", "faction": "Elder", "rank": 5, "title": "Princesse de Rezvenia"}'::jsonb,
    'f0000000-0000-0000-0000-000000000219'
),
(
    'f0000000-0000-0000-0000-000000000238',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Caellan Atlas',
    '{"description": "Le Protecteur de Valguanide, fier guerrier de la faction Honneur et descendant de la légendaire Reisha Atlas.", "faction": "Honneur", "rank": 6, "title": "Protecteur de Valguanide"}'::jsonb,
    'f0000000-0000-0000-0000-000000000217'
),
(
    'f0000000-0000-0000-0000-000000000239',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Riffen Carsarius',
    '{"description": "Maître des Dix Cercles de Sacror, mage de la Sainteté doté d''une maîtrise magique sacrée absolue.", "faction": "Sainteté", "rank": 7, "title": "Maître des Dix Cercles de Sacror"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000240',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Altheor Mornveil',
    '{"description": "Maître de Forkroy, sorcier de premier rang de la faction Occulte maîtrisant la magie maudite de Malakath.", "faction": "Occulte", "rank": 8, "title": "Maître de Forkroy"}'::jsonb,
    'f0000000-0000-0000-0000-000000000207'
),
(
    'f0000000-0000-0000-0000-000000000241',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Yrvaeh Cload',
    '{"description": "Maître de la plus puissante guilde de Baraen, nomade astre d''une agilité et d''une force de premier plan.", "faction": "Astre", "rank": 9, "title": "Maître de la plus puissante Guilde de Baraen"}'::jsonb,
    'f0000000-0000-0000-0000-000000000201'
),
(
    'f0000000-0000-0000-0000-000000000242',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Vladislaus Nocturnus',
    '{"description": "Le roi vampire de la faction Sang-pur, régnant depuis des siècles avec une puissance obscure terrifiante.", "faction": "Sang-pur", "rank": 10, "title": "Le Roi Vampire"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000243',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Azrael Kaun',
    '{"description": "Un Roder (démon de rang supérieur) apparaissant uniquement dans les moments les plus graves à Mundus.", "faction": "Démon", "rank": 11, "title": "Roder de Mundus"}'::jsonb,
    'f0000000-0000-0000-0000-000000000210'
),
(
    'f0000000-0000-0000-0000-000000000244',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Sten Ragnvald',
    '{"description": "Jarl de Ford-Odin Nord, le plus fort des guerriers vikings d''Icetoon, hôte du grand tournoi.", "faction": "Viking", "rank": 12, "title": "Jarl de Ford-Odin Nord"}'::jsonb,
    'f0000000-0000-0000-0000-000000000214'
),
(
    'f0000000-0000-0000-0000-000000000245',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Augusta Brown',
    '{"description": "Seigneur d’Al-Far, dirigeant indépendant n''appartenant à aucune faction et défendant sa cité des raids vikings.", "faction": "Sans-faction", "rank": 13, "title": "Seigneur d’Al-Far"}'::jsonb,
    'f0000000-0000-0000-0000-000000000216'
),
(
    'f0000000-0000-0000-0000-000000000246',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Sandler Void',
    '{"description": "Sans doute l''aventurier le plus célèbre et le plus puissant de Fallen actuellement, hors-la-loi solitaire.", "faction": "Hors la loi", "rank": 14, "title": "Aventurier Légendaire"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000247',
    'f0000000-0000-0000-0000-000000000001',
    'NPC', 'Arthur Thirsk',
    '{"description": "Maître de la plus puissante guilde de Kaos, fier et noble guerrier représentant de sa faction.", "faction": "Honneur", "rank": 15, "title": "Maître de la plus puissante Guilde de Kaos"}'::jsonb,
    'f0000000-0000-0000-0000-000000000205'
)

ON CONFLICT (entity_id) DO UPDATE SET
    universe_id = EXCLUDED.universe_id,
    entity_type = EXCLUDED.entity_type,
    name = EXCLUDED.name,
    properties = EXCLUDED.properties,
    current_location_id = EXCLUDED.current_location_id;

-- ---- GUILD ENTITIES ----
INSERT INTO yinyang.entities (entity_id, universe_id, entity_type, name, properties, current_location_id)
VALUES
(
    'f0000000-0000-0000-0000-000000000248',
    'f0000000-0000-0000-0000-000000000001',
    'GUILD', 'Pegasus',
    '{"description": "La plus grande et la plus influente guilde d''Atlantica. Guilde légale ambassadrice en charge de la défense.", "master": "Michael Black", "members": 100, "treasury": "25 billion+", "status": "légale", "type": "ambassadrice"}'::jsonb,
    'f0000000-0000-0000-0000-000000000203'
),
(
    'f0000000-0000-0000-0000-000000000249',
    'f0000000-0000-0000-0000-000000000001',
    'GUILD', 'Sight of Hope',
    '{"description": "Guilde légale ambassadrice dévouée à la justice et la paix durable, veillant sur Havre de Paix.", "master": "Hinerza Van Blue", "status": "légale", "type": "ambassadrice", "mission": "justice"}'::jsonb,
    'f0000000-0000-0000-0000-000000000212'
),
(
    'f0000000-0000-0000-0000-000000000250',
    'f0000000-0000-0000-0000-000000000001',
    'GUILD', 'Noches',
    '{"description": "Guilde clandestine et sombre agissant dans le secret. Illégale mais extrêmement influente.", "status": "clandestine", "type": "secrète", "alignment": "sombre"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000251',
    'f0000000-0000-0000-0000-000000000001',
    'GUILD', 'Dragon Noir',
    '{"description": "Organisation de mercenaires qui s''est illustrée lors de l''Arc 2, semant le chaos et le désordre.", "status": "clandestine", "type": "mercenaires", "arc_of_prominence": "Arc 2", "alignment": "chaotique"}'::jsonb,
    NULL
)

ON CONFLICT (entity_id) DO UPDATE SET
    universe_id = EXCLUDED.universe_id,
    entity_type = EXCLUDED.entity_type,
    name = EXCLUDED.name,
    properties = EXCLUDED.properties,
    current_location_id = EXCLUDED.current_location_id;

-- ---- DEITY ENTITIES ----
INSERT INTO yinyang.entities (entity_id, universe_id, entity_type, name, properties, current_location_id)
VALUES
(
    'f0000000-0000-0000-0000-000000000252',
    'f0000000-0000-0000-0000-000000000001',
    'DEITY', 'Conrak',
    '{"description": "Chef du Panthéon céleste, dieu de la fortune, de la prospérité et de la chance. Vénéré à Roahx.", "domains": ["fortune", "chance", "prospérité"], "worshippers": "Hors-la-loi, Roahx", "pantheon_rank": "chef"}'::jsonb,
    'f0000000-0000-0000-0000-000000000204'
),
(
    'f0000000-0000-0000-0000-000000000253',
    'f0000000-0000-0000-0000-000000000001',
    'DEITY', 'Malakath',
    '{"description": "Dieu des arcanes obscures, des bannis et des malédictions. Adoré dans les cinq forteresses de la faction occulte.", "domains": ["malédictions", "sorcellerie", "fourberie"], "worshippers": "Occulte"}'::jsonb,
    'f0000000-0000-0000-0000-000000000207'
),
(
    'f0000000-0000-0000-0000-000000000254',
    'f0000000-0000-0000-0000-000000000001',
    'DEITY', 'Anubis',
    '{"description": "Dieu des morts et gardien des âmes dans les royaumes souterrains, juge impartial de la pesée sacrée.", "domains": ["mort", "âmes", "jugement"], "alignment": "impartial"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000255',
    'f0000000-0000-0000-0000-000000000001',
    'DEITY', 'Ézéchiel',
    '{"description": "Dieu de gloire, de splendeur et de la pureté, créateur et maître absolu de la magie blanche.", "domains": ["gloire", "pureté", "magie blanche"], "worshippers": "Sainteté"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000256',
    'f0000000-0000-0000-0000-000000000001',
    'DEITY', 'Khālian',
    '{"description": "Déesse de la métamorphose et de la lune, maîtresse du changement physique et des lycanthropes en Ithis.", "domains": ["métamorphose", "lune", "changement"], "worshippers": "loups-garous, Ithis"}'::jsonb,
    'f0000000-0000-0000-0000-000000000206'
),
(
    'f0000000-0000-0000-0000-000000000257',
    'f0000000-0000-0000-0000-000000000001',
    'DEITY', 'Drahen',
    '{"description": "Dieu du courage et de la sagesse, incarnation de la noblesse divine et guide de la faction Honneur.", "domains": ["courage", "sagesse", "noblesse"], "worshippers": "Honneur"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000258',
    'f0000000-0000-0000-0000-000000000001',
    'DEITY', 'Nergal',
    '{"description": "Déesse de la corruption, du pouvoir absolu et de la malveillance démoniaque régnant sur Mundus.", "domains": ["corruption", "pouvoir", "démons"], "worshippers": "Démon"}'::jsonb,
    'f0000000-0000-0000-0000-000000000210'
),
(
    'f0000000-0000-0000-0000-000000000259',
    'f0000000-0000-0000-0000-000000000001',
    'DEITY', 'Zeita',
    '{"description": "Déesse de la raison, du jugement équitable et patronne des lois célestes adorée en Céleste.", "domains": ["raison", "jugement", "lois"], "worshippers": "Ange"}'::jsonb,
    'f0000000-0000-0000-0000-000000000209'
),
(
    'f0000000-0000-0000-0000-000000000260',
    'f0000000-0000-0000-0000-000000000001',
    'DEITY', 'Élisa',
    '{"description": "Déesse de la nature, protectrice de la faction Esprit et âme pure veillant sur Noah.", "domains": ["nature", "vie", "croissance"], "worshippers": "Esprit"}'::jsonb,
    'f0000000-0000-0000-0000-000000000200'
),
(
    'f0000000-0000-0000-0000-000000000261',
    'f0000000-0000-0000-0000-000000000001',
    'DEITY', 'Vanyr',
    '{"description": "Dieu de la volonté, du combat et du dépassement de ses propres limites physiques ou spirituelles.", "domains": ["volonté", "combat", "limites"], "worshippers": "Honneur guerriers"}'::jsonb,
    NULL
),
(
    'f0000000-0000-0000-0000-000000000262',
    'f0000000-0000-0000-0000-000000000001',
    'DEITY', 'Zëphyr',
    '{"description": "Dieu de la pensée, des arts et de l''adaptation, fils d''Amy et de Conrak, protecteur des nomades Astres.", "domains": ["pensée", "arts", "adaptation"], "worshippers": "Astre", "parentage": "fils de Conrak et d''Amy"}'::jsonb,
    'f0000000-0000-0000-0000-000000000201'
),
(
    'f0000000-0000-0000-0000-000000000263',
    'f0000000-0000-0000-0000-000000000001',
    'DEITY', 'Elsa',
    '{"description": "Déesse des mers et des océans, maîtresse capricieuse et redoutée des marins et des sirènes.", "domains": ["mer", "océan", "tempêtes"], "worshippers": "pirates, marins, sirènes"}'::jsonb,
    NULL
)

ON CONFLICT (entity_id) DO UPDATE SET
    universe_id = EXCLUDED.universe_id,
    entity_type = EXCLUDED.entity_type,
    name = EXCLUDED.name,
    properties = EXCLUDED.properties,
    current_location_id = EXCLUDED.current_location_id;

-- Move seeded NPCs and Deities to the non_player_characters table
INSERT INTO yinyang.non_player_characters (npc_id, universe_id, name, npc_type, faction, stats, properties, image_url, current_location_id, is_alive)
SELECT 
    entity_id, 
    universe_id, 
    name, 
    CASE 
        WHEN entity_type = 'DEITY' THEN 'DEITY'
        WHEN (properties->>'rank')::int IS NOT NULL THEN 'LEGENDARY'
        ELSE 'NPC'
    END as npc_type,
    properties->>'faction',
    CASE 
        WHEN entity_type = 'DEITY' THEN '{"Force": 18, "Vitesse": 18, "Endurance": 18, "Résistance": 18, "Réserve": 18, "Puissance": 18, "Mental": 18, "Réactivité": 18, "Charisme": 18, "Intelligence": 18}'::jsonb
        WHEN (properties->>'rank')::int <= 5 THEN '{"Force": 15, "Vitesse": 15, "Endurance": 15, "Résistance": 15, "Réserve": 15, "Puissance": 15, "Mental": 15, "Réactivité": 15, "Charisme": 15, "Intelligence": 15}'::jsonb
        WHEN (properties->>'rank')::int <= 15 THEN '{"Force": 11, "Vitesse": 11, "Endurance": 11, "Résistance": 11, "Réserve": 11, "Puissance": 11, "Mental": 11, "Réactivité": 11, "Charisme": 11, "Intelligence": 11}'::jsonb
        ELSE '{"Force": 6, "Vitesse": 6, "Endurance": 6, "Résistance": 6, "Réserve": 6, "Puissance": 6, "Mental": 6, "Réactivité": 6, "Charisme": 6, "Intelligence": 6}'::jsonb
    END as stats,
    properties,
    '/assets/images/portraits/' || LOWER(REPLACE(name, ' ', '_')) || '.png',
    current_location_id,
    is_alive
FROM yinyang.entities
WHERE entity_type IN ('NPC', 'DEITY')
ON CONFLICT (universe_id, name) DO UPDATE SET
    npc_type = EXCLUDED.npc_type,
    faction = EXCLUDED.faction,
    stats = EXCLUDED.stats,
    properties = EXCLUDED.properties,
    image_url = EXCLUDED.image_url,
    current_location_id = EXCLUDED.current_location_id,
    is_alive = EXCLUDED.is_alive;

-- ============================================================
-- CHARACTER COMBAT STATE (volatile, per-session tracking)
-- ============================================================

-- Tracks the player's live combat resources within a session.
-- Rows are ephemeral: they are created on first combat action and
-- cascade-deleted when the parent session is removed.
CREATE TABLE IF NOT EXISTS yinyang.character_combat_state (
    state_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES yinyang.sessions(session_id) ON DELETE CASCADE,
    char_id UUID NOT NULL REFERENCES yinyang.player_characters(char_id) ON DELETE CASCADE,
    current_vitality INTEGER NOT NULL DEFAULT 10,
    current_endurance NUMERIC(5,2) NOT NULL DEFAULT 10,
    current_reserve NUMERIC(5,2) NOT NULL DEFAULT 10,
    active_buffs JSONB NOT NULL DEFAULT '[]'::jsonb,
    active_debuffs JSONB NOT NULL DEFAULT '[]'::jsonb,
    status_effects TEXT[] DEFAULT '{}',
    turn_counter INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_session_char UNIQUE(session_id, char_id)
);
CREATE INDEX IF NOT EXISTS idx_combat_state_session_char ON yinyang.character_combat_state(session_id, char_id);

-- Grant permissions matching the existing pattern
GRANT ALL PRIVILEGES ON yinyang.character_combat_state TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON yinyang.character_combat_state TO anon, authenticated;
