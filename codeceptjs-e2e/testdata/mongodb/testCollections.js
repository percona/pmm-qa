const dbObject = { name: 'Honey1', age: 25, cars: ['Audi R8'] };

const dbArray = [
  {
    name: 'Midhuna2', age: 23, cars: ['BMW 320d', 'Audi R8'], place: 'Amaravati',
  },
  {
    name: 'Akhil2', age: 24, cars: ['Audo A7', 'Agera R'], place: 'New York',
  },
  { name: 'Honey2', age: 25, cars: ['Audi R8'] },
];

for (let i = 1; i <= 5; i++) {
  db = db.getSiblingDB(`testingCollections${i}`);
  db.customers.insert(dbObject);
  db.customers.insertMany(dbArray);
  db.products.insert(dbObject);
  db.products.insertMany(dbArray);
  db.users.insert(dbObject);
  db.users.insertMany(dbArray);
}
