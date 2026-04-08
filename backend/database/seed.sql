-- Persistent seed data for development.
-- This file inserts sample data and COMMITS it permanently.
-- Run with: psql -U myuser -d mydatabase -f seed.sql

BEGIN;

-- Insert sample users
INSERT INTO users (email, username, password_hash)
VALUES
	('alice@example.com', 'alice', 'hash_alice'),
	('bob@example.com', 'bob', 'hash_bob'),
	('carol@example.com', 'carol', 'hash_carol'),
	('dave@example.com', 'dave', 'hash_dave')
ON CONFLICT (email) DO NOTHING;

-- Insert friend relationships
INSERT INTO friends (user_id, friend_id, status)
VALUES
	(1, 2, 'accepted'),
	(1, 3, 'pending'),
	(2, 3, 'accepted'),
	(3, 4, 'blocked')
ON CONFLICT (user_id, friend_id) DO NOTHING;

-- Insert sample matches
INSERT INTO matches (status)
VALUES
	('active'),
	('finished'),
	('finished')
ON CONFLICT DO NOTHING;

-- Insert match players
INSERT INTO match_players (match_id, user_id, score, result)
VALUES
	(1, 1, 15, 'win'),
	(1, 2, 8, 'lose'),
	(2, 2, 12, 'draw'),
	(2, 3, 12, 'draw'),
	(3, 1, 20, 'win'),
	(3, 4, 5, 'lose')
ON CONFLICT DO NOTHING;

-- Insert sample messages
INSERT INTO messages (sender_id, receiver_id, content)
VALUES
	(1, 2, 'Hey Bob, want to play?'),
	(2, 1, 'Sure Alice, let''s go!'),
	(3, 1, 'Good game earlier'),
	(4, 2, 'Can we talk?')
ON CONFLICT DO NOTHING;

-- Show inserted data
SELECT '✓ Seed data complete' AS status;
SELECT COUNT(*) AS user_count FROM users;
SELECT COUNT(*) AS friend_count FROM friends;
SELECT COUNT(*) AS match_count FROM matches;
SELECT COUNT(*) AS message_count FROM messages;

COMMIT;
