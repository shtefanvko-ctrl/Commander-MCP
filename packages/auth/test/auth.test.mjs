import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenSha256,validateCredentialStore,verifyAgentToken } from '../dist/index.js';

const token='0123456789abcdef0123456789abcdef';
const store={version:1,agents:{
  'oc-device-1':{tokenSha256:tokenSha256(token),enabled:true},
  'oc-revoked':{tokenSha256:tokenSha256(token),enabled:false}
}};

test('per-device token validates only matching enabled device',()=>{
  assert.equal(verifyAgentToken(store,'oc-device-1',token),true);
  assert.equal(verifyAgentToken(store,'oc-device-1','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'),false);
  assert.equal(verifyAgentToken(store,'oc-revoked',token),false);
  assert.equal(verifyAgentToken(store,'oc-other',token),false);
});

test('credential store rejects malformed hashes and ids',()=>{
  assert.throws(()=>validateCredentialStore({version:1,agents:{'bad id':{tokenSha256:'x'}}}));
  assert.throws(()=>validateCredentialStore({version:1,agents:{'oc-ok':{tokenSha256:'x'}}}));
});
