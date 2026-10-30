#!/usr/bin/env python3
"""Builds migration.json for the gh-pages Migration tab.

  python3 migration/dashboard/build.py --main <pmm-qa main checkout> --out migration/dashboard/migration.json
      [--tracker migration/tracker.md] [--jenkins <jenkins-pipelines checkout>] [--pw-list]

Sources: the tracker on this branch; the GitHub workflows the nightly suites run, from --main;
the nightly orchestrator's lanes and the jobs they call, from --jenkins (else fetched from GitHub).
--pw-list counts Playwright tests per expression with `npx playwright test --list` in
<main>/e2e_tests, which needs its node_modules; without it the Playwright counts are omitted.
The gh-pages page reads migration/dashboard/migration.json from this branch, so committing a
rebuilt file here is the whole refresh.
"""
import argparse
import datetime
import glob
import json
import os
import re
import subprocess
import urllib.request

import yaml

JENKINS_RAW = 'https://raw.githubusercontent.com/Percona-Lab/jenkins-pipelines/master/pmm/v3/'
GITHUB_SUITE = ['e2e-tests-matrix.yml', 'fb-e2e-suite.yml', 'gssapi-psmdb-tests-matrix.yml',
                'PMM_PDPGSQL.yaml', 'PMM_PROXYSQL.yaml']
GITHUB_GROUP = {'e2e-tests-matrix.yml': 'E2E Tests', 'fb-e2e-suite.yml': 'E2E Tests (FB suite)',
                'gssapi-psmdb-tests-matrix.yml': 'GSSAPI', 'PMM_PDPGSQL.yaml': 'Integrations',
                'PMM_PROXYSQL.yaml': 'Integrations'}
SCENARIO = re.compile(r'''(x?Scenario(?:\.skip|\.only)?)\(\s*(['"`])((?:\\.|(?!\2).)*)\2''', re.DOTALL)


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def git(path, *args):
    return subprocess.run(['git', '-C', path, *args], capture_output=True, text=True, check=False).stdout.strip()


def tracker_rows(path):
    rows = []
    for line in read(path).splitlines():
        if not re.match(r'^\| \d+ +\|', line):
            continue
        c = [x.strip() for x in line.rstrip('\n').split('|')[1:-1]]
        notes = c[10] if len(c) > 10 else ''
        prs = sorted({int(n) for n in re.findall(r'(?:pull/|PR #|#)(\d{3,5})\b', notes)})
        rows.append({
            'row': int(c[0]), 'status': c[1], 'bucket': c[2], 'env': c[3], 'setup': c[4].strip('`'),
            'source': c[5].strip('`'), 'target': c[6].strip('`'), 'tags': c[7].split(),
            'date': c[9], 'notes': notes[:300], 'prs': prs,
        })
    return rows


def codecept_tests(main):
    tests = []
    for path in sorted(glob.glob(f'{main}/codeceptjs-e2e/tests/**/*_test.js', recursive=True)):
        code = '\n'.join(line for line in read(path).splitlines() if not line.lstrip().startswith('//'))
        feature = re.search(r'''Feature\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*\)((?:\s*\.tag\([^)]*\))*)''', code, re.DOTALL)
        prefix = ''
        if feature:
            prefix = feature.group(2) + ' ' + ' '.join(re.findall(r'''\.tag\(\s*['"]([^'"]+)''', feature.group(3)))
        rel = os.path.relpath(path, main)
        for m in SCENARIO.finditer(code):
            skipped = m.group(1) != 'Scenario' and m.group(1) != 'Scenario.only'
            tests.append({'file': rel, 'title': f'{prefix}: {m.group(3)}', 'skipped': skipped})
    return tests


