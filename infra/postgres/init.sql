-- USERS
CREATE TABLE IF NOT EXISTS users (
	id SERIAL PRIMARY KEY,
	email VARCHAR(255) NOT NULL UNIQUE,
	username VARCHAR(100) NOT NULL UNIQUE,
	password_hash VARCHAR(255) NOT NULL,
	-- profile fields
	avatar_id INT DEFAULT 0,
	country VARCHAR(100),
	level INT DEFAULT 1,
	xp INT DEFAULT 0,
	next_level_xp INT DEFAULT 100,
	play_time_seconds INT DEFAULT 0,
	wins INT DEFAULT 0,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OAUTH ACCOUNTS
CREATE TABLE IF NOT EXISTS oauth_accounts (
	id SERIAL PRIMARY KEY,
	user_id INT NOT NULL,
	provider VARCHAR(50) NOT NULL,
	provider_user_id VARCHAR(255) NOT NULL,
	provider_data JSONB,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT fk_oauth_user
		FOREIGN KEY (user_id) REFERENCES users(id)
		ON DELETE CASCADE,

	CONSTRAINT unique_provider_user UNIQUE (provider, provider_user_id)
);

-- FRIENDS
CREATE TYPE friend_status AS ENUM('pending', 'accepted', 'blocked');

CREATE TABLE IF NOT EXISTS friends (
	id SERIAL PRIMARY KEY,
	user_id INT NOT NULL,
	friend_id INT NOT NULL,
	status friend_status DEFAULT 'pending',
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT fk_friends_user
		FOREIGN KEY (user_id) REFERENCES users(id)
		ON DELETE CASCADE,

	CONSTRAINT fk_friends_friend
		FOREIGN KEY (friend_id) REFERENCES users(id)
		ON DELETE CASCADE,

	CONSTRAINT unique_friendship UNIQUE (user_id, friend_id)
);

-- MATCHES
CREATE TYPE match_status AS ENUM('active', 'finished');
CREATE TYPE gamemode AS ENUM('quickPlay', 'tetraLeague', 'fortyLines', 'blitz', 'zen', 'customGame');

CREATE TABLE IF NOT EXISTS matches (
	id SERIAL PRIMARY KEY,
	status match_status DEFAULT 'active',
	gamemode gamemode DEFAULT 'quickPlay',
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MATCH_PLAYERS
CREATE TYPE player_result AS ENUM('win', 'lose', 'draw');

CREATE TABLE IF NOT EXISTS match_players (
	id SERIAL PRIMARY KEY,
	match_id INT NOT NULL,
	user_id INT NOT NULL,
	score INT DEFAULT 0,
	result player_result DEFAULT NULL,

	CONSTRAINT fk_match_players_match
		FOREIGN KEY (match_id) REFERENCES matches(id)
		ON DELETE CASCADE,

	CONSTRAINT fk_match_players_user
		FOREIGN KEY (user_id) REFERENCES users(id)
		ON DELETE CASCADE
);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
	id SERIAL PRIMARY KEY,
	sender_id INT NOT NULL,
	receiver_id INT NOT NULL,
	content TEXT NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT fk_messages_sender
		FOREIGN KEY (sender_id) REFERENCES users(id)
		ON DELETE CASCADE,

	CONSTRAINT fk_messages_receiver
		FOREIGN KEY (receiver_id) REFERENCES users(id)
		ON DELETE CASCADE
);

-- STARTUP SEED DATA
-- Shared test password for all accounts below: Password123!
BEGIN;

TRUNCATE TABLE
	messages,
	match_players,
	oauth_accounts,
	friends,
	matches,
	users
RESTART IDENTITY CASCADE;

-- 50 complete profiles. Countries repeat deliberately so country leaderboards
-- contain enough players to be useful during development.
WITH seed_users (seed_number, username, country) AS (
	VALUES
		(1, 'alice', 'France'),
		(2, 'bob', 'Brazil'),
		(3, 'carol', 'Japan'),
		(4, 'dave', 'Canada'),
		(5, 'eva', 'Germany'),
		(6, 'frank', 'Spain'),
		(7, 'gwen', 'Chile'),
		(8, 'hugo', 'Italy'),
		(9, 'ivy', 'Morocco'),
		(10, 'jules', 'Poland'),
		(11, 'kai', 'Germany'),
		(12, 'luna', 'France'),
		(13, 'milo', 'Brazil'),
		(14, 'nora', 'Japan'),
		(15, 'omar', 'Canada'),
		(16, 'pia', 'Spain'),
		(17, 'quinn', 'Chile'),
		(18, 'ravi', 'Italy'),
		(19, 'sara', 'Morocco'),
		(20, 'theo', 'Poland'),
		(21, 'uma', 'Germany'),
		(22, 'victor', 'France'),
		(23, 'willow', 'Brazil'),
		(24, 'xavier', 'Japan'),
		(25, 'yasmin', 'Canada'),
		(26, 'zane', 'Spain'),
		(27, 'nova_27', 'Chile'),
		(28, 'pixel_ace', 'Italy'),
		(29, 'blockstorm', 'Morocco'),
		(30, 'line_clearer', 'Poland'),
		(31, 'tetra_mage', 'Germany'),
		(32, 'fastdrop', 'France'),
		(33, 'spin_master', 'Brazil'),
		(34, 'combo_queen', 'Japan'),
		(35, 'stacksmith', 'Canada'),
		(36, 'ghost_piece', 'Spain'),
		(37, 'harddropper', 'Chile'),
		(38, 'zen_builder', 'Italy'),
		(39, 'blitz_runner', 'Morocco'),
		(40, 'league_pro', 'Poland'),
		(41, 'quickfox', 'Germany'),
		(42, 'matrix_42', 'France'),
		(43, 'cyan_stack', 'Brazil'),
		(44, 'violet_t', 'Japan'),
		(45, 'orange_l', 'Canada'),
		(46, 'green_z', 'Spain'),
		(47, 'red_s', 'Chile'),
		(48, 'blue_j', 'Italy'),
		(49, 'yellow_o', 'Morocco'),
		(50, 'final_boss', 'Poland')
)
INSERT INTO users (
	email,
	username,
	password_hash,
	avatar_id,
	country,
	level,
	xp,
	next_level_xp,
	play_time_seconds,
	wins,
	created_at
)
SELECT
	username || '@example.com',
	username,
	-- bcrypt, 10 salt rounds, Password123!
	'$2b$10$GMbTuXBbvNJ52n2gK3fjz.vnaZFUOrwg9qs89SbliIF/QUY86rkSm',
	((seed_number - 1) % 16) + 1,
	country,
	((seed_number * 7) % 40) + 1,
	(seed_number * 347) % 10000,
	(((seed_number * 7) % 40) + 2) * 500,
	seed_number * 1387,
	0,
	TIMESTAMP '2024-01-06 12:00:00' + ((seed_number - 1) * INTERVAL '9 days')
FROM seed_users
ORDER BY seed_number;

-- GitHub-only, 42-only and linked-to-both-provider account scenarios.
INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_data)
SELECT
	id,
	'github',
	'github_seed_' || id,
	jsonb_build_object(
		'seed', 'startup',
		'provider', 'github',
		'username', username,
		'externalId', 100000 + id
	)
