use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{env, fs, path::{Path, PathBuf}, time::Duration};
use sysinfo::System;
use tokio::{process::Command, time::timeout};
use tokio_tungstenite::{connect_async, tungstenite::Message};

fn workspace()->PathBuf{
    fs::canonicalize(env::var("OC_WORKSPACE").unwrap_or_else(|_|".".into()))
        .expect("OC_WORKSPACE must exist")
}

fn safe_path(root:&Path,raw:&str,for_write:bool)->Result<PathBuf,String>{
    let joined=root.join(raw.trim_start_matches(['/','\\']));
    let check=if for_write{joined.parent().unwrap_or(root)}else{joined.as_path()};
    let canonical=fs::canonicalize(check).map_err(|e|e.to_string())?;
    if !canonical.starts_with(root){return Err("path escapes workspace".into())}
    Ok(joined)
}

fn stable_agent_id(root:&Path)->String{
    let mut h=Sha256::new();
    h.update(env::consts::OS);
    h.update(root.to_string_lossy().as_bytes());
    if let Ok(host)=env::var("COMPUTERNAME").or_else(|_|env::var("HOSTNAME")){h.update(host)}
    format!("oc-{}",&hex::encode(h.finalize())[..24])
}

async fn handle(method:&str,p:&Value,root:&Path)->Result<Value,String>{
    match method{
        "system.info"=>{
            let mut s=System::new_all();s.refresh_all();
            Ok(json!({"os":System::name(),"osVersion":System::os_version(),"kernel":System::kernel_version(),"cpuCount":s.cpus().len(),"memoryTotal":s.total_memory(),"memoryUsed":s.used_memory(),"workspace":root}))
        },
        "fs.list"=>{
            let path=safe_path(root,p["path"].as_str().unwrap_or("."),false)?;
            let mut a=vec![];
            for e in fs::read_dir(path).map_err(|e|e.to_string())?{
                let e=e.map_err(|e|e.to_string())?;
                let m=e.metadata().map_err(|e|e.to_string())?;
                a.push(json!({"name":e.file_name().to_string_lossy(),"dir":m.is_dir(),"size":m.len()}));
            }
            Ok(json!(a))
        },
        "fs.read"=>{
            let path=safe_path(root,p["path"].as_str().ok_or("path required")?,false)?;
            let m=fs::metadata(&path).map_err(|e|e.to_string())?;
            if m.len()>1_048_576{return Err("file exceeds 1 MiB read limit".into())}
            Ok(json!({"content":fs::read_to_string(path).map_err(|e|e.to_string())?}))
        },
        "fs.write"=>{
            let path=safe_path(root,p["path"].as_str().ok_or("path required")?,true)?;
            let content=p["content"].as_str().ok_or("content required")?;
            if content.len()>1_048_576{return Err("write exceeds 1 MiB limit".into())}
            fs::write(&path,content).map_err(|e|e.to_string())?;
            Ok(json!({"written":content.len()}))
        },
        "terminal.exec"=>{
            let cmd=p["command"].as_str().ok_or("command required")?;
            let cwd=safe_path(root,p["cwd"].as_str().unwrap_or("."),false)?;
            let mut c=if cfg!(windows){
                let mut x=Command::new("cmd");x.args(["/C",cmd]);x
            }else{
                let mut x=Command::new("sh");x.args(["-lc",cmd]);x
            };
            c.current_dir(cwd);
            let out=timeout(Duration::from_secs(30),c.output())
                .await.map_err(|_|"command timeout".to_string())?
                .map_err(|e|e.to_string())?;
            Ok(json!({"exitCode":out.status.code(),"stdout":String::from_utf8_lossy(&out.stdout),"stderr":String::from_utf8_lossy(&out.stderr)}))
        },
        _=>Err("unsupported method".into())
    }
}

#[tokio::main]
async fn main()->Result<(),Box<dyn std::error::Error>>{
    let url=env::var("GATEWAY_URL").unwrap_or("ws://127.0.0.1:8787".into());
    let token=env::var("AGENT_TOKEN").unwrap_or("dev-change-me".into());
    let root=workspace();
    let agent_id=stable_agent_id(&root);
    loop{
        match connect_async(&url).await{
            Ok((mut ws,_))=>{
                ws.send(Message::Text(json!({"type":"hello","protocol":1,"agentId":agent_id,"token":token,"platform":env::consts::OS,"capabilities":["system.info","fs.list","fs.read","fs.write","terminal.exec"]}).to_string().into())).await?;
                let mut beat=tokio::time::interval(Duration::from_secs(15));
                loop{
                    tokio::select!{
                        _=beat.tick()=>{
                            ws.send(Message::Text(json!({"type":"heartbeat","ts":0}).to_string().into())).await?
                        },
                        item=ws.next()=>{
                            let Some(item)=item else{break};
                            let msg=item?;
                            if !msg.is_text(){continue}
                            let v:Value=serde_json::from_str(msg.to_text()?)?;
                            if v["type"]=="hello_ack"{
                                println!("[agent] connected {}",v["sessionId"]);
                                continue
                            }
                            if v["type"]=="command"{
                                let id=v["id"].clone();
                                let r=handle(v["method"].as_str().unwrap_or(""),&v["params"],&root).await;
                                let out=match r{
                                    Ok(x)=>json!({"type":"result","id":id,"ok":true,"result":x}),
                                    Err(e)=>json!({"type":"result","id":id,"ok":false,"error":e})
                                };
                                ws.send(Message::Text(out.to_string().into())).await?;
                            }
                        }
                    }
                }
            },
            Err(e)=>eprintln!("[agent] connect failed: {e}")
        }
        tokio::time::sleep(Duration::from_secs(3)).await;
    }
}
