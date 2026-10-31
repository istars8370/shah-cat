import test from "node:test";
import assert from "node:assert/strict";
import { readRemoteDeliveryState, publishDeliveryState } from "./telegram-remote-state.mjs";

const shaA="a".repeat(40),shaB="b".repeat(40);
const rowKey="sig|from|to|1";
const reserved={ [rowKey]:{status:"reserved"} };

test("reads authoritative remote state and commit",async()=>{
  const calls=[];
  const run=async args=>{
    calls.push(args.join(" "));
    if(args[0]==="rev-parse") return shaA;
    if(args[0]==="show") return JSON.stringify(reserved);
    return "";
  };
  const result=await readRemoteDeliveryState(run);
  assert.equal(result.commit,shaA);
  assert.deepEqual(result.state,reserved);
  assert.ok(calls.some(x=>x.startsWith("fetch origin automation/devnet-ledger-data")));
});

test("missing delivery file initializes empty state only for expected Git error",async()=>{
  const run=async args=>{
    if(args[0]==="rev-parse") return shaA;
    if(args[0]==="show") throw Object.assign(new Error("missing"),{stderr:"fatal: path 'docs/devnet-telegram-delivery.json' does not exist in '"+shaA+"'"});
    return "";
  };
  assert.deepEqual((await readRemoteDeliveryState(run)).state,{});
});

test("remote fetch errors are not silently treated as empty state",async()=>{
  const run=async args=>{
    if(args[0]==="fetch") throw new Error("network unavailable");
    return "";
  };
  await assert.rejects(readRemoteDeliveryState(run),/network unavailable/);
});

test("remote branch advancement prevents any worktree creation or push",async()=>{
  const calls=[];
  const run=async args=>{
    calls.push(args[0]);
    if(args[0]==="rev-parse") return shaB;
    if(args[0]==="show") return "{}";
    return "";
  };
  await assert.rejects(publishDeliveryState({commit:shaA,state:{}},reserved,run),/Remote branch advanced/);
  assert.equal(calls.includes("push"),false);
  assert.equal(calls.includes("worktree"),false);
});

test("invalid state cannot be published",async()=>{
  await assert.rejects(publishDeliveryState({commit:shaA,state:{}},{bad:{status:"invalid"}},async()=>""),/Invalid delivery record/);
});
