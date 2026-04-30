# WIP - PMM-QA Framework Documentation
Sets up all types of dbs base one or with replication sets.

Available flags:
-
- ```--database``` Sets up selected DB available options:
  - ```ps``` - Sets up Percona server, example: ```--database ps=8.4,SETUP_TYPE=gr,QUERY_SOURCE=perfschema```
    - parameters:
      - SETUP_TYPE:
        - gr - Group replication
      - QUERY_SOURCE - The Performance Schema provides detailed, real-time metrics on various server 
        performance aspects, while the Slow Query Log records queries that exceed a defined execution 
        time threshold, helping to identify inefficient queries.
        - perfschema
        - slowlog
      - COUNT - Count of percona server dbs created.
    - Available versions: ```8.4```, ```8.0```, ```5.7```