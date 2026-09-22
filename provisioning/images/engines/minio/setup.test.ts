import assert from 'node:assert/strict';
import test from 'node:test';
import { dockerBuildArgs } from '../../build.ts';
import { parseConfig } from './setup.ts';

test('builds MinIO and parses buckets', () => {
  assert.ok(dockerBuildArgs('bucket').includes('pmm-qa/bucket:latest'));
  assert.deepEqual(parseConfig(['--buckets', 'bcp;archive']).buckets, ['bcp', 'archive']);
  // pmm-framework's BUCKET_NAMES accepted either separator, quoted or upper-cased.
  assert.deepEqual(parseConfig(['--buckets', '"BCP,Archive"']).buckets, ['bcp', 'archive']);
  assert.throws(() => parseConfig(['--buckets', '../bad']), /valid S3 bucket/);
});
