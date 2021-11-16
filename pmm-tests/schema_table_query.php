<?php

/* This script is designed to generate test workload to hit certain amount of tables in certain amount of schemas 
   having certain amount of unique queries */


$schemas=10;
$tables=10;
$queries=10;

/* How many queries try to run per second */
$target_qps=100;

$mysql_host="localhost";
$mysql_user="root";
$mysql_password="";


/* We do not want uniform distribution so skew things a bit */
function skewed_rnd($min,$max)
{
  $rounds=5;
  $r=0;
  for($i=0;$i<$rounds;$i++)
    $r+=rand($min,$max);
  
  return round($r/$rounds);
}

/* Run one query for one table */
function run_query($schema,$table,$query)
{
  global $link;

  if(!$link->select_db("db$schema"))
    die("Can't select database db$schema\n");
  $r=$link->query("select id, v as col$query from tbl$table");
  $link->query("insert into tbl$table values(2,'value')");
  $link->query("update tbl$table set v='new value' where id=2");
  $link->query("delete from tbl$table where id=2 and v='new value'");
  if(!$r)
    die("Can't run query on db$schema.tbl$table\n");
  $r->free_result();
}

/*Main Program Starts Here */

if(getenv('TEST_SCHEMAS'))
  $schemas=getenv('TEST_SCHEMAS');
if(getenv('TEST_TABLES'))
  $tables=getenv('TEST_TABLES');
if(getenv('TEST_QUERIES'))
  $queries=getenv('TEST_QUERIES');
if(getenv('TEST_TARGET_QPS'))
  $target_qps=getenv('TEST_TARGET_QPS');
if(getenv('MYSQL_HOST'))
  $mysql_host=getenv('MYSQL_HOST');
if(getenv('MYSQL_USER'))
  $mysql_user=getenv('MYSQL_USER');
if(getenv('MYSQL_PASSWORD'))
  $mysql_password=getenv('MYSQL_PASSWORD');
if(getenv('MYSQL_PORT'))
  $mysql_port=getenv('MYSQL_PORT');
if(getenv('MYSQL_DATABASE'))
  $mysql_db=getenv('MYSQL_DATABASE');


echo("Schemas:  $schemas,  Tables: $tables,  Queries: $queries   Target Queries Per Second: $target_qps\n");



$link=mysqli_connect($mysql_host,$mysql_user,$mysql_password, $mysql_db, $mysql_port);

if (!$link) {
    echo "Error: Unable to connect to MySQL." . PHP_EOL;
    echo "Debugging errno: " . mysqli_connect_errno() . PHP_EOL;
    echo "Debugging error: " . mysqli_connect_error() . PHP_EOL;
    exit;
}

/* Create all the schemas  */
for($i=1;$i<=$schemas;$i++)
{
  /* We strategically ignore error here assuming it would be database already exists */
  $link->query("create database db$i"); 
  if(!$link->select_db("db$i"))
    die("Can't select database db$i\n");
  echo("Initializing Database db$i\n");
  for ($j=1;$j<=$tables;$j++)
  {    
    $link->query("create table tbl$j(id int unsigned not null primary key, v varchar(20) not null)"); 
    $link->query("insert into tbl$j values(1,'value')");
  }
}

echo("Running Queries...\n");

/* How long we want target to take */
$target_round_time=1/$target_qps;

while(1)
{
   $start=microtime(1);
   $schema=skewed_rnd(1,$schemas);
   $table=skewed_rnd(1,$tables);
   $query=skewed_rnd(1,$queries);
   run_query($schema,$table,$query);
   $end=microtime(1);
   $round_time=$end-$start;
#   echo("Round Took: $round_time\n");
   if($round_time<$target_round_time) /* Went faster than needed */
   {
     $sleep=($target_round_time-$round_time)*1000000;
#     echo("Sleeping $sleep microseconds\n");
     usleep($sleep);     
   } 
}

?>
