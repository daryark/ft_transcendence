-- Reset and populate the database with sample data for manual testing.
-- Run from inside the database container, for example:
-- psql -U myuser -d mydatabase -f /docker-entrypoint-initdb.d/test_tables.sql

BEGIN;

TRUNCATE TABLE
	messages,
	match_players,
	friends,
	matches,
	users
RESTART IDENTITY CASCADE;

INSERT INTO users (email, username, password_hash)
VALUES
	('alice@example.com', 'alice', 'hash_alice'),
	('bob@example.com', 'bob', 'hash_bob'),
	('carol@example.com', 'carol', 'hash_carol');

INSERT INTO friends (user_id, friend_id, status)
VALUES
	(1, 2, 'accepted'),
	(2, 3, 'accepted');

INSERT INTO matches (status)
VALUES
	('active'),
	('finished');

INSERT INTO match_players (match_id, user_id, score, result)
VALUES
	(1, 1, 12, 'win'),
	(1, 2, 7, 'lose'),
	(2, 2, 9, 'draw'),
	(2, 3, 9, 'draw');

INSERT INTO messages (sender_id, receiver_id, content)
VALUES
	(1, 2, 'Hello Bob'),
	(2, 1, 'Hi Alice'),
	(3, 1, 'Good game');

SELECT
	u.id,
	u.username,
	u.email,
	f.friend_id,
	f.status
FROM users u
LEFT JOIN friends f ON f.user_id = u.id
ORDER BY u.id, f.friend_id;

SELECT
	m.id AS match_id,
	m.status,
	mp.user_id,
	mp.score,
	mp.result
FROM matches m
JOIN match_players mp ON mp.match_id = m.id
ORDER BY m.id, mp.user_id;

SELECT
	sender.username AS sender,
	receiver.username AS receiver,
	msg.content,
	msg.created_at
FROM messages msg
JOIN users sender ON sender.id = msg.sender_id
JOIN users receiver ON receiver.id = msg.receiver_id
ORDER BY msg.id;

SELECT '✓ Test data inserted successfully' AS status;

COMMIT;
