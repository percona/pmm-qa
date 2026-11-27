Create EXTENSION IF NOT EXISTS pg_stat_statements ;
Set application_name = 'pmm-pgss-codeceptjs' ;
SELECT 99 AS num;

Set application_name = 'codeceptjs' ;
-- This causes break on PMM side, SELECT 99 AS num;

create table IF NOT EXISTS dummy_table(name varchar(20),address text,age int);

insert into dummy_table values('XYZ','location-A',25);
insert into dummy_table values('ABC','location-B',35);
insert into dummy_table values('DEF','location-C',40);
insert into dummy_table values('PQR','location-D',54);

select * from dummy_table;

update dummy_table set age=50 where name='PQR';

select * from dummy_table;

update dummy_table set name='GHI',age=54 where address='location-D';
update dummy_table set age=54,address='location-X';
select * from dummy_table ;

update dummy_table set age=30 where name='XYZ' returning age as age_no;
delete from dummy_table where age=65;


select * from dummy_table where age <=50;

select * from dummy_table where age>=50;

select * from dummy_table where age<>50;
select * from dummy_table where age=50;
select age from dummy_table order by 1;
select distinct age from dummy_table order by 1;
truncate table dummy_table;

drop table if exists dummy;
create or replace view vi as select * from dummy_table where age is NULL;
drop table if exists new_table;
select 'My name  is X' as col1 , 10 as col2, 'Address is -XYZ location' as col3  into new_table;
select * from new_table ;


create table IF NOT EXISTS test_table(
  emp_no                int,
  ename                 char(5),
  job                       char(9),
  manager_no        int
);

insert into test_table values(10,'A1','CEO',null);
insert into test_table values(11, 'B1', 'VP', 10);
insert into test_table values(12, 'B2', 'VP', 10);
insert into test_table values(13, 'B3', 'VP', 10);
insert into test_table values(14, 'C1', 'DIRECTOR', 13);
insert into test_table values(15, 'C2', 'DIRECTOR', 13);
insert into test_table values(16, 'D1', 'MANAGER', 15);
insert into test_table values(17 ,'E1', 'ENGINEER', 11);
insert into test_table values(18, 'E2', 'ENGINEER', 11);

create table IF NOT EXISTS X(n int, n1 char(10));

insert into X values (1,'abc');
insert into X values (2,'xyz');
insert into X values (3,'pqr');

create table IF NOT EXISTS Y(n int, n1 char(10));
insert into Y values (1,'');
insert into Y values (2,'');
insert into Y values (5,'axyz');

update Y set n1=X.n1 from X  where X.n=Y.n;
select * from Y;

select *  from x inner join  y on  x.n1 = y.n1;

SELECT age,
       CASE age WHEN 25 THEN 'one'
              WHEN 50 THEN 'two'
              ELSE 'other'
       END
    FROM  dummy_table;


CREATE TABLE IF NOT EXISTS emp_test (
  id int,
  ename varchar(255),
  emanager int
);

INSERT INTO emp_test VALUES (1, 'abc', null);
INSERT INTO emp_test VALUES (2, 'xyz', 1);
INSERT INTO emp_test VALUES (3, 'def', 2);
INSERT INTO emp_test VALUES (4, 'cde', 1);
INSERT INTO emp_test VALUES (5, 'qrs', 2);
INSERT INTO emp_test VALUES (9, 'iop', 3);
INSERT INTO emp_test VALUES (10, 'klm', 4);

WITH RECURSIVE emp_testnew  AS (
  SELECT id, ename, emanager
  FROM emp_test
  WHERE id = 2
  UNION ALL
  SELECT e.id, e.ename, e.emanager
  FROM emp_test e
  INNER JOIN emp_testnew e1 ON e1.id = e.emanager
)
SELECT *
FROM emp_testnew;
SELECT * FROM emp_test;
