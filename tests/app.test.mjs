import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addNote,deleteNote,readNotes,NOTES_KEY} from '../src/storage.js';
import {summarizeNotes,TOOL_ID} from '../src/tools.js';
function host(){let value;const calls=[];return {calls,storage:{get:async args=>{calls.push(['get',args]);return {exists:value!==undefined,value:structuredClone(value)}},set:async args=>{calls.push(['set',args]);value=structuredClone(args.value)}}}}
test('create/read/delete persist through Host API; order never reused',async()=>{
 const anna=host();assert.deepEqual((await readNotes(anna)).notes,[]);
 const a=await addNote(anna,'  第一条  ');const b=await addNote(anna,'第二条');
 assert.equal(a.notes[0].content,'第一条');await deleteNote(anna,b.notes[1].id);
 const c=await addNote(anna,'第三条');assert.deepEqual(c.notes.map(n=>n.order),[1,3]);
 assert.equal((await readNotes(anna)).notes.length,2);
 assert(anna.calls.filter(c=>c[0]==='set').length===4);
 assert(anna.calls.every(c=>c[1].key===NOTES_KEY));
});
test('invalid input and corrupt storage are rejected without writing',async()=>{
 const anna=host();await assert.rejects(addNote(anna,'  '));assert.equal(anna.calls.length,0);
 await anna.storage.set({value:{oops:true}});await assert.rejects(readNotes(anna),/格式/);
});
test('storage write failures do not report a successful mutation',async()=>{
 const anna=host();anna.storage.set=async()=>{throw Error('quota exceeded')};
 await assert.rejects(addNote(anna,'hi'),/quota/);assert.equal((await readNotes(anna)).notes.length,0);
});
test('summary is verbatim tool result; disabled LLM error propagates',async()=>{
 const calls=[];const anna={tools:{invoke:async args=>{calls.push(args);return {success:true,data:{summary:'host result'}}}}};
 assert.equal(await summarizeNotes(anna,[{order:4,content:'hello'}]),'host result');
 assert.deepEqual(calls[0],{tool_id:TOOL_ID,method:'summarize',args:{text:'4. hello'}});
 anna.tools.invoke=async()=>{throw Error('[-32603] harness started with --no-llm')};
 await assert.rejects(summarizeNotes(anna,[{order:1,content:'hello'}]),/no-llm/);
});
test('App, discovery, describe and UI share the exact tool identity',()=>{
 const app=JSON.parse(readFileSync('manifest.json'));const plugin=JSON.parse(readFileSync('executas/mini-notes/manifest.json'));const discovery=JSON.parse(readFileSync('executas/mini-notes/executa.json'));
 assert.equal(app.required_executas[0].tool_id,TOOL_ID);assert.deepEqual(app.ui.host_api.tools,[TOOL_ID]);assert.equal(plugin.name,TOOL_ID);assert.equal(discovery.tool_id,TOOL_ID);assert.deepEqual(plugin.host_capabilities,['llm.sample']);
});
