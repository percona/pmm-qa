rs.initiate(
    {
        _id: 'rs1',
        members: [
            { _id: 0, host: 'mo-replica-set-201-integration-0:27017', priority: 500 },
            { _id: 1, host: 'mo-replica-set-201-integration-1:27017' },
            { _id: 2, host: 'mo-replica-set-201-integration-2:27017' },
        ]
    });

sleep(40000);

