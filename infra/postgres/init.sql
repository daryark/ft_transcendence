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
	metric_value DOUBLE PRECISION DEFAULT NULL,
	rank_label VARCHAR(16) DEFAULT NULL,
	result player_result DEFAULT NULL,

	CONSTRAINT fk_match_players_match
		FOREIGN KEY (match_id) REFERENCES matches(id)
		ON DELETE CASCADE,

	CONSTRAINT fk_match_players_user
		FOREIGN KEY (user_id) REFERENCES users(id)
		ON DELETE CASCADE
);

ALTER TABLE match_players
	ADD COLUMN IF NOT EXISTS metric_value DOUBLE PRECISION DEFAULT NULL,
	ADD COLUMN IF NOT EXISTS rank_label VARCHAR(16) DEFAULT NULL;

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
	wins
)
VALUES -- Password hash generated from bcrypt with 10 salt rounds for "Password123!"
	('alice@example.com', 'alice', '$2b$10$GMbTuXBbvNJ52n2gK3fjz.vnaZFUOrwg9qs89SbliIF/QUY86rkSm', 1, 'France', 12, 1800, 2400, 5400, 2),
	('bob@example.com', 'bob', '$2b$10$GMbTuXBbvNJ52n2gK3fjz.vnaZFUOrwg9qs89SbliIF/QUY86rkSm', 2, 'Brazil', 10, 1400, 2000, 4200, 1),
	('carol@example.com', 'carol', '$2b$10$GMbTuXBbvNJ52n2gK3fjz.vnaZFUOrwg9qs89SbliIF/QUY86rkSm', 3, 'Japan', 11, 1600, 2200, 4800, 1),
	('dave@example.com', 'dave', '$2b$10$GMbTuXBbvNJ52n2gK3fjz.vnaZFUOrwg9qs89SbliIF/QUY86rkSm', 4, 'Canada', 9, 1200, 1800, 3600, 0),
	('eva@example.com', 'eva', '$2b$10$GMbTuXBbvNJ52n2gK3fjz.vnaZFUOrwg9qs89SbliIF/QUY86rkSm', 5, 'Germany', 4, 320, 800, 900, 0),
	('frank@example.com', 'frank', '$2b$10$GMbTuXBbvNJ52n2gK3fjz.vnaZFUOrwg9qs89SbliIF/QUY86rkSm', 6, 'Spain', 3, 260, 700, 600, 0),
	('gwen@example.com', 'gwen', '$2b$10$GMbTuXBbvNJ52n2gK3fjz.vnaZFUOrwg9qs89SbliIF/QUY86rkSm', 7, 'Chile', 5, 480, 900, 1200, 0),
	('hugo@example.com', 'hugo', '$2b$10$GMbTuXBbvNJ52n2gK3fjz.vnaZFUOrwg9qs89SbliIF/QUY86rkSm', 8, 'Italy', 7, 760, 1300, 1800, 0),
	('ivy@example.com', 'ivy', '$2b$10$GMbTuXBbvNJ52n2gK3fjz.vnaZFUOrwg9qs89SbliIF/QUY86rkSm', 9, 'Morocco', 2, 120, 500, 240, 0),
	('jules@example.com', 'jules', '$2b$10$GMbTuXBbvNJ52n2gK3fjz.vnaZFUOrwg9qs89SbliIF/QUY86rkSm', 10, 'Poland', 6, 640, 1100, 1500, 0);

INSERT INTO oauth_accounts (user_id, provider, provider_user_id, provider_data)
VALUES
	(1, 'github', 'alice_github', '{"seed":"startup","username":"alice"}'::jsonb),
	(2, 'github', 'bob_github', '{"seed":"startup","username":"bob"}'::jsonb),
	(3, 'github', 'carol_github', '{"seed":"startup","username":"carol"}'::jsonb),
	(4, 'github', 'dave_github', '{"seed":"startup","username":"dave"}'::jsonb);

INSERT INTO friends (user_id, friend_id, status)
VALUES
	(1, 2, 'accepted'),
	(1, 3, 'pending'),
	(2, 3, 'accepted'),
	(3, 4, 'blocked'),
	(4, 1, 'accepted');

INSERT INTO messages (sender_id, receiver_id, content)
VALUES
	(1, 2, 'Hey Bob, want to play?'),
	(2, 1, 'Sure Alice, let''s go!'),
	(3, 1, 'Good game earlier'),
	(4, 2, 'Can we talk about the last match?'),
	(1, 3, 'Rematch after lunch?'),
	(2, 4, 'I am ready when you are.');

INSERT INTO matches (status, gamemode)
VALUES
	('finished', 'quickPlay'),
	('finished', 'tetraLeague'),
	('finished', 'fortyLines'),
	('finished', 'blitz'),
	('finished', 'zen');

INSERT INTO match_players (match_id, user_id, score, metric_value, rank_label, result)
VALUES
	(1, 1, 15, 15.5, NULL, 'win'),
	(1, 2, 8, 8.25, NULL, 'lose'),
	(2, 2, 12, NULL, 'B', 'draw'),
	(2, 3, 12, NULL, 'C+', 'draw'),
	(3, 3, 20000, NULL, NULL, 'win'),
	(3, 4, 28000, NULL, NULL, 'lose'),
	(4, 1, 18000, NULL, NULL, 'win'),
	(4, 4, 7000, NULL, NULL, 'lose'),
	(5, 2, 16, NULL, NULL, 'win'),
	(5, 1, 11, NULL, NULL, 'lose');

COMMIT;
