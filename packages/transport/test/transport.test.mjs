import test from 'node:test';
import assert from 'node:assert/strict';
import { isLoopbackHost,resolveGatewayTransport } from '../dist/index.js';

test('loopback can use ws without TLS',()=>{
  assert.equal(isLoopbackHost('127.0.0.1'),true);
  assert.deepEqual(resolveGatewayTransport({host:'127.0.0.1'}),{tls:false,scheme:'ws',certFile:null,keyFile:null});
});
test('remote binding requires complete TLS pair',()=>{
  assert.throws(()=>resolveGatewayTransport({host:'0.0.0.0'}),/requires TLS/);
  assert.throws(()=>resolveGatewayTransport({host:'0.0.0.0',certFile:'cert.pem'}),/configured together/);
  assert.equal(resolveGatewayTransport({host:'0.0.0.0',certFile:'cert.pem',keyFile:'key.pem'}).scheme,'wss');
});
