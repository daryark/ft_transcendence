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
