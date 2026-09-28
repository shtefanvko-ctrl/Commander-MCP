# Security baseline v0.6

## Closed from the original v0.3 baseline

### Authentication
- No default development credential.
- Per-device credential records instead of one global token.
- Gateway stores SHA-256 token digests.
- Device revocation and rotation force existing sessions closed.
- Live credential file is excluded from Git.

### Filesystem
- Absolute paths and parent traversal rejected on Agent.
- Read targets canonicalized.
- Existing write targets canonicalized, blocking direct symlink escape.
- New write targets require a canonical in-workspace parent.
- Rust regression tests cover traversal and Unix symlink escape.

### Terminal
- Disabled by default at Gateway and Agent.
- No arbitrary shell strings.
- Structured executable + argument arrays.
- Executable name allowlist enforced by Gateway and Agent.

### Human control
- `fs.write` and `terminal.exec` require a one-time approval when enabled.
- Approval binds exact agent, method and canonical request hash.
- Approval has bounded TTL (maximum 1 hour).
- Used approval cannot be replayed.
- Modified params fail request-hash verification.
- Approval metadata is stripped before command dispatch.

## Remaining P0 for hostile / Internet-facing production use

1. WSS/TLS with explicit server identity validation.
2. Short-lived bootstrap enrollment or mutually authenticated device keys/certificates rather than long-lived bearer tokens.
3. Approval service/UI with authenticated human identity, reason, policy context and durable storage.
4. OS-level sandboxing/containerization and CPU/memory/process/network ceilings.
5. Signed/tamper-evident durable audit and correlation storage.
6. Command cancellation/streaming.
7. Windows reparse-point security regression coverage.
8. Protocol fuzzing and abuse/rate-limit tests.

## Secret and approval handling

Never commit:
- `config/agents.json`;
- `config/approvals.json`;
- plaintext agent tokens;
- private keys/tunnel credentials.

Approval files are control-plane state, not source code. Production approval state should move to a transactional store before multi-Gateway deployment.
