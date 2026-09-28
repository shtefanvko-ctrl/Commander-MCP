# Security baseline v0.5

## Closed since v0.3

- Removed default `dev-change-me` credential.
- Replaced one shared Gateway bearer token with per-device credential records.
- Gateway stores only SHA-256 digests of high-entropy device tokens.
- Device records support `enabled:false` revocation.
- Gateway reloads the credential store and disconnects sessions whose credential was revoked or rotated.
- Gateway uses explicit host binding and a WebSocket payload cap.
- `fs.write` defaults to disabled at Gateway and Agent.
- `terminal.exec` defaults to disabled at Gateway and Agent.
- Terminal execution uses structured executable + argument arrays; no shell string execution.
- Operator executable allowlists are enforced at Gateway and Agent.
- Absolute paths and parent traversal are rejected.
- Reads canonicalize the final target.
- Existing write targets canonicalize the final target, preventing direct symlink escape.
- New write targets canonicalize and validate the parent before creation.
- Duplicate agent sessions replace the old connection.
- Pending command records expire.
- Rust regression tests cover traversal and Unix symlink escape.

## Remaining P0 before hostile / Internet-facing production use

1. Replace manual long-lived bearer-token enrollment with short-lived bootstrap credentials or mutually authenticated device keys/certificates.
2. Use WSS/TLS with server identity validation for any non-local transport.
3. Add explicit human approval objects for write/exec, not only environment switches.
4. Add OS-level sandboxing/containerization. Workspace `cwd` is not a complete process sandbox.
5. Add signed/tamper-evident audit records and durable request/result correlation.
6. Add command cancellation/streaming and CPU/memory/process ceilings.
7. Add Windows-specific symlink/reparse-point security tests and protocol fuzzing.

## Secret handling

- Never commit `config/agents.json`, plaintext device tokens, private keys or tunnel credentials.
- Store Agent plaintext token only in the device secret environment/store.
- Audit events must not include the hello token.
- Rotation replaces the stored digest and the Agent secret; the previous token must be discarded.
