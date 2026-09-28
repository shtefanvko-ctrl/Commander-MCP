export const PROTOCOL_VERSION = 1;
export type Capability = 'system.info'|'fs.list'|'fs.read'|'fs.write'|'terminal.exec';
export type Risk = 'read'|'write'|'exec'|'destructive'|'privileged';
export type AgentMessage =
 | {type:'hello';protocol:number;agentId:string;token:string;platform:string;capabilities:Capability[]}
 | {type:'heartbeat';ts:number}
 | {type:'result';id:string;ok:boolean;result?:unknown;error?:string};
export type GatewayMessage =
 | {type:'hello_ack';protocol:number;sessionId:string;heartbeatIntervalMs:number}
 | {type:'command';id:string;method:Capability;params:Record<string,unknown>}
 | {type:'error';code:string;message:string};
