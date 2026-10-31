import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {readRemoteDeliveryState,publishDeliveryState} from "./telegram-remote-state.mjs";

const exec=promisify(execFile);
async function git(cwd,...args) {
  const {stdout}=await exec("git",args,{cwd});
  return stdout.trim();
}

test("real local bare Git remote: reserve, push, reread, and reject stale writer",async()=>{
  const root=await mkdtemp(join(tmpdir(),"shah-ledger-git-test-"));
  const bare=join(root,"origin.git");
  const clone=join(root,"checkout");
  try {
    await mkdir(bare);
    await git(root,"init","--bare",bare);
    await git(root,"clone",bare,clone);
    await git(clone,"-c","user.name=test","-c","user.email=test@example.invalid","commit","--allow-empty","-m","initial");
    await git(clone,"push","origin","HEAD:refs/heads/automation/devnet-ledger-data");
    const initial=await readRemoteDeliveryState((args)=>git(clone,...args));
    assert.deepEqual(initial.state,{});
    const next={'["sig","from","to","1"]':{status:"reserved"}};
    const published=await publishDeliveryState(initial,next,(args)=>git(clone,...args));
    assert.deepEqual(published.state,next);
    const confirmed=await readRemoteDeliveryState((args)=>git(clone,...args));
    assert.equal(confirmed.commit,published.commit);
    await assert.rejects(publishDeliveryState(initial,next,(args)=>git(clone,...args)),/Remote branch advanced/);
  } finally {
    await rm(root,{recursive:true,force:true});
  }
});

test("local Git remote: concurrent writer blocks stale publication",async()=>{
  const root=await mkdtemp(join(tmpdir(),"shah-ledger-conflict-test-"));
  const bare=join(root,"origin.git");
  const clone=join(root,"checkout");
  try {
    await mkdir(bare);
    await git(root,"init","--bare",bare);
    await git(root,"clone",bare,clone);
    await git(clone,"-c","user.name=test","-c","user.email=test@example.invalid","commit","--allow-empty","-m","initial");
    await git(clone,"push","origin","HEAD:refs/heads/automation/devnet-ledger-data");
    const snapshot=await readRemoteDeliveryState((args)=>git(clone,...args));
    await publishDeliveryState(snapshot,{['["external","from","to","1"]']:{status:"unknown"}},(args)=>git(clone,...args));
    await assert.rejects(
      publishDeliveryState(snapshot,{'["sig","from","to","1"]':{status:"reserved"}},(args)=>git(clone,...args)),
      /Remote branch advanced/
    );
    const final=await readRemoteDeliveryState((args)=>git(clone,...args));
    assert.equal(final.state['["external","from","to","1"]'].status,"unknown");
    assert.equal(final.state['["sig","from","to","1"]'],undefined);
  } finally {
    await rm(root,{recursive:true,force:true});
  }
});
