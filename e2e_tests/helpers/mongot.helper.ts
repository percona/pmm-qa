import CliHelper from '@helpers/cli.helper';

const rootUri = 'mongodb://root:root@127.0.0.1:27017/admin';
const loadPidFile = '/tmp/pmm-qa-search-load.pid';
const vectorSearch =
  "[{ $vectorSearch: { index: 'vector_index', path: 'embedding', queryVector: [1, 0, 0], numCandidates: 4, limit: 2 } }]";
// A mongot that served no $vectorSearch shows No data in HNSW Nodes Visited per Query, so one query reads
// from a secondary.
const searchLoad = [
  "const movies = db.getSiblingDB('search').movies;",
  "const secondary = new Mongo('mongodb://root:root@rs101:27017,rs102:27017,rs103:27017/admin?replicaSet=rs&readPreference=secondary')",
  "  .getDB('search').movies;",
  'const end = Date.now() + 3600000;',
  'while (Date.now() < end) {',
  "  try { movies.aggregate([{ $search: { index: 'default', text: { query: 'space', path: 'plot' } } }]).toArray();",
  `    movies.aggregate(${vectorSearch}).toArray(); } catch (e) { print(e); }`,
  `  try { secondary.aggregate(${vectorSearch}, { maxTimeMS: 2000 }).toArray(); } catch (e) { print(e); }`,
  '  sleep(1000);',
  '}',
].join(' ');

export default class MongotHelper {
  constructor(private readonly cliHelper: CliHelper) {}

  getSearchIndexes = () =>
    JSON.parse(
      this.cliHelper
        .execute(
          `docker exec rs101 mongo --quiet ${rootUri} --eval 'print(JSON.stringify(db.getSiblingDB("search").movies.getSearchIndexes().map((i) => ({ id: i.id, name: i.name }))))'`,
        )
        .assertSuccess()
        .stdout.trim(),
    ) as { id: string; name: string }[];

  /** -1 while the load is not running. */
  searchLoadSeconds = () => {
    const ps = this.cliHelper.execSilent(
      `docker exec rs101 sh -c 'ps -o etimes= -p "$(cat ${loadPidFile})"'`,
    );

    return ps.code === 0 ? Number(ps.stdout.trim()) : -1;
  };

  startSearchLoad = () => {
    if (this.searchLoadSeconds() >= 0) return;

    const script = Buffer.from(searchLoad).toString('base64');

    this.cliHelper
      .execute(
        `docker exec -d rs101 sh -c 'echo $$ > ${loadPidFile} && exec mongo --quiet ${rootUri} --eval "$(echo ${script} | base64 -d)"'`,
      )
      .assertSuccess();
  };
}
