-- Drop and create the database
DROP DATABASE IF EXISTS sbtest3;
CREATE DATABASE sbtest3;

-- Use the new database
USE sbtest3;

-- Set global variables (these require SUPER privilege; comment out if running as non-root)
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 0;

-- Create tables and insert data
-- Repeat for Persons1 to Persons5, each with 5 rows
CREATE TABLE Persons1 (
                          PersonID int not null,
                          LastName varchar(255),
                          FirstName varchar(255),
                          Address varchar(255),
                          City varchar(255)
);
INSERT INTO Persons1 VALUES (0,'Qwerty','Qwe','Address','City');
INSERT INTO Persons1 VALUES (1,'Qwerty','Qwe','Address','City');
INSERT INTO Persons1 VALUES (2,'Qwerty','Qwe','Address','City');
INSERT INTO Persons1 VALUES (3,'Qwerty','Qwe','Address','City');
INSERT INTO Persons1 VALUES (4,'Qwerty','Qwe','Address','City');
SELECT COUNT(*) FROM Persons1;

CREATE TABLE Persons2 (
                          PersonID int not null,
                          LastName varchar(255),
                          FirstName varchar(255),
                          Address varchar(255),
                          City varchar(255)
);
INSERT INTO Persons2 VALUES (0,'Qwerty','Qwe','Address','City');
INSERT INTO Persons2 VALUES (1,'Qwerty','Qwe','Address','City');
INSERT INTO Persons2 VALUES (2,'Qwerty','Qwe','Address','City');
INSERT INTO Persons2 VALUES (3,'Qwerty','Qwe','Address','City');
INSERT INTO Persons2 VALUES (4,'Qwerty','Qwe','Address','City');
SELECT COUNT(*) FROM Persons2;

CREATE TABLE Persons3 (
                          PersonID int not null,
                          LastName varchar(255),
                          FirstName varchar(255),
                          Address varchar(255),
                          City varchar(255)
);
INSERT INTO Persons3 VALUES (0,'Qwerty','Qwe','Address','City');
INSERT INTO Persons3 VALUES (1,'Qwerty','Qwe','Address','City');
INSERT INTO Persons3 VALUES (2,'Qwerty','Qwe','Address','City');
INSERT INTO Persons3 VALUES (3,'Qwerty','Qwe','Address','City');
INSERT INTO Persons3 VALUES (4,'Qwerty','Qwe','Address','City');
SELECT COUNT(*) FROM Persons3;

CREATE TABLE Persons4 (
                          PersonID int not null,
                          LastName varchar(255),
                          FirstName varchar(255),
                          Address varchar(255),
                          City varchar(255)
);
INSERT INTO Persons4 VALUES (0,'Qwerty','Qwe','Address','City');
INSERT INTO Persons4 VALUES (1,'Qwerty','Qwe','Address','City');
INSERT INTO Persons4 VALUES (2,'Qwerty','Qwe','Address','City');
INSERT INTO Persons4 VALUES (3,'Qwerty','Qwe','Address','City');
INSERT INTO Persons4 VALUES (4,'Qwerty','Qwe','Address','City');
SELECT COUNT(*) FROM Persons4;

CREATE TABLE Persons5 (
                          PersonID int not null,
                          LastName varchar(255),
                          FirstName varchar(255),
                          Address varchar(255),
                          City varchar(255)
);
INSERT INTO Persons5 VALUES (0,'Qwerty','Qwe','Address','City');
INSERT INTO Persons5 VALUES (1,'Qwerty','Qwe','Address','City');
INSERT INTO Persons5 VALUES (2,'Qwerty','Qwe','Address','City');
INSERT INTO Persons5 VALUES (3,'Qwerty','Qwe','Address','City');
INSERT INTO Persons5 VALUES (4,'Qwerty','Qwe','Address','City');
SELECT COUNT(*) FROM Persons5;
