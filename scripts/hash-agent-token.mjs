import { createHash } from 'node:crypto';

const token=process.argv[2]||process.env.AGENT_TOKEN||'';
if(token.length<32){
  console.error('Token must contain at least 32 characters.');
  process.exit(2);
}
console.log(createHash('sha256').update(token,'utf8').digest('hex'));
