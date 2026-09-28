use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{env, fs, path::{Component, Path, PathBuf}, time::Duration};
use sysinfo::System;
use tokio::{process::Command, time::timeout};
use tokio_tungstenite::{connect_async, tungstenite::Message};

fn workspace()->PathBuf{fs::canonicalize(env::var("OC_WORKSPACE").unwrap_or_else(|_|".".into())).expect("OC_WORKSPACE must exist")}
fn clean_relative(raw:&str)->Result<PathBuf,String>{
 let p=Path::new(raw);
 if p.is_absolute(){return Err("absolute paths are not allowed".into())}
 for c in p.components(){if matches!(c,Component::ParentDir|Component::RootDir|Component::Prefix(_)){return Err("path traversal rejected".into())}}
 Ok(p.to_path_buf())
}
fn safe_existing(root:&Path,raw:&str)->Result<PathBuf,String>{
 let joined=root.join(clean_relative(raw)?);
 let canonical=fs::canonicalize(joined).map_err(|e|e.to_string())?;
 if !canonical.starts_with(root){return Err("path escapes workspace".into())}
 Ok(canonical)
}
fn safe_write(root:&Path,raw:&str)->Result<PathBuf,String>{
 let rel=clean_relative(raw)?;let joined=root.join(&rel);
 if joined.exists(){let c=fs::canonicalize(&joined).map_err(|e|e.to_string())?;if !c.starts_with(root){return Err("write target escapes workspace".into())}return Ok(c)}
 let parent=joined.parent().ok_or("invalid write path")?;let c=fs::canonicalize(parent).map_err(|e|e.to_string())?;
 if !c.starts_with(root){return Err("write parent escapes workspace".into())}
 Ok(c.join(joined.file_name().ok_or("invalid write filename")?))
}
fn stable_agent_id(root:&Path)->String{let mut h=Sha256::new();h.update(env::consts::OS);h.update(root.to_string_lossy().as_bytes());if let Ok(host)=env::var("COMPUTERNAME").or_else(|_|env::var("HOSTNAME")){h.update(host)}format!("oc-{}",&hex::encode(h.finalize())[..24])}
fn flag(name:&str)->bool{env::var(name).map(|v|v=="1").unwrap_or(false)}
fn allowed_programs()->Vec<String>{env::var("OC_TERMINAL_PROGRAMS").unwrap_or_default().split(',').map(str::trim).filter(|x|!x.is_empty()).map(str::to_string).collect()}
async fn handle(method:&str,p:&Value,root:&Path,write_enabled:bool,terminal_enabled:bool,programs:&[String])->Result<Value,String>{match method{
"system.info"=>{let mut s=System::new_all();s.refresh_all();Ok(json!({"os":System::name(),"osVersion":System::os_version(),"kernel":System::kernel_version(),"cpuCount":s.cpus().len(),"memoryTotal":s.total_memory(),"memoryUsed":s.used_memory(),"workspace":root}))},
"fs.list"=>{let path=safe_existing(root,p["path"].as_str().unwrap_or("."))?;let mut a=vec![];for e in fs::read_dir(path).map_err(|e|e.to_string())?{let e=e.map_err(|e|e.to_string())?;let m=e.metadata().map_err(|e|e.to_string())?;a.push(json!({"name":e.file_name().to_string_lossy(),"dir":m.is_dir(),"size":m.len()}));}Ok(json!(a))},
"fs.read"=>{let path=safe_existing(root,p["path"].as_str().ok_or("path required")?)?;let m=fs::metadata(&path).map_err(|e|e.to_string())?;if m.len()>1_048_576{return Err("file exceeds 1 MiB read limit".into())}Ok(json!({"content":fs::read_to_string(path).map_err(|e|e.to_string())?}))},
"fs.write"=>{if !write_enabled{return Err("remote writes disabled on agent".into())}let path=safe_write(root,p["path"].as_str().ok_or("path required")?)?;let content=p["content"].as_str().ok_or("content required")?;if content.len()>1_048_576{return Err("write exceeds 1 MiB limit".into())}fs::write(&path,content).map_err(|e|e.to_string())?;Ok(json!({"written":content.len()}))},
"terminal.exec"=>{if !terminal_enabled{return Err("terminal execution disabled on agent".into())}let program=p["program"].as_str().ok_or("program required")?;if program.contains('/')||program.contains('\\')||!programs.iter().any(|x|x==program){return Err("program not in agent allowlist".into())}let args=p["args"].as_array().ok_or("args array required")?.iter().map(|v|v.as_str().ok_or("args must be strings").map(str::to_string)).collect::<Result<Vec<_>,_>>()?;let cwd=safe_existing(root,p["cwd"].as_str().unwrap_or("."))?;let mut c=Command::new(program);c.args(args);c.current_dir(cwd);let out=timeout(Duration::from_secs(30),c.output()).await.map_err(|_|"command timeout".to_string())?.map_err(|e|e.to_string())?;Ok(json!({"exitCode":out.status.code(),"stdout":String::from_utf8_lossy(&out.stdout),"stderr":String::from_utf8_lossy(&out.stderr)}))},_=>Err("unsupported method".into())}}
#[tokio::main]async fn main()->Result<(),Box<dyn std::error::Error>>{
 let url=env::var("GATEWAY_URL").unwrap_or("ws://127.0.0.1:8787".into());let token=env::var("AGENT_TOKEN").expect("AGENT_TOKEN is required");if token.len()<32{panic!("AGENT_TOKEN must contain at least 32 characters")}
 let root=workspace();let agent_id=stable_agent_id(&root);let write_enabled=flag("OC_ENABLE_WRITES");let terminal_enabled=flag("OC_ENABLE_TERMINAL");let programs=allowed_programs();
 let mut capabilities=vec!["system.info","fs.list","fs.read"];if write_enabled{capabilities.push("fs.write")}if terminal_enabled{capabilities.push("terminal.exec")}
 println!("[agent] id={} workspace={} writes={} terminal={}",agent_id,root.display(),write_enabled,terminal_enabled);
 loop{match connect_async(&url).await{Ok((mut ws,_))=>{ws.send(Message::Text(json!({"type":"hello","protocol":1,"agentId":agent_id,"token":token,"platform":env::consts::OS,"capabilities":capabilities}).to_string().into())).await?;let mut beat=tokio::time::interval(Duration::from_secs(15));loop{tokio::select!{_=beat.tick()=>{ws.send(Message::Text(json!({"type":"heartbeat","ts":0}).to_string().into())).await?},item=ws.next()=>{let Some(item)=item else{break};let msg=item?;if !msg.is_text(){continue}let v:Value=serde_json::from_str(msg.to_text()?)?;if v["type"]=="hello_ack"{println!("[agent] connected {}",v["sessionId"]);continue}if v["type"]=="command"{let id=v["id"].clone();let r=handle(v["method"].as_str().unwrap_or(""),&v["params"],&root,write_enabled,terminal_enabled,&programs).await;let out=match r{Ok(x)=>json!({"type":"result","id":id,"ok":true,"result":x}),Err(e)=>json!({"type":"result","id":id,"ok":false,"error":e})};ws.send(Message::Text(out.to_string().into())).await?;}}}}},Err(e)=>eprintln!("[agent] connect failed: {e}")}tokio::time::sleep(Duration::from_secs(3)).await;}
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_absolute_and_parent_paths() {
        assert!(clean_relative("../escape").is_err());
        assert!(clean_relative("/absolute").is_err());
        assert!(clean_relative("safe/file.txt").is_ok());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_escape_for_read_and_write() {
        use std::os::unix::fs::symlink;
        let base=env::temp_dir().join(format!("oc-path-test-{}",uuid::Uuid::new_v4()));
        let root=base.join("root");
        let outside=base.join("outside");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        fs::write(outside.join("secret.txt"),"secret").unwrap();
        symlink(outside.join("secret.txt"),root.join("link.txt")).unwrap();
        let canonical_root=fs::canonicalize(&root).unwrap();
        assert!(safe_existing(&canonical_root,"link.txt").is_err());
        assert!(safe_write(&canonical_root,"link.txt").is_err());
        fs::remove_dir_all(base).unwrap();
    }
}
