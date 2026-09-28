# Commander MCP v0.3

Self-hosted remote execution foundation.

## Included

- TypeScript WebSocket Gateway
- Rust outbound-only Agent
- shared protocol package
- capability-aware Policy Engine
- workspace-confined file operations
- terminal execution with timeout
- heartbeat + stale-agent eviction
- NDJSON audit log

## Development

```bash
npm install
npm run build
AGENT_TOKEN=change-me npm start
```

Agent environment: `GATEWAY_URL`, `AGENT_TOKEN`, `OC_WORKSPACE`.

## Security status

**Not production-ready.**

P0:
- replace the shared agent token with enrollment + per-device credentials;
- bind/terminate transport explicitly and use TLS for remote deployment;
- canonicalize the final write target to prevent symlink escape;
- replace terminal regex denylisting with an allow/approval execution contract;
- add explicit approval for write/exec/destructive/privileged actions;
- add command streaming/cancel and durable request/result correlation.

The repository preserves v0.3 as a development baseline, not as a hardened remote-admin product.
