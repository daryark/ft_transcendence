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
CREATE TYPE gamemode AS ENUM('quickPlay', 'fortyLines', 'blitz', 'zen', 'customGame');

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
	metric_value DOUBLE PRECISION DEFAULT NULL,
	result player_result DEFAULT NULL,
	lines INT NOT NULL DEFAULT 0,
	pieces_placed INT NOT NULL DEFAULT 0,
	hard_drops INT NOT NULL DEFAULT 0,
	holds INT NOT NULL DEFAULT 0,
	max_combo INT NOT NULL DEFAULT 0,
	max_lines_cleared INT NOT NULL DEFAULT 0,
	cleared_two_at_once BOOLEAN NOT NULL DEFAULT FALSE,
	cleared_three_at_once BOOLEAN NOT NULL DEFAULT FALSE,
	tetrises INT NOT NULL DEFAULT 0,
	duration_ms INT NOT NULL DEFAULT 0,
	cleared_after_half_height BOOLEAN NOT NULL DEFAULT FALSE,

	CONSTRAINT fk_match_players_match
		FOREIGN KEY (match_id) REFERENCES matches(id)
		ON DELETE CASCADE,

	CONSTRAINT fk_match_players_user
		FOREIGN KEY (user_id) REFERENCES users(id)
		ON DELETE CASCADE
);

ALTER TABLE match_players
	ADD COLUMN IF NOT EXISTS metric_value DOUBLE PRECISION DEFAULT NULL;

-- ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS achievements (
	id INT PRIMARY KEY,
	code VARCHAR(80) NOT NULL UNIQUE,
	name VARCHAR(120) NOT NULL,
	description TEXT NOT NULL,
	rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('common', 'rare', 'epic')),
	target INT NOT NULL CHECK (target > 0)
);

CREATE TABLE IF NOT EXISTS user_achievements (
	id SERIAL PRIMARY KEY,
	user_id INT NOT NULL,
	achievement_id INT NOT NULL,
	unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

	CONSTRAINT fk_user_achievements_user
		FOREIGN KEY (user_id) REFERENCES users(id)
		ON DELETE CASCADE,

	CONSTRAINT fk_user_achievements_achievement
		FOREIGN KEY (achievement_id) REFERENCES achievements(id)
		ON DELETE CASCADE,

	CONSTRAINT unique_user_achievement UNIQUE (user_id, achievement_id)
);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
	id SERIAL PRIMARY KEY,
	sender_id INT NOT NULL,
	receiver_id INT NOT NULL,
	content TEXT NOT NULL,
	reply_to_id INT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	read_at TIMESTAMP NULL,

	CONSTRAINT fk_messages_sender
		FOREIGN KEY (sender_id) REFERENCES users(id)
		ON DELETE CASCADE,

	CONSTRAINT fk_messages_receiver
		FOREIGN KEY (receiver_id) REFERENCES users(id)
		ON DELETE CASCADE,

	CONSTRAINT fk_messages_reply
		FOREIGN KEY (reply_to_id) REFERENCES messages(id)
		ON DELETE SET NULL
);

ALTER TABLE messages
	ADD COLUMN IF NOT EXISTS reply_to_id INT NULL,
	ADD COLUMN IF NOT EXISTS read_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation
	ON messages(sender_id, receiver_id, id);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
	id SERIAL PRIMARY KEY,
	user_id INT NOT NULL,
	actor_id INT NULL,
	type VARCHAR(50) NOT NULL,
	title VARCHAR(120) NOT NULL,
	body TEXT NOT NULL,
	link VARCHAR(255) NULL,
	payload JSONB NULL,
	is_read BOOLEAN NOT NULL DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	read_at TIMESTAMP NULL,

	CONSTRAINT fk_notifications_user
		FOREIGN KEY (user_id) REFERENCES users(id)
		ON DELETE CASCADE,

	CONSTRAINT fk_notifications_actor
		FOREIGN KEY (actor_id) REFERENCES users(id)
		ON DELETE SET NULL
);