FROM users
WHERE id <= 30;

INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_data)
SELECT
	id,
	'42',
	'42_seed_' || id,
	jsonb_build_object(
		'seed', 'startup',
		'provider', '42',
		'login', username,
		'campus', 'Berlin'
	)
FROM users
WHERE id BETWEEN 26 AND 45 OR id <= 5;

-- Alice has accepted, incoming/outgoing pending, and blocked relationships.
-- The second group gives other users realistic friend graphs as well.
INSERT INTO friends (user_id, friend_id, status, created_at)
SELECT
	1,
	friend_id,
	CASE
		WHEN friend_id <= 25 THEN 'accepted'::friend_status
		WHEN friend_id <= 38 THEN 'pending'::friend_status
		ELSE 'blocked'::friend_status
	END,
	TIMESTAMP '2025-02-01 09:00:00' + (friend_id * INTERVAL '3 hours')
FROM generate_series(2, 50) AS friend_id;

INSERT INTO friends (user_id, friend_id, status, created_at)
SELECT
	user_id,
	user_id + 24,
	CASE
		WHEN user_id % 5 = 0 THEN 'pending'::friend_status
		ELSE 'accepted'::friend_status
	END,
	TIMESTAMP '2025-03-01 10:00:00' + (user_id * INTERVAL '5 hours')
FROM generate_series(2, 25) AS user_id;

