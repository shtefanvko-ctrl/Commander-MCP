import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PROTOCOL_VERSION, type AgentMessage, type GatewayMessage, type Capability } from '@oc/protocol';
import { decide } from '@oc/policy';

const port=Number(process.env.PORT??8787), expectedToken=process.env.AGENT_TOKEN??'dev-change-me';
const auditFile=process.env.AUDIT_FILE??'./data/audit.ndjson';
const wss=new WebSocketServer({port});
const agents=new Map<string,{ws:WebSocket;capabilities:Capability[];lastSeen:number;sessionId:string}>();
const pending=new Map<string,{agentId:string;method:Capability;started:number}>();

async function audit(event:Record<string,unknown>){
 await mkdir(dirname(auditFile),{recursive:true});
 await appendFile(auditFile,JSON.stringify({ts:new Date().toISOString(),...event})+'\n').catch(console.error)
}
function sendCommand(agentId:string,method:Capability,params:Record<string,unknown>={}){
 const a=agents.get(agentId);if(!a)throw new Error('agent offline');
 const policy=decide(method,params,a.capabilities);
 void audit({event:'policy',agentId,method,allow:policy.allow,risk:policy.risk,reason:policy.reason});
 if(!policy.allow)throw new Error(policy.reason);
 const id=randomUUID();
 const msg:GatewayMessage={type:'command',id,method,params};
 pending.set(id,{agentId,method,started:Date.now()});
 a.ws.send(JSON.stringify(msg));
 void audit({event:'command.sent',id,agentId,method});
 return id;
}
console.log(`[gateway] ws://127.0.0.1:${port} protocol=${PROTOCOL_VERSION}`);
wss.on('connection',ws=>{
 let agentId:string|undefined;let authenticated=false;
 ws.on('message',raw=>{
  let msg:AgentMessage;
  try{msg=JSON.parse(raw.toString())}catch{return ws.close(1003,'invalid json')}
  if(!authenticated){
   if(msg.type!=='hello'||msg.protocol!==PROTOCOL_VERSION||msg.token!==expectedToken)
    return ws.close(1008,'auth/protocol rejected');
   authenticated=true;agentId=msg.agentId;
   const connectedAgentId=msg.agentId;const sessionId=randomUUID();
   agents.set(connectedAgentId,{ws,capabilities:msg.capabilities,lastSeen:Date.now(),sessionId});
   void audit({event:'agent.connected',agentId:connectedAgentId,sessionId,platform:msg.platform,capabilities:msg.capabilities});
   const ack:GatewayMessage={type:'hello_ack',protocol:PROTOCOL_VERSION,sessionId,heartbeatIntervalMs:15000};
   ws.send(JSON.stringify(ack));
   try{sendCommand(connectedAgentId,'system.info')}catch(e){console.error(e)}
   return;
  }
  if(agentId){const a=agents.get(agentId);if(a)a.lastSeen=Date.now()}
  if(msg.type==='heartbeat'){void audit({event:'agent.heartbeat',agentId});return}
  if(msg.type==='result'){
   const p=pending.get(msg.id);pending.delete(msg.id);
   void audit({event:'command.result',id:msg.id,agentId,method:p?.method,ok:msg.ok,durationMs:p?Date.now()-p.started:undefined,error:msg.error});
   console.log(`[result ${agentId}]`,JSON.stringify(msg));
  }
 });
 ws.on('close',()=>{if(agentId&&agents.get(agentId)?.ws===ws){agents.delete(agentId);void audit({event:'agent.disconnected',agentId})}});
});
setInterval(()=>{const now=Date.now();for(const [id,a] of agents){if(now-a.lastSeen>45000){a.ws.close(1001,'heartbeat timeout');agents.delete(id)}}},15000).unref();
