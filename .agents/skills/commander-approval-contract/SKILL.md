---
name: commander-approval-contract
description: Change or audit one-time approvals for fs.write and terminal.exec.
version: 1.0.0
---
Approval must bind authenticated human/operator context, agent id, method, canonical exact params/request hash, bounded expiry and single use. Modified params or replay must fail. Strip approval metadata before dispatch. Never downgrade to a generic yes/no token.
