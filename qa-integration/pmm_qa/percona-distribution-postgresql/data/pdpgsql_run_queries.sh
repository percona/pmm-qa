#!/bin/sh

psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'contrib_regression'" | grep -q 1 \
  || psql -U postgres -c "CREATE DATABASE contrib_regression;"

psql -U postgres -d contrib_regression -c "CREATE EXTENSION IF NOT EXISTS pg_stat_monitor;"
psql -U postgres -d contrib_regression -c "ALTER SYSTEM SET pg_stat_monitor.pgsm_track TO 'all';"
psql -U postgres -d contrib_regression -c "SELECT pg_reload_conf();"

seed_plan_tables() {
  psql -U postgres -d contrib_regression -v ON_ERROR_STOP=0 <<'EOSQL'
CREATE TABLE IF NOT EXISTS pgsm_t1 (a INTEGER);
CREATE TABLE IF NOT EXISTS pgsm_t2 (b INTEGER);
CREATE TABLE IF NOT EXISTS pgsm_t3 (c INTEGER);
CREATE TABLE IF NOT EXISTS pgsm_t4 (d INTEGER);
INSERT INTO pgsm_t1(a) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM pgsm_t1);
INSERT INTO pgsm_t2(b) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM pgsm_t2);
INSERT INTO pgsm_t3(c) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM pgsm_t3);
INSERT INTO pgsm_t4(d) SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM pgsm_t4);
EOSQL
}

seed_plan_tables

while true; do
  seed_plan_tables

  # PMM-T1061: capture query plans in pg_stat_monitor.
  psql -U postgres -d contrib_regression -c \
    "SELECT a,b,c,d FROM pgsm_t1 t1, pgsm_t2 t2, pgsm_t3 t3, pgsm_t4 t4 WHERE t1.a = t2.b AND t3.c = t4.d ORDER BY a;" >/dev/null 2>&1 || true

  # PMM-T1061: second part of the scenario.
  psql -U postgres -d contrib_regression -c "SELECT * FROM pg_stat_database;" >/dev/null 2>&1 || true

  # PMM-T13 PDPGSQL QAN workload on school DB.
  psql -U postgres -d school -c \
    "SELECT s.first_name, s.last_name FROM students s JOIN enrollments e ON s.student_id = e.student_id JOIN classes c ON e.class_id = c.class_id WHERE c.name = 'Mathematics';" >/dev/null 2>&1 || true
  psql -U postgres -d school -c \
    "INSERT INTO classes (name, teacher) VALUES ('Physics', 'Mr. Demo');" >/dev/null 2>&1 || true
  psql -U postgres -d school -c \
    "DELETE FROM enrollments WHERE enrollment_id IN (SELECT enrollment_id FROM enrollments LIMIT 1);" >/dev/null 2>&1 || true

  sleep 30
done
