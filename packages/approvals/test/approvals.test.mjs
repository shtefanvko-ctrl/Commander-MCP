import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApproval,consumeApproval,requestSha256 } from '../dist/index.js';

function tempStore(){
  const dir=mkdtempSync(join(tmpdir(),'oc-approvals-'));
  return {dir,file:join(dir,'approvals.json')};
}

test('approval is bound to exact device, method and canonical params and is one-time',()=>{
  const t=tempStore();
  try{
    const params={path:'notes.txt',content:'hello'};
    const a=createApproval(t.file,{agentId:'oc-device',method:'fs.write',params,ttlSeconds:60,now:1000});
    assert.equal(a.requestSha256,requestSha256('oc-device','fs.write',params));
    assert.doesNotThrow(()=>consumeApproval(t.file,{approvalId:a.id,agentId:'oc-device',method:'fs.write',params:{content:'hello',path:'notes.txt',approvalId:a.id},now:2000}));
    assert.throws(()=>consumeApproval(t.file,{approvalId:a.id,agentId:'oc-device',method:'fs.write',params,now:3000}),/already used/);
  }finally{rmSync(t.dir,{recursive:true,force:true})}
});

test('approval rejects changed request and expiry',()=>{
  const t=tempStore();
  try{
    const a=createApproval(t.file,{agentId:'oc-device',method:'terminal.exec',params:{program:'git',args:['status']},ttlSeconds:10,now:1000});
    assert.throws(()=>consumeApproval(t.file,{approvalId:a.id,agentId:'oc-device',method:'terminal.exec',params:{program:'git',args:['push']},now:2000}),/request mismatch/);
    assert.throws(()=>consumeApproval(t.file,{approvalId:a.id,agentId:'oc-device',method:'terminal.exec',params:{program:'git',args:['status']},now:12000}),/expired/);
  }finally{rmSync(t.dir,{recursive:true,force:true})}
});
