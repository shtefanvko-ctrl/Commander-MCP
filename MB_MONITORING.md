# MB-file monitoring contract

## Purpose
Monitor selected GitHub and Google Drive sources for changes that materially affect the project. Do not notify on cosmetic, formatting-only, generated, or otherwise non-actionable changes.

## A change is material when it changes at least one of these
1. Project rule, invariant, policy, or architecture constraint.
2. Approved plan, milestone order, release sequence, or priority.
3. Changelog entry that changes the understood shipped/current state.
4. Open issue state or scope: created, closed, reopened, reprioritized, blocked/unblocked, acceptance criteria changed.
5. Definition of Done or verification/evidence requirement.
6. Concrete next step, owner/action dependency, deployment target, or required gate.
7. Baseline/reference state used to compare future changes, including release/tag/SHA/staging state.

## Not material by default
- formatting, spelling, comments, or documentation wording that does not change a rule or action;
- directory-only or generated-file churn;
- refactors with no behavior/contract/verification impact;
- duplicated information already represented by the current baseline;
- status noise that creates no new action.

## Baseline rule
The baseline is the most recently verified project state, not merely the newest commit. Track separately: desired state; implemented state; verified state; deployed state.

When these differ, the monitoring baseline must state the exact repository/ref or SHA and, when relevant, the deployed/staging release being verified. A newer commit does not automatically replace the verified/deployed baseline.

## Conflict priority
When signals disagree, resolve them in this order:
1. Explicit project rule / architecture invariant / approved user decision.
2. Definition of Done and required verification gates.
3. Verified runtime or test evidence for the exact SHA/release.
4. Deployed/staging state for the exact SHA/release.
5. Approved plan / current-plan document.
6. Issue/PR description and labels.
7. Commit message or changelog text.

Do not mark work DONE from a PR description, commit message, green local test, or deployed-looking UI alone when the required DoD evidence is missing.

## Required notification format
Notify only for a material change, and always include:
- **What changed** — exact repo/source, issue/PR/file/ref/SHA when available.
- **Why it matters** — which rule, plan, changelog, issue, DoD, baseline, or next step changed.
- **Concrete action created** — the next executable action, including required gate/evidence/dependency.

If no material change exists, remain silent unless an explicit check/status report was requested.

## Ambiguous cases
Treat a change as material when it can alter sequence, acceptance criteria, release/deployment eligibility, security posture, data/schema compatibility, or regression risk. If it only changes presentation without changing any decision or action, treat it as non-material.
