import { createApproval } from '@oc/approvals';

const [agentId,method,paramsJson,ttlRaw='300']=process.argv.slice(2);
const file=process.env.OC_APPROVALS_FILE||'';
if(!file){
  console.error('OC_APPROVALS_FILE is required');
  process.exit(2);
}
if(!agentId||!method||!paramsJson){
  console.error("Usage: OC_APPROVALS_FILE=... npm run approval:create -- <agentId> <method> '<params-json>' [ttlSeconds]");
  process.exit(2);
}
const params=JSON.parse(paramsJson);
const approval=createApproval(file,{agentId,method,params,ttlSeconds:Number(ttlRaw)});
console.log(JSON.stringify({approvalId:approval.id,requestSha256:approval.requestSha256,expiresAt:approval.expiresAt},null,2));
