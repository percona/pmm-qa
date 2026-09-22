import assert from 'node:assert/strict';
import test from 'node:test';
import { dockerBuildArgs } from '../../build.ts';
import { parseConfig, serviceRunArgs } from './setup.ts';

test('builds HAProxy and external exporter images', () => {
  assert.ok(dockerBuildArgs('haproxy').includes('pmm-qa/haproxy:latest'));
  assert.ok(dockerBuildArgs('external').includes('pmm-qa/external:latest'));
});

test('starts each service with its metrics endpoint', () => {
  const haproxy = parseConfig(['--type', 'haproxy'], {});
  assert.ok(serviceRunArgs(haproxy).some((arg) => arg.includes('haproxy -W')));
  const external = parseConfig(['--type', 'external'], {});
  assert.ok(serviceRunArgs(external).some((arg) => arg.includes('redis_exporter')));
  assert.throws(() => parseConfig(['--type', 'unknown'], {}), /type must be/);
});

test('haproxy fronts real backends over a TCP proxy when --backends is supplied', () => {
  const haproxy = parseConfig(['--type', 'haproxy', '--backends', 'pxc_pmm_1:3306,pxc_pmm_2:3306'], {});
  const command = serviceRunArgs(haproxy).at(-1) ?? '';
  assert.ok(command.includes('frontend mysql_front'));
  assert.ok(command.includes('bind *:3306'));
  assert.ok(command.includes('default_backend allservers'));
  assert.ok(command.includes('server srv1 pxc_pmm_1:3306 check'));
  assert.ok(command.includes('server srv2 pxc_pmm_2:3306 check'));
  assert.ok(command.includes('/dev/tcp/127.0.0.1/3306'));
  assert.ok(command.includes('haproxy -W'), 'still execs haproxy after writing the config');
});

test('haproxy without --backends leaves the baked stats-only config untouched', () => {
  const haproxy = parseConfig(['--type', 'haproxy'], {});
  const command = serviceRunArgs(haproxy).at(-1) ?? '';
  assert.ok(!command.includes('frontend mysql_front'));
  assert.ok(!command.includes('cat <<'));
});

test('haproxy rejects malformed backend targets', () => {
  assert.throws(
    () => parseConfig(['--type', 'haproxy', '--backends', 'pxc_pmm_1:3306\nHAPROXY_CFG'], {}),
    /invalid HAProxy backend/,
  );
  assert.throws(
    () => parseConfig(['--type', 'haproxy', '--backends', 'pxc_pmm_1:70000'], {}),
    /invalid HAProxy backend/,
  );
});
