<?php
require 'vendor/autoload.php'; // include Composer's autoloader
/* This script is designed to generate test workload to hit certain amount of tables in certain amount of schemas
   having certain amount of unique queries */
$db=5;
$collection=50;

/* How many queries try to run per second */
$target_qps=10;

$mongodb_host="localhost";
$mongodb_user="";
$mongodb_password="";
$mongodb_port=27017;

if(getenv('TEST_DB'))
  $db=getenv('TEST_DB');
if(getenv('TEST_COLLECTION'))
  $collection=getenv('TEST_COLLECTION');
if(getenv('TEST_TARGET_QPS'))
  $target_qps=getenv('TEST_TARGET_QPS');
if(getenv('MONGODB_HOST'))
  $mongodb_host=getenv('MONGODB_HOST');
if(getenv('MONGODB_USER'))
  $mongodb_user=getenv('MONGODB_USER') . ":";
if(getenv('MONGODB_PASSWORD'))
  $mongodb_password=getenv('MONGODB_PASSWORD') . "@";
if(getenv('MONGODB_PORT'))
  $mongodb_port=getenv('MONGODB_PORT');

/* We do not want uniform distribution so skew things a bit */
function skewed_rnd($min,$max)
{
        $rounds=5;
        $r=0;
        for($i=0;$i<$rounds;$i++)
        $r+=rand($min,$max);

        return round($r/$rounds);
}

$client = new MongoDB\Client("mongodb://$mongodb_user$mongodb_password$mongodb_host:$mongodb_port", ["retryWrites" => false]);

function run_query($db,$collection)
{
        global $client;
        $collectionName = "beers" . $collection;
        $dbName = "demo" . $db;
        $collectionObj = $client->$dbName->$collectionName;
        //read
        $cursor = $collectionObj->find();
        //update
        $collectionObj->updateMany(array("a"=>"a"),
        array('$set'=>array("a"=>"a_u")));
        
        //count
        $collectionObj->count();

        //distinct
        $collectionObj->distinct("a");

        //aggregate
        $collectionObj->aggregate([array('$match' =>array("a"=>"a_u"))]);

        //findAndModify
        $collectionObj->findOneAndUpdate(array("a"=>"a_u"), array('$set'=>array("a"=>"a_m")));  
      
        //delete
        $collectionObj->deleteOne(array("a"=>"a_m"));
        //create
        $result = $collectionObj->insertOne( [ 'a' => 'a', 'b' => 'B', 'c' => $i ] );
}

echo("Running Queries...\n");

//lets create all db's and data
for($i = 1; $i <= $db; $i++)
{
        $dbName = "demo" . $i;
        for ($j = 1; $j <= $collection; $j++)
        {
                $collectionName = "beers" . $j;
                $collectionObj = $client->$dbName->$collectionName;
                $result = $collectionObj->insertOne( [ 'a' => 'a', 'b' => 'B', 'c' => $j ] );
                echo "Inserted with Object ID '{$result->getInsertedId()}'";
        }
}

/* How long we want target to take */
$target_round_time=1/$target_qps;

while(1)
{
   $start=microtime(1);
   $dbNumber=skewed_rnd(1,$db);
   $collectionNumber=skewed_rnd(1,$collection);
   run_query($dbNumber,$collectionNumber);
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
