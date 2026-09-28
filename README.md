# Commander MCP v0.5

Self-hosted remote execution foundation with per-device authentication and default-deny write/terminal policy.

## Security baseline

- Gateway binds to `127.0.0.1` unless `GATEWAY_HOST` is explicitly changed.
- Authentication uses a **per-device credential store**. Git stores only the example file; live `config/agents.json` is ignored.
- Device tokens are never stored plaintext by the Gateway; the credential store contains SHA-256 of high-entropy 32+ character tokens.
- `enabled:false` revokes a device. Token rotation changes its hash. Gateway reloads credentials every ~15s and disconnects already-connected revoked/rotated sessions.
- WebSocket payloads are capped at 256 KiB.
- Remote writes are disabled unless both Gateway and Agent enable them.
- Terminal execution is disabled unless both sides enable it.
- Terminal uses structured `program + args`; there is no `sh -lc` / `cmd /C`.
- Executables must be present in the operator allowlist.
- Filesystem targets are canonicalized against the workspace boundary, including existing symlink targets.
- CI runs TypeScript builds, policy/auth tests, Rust tests and symlink/path regressions.

## First device enrollment

Generate a high-entropy token, for example:

```bash
openssl rand -hex 32
```

Set the same token only on the Agent. Start the Agent once with its real `OC_WORKSPACE`; it prints its stable `agentId` before connecting.

Hash the token:

```bash
npm run credential:hash -- '<token>'
```

Copy `config/agents.example.json` to the ignored `config/agents.json`, replace the example agent ID and hash, then start the Gateway:

```bash
AGENT_CREDENTIALS_FILE=./config/agents.json npm start
```

The Agent will reconnect automatically.

## High-risk capabilities

Both ends must opt in:

```bash
# Gateway
OC_ALLOW_WRITES=1
OC_ALLOW_TERMINAL=1
OC_TERMINAL_PROGRAMS=git,node,npm

# Agent
OC_ENABLE_WRITES=1
OC_ENABLE_TERMINAL=1
OC_TERMINAL_PROGRAMS=git,node,npm
```

These controls reduce exposure but are **not an OS sandbox**. Internet-facing or untrusted execution still requires WSS/TLS, OS-level isolation, approval objects and resource controls.
