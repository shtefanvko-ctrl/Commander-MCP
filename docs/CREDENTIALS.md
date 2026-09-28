# Device credentials

## Store format

Live credentials are stored outside Git as `config/agents.json` or another protected path:

```json
{
  "version": 1,
  "agents": {
    "oc-device-id": {
      "tokenSha256": "<64 hex chars>",
      "enabled": true
    }
  }
}
```

The Agent keeps the original high-entropy token in its local environment/secret store. The Gateway keeps only its SHA-256 digest.

## Enroll

1. Choose the final `OC_WORKSPACE`.
2. Generate a random token with at least 32 characters.
3. Start the Agent and copy the printed stable `agentId`.
4. Run `npm run credential:hash -- '<token>'`.
5. Add the ID + digest to the credential file.
6. Start/reload Gateway with `AGENT_CREDENTIALS_FILE`.

## Rotate

Generate a new token, update the Agent secret and replace the hash in the Gateway credential store. The Gateway reload loop notices the hash change and disconnects any session authenticated with the old token.

## Revoke

Set `enabled:false` or remove the device record. Within the credential reload interval, an existing session is closed and new authentication is rejected.

## Remaining production work

Static per-device credentials are materially stronger than one shared token, but production enrollment should ultimately use short-lived bootstrap credentials or mutually authenticated device keys/certificates rather than manually exchanged long-lived bearer tokens.
