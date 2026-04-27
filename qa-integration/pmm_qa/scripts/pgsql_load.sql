-- ========================================
-- CREATE TABLES
-- ========================================

CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    birth_date DATE
);

CREATE TABLE classes (
    class_id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    teacher VARCHAR(100)
);

CREATE TABLE enrollments (
    enrollment_id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES students(student_id),
    class_id INTEGER REFERENCES classes(class_id),
    enrollment_date DATE DEFAULT CURRENT_DATE
);

-- ========================================
-- INSERT MOCK DATA
-- ========================================

INSERT INTO students (first_name, last_name, birth_date) VALUES
('Alice', 'Smith', '2005-04-10'),
('Bob', 'Johnson', '2006-08-15'),
('Charlie', 'Brown', '2004-12-01');

INSERT INTO classes (name, teacher) VALUES
('Mathematics', 'Mrs. Taylor'),
('History', 'Mr. Anderson'),
('Science', 'Dr. Reynolds');

INSERT INTO enrollments (student_id, class_id) VALUES
(1, 1),
(1, 2),
(2, 2),
(3, 1),
(3, 3);

-- ========================================
-- SIMULATE DEAD TUPLES
-- ========================================


INSERT INTO students (first_name, last_name, birth_date)
SELECT 'John', 'Doe', CURRENT_DATE - (random() * 5000)::int
FROM generate_series(1, 100000);

-- These updates and deletes will create dead tuples

-- Update records (old versions become dead)
UPDATE students
SET last_name = last_name || '_updated'
WHERE student_id IN (1, 2);

-- Delete records (deleted rows become dead)
DELETE FROM enrollments
WHERE enrollment_id IN (SELECT enrollment_id FROM enrollments LIMIT 2);

-- Disable autovacuum temporarily (for demo)
ALTER TABLE students SET (autovacuum_enabled = false);
ALTER TABLE enrollments SET (autovacuum_enabled = false);

-- ========================================
-- SELECT QUERIES
-- ========================================

-- Get all students
SELECT * FROM students;

-- Get all students enrolled in Mathematics
SELECT s.first_name, s.last_name
FROM students s
JOIN enrollments e ON s.student_id = e.student_id
JOIN classes c ON e.class_id = c.class_id
WHERE c.name = 'Mathematics';

-- Count students per class
SELECT c.name, COUNT(e.student_id) AS student_count
FROM classes c
LEFT JOIN enrollments e ON c.class_id = e.class_id
GROUP BY c.name;

-- ========================================
-- UPDATE QUERIES
-- ========================================

-- Change Bob's last name
UPDATE students
SET last_name = 'Williams'
WHERE first_name = 'Bob' AND last_name = 'Johnson';

-- Update the teacher for the History class
UPDATE classes
SET teacher = 'Ms. Carter'
WHERE name = 'History';

-- ========================================
-- DELETE QUERIES
-- ========================================

-- Remove Charlie from Science class
DELETE FROM enrollments
WHERE student_id = (SELECT student_id FROM students WHERE first_name = 'Charlie')
  AND class_id = (SELECT class_id FROM classes WHERE name = 'Science');

-- Delete a student completely
DELETE FROM students
WHERE first_name = 'Alice' AND last_name = 'Smith';
