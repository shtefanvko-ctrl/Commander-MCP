import { WebSocketServer, WebSocket } from 'ws';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PROTOCOL_VERSION, type AgentMessage, type GatewayMessage, type Capability } from '@oc/protocol';
import { decide, type PolicyConfig } from '@oc/policy';
import { loadCredentialStore, tokenSha256, verifyAgentToken, type AgentCredentialStore } from '@oc/auth';
import { commandParams, consumeApproval } from '@oc/approvals';
import { resolveGatewayTransport } from '@oc/transport';

const host=process.env.GATEWAY_HOST??'127.0.0.1';
const port=Number(process.env.PORT??8787);
const transport=resolveGatewayTransport({host,certFile:process.env.GATEWAY_TLS_CERT,keyFile:process.env.GATEWAY_TLS_KEY});
const credentialFile=process.env.AGENT_CREDENTIALS_FILE??'';
if(!credentialFile)throw new Error('AGENT_CREDENTIALS_FILE is required');
let credentials:AgentCredentialStore=await loadCredentialStore(credentialFile);
const auditFile=process.env.AUDIT_FILE??'./data/audit.ndjson';
const policy:PolicyConfig={allowWrites:process.env.OC_ALLOW_WRITES==='1',allowTerminal:process.env.OC_ALLOW_TERMINAL==='1',terminalPrograms:(process.env.OC_TERMINAL_PROGRAMS??'').split(',').map(x=>x.trim()).filter(Boolean)};
const approvalFile=process.env.OC_APPROVALS_FILE??'';
if((policy.allowWrites||policy.allowTerminal)&&!approvalFile)throw new Error('OC_APPROVALS_FILE is required when write or terminal capabilities are enabled');

const tlsServer=transport.tls?https.createServer({cert:readFileSync(transport.certFile!,'utf8'),key:readFileSync(transport.keyFile!,'utf8')}):null;
const wss=transport.tls?new WebSocketServer({server:tlsServer!,maxPayload:256*1024}):new WebSocketServer({host,port,maxPayload:256*1024});
if(tlsServer)tlsServer.listen(port,host);

const agents=new Map<string,{ws:WebSocket;capabilities:Capability[];lastSeen:number;sessionId:string;credentialHash:string}>();
const pending=new Map<string,{agentId:string;method:Capability;started:number}>();
async function audit(event:Record<string,unknown>){await mkdir(dirname(auditFile),{recursive:true});await appendFile(auditFile,JSON.stringify({ts:new Date().toISOString(),...event})+'\n').catch(console.error)}
async function refreshCredentials(){try{const next=await loadCredentialStore(credentialFile);credentials=next;for(const [agentId,agent] of agents){const record=next.agents[agentId];if(!record||record.enabled===false||record.tokenSha256.toLowerCase()!==agent.credentialHash){agent.ws.close(1008,'credential revoked or rotated');agents.delete(agentId);void audit({event:'agent.credential_revoked',agentId})}}}catch(error){void audit({event:'credential.reload_failed',error:String(error)})}}
function sendCommand(agentId:string,method:Capability,params:Record<string,unknown>={}){const a=agents.get(agentId);if(!a)throw new Error('agent offline');const d=decide(method,params,a.capabilities,policy);void audit({event:'policy',agentId,method,allow:d.allow,risk:d.risk,reason:d.reason});if(!d.allow)throw new Error(d.reason);let dispatchParams=params;if(method==='fs.write'||method==='terminal.exec'){const approvalId=String(params.approvalId??'');if(!approvalId)throw new Error('one-time approvalId is required for high-risk command');consumeApproval(approvalFile,{approvalId,agentId,method,params});dispatchParams=commandParams(params);void audit({event:'approval.consumed',approvalId,agentId,method})}const id=randomUUID();const msg:GatewayMessage={type:'command',id,method,params:dispatchParams};pending.set(id,{agentId,method,started:Date.now()});a.ws.send(JSON.stringify(msg));void audit({event:'command.sent',id,agentId,method});return id}
console.log(`[gateway] ${transport.scheme}://${host}:${port} protocol=${PROTOCOL_VERSION} auth=per-device writes=${policy.allowWrites} terminal=${policy.allowTerminal}`);
wss.on('connection',ws=>{let agentId:string|undefined;let authenticated=false;ws.on('message',raw=>{let msg:AgentMessage;try{msg=JSON.parse(raw.toString())}catch{return ws.close(1003,'invalid json')}if(!authenticated){if(msg.type!=='hello'||msg.protocol!==PROTOCOL_VERSION||!verifyAgentToken(credentials,msg.agentId,msg.token))return ws.close(1008,'auth/protocol rejected');authenticated=true;agentId=msg.agentId;const sessionId=randomUUID();const previous=agents.get(msg.agentId);if(previous)previous.ws.close(1000,'replaced by new session');agents.set(msg.agentId,{ws,capabilities:msg.capabilities,lastSeen:Date.now(),sessionId,credentialHash:tokenSha256(msg.token)});void audit({event:'agent.connected',agentId:msg.agentId,sessionId,platform:msg.platform,capabilities:msg.capabilities});const ack:GatewayMessage={type:'hello_ack',protocol:PROTOCOL_VERSION,sessionId,heartbeatIntervalMs:15000};ws.send(JSON.stringify(ack));try{sendCommand(msg.agentId,'system.info')}catch(e){console.error(e)}return}if(agentId){const a=agents.get(agentId);if(a)a.lastSeen=Date.now()}if(msg.type==='heartbeat')return;if(msg.type==='result'){const p=pending.get(msg.id);pending.delete(msg.id);void audit({event:'command.result',id:msg.id,agentId,method:p?.method,ok:msg.ok,durationMs:p?Date.now()-p.started:undefined,error:msg.error})}});ws.on('close',()=>{if(agentId&&agents.get(agentId)?.ws===ws){agents.delete(agentId);void audit({event:'agent.disconnected',agentId})}})});
setInterval(()=>{const now=Date.now();for(const [id,a] of agents){if(now-a.lastSeen>45000){a.ws.close(1001,'heartbeat timeout');agents.delete(id)}}for(const [id,p] of pending){if(now-p.started>60000){pending.delete(id);void audit({event:'command.timeout',id,agentId:p.agentId,method:p.method})}}void refreshCredentials()},15000).unref();
