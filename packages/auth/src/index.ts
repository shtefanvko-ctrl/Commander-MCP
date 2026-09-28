import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export type AgentCredentialRecord={tokenSha256:string;enabled?:boolean};
export type AgentCredentialStore={version:1;agents:Record<string,AgentCredentialRecord>};

const ID=/^[A-Za-z0-9._-]{3,128}$/;
const HEX64=/^[a-f0-9]{64}$/i;

export function tokenSha256(token:string){
  return createHash('sha256').update(token,'utf8').digest('hex');
}

export function validateCredentialStore(value:unknown):AgentCredentialStore{
  if(!value||typeof value!=='object')throw new Error('credential store must be an object');
  const raw=value as {version?:unknown;agents?:unknown};
  if(raw.version!==1||!raw.agents||typeof raw.agents!=='object')throw new Error('credential store version/agents invalid');
  for(const [agentId,record] of Object.entries(raw.agents as Record<string,unknown>)){
    if(!ID.test(agentId))throw new Error(`invalid agent id in credential store: ${agentId}`);
    if(!record||typeof record!=='object')throw new Error(`invalid credential record: ${agentId}`);
    const hash=String((record as AgentCredentialRecord).tokenSha256||'');
    if(!HEX64.test(hash))throw new Error(`invalid tokenSha256 for agent: ${agentId}`);
  }
  return raw as AgentCredentialStore;
}

export async function loadCredentialStore(file:string){
  return validateCredentialStore(JSON.parse(await readFile(file,'utf8')));
}

export function verifyAgentToken(store:AgentCredentialStore,agentId:string,token:string){
  if(!ID.test(agentId)||token.length<32)return false;
  const record=store.agents[agentId];
  if(!record||record.enabled===false)return false;
  const actual=Buffer.from(tokenSha256(token),'hex');
  const expected=Buffer.from(record.tokenSha256,'hex');
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
