import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { parseDeliveryState } from "./telegram-delivery-state.mjs";

const exec=promisify(execFile);
const DATA_BRANCH="automation/devnet-ledger-data";
const STATE_PATH="docs/devnet-telegram-delivery.json";

export async function git(args, options={}) {
  const result=await exec("git",args,{...options,maxBuffer:1024*1024});
  return result.stdout.trim();
}

export async function readRemoteDeliveryState(run=git) {
  await run(["fetch","origin",DATA_BRANCH]);
  const commit=await run(["rev-parse","FETCH_HEAD"]);
  let raw;
  try { raw=await run(["show",commit+":"+STATE_PATH]); }
  catch (error) {
    const message=String(error.stderr??error.message);
    if (!message.includes("does not exist in") && !message.includes("exists on disk, but not in")) throw error;
    raw="{}";
  }
  return {commit,state:parseDeliveryState(raw)};
}

/**
 * Prepare an isolated worktree at an exact parent commit and push with
 * fast-forward-only semantics. Never force-push or rewrite the data branch.
 * Caller must verify the returned commit on origin before sending.
 */
export async function publishDeliveryState(snapshot,next,run=git) {
  parseDeliveryState(JSON.stringify(next));
  const current=await readRemoteDeliveryState(run);
  if(current.commit!==snapshot.commit) throw new Error("Remote branch advanced; aborting delivery");
  const encoded=Buffer.from(JSON.stringify(next,null,2)+"\n").toString("base64");
  const script="mkdir -p docs; printf %s '"+encoded+"' | base64 -d > "+STATE_PATH+"; git add "+STATE_PATH+"; git -c user.name=shah-cat-ledger-bot -c user.email=github-actions\\[bot\\]@users.noreply.github.com commit -m 'chore(telegram): record delivery reservation'";
  // Isolated worktree prevents modifying the caller's current checkout.
  const folder=await import("node:fs/promises").then(fs=>fs.mkdtemp("/tmp/shah-telegram-state-"));
  try {
    await run(["worktree","add","--detach",folder,snapshot.commit]);
    await exec("bash",["-c",script],{cwd:folder});
    const newCommit=(await exec("git",["rev-parse","HEAD"],{cwd:folder})).stdout.trim();
    await run(["push","origin",newCommit+":refs/heads/"+DATA_BRANCH]);
    const confirmed=await readRemoteDeliveryState(run);
    if(confirmed.commit!==newCommit) throw new Error("Remote delivery commit not confirmed");
    return confirmed;
  } finally {
    await run(["worktree","remove","--force",folder]).catch(()=>{});
    await import("node:fs/promises").then(fs=>fs.rm(folder,{recursive:true,force:true}));
  }
}
