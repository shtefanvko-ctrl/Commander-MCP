# Security baseline v0.7

## Closed from the original v0.3 baseline

### Authentication
- No default development credential.
- Per-device credential records instead of one global token.
- Gateway stores SHA-256 token digests.
- Device revocation and rotation force existing sessions closed.
- Live credential file is excluded from Git.

### Transport
- Loopback may use `ws://`.
- Non-loopback Gateway binding is rejected unless both TLS certificate and key are configured.
- Remote Agent URLs using `ws://` are rejected.
- WSS Agent transport is compiled with rustls + WebPKI root validation.

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
- Approval has bounded TTL.
- Used approval cannot be replayed.
- Modified params fail request-hash verification.
- Approval metadata is stripped before command dispatch.

## Remaining P0 for hostile / Internet-facing production use

1. Short-lived bootstrap enrollment or mutually authenticated device keys/certificates rather than long-lived bearer tokens.
2. Approval service/UI with authenticated human identity, reason, policy context and durable storage.
3. OS-level sandboxing/containerization and CPU/memory/process/network ceilings.
4. Signed/tamper-evident durable audit and correlation storage.
5. Command cancellation/streaming.
6. Windows reparse-point security regression coverage.
7. Protocol fuzzing and abuse/rate-limit tests.

## Secret and approval handling

Never commit:
- `config/agents.json`;
- `config/approvals.json`;
- plaintext agent tokens;
- private keys/tunnel credentials.

Production TLS private keys and approval state must remain outside Git.
