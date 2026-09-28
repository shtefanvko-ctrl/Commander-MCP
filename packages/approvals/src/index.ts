import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

export type ApprovalRecord={
  agentId:string;
  method:string;
  requestSha256:string;
  expiresAt:string;
  usedAt?:string|null;
};
export type ApprovalStore={version:1;approvals:Record<string,ApprovalRecord>};

function canonical(value:unknown):unknown{
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object'){
    return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
  }
  return value;
}
export function commandParams(params:Record<string,unknown>){
  const {approvalId:_approvalId,...clean}=params;
  return clean;
}
export function requestSha256(agentId:string,method:string,params:Record<string,unknown>){
  return createHash('sha256').update(JSON.stringify(canonical({agentId,method,params:commandParams(params)})),'utf8').digest('hex');
}
export function loadApprovalStore(file:string):ApprovalStore{
  if(!existsSync(file))return {version:1,approvals:{}};
  const parsed=JSON.parse(readFileSync(file,'utf8')) as ApprovalStore;
  if(parsed.version!==1||!parsed.approvals||typeof parsed.approvals!=='object')throw new Error('invalid approval store');
  return parsed;
}
function saveApprovalStore(file:string,store:ApprovalStore){
  const tmp=`${file}.${process.pid}.tmp`;
  writeFileSync(tmp,JSON.stringify(store,null,2)+'\n',{encoding:'utf8',mode:0o600});
  chmodSync(tmp,0o600);
  renameSync(tmp,file);
}
export function createApproval(file:string,input:{agentId:string;method:string;params:Record<string,unknown>;ttlSeconds:number;now?:number}){
  if(!input.agentId||!input.method)throw new Error('agentId and method are required');
  if(!Number.isFinite(input.ttlSeconds)||input.ttlSeconds<1||input.ttlSeconds>3600)throw new Error('ttlSeconds must be 1..3600');
  const now=input.now??Date.now();
  const id=randomUUID();
  const store=loadApprovalStore(file);
  store.approvals[id]={
    agentId:input.agentId,
    method:input.method,
    requestSha256:requestSha256(input.agentId,input.method,input.params),
    expiresAt:new Date(now+input.ttlSeconds*1000).toISOString(),
    usedAt:null
  };
  saveApprovalStore(file,store);
  return {id,...store.approvals[id]};
}
export function consumeApproval(file:string,input:{approvalId:string;agentId:string;method:string;params:Record<string,unknown>;now?:number}){
  const store=loadApprovalStore(file);
  const record=store.approvals[input.approvalId];
  if(!record)throw new Error('approval not found');
  if(record.usedAt)throw new Error('approval already used');
  const now=input.now??Date.now();
  if(Date.parse(record.expiresAt)<=now)throw new Error('approval expired');
  if(record.agentId!==input.agentId||record.method!==input.method)throw new Error('approval subject mismatch');
  const actual=requestSha256(input.agentId,input.method,input.params);
  if(actual!==record.requestSha256)throw new Error('approval request mismatch');
  record.usedAt=new Date(now).toISOString();
  saveApprovalStore(file,store);
  return record;
}
