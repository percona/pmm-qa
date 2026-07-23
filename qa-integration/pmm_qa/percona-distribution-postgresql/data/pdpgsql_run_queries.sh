#!/bin/sh

while true; do
  psql -U postgres -d school -c "SELECT s.first_name, s.last_name FROM students s JOIN enrollments e ON s.student_id = e.student_id JOIN classes c ON e.class_id = c.class_id WHERE c.name = 'Mathematics';"
  psql -U postgres -d school -c "INSERT INTO classes (name, teacher) VALUES ('Physics', 'Mr. Demo');"
  psql -U postgres -d school -c "DELETE FROM enrollments WHERE enrollment_id IN (SELECT enrollment_id FROM enrollments LIMIT 1);"
  sleep 30
done
