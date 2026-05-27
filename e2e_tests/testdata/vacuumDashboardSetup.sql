-- Creates the `dvdrental` database and 10 film_testing_* tables seeded with
-- 5,000 rows each. Length values are spread across 100..220 so the churn
-- loop in the test can pick a random length and find rows to delete/update.
CREATE DATABASE dvdrental;
\connect dvdrental

DO $$
BEGIN
  FOR i IN 1..10 LOOP
    EXECUTE format(
      'CREATE TABLE film_testing_%s (id int, title text, description text, length int)',
      i
    );
    EXECUTE format(
      $sql$
        INSERT INTO film_testing_%s (id, title, description, length)
        SELECT g, 'title for ' || g, 'Description for ' || g, 100 + (g %% 121)
        FROM generate_series(1, 5000) AS g
      $sql$,
      i
    );
  END LOOP;
END $$;
