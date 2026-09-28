import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PROTOCOL_VERSION, type AgentMessage, type GatewayMessage, type Capability } from '@oc/protocol';
import { decide, type PolicyConfig } from '@oc/policy';

function requiredSecret(name:string){const value=process.env[name]??'';if(value.length<32)throw new Error(`${name} must be set and contain at least 32 characters`);return value}
function sameSecret(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
const host=process.env.GATEWAY_HOST??'127.0.0.1', port=Number(process.env.PORT??8787);
const expectedToken=requiredSecret('AGENT_TOKEN'), auditFile=process.env.AUDIT_FILE??'./data/audit.ndjson';
const policy:PolicyConfig={allowWrites:process.env.OC_ALLOW_WRITES==='1',allowTerminal:process.env.OC_ALLOW_TERMINAL==='1',terminalPrograms:(process.env.OC_TERMINAL_PROGRAMS??'').split(',').map(x=>x.trim()).filter(Boolean)};
const wss=new WebSocketServer({host,port,maxPayload:256*1024});
const agents=new Map<string,{ws:WebSocket;capabilities:Capability[];lastSeen:number;sessionId:string}>();
const pending=new Map<string,{agentId:string;method:Capability;started:number}>();
async function audit(event:Record<string,unknown>){await mkdir(dirname(auditFile),{recursive:true});await appendFile(auditFile,JSON.stringify({ts:new Date().toISOString(),...event})+'\n').catch(console.error)}
function sendCommand(agentId:string,method:Capability,params:Record<string,unknown>={}){
 const a=agents.get(agentId);if(!a)throw new Error('agent offline');const d=decide(method,params,a.capabilities,policy);void audit({event:'policy',agentId,method,allow:d.allow,risk:d.risk,reason:d.reason});if(!d.allow)throw new Error(d.reason);
 const id=randomUUID();const msg:GatewayMessage={type:'command',id,method,params};pending.set(id,{agentId,method,started:Date.now()});a.ws.send(JSON.stringify(msg));void audit({event:'command.sent',id,agentId,method});return id
}
console.log(`[gateway] ws://${host}:${port} protocol=${PROTOCOL_VERSION} writes=${policy.allowWrites} terminal=${policy.allowTerminal}`);
wss.on('connection',ws=>{let agentId:string|undefined;let authenticated=false;
 ws.on('message',raw=>{let msg:AgentMessage;try{msg=JSON.parse(raw.toString())}catch{return ws.close(1003,'invalid json')}
  if(!authenticated){if(msg.type!=='hello'||msg.protocol!==PROTOCOL_VERSION||!sameSecret(msg.token,expectedToken))return ws.close(1008,'auth/protocol rejected');if(!/^[A-Za-z0-9._-]{3,128}$/.test(msg.agentId))return ws.close(1008,'invalid agent id');
   authenticated=true;agentId=msg.agentId;const sessionId=randomUUID();const previous=agents.get(msg.agentId);if(previous)previous.ws.close(1000,'replaced by new session');agents.set(msg.agentId,{ws,capabilities:msg.capabilities,lastSeen:Date.now(),sessionId});void audit({event:'agent.connected',agentId:msg.agentId,sessionId,platform:msg.platform,capabilities:msg.capabilities});
   const ack:GatewayMessage={type:'hello_ack',protocol:PROTOCOL_VERSION,sessionId,heartbeatIntervalMs:15000};ws.send(JSON.stringify(ack));try{sendCommand(msg.agentId,'system.info')}catch(e){console.error(e)}return}
  if(agentId){const a=agents.get(agentId);if(a)a.lastSeen=Date.now()} if(msg.type==='heartbeat')return;
  if(msg.type==='result'){const p=pending.get(msg.id);pending.delete(msg.id);void audit({event:'command.result',id:msg.id,agentId,method:p?.method,ok:msg.ok,durationMs:p?Date.now()-p.started:undefined,error:msg.error})}
 });
 ws.on('close',()=>{if(agentId&&agents.get(agentId)?.ws===ws){agents.delete(agentId);void audit({event:'agent.disconnected',agentId})}})
});
setInterval(()=>{const now=Date.now();for(const [id,a] of agents){if(now-a.lastSeen>45000){a.ws.close(1001,'heartbeat timeout');agents.delete(id)}}for(const [id,p] of pending){if(now-p.started>60000){pending.delete(id);void audit({event:'command.timeout',id,agentId:p.agentId,method:p.method})}}},15000).unref();
