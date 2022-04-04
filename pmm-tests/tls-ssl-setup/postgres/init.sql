CREATE DATABASE sbtest1;
CREATE DATABASE sbtest2;
CREATE USER pmm WITH PASSWORD 'pmm';
GRANT pg_monitor TO pmm;
CREATE EXTENSION pg_stat_statements;
ALTER SYSTEM SET shared_preload_libraries TO 'pg_stat_statements';
ALTER SYSTEM SET track_activity_query_size=2048;
ALTER SYSTEM SET track_io_timing=ON;
