export type Capability = 'system.info'|'fs.list'|'fs.read'|'fs.write'|'terminal.exec';
export type Risk = 'read'|'write'|'exec'|'destructive'|'privileged';
export type PolicyDecision={allow:boolean;risk:Risk;reason:string};
const risks:Record<Capability,Risk>={
 'system.info':'read','fs.list':'read','fs.read':'read','fs.write':'write','terminal.exec':'exec'
};
const destructive=/\b(rm\s+-rf|del\s+\/s|rmdir\s+\/s|format\b|mkfs\b|diskpart\b|shutdown\b|reboot\b|poweroff\b)\b/i;
const privileged=/\b(sudo\b|runas\b|powershell\s+.*start-process.*-verb\s+runas)\b/i;
export function decide(method:Capability,params:Record<string,unknown>,granted:readonly Capability[]):PolicyDecision{
 if(!granted.includes(method)) return {allow:false,risk:risks[method],reason:'capability not granted to device'};
 if(method==='terminal.exec'){
  const command=String(params.command??'');
  if(privileged.test(command)) return {allow:false,risk:'privileged',reason:'privileged execution requires an explicit approval flow'};
  if(destructive.test(command)) return {allow:false,risk:'destructive',reason:'destructive execution denied by baseline policy'};
 }
 return {allow:true,risk:risks[method],reason:'allowed by baseline policy'};
}