def workflow_jobs(main):
    jobs = []
    for wf in GITHUB_SUITE:
        path = f'{main}/.github/workflows/{wf}'
        if not os.path.exists(path):
            continue
        text = read(path)
        for key, job in ((yaml.safe_load(text) or {}).get('jobs') or {}).items():
            w = job.get('with') or {}
            uses = str(job.get('uses', ''))
            name = str(job.get('name', key))
            for fw in ('playwright', 'codeceptjs'):
                if f'runner-e2e-tests-{fw}' in uses:
                    expr = w.get('pmm_test_flag') or w.get('tags_for_tests')
                    if expr and '${{' not in str(expr):
                        jobs.append({'group': GITHUB_GROUP[wf], 'name': name, 'where': f'{wf}:{key}',
                                     'framework': fw, 'expr': str(expr), 'setup': w.get('setup_services', '')})
            matrix = (job.get('strategy') or {}).get('matrix')
            for e in (matrix.get('include') or []) if isinstance(matrix, dict) else []:
                if isinstance(e, dict) and e.get('tests_framework') in ('playwright', 'codeceptjs') and e.get('tags_for_tests'):
                    jobs.append({'group': GITHUB_GROUP[wf], 'name': f"{name} / {e.get('shard_name') or e['tags_for_tests']}",
                                 'where': f'{wf}:{key}', 'framework': e['tests_framework'],
                                 'expr': e['tags_for_tests'], 'setup': e.get('setup_services', '')})
        for f in re.findall(r'codeceptjs run[^\n]*?(tests/\S+_test\.js)', text):
            jobs.append({'group': GITHUB_GROUP[wf], 'name': f'{wf.split(".")[0]} / {os.path.basename(f)}',
                         'where': wf, 'framework': 'codeceptjs', 'file': f'codeceptjs-e2e/{f}', 'setup': ''})
    suite = yaml.safe_load(read(f'{main}/.github/workflows/nightly-test-suite.yml'))
    for key, job in (suite.get('jobs') or {}).items():
        wf = os.path.basename(str(job.get('uses', '')))
        if not wf or wf in GITHUB_SUITE or 'version-getter' in wf or not os.path.exists(f'{main}/.github/workflows/{wf}'):
            continue
        body = read(f'{main}/.github/workflows/{wf}')
        fw = 'codeceptjs' if 'codeceptjs run' in body else 'playwright' if 'playwright test' in body else 'other'
        jobs.append({'group': 'Other nightly suites', 'name': re.sub(r'\$\{\{[^}]*\}\}', '<GA client>', str(job.get('name', key))), 'where': wf,
                     'framework': fw, 'expr': '', 'setup': ''})
    nightly = yaml.safe_load(read(f'{main}/.github/workflows/nightly-e2e-tests-matrix.yml'))
    shards = [e for j in nightly['jobs'].values()
              for e in (((j.get('strategy') or {}).get('matrix') or {}).get('include') or []) if isinstance(e, dict)]
    return jobs, shards


def jenkins_file(jenkins, name):
    if jenkins:
        path = f'{jenkins}/pmm/v3/{name}'
        return read(path) if os.path.exists(path) else ''
    try:
        with urllib.request.urlopen(JENKINS_RAW + name, timeout=30) as r:
            return r.read().decode()
    except OSError:
        return ''


def jenkins_lanes(jenkins, shards):
    orch = jenkins_file(jenkins, 'pmm3-nightly-orchestrator.groovy')
    nightly_expr = '|'.join(sorted({t for e in shards for t in str(e.get('tags_for_tests') or '').split('|') if t}))
    lanes = []
    for name in re.findall(r"branches\['([^']+)'\] = nightlyGha\(", orch):
        lanes.append({'group': 'Nightly', 'name': name, 'job': 'pmm3-ui-tests-nightly-gha',
                      'framework': 'playwright', 'expr': nightly_expr,
                      'note': 'dispatches nightly-e2e-tests-matrix.yml'})
    if 'compat / client' in orch:
        lanes.append({'group': 'Nightly Compatibility', 'name': 'compat / client <last 5 GA>',
                      'job': 'pmm3-ui-tests-nightly-gha', 'framework': 'playwright', 'expr': nightly_expr,
                      'note': 'one lane per GA client, nightly-e2e-tests-matrix.yml'})
    ui = re.search(r"\[(\['@[^\]]*\](?:,\s*\['@[^\]]*\])*)\]\.each", orch)
    for tag in re.findall(r"\['(@[^']+)'", ui.group(1) if ui else ''):
        lanes.append({'group': 'UI', 'name': f'ui / {tag}', 'job': 'pmm3-ui-tests', 'framework': 'mixed',
                      'expr': tag, 'note': 'runs CodeceptJS and Playwright with the same grep'})
    others = [('HA, OpenShift & GSSAPI', 'nightly / gssapi', 'pmm3-ui-tests-nightly-gssapi'),
              ('HA, OpenShift & GSSAPI', 'openshift', 'openshift-helm-tests'),
              ('HA, OpenShift & GSSAPI', 'ha', 'pmm3-ha-tests'),
              ('HA, OpenShift & GSSAPI', 'ha backup-restore', 'pmm3-ha-backup-restore-tests'),
              ('Upgrade AMI', 'upgrade / ami <last 5 GA>', 'pmm3-upgrade-ami-test-runner')]
    for group, name, job in others:
        if f"'{job}'" not in orch:
            continue
        src = jenkins_file(jenkins, f'{job}.groovy')
        cc = bool(re.search(r'codeceptjs run', src))
        pw = bool(re.search(r'playwright test', src))
        expr = re.search(r'''playwright test[^\n]*--grep[= ]["']?(@[\w-]+)''', src)
        lanes.append({'group': group, 'name': name, 'job': job,
                      'framework': 'mixed' if cc and pw else 'codeceptjs' if cc else 'playwright' if pw else 'other',
                      'expr': expr.group(1) if expr else '', 'note': '' if src else 'pipeline file not in pmm/v3'})
    return lanes, git(jenkins, 'rev-parse', '--short', 'HEAD') if jenkins else 'master'


