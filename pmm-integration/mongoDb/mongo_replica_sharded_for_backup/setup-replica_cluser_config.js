rs.initiate(
  {
    _id: 'rsConfig',
    members: [
      { _id: 0, host: 'mo-replica-set-configuration-integration-0:27017', priority: 500 },
      { _id: 1, host: 'mo-replica-set-configuration-integration-1:27017' },
      { _id: 2, host: 'mo-replica-set-configuration-integration-2:27017' },
    ],
  },
);

sleep(40000);