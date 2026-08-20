Create EXTENSION IF NOT EXISTS pg_stat_monitor ;
Set application_name = 'PMMT1063' ;
create table IF NOT EXISTS PMMT1063(name varchar(20),address text,age int);

insert into PMMT1063 values('XYZ','location-A',25);
insert into PMMT1063 values('ABC','location-B',35);
insert into PMMT1063 values('DEF','location-C',40);
insert into PMMT1063 values('PQR','location-D',54);

select * from PMMT1063;

update PMMT1063 set age=50 where name='PQR';
