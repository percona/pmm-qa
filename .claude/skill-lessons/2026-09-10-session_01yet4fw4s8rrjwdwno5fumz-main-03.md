# .claude/skills/qa-code-review/references/playwright-suite.md — a ported assertion's strength is set by its CodeceptJS source, for visibility as well as for text

- Added: 2026-09-10
- Applies to: target only
- Evidence: A bot finding on percona/pmm-qa#1402 asked for `filter({ visible: true })` to be dropped before `toHaveCount(0)` as too weak for absence; the author kept the filter and renamed the builder instead, because the CodeceptJS source used `dontSeeElement`, which passes on a hidden element, so dropping it would assert something stronger than the source did (https://github.com/percona/pmm-qa/pull/1402#discussion_r3980266689). The reference already states this for tightening a ported substring match into equality, but the visible-absence vs DOM-absence case fell outside that wording.
- Proposed change: Generalize the existing "tightening a ported substring match into equality is a coverage change that needs evidence" clause to any ported assertion, naming visible-absence (`dontSeeElement` ported to a `visible` filter plus a count) as the second instance, so SKILL.md check 9 has a rule to adjudicate this bot finding against rather than endorsing it.
