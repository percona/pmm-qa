DROP USER IF EXISTS 'pmm'@'%';
CREATE USER 'pmm'@'%' IDENTIFIED BY 'secret';
GRANT SELECT, PROCESS, REPLICATION CLIENT, RELOAD ON *.* TO 'pmm'@'%';
CREATE SCHEMA sbtest;
CREATE USER 'sbtest'@'%' IDENTIFIED BY 'sbtestsecret';
GRANT ALL PRIVILEGES ON sbtest.* to 'sbtest'@'%';
