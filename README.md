# Commander MCP v0.7

Self-hosted remote execution foundation with per-device authentication, workspace confinement, one-time approvals and enforced secure transport.

## Default security posture

- Gateway binds to `127.0.0.1` unless explicitly changed.
- Any **non-loopback Gateway binding requires TLS** via `GATEWAY_TLS_CERT` + `GATEWAY_TLS_KEY`.
- Agent accepts `ws://` only for loopback (`127.0.0.1`, `localhost`, `::1`); all remote Gateway URLs must use `wss://`.
- Rust Agent enables rustls/webpki root validation for WSS server identity.
- Devices authenticate with per-device credentials; Gateway stores SHA-256 digests, not plaintext tokens.
- Credential rotation/revocation is detected by live reload and disconnects old sessions.
- WebSocket payloads are capped.
- Reads are workspace-confined and symlink-aware.
- Remote writes and terminal execution are disabled by default at **both** Gateway and Agent.
- Terminal uses structured `program + args`, never arbitrary `sh -lc` / `cmd /C`.
- Executables require an operator allowlist.
- Each enabled write/terminal command additionally requires a **one-time approval** bound to agent, method, exact canonical params and expiration time.
- CI builds TypeScript, tests auth/policy/approval/transport semantics, and runs Rust traversal/symlink/transport regressions.

## Local development

Loopback may use plain WebSocket:

```bash
GATEWAY_HOST=127.0.0.1
GATEWAY_URL=ws://127.0.0.1:8787
```

## Remote deployment

Remote listening must provide TLS material:

```bash
GATEWAY_HOST=0.0.0.0
GATEWAY_TLS_CERT=/secure/path/fullchain.pem
GATEWAY_TLS_KEY=/secure/path/privkey.pem
AGENT_CREDENTIALS_FILE=./config/agents.json
npm start
```

Agent:

```bash
GATEWAY_URL=wss://commander.example.com:8787
```

The Agent uses standard WebPKI validation. Do not disable certificate verification.

## High-risk capability enablement

Both Gateway and Agent must opt in and each command still needs a one-time approval.

Gateway:

```bash
OC_ALLOW_WRITES=1
OC_ALLOW_TERMINAL=1
OC_TERMINAL_PROGRAMS=git,node,npm
OC_APPROVALS_FILE=./config/approvals.json
```

Agent:

```bash
OC_ENABLE_WRITES=1
OC_ENABLE_TERMINAL=1
OC_TERMINAL_PROGRAMS=git,node,npm
```

See `docs/APPROVALS.md`, `docs/CREDENTIALS.md` and `docs/SECURITY.md`.

## Remaining production boundary

v0.7 closes the plaintext remote transport gap, but hostile/untrusted execution still requires short-lived enrollment or device keys/certificates, durable tamper-evident audit, OS sandboxing/resource ceilings, cancellation/streaming, Windows reparse-point coverage and a real authenticated approval service/UI.
