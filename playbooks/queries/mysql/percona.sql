ALTER USER 'pmm'@'%' IDENTIFIED WITH mysql_native_password BY 'secret';
ALTER USER 'sbtest'@'%' IDENTIFIED WITH mysql_native_password BY 'sbtestsecret';
SET GLOBAL userstat=1;
SET GLOBAL innodb_monitor_enable=all;
SET GLOBAL log_slow_rate_limit=1;
