<?php

/* This script is designed to generate test workload to hit certain amount of tables in certain amount of schemas 
   having certain amount of unique queries */
$schemas=10;
$tables=100;
$queries=10;

/* How many queries try to run per second */
$target_qps=100;

$pgsql_host="localhost";
$pgsql_user="postgres";
$pgsql_password="";
$pgsql_port=5432;


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
  global $pgsql_port,$pgsql_host,$pgsql_user, $pgsql_password;
  try {
    $runQuery = new PDO("pgsql:host=$pgsql_host;port=$pgsql_port;dbname=db$schema", $pgsql_user, $pgsql_password);
  }
  catch (PDOException $e) {
    print "Error!: " . $e->getMessage() . "<br/>";
    die();
  }
  $runQuery->exec("select id, v as col$query from tbl$table");
  $runQuery->exec("insert into tbl$table values(2,'value')");
  $runQuery->exec("update tbl$table set v='new value' where id=2");
  $runQuery->exec("delete from tbl$table where id=2 and v='new value'");
  $runQuery=null;
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
if(getenv('PGSQL_HOST'))
  $pgsql_host=getenv('PGSQL_HOST');
if(getenv('PGSQL_USER'))
  $pgsql_user=getenv('PGSQL_USER');
if(getenv('PGSQL_PASSWORD'))
  $pgsql_password=getenv('PGSQL_PASSWORD');
if(getenv('PGSQL_PORT'))
  $pgsql_port=getenv('PGSQL_PORT');
if(getenv('PGSQL_DATABASE'))
  $pgsql_db=getenv('PGSQL_DATABASE');


echo("Schemas:  $schemas,  Tables: $tables,  Queries: $queries   Target Queries Per Second: $target_qps\n");

try {
    $link = new PDO("pgsql:host=$pgsql_host;port=$pgsql_port;dbname=postgres", $pgsql_user, $pgsql_password);
    if($link){
      echo "Connected to the postgres database successfully! \n";
    }
} catch (PDOException $e) {
    print "Error!: " . $e->getMessage() . "<br/>";
    die();
}

/* Create all the schemas  */
for($i = 1;$i <= $schemas;$i++)
{
  /* We strategically ignore error here assuming it would be database already exists */
  $link->exec("create database db$i");
  $link->exec("create EXTENSION pg_stat_monitor");
  echo("Initializing Database db$i\n");
  try {
    $initializeConnection = new PDO("pgsql:host=$pgsql_host;port=$pgsql_port;dbname=db$i", $pgsql_user, $pgsql_password);
  } catch (PDOException $e) {
    print "Error!: " . $e->getMessage() . "<br/>";
    die();
  }
  for ($j=1;$j<=$tables;$j++)
  {    
    $initializeConnection->exec("create table tbl$j(id serial not null primary key, v varchar(20) not null)"); 
    $initializeConnection->exec("insert into tbl$j values(1,'value')");
  }
  $initializeConnection=null;
}
$link=null;

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
