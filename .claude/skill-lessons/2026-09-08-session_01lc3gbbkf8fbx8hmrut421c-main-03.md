# CLAUDE.md — re-read a copied comment against the file it lands in

- Added: 2026-09-08
- Applies to: all agents and routines (House style)
- Evidence: A block of workflow code was applied to three files with one identical explanatory comment; the comment's justification ("a job that dies here takes the databases it holds open with it") was true only in the setup-shard file and plainly false in the two test-execution runners, which hold no databases and are not shards. Review flagged it, and the same false sentence was then carried into the rewritten comment and had to be flagged a second time.
- Proposed change: Add a House style rule that when the same code or comment is applied to more than one file, each copy's comment must be re-read against that file's actual role and edited or dropped where its justification does not hold — and that a comment rewritten in response to review is re-checked for the same defect rather than reworded around it.
