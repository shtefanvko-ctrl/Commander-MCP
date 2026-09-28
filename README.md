# Commander MCP v0.4

Self-hosted remote execution foundation.

## Security baseline

v0.4 changes the default posture to deny-by-default:

- `AGENT_TOKEN` is mandatory and must be at least 32 characters.
- Gateway binds to `127.0.0.1` unless `GATEWAY_HOST` is explicitly changed.
- WebSocket payloads are capped.
- Duplicate agent sessions replace the older session.
- Remote writes are disabled unless both gateway and agent explicitly enable them.
- Terminal execution is disabled unless both sides enable it.
- Terminal uses structured `program + args`; shell strings are no longer executed with `sh -lc` / `cmd /C`.
- Executables must be in an operator allowlist.
- Existing and write-target paths are canonicalized against the workspace boundary, including final symlink targets.
- CI builds TypeScript and runs policy regression tests.

## Development

```bash
npm install
export AGENT_TOKEN='<32+ random characters>'
npm test
npm run build
npm start
```

Optional high-risk capabilities:

```bash
OC_ALLOW_WRITES=1
OC_ENABLE_WRITES=1

OC_ALLOW_TERMINAL=1
OC_ENABLE_TERMINAL=1
OC_TERMINAL_PROGRAMS=git,node,npm
```

These flags are an operator decision, not a sandbox. OS-level isolation is still required before exposing terminal execution to untrusted workloads.

## Status

Gateway/Policy v0.4 source is hardened and Policy smoke tests pass locally. Rust-agent source was hardened but still requires a Rust toolchain CI/build check before release.