-- STARTUP SEED DATA
-- Shared test password for all accounts below: Password123!
BEGIN;

TRUNCATE TABLE
	messages,
	user_achievements,
	achievements,
	match_players,
	oauth_accounts,
	friends,
	matches,
	users
RESTART IDENTITY CASCADE;

INSERT INTO achievements (id, code, name, description, rarity, target) VALUES
	(1, 'first_piece', 'Block, Stock and Barrel', 'Place your first piece.', 'common', 1),
	(2, 'first_line', 'Line Goes Up? No, Down.', 'Clear your first line.', 'common', 1),
	(3, 'double_clear', 'Two Birds, One Block', 'Clear 2 lines at once.', 'common', 2),
	(4, 'triple_clear', 'Three''s Company', 'Clear 3 lines at once.', 'common', 3),
	(5, 'pieces_25', 'Square Deal', 'Place 25 pieces in one game.', 'common', 25),
	(6, 'hard_drops_25', 'Gravity Enjoyer', 'Use hard drop 25 times in one game.', 'common', 25),
	(7, 'first_hold', 'Hold My Block', 'Use hold for the first time.', 'common', 1),
	(8, 'tiny_comeback', 'Tiny Comeback', 'Clear a line after the stack reaches half the field.', 'common', 1),
	(9, 'total_lines_10', 'Stack Intern', 'Clear 10 total lines.', 'common', 10),
	(10, 'score_1000', 'Not Quite Art', 'Reach 1,000 points.', 'common', 1000),
	(11, 'first_tetris', 'Tetris, Actually', 'Clear 4 lines at once.', 'rare', 1),
	(12, 'lines_25', 'Line Cook', 'Clear 25 lines in one game.', 'rare', 25),
	(13, 'pieces_100', 'Blocksmith', 'Place 100 pieces in one game.', 'rare', 100),
	(14, 'hard_drops_100', 'Drop It Like It''s Hot', 'Use hard drop 100 times in one game.', 'rare', 100),
	(15, 'holds_25', 'Professional Procrastinator', 'Use hold 25 times in one game.', 'rare', 25),
	(16, 'combo_3', 'Combo Meal', 'Reach a 3-combo in one game.', 'rare', 3),
	(17, 'score_10000', 'Stack Overflow', 'Reach 10,000 points.', 'rare', 10000),
	(18, 'multiplayer_survive_180', 'Still Standing', 'Survive 3 minutes in multiplayer.', 'rare', 180),
	(19, 'level_10', 'Mildly Geometric', 'Reach level 10.', 'rare', 10),
	(21, 'tetrises_10', 'Four Real This Time', 'Clear 10 Tetrises in one game.', 'epic', 10),
	(23, 'pieces_500', 'Certified Bricklayer', 'Place 500 pieces in one game.', 'epic', 500),
	(24, 'combo_5', 'Combo Wombo', 'Reach a 5-combo in one game.', 'epic', 5),
	(25, 'lines_100', 'Ctrl + Alt + Deplete', 'Clear 100 lines in one game.', 'epic', 100),
	(26, 'multiplayer_survive_300', 'Panic at the Gridco', 'Survive 5 minutes in multiplayer.', 'epic', 300),
	(27, 'level_50', 'That Escalated Vertically', 'Reach level 50.', 'epic', 50),
	(28, 'multiplayer_score_50000', 'Point Taken', 'Reach 50,000 points in multiplayer.', 'epic', 50000),
	(29, 'hard_drops_250', 'Hard Drop Addict', 'Use hard drop 250 times in one game.', 'epic', 250),
	(30, 'holds_100', 'Held Together by Blocks', 'Use hold 100 times in one game.', 'epic', 100);

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
		(40, 'quickplay_pro', 'Poland'),
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
		('fortyLines'::gamemode, 2),
		('blitz'::gamemode, 3),
		('zen'::gamemode, 4),
		('customGame'::gamemode, 5)
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

