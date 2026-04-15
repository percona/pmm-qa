-- Step 1: Create a test table
CREATE TABLE IF NOT EXISTS test_users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(150),
    created_at TIMESTAMP DEFAULT NOW(),
    bio TEXT
);

-- Step 2: Insert 10,000 rows
INSERT INTO test_users (name, email, bio)
SELECT
    'User_' || gs::TEXT AS name,
    'user_' || gs::TEXT || '@example.com' AS email,
    'This is a generated bio for user #' || gs::TEXT
FROM generate_series(1, 10000) AS gs;

-- Step 3: Query the data
SELECT * FROM test_users;

-- Step 4: Delete the data
DELETE FROM test_users;

-- Step 5: Drop the table
DROP TABLE test_users;
