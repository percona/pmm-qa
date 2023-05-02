rs.initiate(
  {
    _id: 'rs0',
    members: [
      { _id: 0, host: 'mo-replica-set-101-integration-0:27017', priority: 500 },
      { _id: 1, host: 'mo-replica-set-101-integration-1:27017' },
      { _id: 2, host: 'mo-replica-set-101-integration-2:27017' },
    ]
  });

sleep(40000);