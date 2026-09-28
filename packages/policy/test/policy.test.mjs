import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../dist/index.js';

const caps=['system.info','fs.list','fs.read','fs.write','terminal.exec'];

test('writes and terminal default deny',()=>{
  const cfg={allowWrites:false,allowTerminal:false,terminalPrograms:[]};
  assert.equal(decide('fs.write',{},caps,cfg).allow,false);
  assert.equal(decide('terminal.exec',{program:'git',args:['status']},caps,cfg).allow,false);
});

test('terminal requires explicit operator allowlist and structured args',()=>{
  const cfg={allowWrites:true,allowTerminal:true,terminalPrograms:['git']};
  assert.equal(decide('terminal.exec',{program:'git',args:['status']},caps,cfg).allow,true);
  assert.equal(decide('terminal.exec',{program:'sh',args:['-c','rm -rf /']},caps,cfg).allow,false);
  assert.equal(decide('terminal.exec',{program:'../git',args:[]},caps,cfg).allow,false);
  assert.equal(decide('terminal.exec',{program:'git',args:'status'},caps,cfg).allow,false);
});
