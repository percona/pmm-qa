create extension pg_stat_statements;
ALTER SYSTEM SET track_io_timing=ON;
SELECT pg_reload_conf();
