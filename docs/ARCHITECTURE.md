# Architecture v0.3

LLM/MCP (v0.4 target) -> Gateway -> Policy Engine -> WSS -> Rust Agent -> workspace capabilities.

Gateway owns authorization/policy/audit. Agent owns OS execution and workspace confinement. Both layers reject unsafe operations independently where practical.