def pw_counts(main, exprs):
    counts = {}
    for expr in sorted(exprs):
        out = subprocess.run(['npx', 'playwright', 'test', '--list', '--grep', expr], cwd=f'{main}/e2e_tests',
                             capture_output=True, text=True, check=False, env={**os.environ, 'CI': ''}).stdout
        counts[expr] = sum(1 for line in out.splitlines() if '›' in line)
    return counts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--main', required=True)
    ap.add_argument('--tracker', default=os.path.join(os.path.dirname(__file__), '..', 'tracker.md'))
    ap.add_argument('--jenkins')
    ap.add_argument('--out', required=True)
    ap.add_argument('--pw-list', action='store_true')
    a = ap.parse_args()

    rows = tracker_rows(a.tracker)
    by_source = {r['source']: r for r in rows}
    tests = codecept_tests(a.main)
    gh_jobs, shards = workflow_jobs(a.main)
    lanes, jenkins_sha = jenkins_lanes(a.jenkins, shards)

    def codecept_match(job):
        if job.get('file'):
            hits = [t for t in tests if t['file'] == job['file'] and not t['skipped']]
        else:
            try:
                rx = re.compile(job['expr'])
            except re.error:
                return [], []
            hits = [t for t in tests if not t['skipped'] and rx.search(t['title'])]
        files = sorted({t['file'] for t in hits})
        return hits, [{'file': f, 'row': by_source.get(f, {}).get('row'), 'status': by_source.get(f, {}).get('status'),
                       'tests': sum(1 for t in hits if t['file'] == f)} for f in files]

    jobs = []
    for j in [dict(j, surface='github') for j in gh_jobs] + [dict(lane, surface='jenkins') for lane in lanes]:
        if j['framework'] in ('codeceptjs', 'mixed'):
            hits, files = codecept_match(j)
            j['codecept_tests'], j['codecept_files'] = len(hits), files
        jobs.append(j)

    merged = {}
    for j in jobs:
        key = (j['surface'], j['group'], j['name'], j.get('expr', ''))
        if key in merged and merged[key]['framework'] != j['framework']:
            m = merged[key]
            m['framework'] = 'mixed'
            m['where'] = ', '.join(sorted({m['where'], j['where']}))
            for k in ('codecept_tests', 'codecept_files'):
                if k in j:
                    m[k] = j[k]
        else:
            merged.setdefault(key, j)
    jobs = list(merged.values())

    if a.pw_list:
        counts = pw_counts(a.main, {j['expr'] for j in jobs if j['framework'] in ('playwright', 'mixed') and j.get('expr')})
        for j in jobs:
            if j['framework'] in ('playwright', 'mixed') and j.get('expr') in counts:
                j['playwright_tests'] = counts[j['expr']]

    remaining = [t for t in tests if not t['skipped']]
    out = {
        'generated_at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'sources': {'main': git(a.main, 'rev-parse', '--short', 'HEAD'),
                    'tracker': git(os.path.dirname(os.path.abspath(a.tracker)), 'rev-parse', '--short', 'HEAD'),
                    'jenkins': jenkins_sha},
        'codecept_remaining': {'tests': len(remaining), 'files': len({t['file'] for t in remaining}),
                               'retired_files': len(glob.glob(f'{a.main}/codeceptjs-e2e/tests/**/*_migrated.js', recursive=True))},
        'rows': rows,
        'jobs': jobs,
    }
    with open(a.out, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'), ensure_ascii=False)
    print(f"{a.out}: {len(rows)} rows, {len(jobs)} jobs, {len(remaining)} CodeceptJS tests left")


if __name__ == '__main__':
    main()
