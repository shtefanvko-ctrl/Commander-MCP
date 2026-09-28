# Security baseline v0.4

## Closed from v0.3

- Removed default `dev-change-me` credential.
- Added constant-time token comparison in Gateway.
- Gateway now has explicit host binding and payload cap.
- `fs.write` defaults to disabled at both Gateway and Agent.
- `terminal.exec` defaults to disabled at both Gateway and Agent.
- Terminal commands are structured executable + argument arrays; no shell string execution.
- Operator executable allowlist is enforced by Gateway and Agent.
- File reads canonicalize the final target.
- Existing write targets canonicalize the final target, closing the direct symlink escape.
- New write targets canonicalize and validate their parent before creation.
- Path traversal and absolute paths are rejected on the Agent.
- Duplicate agent sessions are replaced and stale pending commands are expired.

## Still P0 before hostile / Internet-facing production use

1. Replace shared bearer token with enrollment and per-device credentials, rotation and revocation.
2. Use WSS/TLS with server identity validation for non-local transport.
3. Add explicit human approval objects for write/exec, not only environment switches.
4. Add OS-level sandboxing/containerization. Workspace `cwd` is not a complete process sandbox.
5. Add signed/tamper-evident audit records and durable correlation storage.
6. Add command cancellation/streaming and resource ceilings.
7. Add Rust CI, symlink regression tests on Windows/Linux, and protocol fuzzing.
