-- Step 1: Show initial buffers_alloc value
SELECT 'Initial buffers_alloc' AS info, buffers_alloc FROM pg_stat_bgwriter;

-- Step 2: Drop and create a large test table (~500MB+)
DROP TABLE IF EXISTS buffer_test;

CREATE TABLE buffer_test AS
SELECT
    generate_series(1, 1_000_000) AS id,
    md5(random()::text) AS filler;

ANALYZE buffer_test;

-- Step 3: Perform repeated full-table scans to stress buffer allocation
DO $$
BEGIN
  FOR i IN 1..10 LOOP
    RAISE NOTICE 'Running scan iteration %', i;
    PERFORM COUNT(*) FROM buffer_test;
  END LOOP;
END $$;

---- Step 4: Show final buffers_alloc value
--SELECT 'Final buffers_alloc' AS info, buffers_alloc FROM pg_stat_bgwriter;
VACUUM;
SELECT pg_switch_wal();

-- Step 5: Query the data
SELECT * FROM buffer_test;

-- Step 6: Delete the data
DELETE FROM buffer_test;
