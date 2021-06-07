db.grantRolesToUser( "userAdmin", [ "root" ]);
db = db.getSiblingDB('tutorialkart2');
db.customers.insert({ name: "Honey1", age: 25, cars: [ "Audi R8" ] })
db.customers.insertMany(
    [
        { name: "Midhuna2", age: 23, cars: [ "BMW 320d", "Audi R8" ], place:"Amaravati" },
        { name: "Akhil2", age: 24, cars: [ "Audo A7", "Agera R" ], place:"New York" },
        { name: "Honey2", age: 25, cars: [ "Audi R8" ] }
    ]
)
printjson(db.getCollectionNames());
printjson(db.adminCommand( { listDatabases: 1 } ))
