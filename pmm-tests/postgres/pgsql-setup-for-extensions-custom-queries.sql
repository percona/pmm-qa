create extension pg_stat_statements;
ALTER SYSTEM SET track_io_timing=ON;
SELECT pg_reload_conf();

### Sample sql for postgresql to get custom queries
create table dummy_table(name varchar(20),address text,age int);
insert into dummy_table values('XYZ','location-A',25);
insert into dummy_table values('ABC','location-B',35);
insert into dummy_table values('DEF','location-C',40);
insert into dummy_table values('PQR','location-D',54);
select * from dummy_table;
update dummy_table set age=50 where name='PQR';
select * from dummy_table;
delete from dummy_table where age=50;
