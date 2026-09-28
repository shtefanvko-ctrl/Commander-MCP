# Security baseline v0.3

Current baseline:
- Agent initiates the outbound WebSocket connection.
- Gateway checks advertised device capabilities before dispatch.
- Policy Engine classifies read/write/exec and denies baseline destructive/privileged command patterns.
- Runtime audit is append-only NDJSON.
- Heartbeat removes stale connections.
- File payload limit: 1 MiB.
- Command timeout: 30 seconds.

## P0 before remote production use

The current implementation is development-only.

1. Shared `AGENT_TOKEN` must become enrollment + per-device credentials with rotation/revocation.
2. Gateway network binding and TLS termination must be explicit.
3. File writes must resolve/canonicalize the final target, not only the parent, to close symlink escapes.
4. Shell execution cannot be secured by a regex denylist. Use typed commands/allowlists or explicit approval with sandboxing.
5. A workspace `cwd` does not confine shell filesystem access; OS-level sandboxing is required for a real boundary.
6. Approval, durable request IDs, streaming/cancel, rate limits and audit integrity are required.