INSERT INTO match_players (
	match_id, user_id, score, result, lines, pieces_placed, hard_drops,
	holds, max_combo, max_lines_cleared, tetrises, duration_ms,
	cleared_after_half_height, cleared_two_at_once, cleared_three_at_once
)
SELECT
	match_id,
	pair_number,
	(mode_number * 10000) + (pair_number * 731),
	CASE
		WHEN pair_number % 7 = 0 THEN 'draw'::player_result
		WHEN pair_number % 2 = 0 THEN 'win'::player_result
		ELSE 'lose'::player_result
	END,
	(pair_number * 5 + mode_number * 3) % 121,
	20 + pair_number * 18,
	pair_number * 9,
	pair_number * 4,
	1 + (pair_number % 7),
	LEAST(4, 1 + (pair_number % 4)),
	pair_number % 13,
	(45 + pair_number * 14) * 1000,
	pair_number % 3 = 0,
	pair_number % 2 = 0,
	pair_number % 3 = 0
FROM (
	SELECT
		id AS match_id,
		((id - 1) / 25) + 1 AS mode_number,
		((id - 1) % 25) + 1 AS pair_number
	FROM matches
	WHERE status = 'finished'
) AS finished_matches;

INSERT INTO match_players (
	match_id, user_id, score, result, lines, pieces_placed, hard_drops,
	holds, max_combo, max_lines_cleared, tetrises, duration_ms,
	cleared_after_half_height, cleared_two_at_once, cleared_three_at_once
)
SELECT
	match_id,
	51 - pair_number,
	(mode_number * 10000) + ((26 - pair_number) * 683),
	CASE
		WHEN pair_number % 7 = 0 THEN 'draw'::player_result
		WHEN pair_number % 2 = 0 THEN 'lose'::player_result
		ELSE 'win'::player_result
	END,
	((26 - pair_number) * 6 + mode_number * 2) % 121,
	30 + (26 - pair_number) * 19,
	(26 - pair_number) * 10,
	(26 - pair_number) * 4,
	1 + ((26 - pair_number) % 7),
	LEAST(4, 1 + ((26 - pair_number) % 4)),
	(26 - pair_number) % 13,
	(55 + (26 - pair_number) * 13) * 1000,
	pair_number % 4 = 0,
	pair_number % 2 <> 0,
	pair_number % 3 = 0
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
		('fortyLines'::gamemode, 2),
		('blitz'::gamemode, 3),
		('zen'::gamemode, 4),
		('customGame'::gamemode, 5)
)
INSERT INTO matches (status, gamemode, created_at)
SELECT
	'active',
	gamemode,
	TIMESTAMP '2026-06-15 15:00:00' + (mode_number * INTERVAL '10 minutes')
FROM modes
ORDER BY mode_number;

INSERT INTO match_players (match_id, user_id, score, metric_value, result)
SELECT
	id,
	((id - 126) * 2) + 1,
	0,
	CASE WHEN gamemode = 'quickPlay' THEN 0.0 ELSE NULL END,
	NULL
FROM matches
WHERE status = 'active';

-- Unlock a varied subset for every seed profile. User 50 has all achievements,
-- while early users retain many locked cards for visual and API testing.
INSERT INTO user_achievements (user_id, achievement_id, unlocked_at)
SELECT
	users.id,
	achievements.id,
	TIMESTAMP '2026-01-01 10:00:00'
		+ (users.id * INTERVAL '1 day')
		+ (achievements.id * INTERVAL '10 minutes')
FROM users
CROSS JOIN achievements
WHERE achievements.id <= CASE
	WHEN users.id = 50 THEN 30
	ELSE 1 + (users.id % 20)
END;

INSERT INTO match_players (match_id, user_id, score, metric_value, result)
SELECT
	id,
	((id - 126) * 2) + 2,
	0,
	CASE WHEN gamemode = 'quickPlay' THEN 0.0 ELSE NULL END,
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
