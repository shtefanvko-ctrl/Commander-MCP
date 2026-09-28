# One-time approval contract

High-risk Commander methods require explicit operator authorization in addition to capability enablement.

## Covered methods

- `fs.write`
- `terminal.exec`

Read-only methods do not require an approval.

## Binding

An approval record contains:

- approval ID;
- agent ID;
- method;
- SHA-256 of canonical `{agentId, method, params}`;
- expiration timestamp;
- used timestamp.

`approvalId` itself is excluded from the request hash.

Object keys are canonicalized before hashing, so equivalent JSON key ordering produces the same digest while any changed value produces a different digest.

## One-time semantics

Gateway consumes the approval before sending the command. The local approval ledger is rewritten atomically and the record receives `usedAt`.

A replay fails even if all command parameters are identical.

## TTL

The helper accepts 1–3600 seconds. Short TTLs are recommended.

## Current limitation

The approval ledger is file-backed and designed for one Gateway process. A production multi-instance Gateway needs a transactional approval service with compare-and-set consumption, authenticated approver identity, reason/policy metadata and durable audit linkage.
