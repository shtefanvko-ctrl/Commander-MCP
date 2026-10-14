# Commander MCP Agent Kernel

- Gateway owns authorization/policy/audit; Agent owns OS execution/workspace confinement.
- Unsafe operations must fail closed at both layers where practical.
- Remote non-loopback transport requires TLS/WSS; do not disable certificate verification.
- Writes and terminal execution remain disabled by default and require one-time exact-parameter approval when enabled.
- Never commit device credentials, approval state, private keys or tunnel secrets.
- Use `.agents/skills/`; run `commander-devil-review` for auth, transport, filesystem, terminal, approvals or protocol changes.
