DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 1..20000 LOOP
        EXECUTE format('CREATE TABLE t%s (id int);', i);
        EXECUTE format('SELECT count(*) FROM t%s;', i);
        EXECUTE format('DROP TABLE t%s;', i);
    END LOOP;
END $$;
