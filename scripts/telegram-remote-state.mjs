import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDeliveryState } from "./telegram-delivery-state.mjs";
import { assertStateKeysCompatible } from "./telegram-state-compatibility.mjs";

const exec=promisify(execFile);
const BRANCH="automation/devnet-ledger-data";
const PATH="docs/devnet-telegram-delivery.json";

async function git(args,cwd) {
  const result=await exec("git",args,{cwd,maxBuffer:1024*1024});
  return result.stdout.trim();
}

export async function readRemoteDeliveryState(run=git) {
  await run(["fetch","origin",BRANCH]);
  const commit=await run(["rev-parse","FETCH_HEAD"]);
  let raw="{}";
  try { raw=await run(["show",commit+":"+PATH]); }
  catch(error) {
    const message=String(error.stderr??error.message);
    if(!message.includes("does not exist in") && !message.includes("exists on disk, but not in")) throw error;
  }
  const state=parseDeliveryState(raw);
  assertStateKeysCompatible(state);
  return {commit,state};
}

/** Only call from an explicitly authorized, isolated test environment. */
export async function publishDeliveryState(snapshot,next,run=git) {
  parseDeliveryState(JSON.stringify(next));
  assertStateKeysCompatible(next);
  const current=await readRemoteDeliveryState(run);
  if(current.commit!==snapshot.commit) throw new Error("Remote branch advanced; aborting delivery");
  if(JSON.stringify(current.state)!==JSON.stringify(snapshot.state)) throw new Error("Remote delivery snapshot mismatch; aborting delivery");
  const folder=await mkdtemp(join(tmpdir(),"shah-telegram-state-"));
  let attached=false;
  try {
    await run(["worktree","add","--detach",folder,snapshot.commit]);
    attached=true;
    await mkdir(join(folder,"docs"),{recursive:true});
    await writeFile(join(folder,PATH),JSON.stringify(next,null,2)+"\n",{flag:"w",mode:0o600});
    await git(["add","--",PATH],folder);
    await git(["-c","user.name=shah-cat-ledger-bot","-c","user.email=github-actions[bot]@users.noreply.github.com","commit","-m","chore(telegram): record delivery state"],folder);
    const newCommit=await git(["rev-parse","HEAD"],folder);
    await run(["push","origin",newCommit+":refs/heads/"+BRANCH]);
    const confirmed=await readRemoteDeliveryState(run);
    if(confirmed.commit!==newCommit) throw new Error("Remote delivery commit not confirmed");
    return confirmed;
  } finally {
    if(attached) await run(["worktree","remove","--force",folder]).catch(()=>{});
    await rm(folder,{recursive:true,force:true});
  }
}
