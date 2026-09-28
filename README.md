# Commander MCP v0.6

Self-hosted remote execution foundation with per-device authentication, workspace confinement and one-time approval gates.

## Default security posture

- Gateway binds to `127.0.0.1` unless explicitly changed.
- Devices authenticate with per-device credentials; Gateway stores SHA-256 digests, not plaintext tokens.
- Credential rotation/revocation is detected by live reload and disconnects old sessions.
- WebSocket payloads are capped.
- Reads are workspace-confined and symlink-aware.
- Remote writes and terminal execution are disabled by default at **both** Gateway and Agent.
- Terminal uses structured `program + args`, never arbitrary `sh -lc` / `cmd /C`.
- Executables require an operator allowlist.
- When write/terminal capabilities are enabled, each individual command additionally requires a **one-time approval** bound to agent, method, exact canonical params and expiration time.
- Approval IDs are removed before dispatch to the Agent and are consumed atomically by the single Gateway process.
- CI builds TypeScript, tests auth/policy/approval semantics, and runs Rust traversal/symlink regressions.

## Device enrollment

Generate a high-entropy token and keep it only on the Agent:

```bash
openssl rand -hex 32
```

Start the Agent with its real `OC_WORKSPACE`; it prints the stable `agentId`.

Hash the token:

```bash
npm run credential:hash -- '<token>'
```

Copy `config/agents.example.json` to ignored `config/agents.json`, insert the device ID and digest, then:

```bash
AGENT_CREDENTIALS_FILE=./config/agents.json npm start
```

## High-risk capability enablement

Both Gateway and Agent must opt in.

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

## One-time approval

Prepare exact params, then create an approval:

```bash
OC_APPROVALS_FILE=./config/approvals.json \
npm run approval:create -- oc-device-1 fs.write '{"path":"notes.txt","content":"hello"}' 300
```

The CLI returns an `approvalId`. The control layer must attach that ID to the **same exact** request. Any changed path/content/program/args, expired approval or reused approval is rejected.

See `docs/APPROVALS.md`, `docs/CREDENTIALS.md` and `docs/SECURITY.md`.

## Remaining production boundary

v0.6 materially reduces remote-execution risk, but it is not an OS sandbox. Before hostile/Internet-facing use: WSS/TLS, signed/short-lived device enrollment, durable tamper-evident audit, process/resource sandboxing, command cancellation and a real human approval UI/API are still required.
