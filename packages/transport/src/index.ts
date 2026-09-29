export function isLoopbackHost(host:string){
  const h=host.trim().toLowerCase();
  return h==='127.0.0.1'||h==='localhost'||h==='::1'||h==='[::1]';
}
export function resolveGatewayTransport({host,certFile,keyFile}:{host:string;certFile?:string;keyFile?:string}){
  const cert=String(certFile||'').trim(),key=String(keyFile||'').trim();
  if(Boolean(cert)!==Boolean(key))throw new Error('GATEWAY_TLS_CERT and GATEWAY_TLS_KEY must be configured together');
  const tls=Boolean(cert&&key);
  if(!isLoopbackHost(host)&&!tls)throw new Error('non-loopback Gateway binding requires TLS');
  return {tls,scheme:tls?'wss':'ws',certFile:cert||null,keyFile:key||null};
}
