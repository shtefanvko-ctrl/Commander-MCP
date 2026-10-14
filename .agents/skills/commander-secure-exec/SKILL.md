---
name: commander-secure-exec
description: Change Commander MCP remote execution while preserving fail-closed policy at Gateway and Agent.
version: 1.0.0
---
Map request -> auth -> policy -> approval -> transport -> Agent validation -> OS action -> audit. Do not add arbitrary shell strings. Keep program+args structured, executable allowlists enforced and high-risk capabilities off by default.
