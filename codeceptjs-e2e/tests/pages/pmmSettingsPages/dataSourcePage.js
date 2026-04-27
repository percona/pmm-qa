module.exports = {
  url: 'graph/datasources',
  elements: {
    clickHouseDatasource: locate('h2').withText('ClickHouse'),
  },
  fields: {
    clickhouseServerAddress: locate('[aria-label="Server address"]'),
    clickhouseServerPort: locate('[aria-label="Server port"]'),
  },
};
