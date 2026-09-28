export type Capability = 'system.info'|'fs.list'|'fs.read'|'fs.write'|'terminal.exec';
export type Risk = 'read'|'write'|'exec'|'destructive'|'privileged';
export type PolicyConfig = { allowWrites:boolean; allowTerminal:boolean; terminalPrograms:readonly string[] };
export type PolicyDecision={allow:boolean;risk:Risk;reason:string};
const risks:Record<Capability,Risk>={
 'system.info':'read','fs.list':'read','fs.read':'read','fs.write':'write','terminal.exec':'exec'
};
const simpleProgram=/^[A-Za-z0-9._-]+$/;
export function decide(method:Capability,params:Record<string,unknown>,granted:readonly Capability[],config:PolicyConfig):PolicyDecision{
 if(!granted.includes(method)) return {allow:false,risk:risks[method],reason:'capability not granted to device'};
 if(method==='fs.write'&&!config.allowWrites) return {allow:false,risk:'write',reason:'remote writes disabled by gateway policy'};
 if(method==='terminal.exec'){
  if(!config.allowTerminal) return {allow:false,risk:'exec',reason:'terminal execution disabled by gateway policy'};
  const program=String(params.program??''); const args=params.args;
  if(!simpleProgram.test(program)||program.includes('/')||program.includes('\\')) return {allow:false,risk:'exec',reason:'terminal program must be a simple executable name'};
  if(!Array.isArray(args)||!args.every(x=>typeof x==='string')) return {allow:false,risk:'exec',reason:'terminal args must be a string array'};
  if(!config.terminalPrograms.includes(program)) return {allow:false,risk:'exec',reason:'terminal program not in operator allowlist'};
 }
 return {allow:true,risk:risks[method],reason:'allowed by configured policy'};
}