-- Three chronological messages for every accepted Alice conversation.
INSERT INTO messages (sender_id, receiver_id, content, created_at)
SELECT
	CASE WHEN message_number = 2 THEN friend_id ELSE 1 END,
	CASE WHEN message_number = 2 THEN 1 ELSE friend_id END,
	CASE message_number
		WHEN 1 THEN 'Hi! Want to play a quick match?'
		WHEN 2 THEN 'Sure, invite me when you are ready.'
		ELSE 'Good game! Let us play again later.'
	END,
	TIMESTAMP '2025-04-01 18:00:00'
		+ (friend_id * INTERVAL '1 day')
		+ (message_number * INTERVAL '7 minutes')
FROM generate_series(2, 25) AS friend_id
CROSS JOIN generate_series(1, 3) AS message_number;

-- Additional conversations between regular friends exercise conversation lists.
INSERT INTO messages (sender_id, receiver_id, content, created_at)
SELECT
	user_id,
	user_id + 24,
	'Seed conversation between friends ' || user_id || ' and ' || (user_id + 24),
	TIMESTAMP '2025-05-01 14:00:00' + (user_id * INTERVAL '2 hours')
FROM generate_series(2, 25) AS user_id
WHERE user_id % 5 <> 0;

-- 25 finished two-player matches for every mode. All 50 users participate
-- once per mode, producing full global, country and friends leaderboards.
WITH modes (gamemode, mode_number) AS (
	VALUES
		('quickPlay'::gamemode, 1),
		('tetraLeague'::gamemode, 2),
		('fortyLines'::gamemode, 3),
		('blitz'::gamemode, 4),
		('zen'::gamemode, 5),
		('customGame'::gamemode, 6)
)
INSERT INTO matches (status, gamemode, created_at)
SELECT
	'finished',
	gamemode,
	TIMESTAMP '2025-06-01 12:00:00'
		+ ((mode_number - 1) * INTERVAL '30 days')
		+ (pair_number * INTERVAL '6 hours')
FROM modes
CROSS JOIN generate_series(1, 25) AS pair_number
ORDER BY mode_number, pair_number;

INSERT INTO match_players (match_id, user_id, score, result)
SELECT
	match_id,
	pair_number,
	(mode_number * 10000) + (pair_number * 731),
	CASE
		WHEN pair_number % 7 = 0 THEN 'draw'::player_result
		WHEN pair_number % 2 = 0 THEN 'win'::player_result
		ELSE 'lose'::player_result
	END
FROM (
	SELECT
		id AS match_id,
		((id - 1) / 25) + 1 AS mode_number,
		((id - 1) % 25) + 1 AS pair_number
	FROM matches
	WHERE status = 'finished'
) AS finished_matches;

INSERT INTO match_players (match_id, user_id, score, result)
SELECT
	match_id,
	51 - pair_number,
	(mode_number * 10000) + ((26 - pair_number) * 683),
	CASE
		WHEN pair_number % 7 = 0 THEN 'draw'::player_result
		WHEN pair_number % 2 = 0 THEN 'lose'::player_result
		ELSE 'win'::player_result
	END
FROM (
	SELECT
		id AS match_id,
		((id - 1) / 25) + 1 AS mode_number,
		((id - 1) % 25) + 1 AS pair_number
	FROM matches
	WHERE status = 'finished'
) AS finished_matches;

-- One currently active match per mode, with NULL results representing games
-- that have not ended yet.
WITH modes (gamemode, mode_number) AS (
	VALUES
		('quickPlay'::gamemode, 1),
		('tetraLeague'::gamemode, 2),
		('fortyLines'::gamemode, 3),
		('blitz'::gamemode, 4),
		('zen'::gamemode, 5),
		('customGame'::gamemode, 6)
)
INSERT INTO matches (status, gamemode, created_at)
SELECT
	'active',
	gamemode,
	TIMESTAMP '2026-06-15 15:00:00' + (mode_number * INTERVAL '10 minutes')
FROM modes
ORDER BY mode_number;

INSERT INTO match_players (match_id, user_id, score, result)
SELECT
	id,
	((id - 151) * 2) + 1,
	0,
	NULL
FROM matches
WHERE status = 'active';

INSERT INTO match_players (match_id, user_id, score, result)
SELECT
	id,
	((id - 151) * 2) + 2,
	0,
	NULL
FROM matches
WHERE status = 'active';

-- Keep denormalized profile wins consistent with the finished match history.
UPDATE users
SET wins = player_wins.total
FROM (
	SELECT user_id, COUNT(*)::INT AS total
	FROM match_players
	WHERE result = 'win'
	GROUP BY user_id
) AS player_wins
WHERE users.id = player_wins.user_id;

COMMIT;
