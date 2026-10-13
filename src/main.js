import './style.css';
import {connectAnna} from './runtime.js';
import {readNotes, addNote, deleteNote} from './storage.js';
import {summarizeNotes} from './tools.js';
const $ = id => document.getElementById(id);
let anna, state = {notes: []}, busy = true;
function controls() {
  $('content').disabled = busy || !anna;
  $('save').disabled = busy || !anna || !$('content').value.trim();
  $('refresh').disabled = busy || !anna;
  $('summarize').disabled = busy || !anna || !state.notes.length;
  document.querySelectorAll('#notes button').forEach(b => { b.disabled = busy; });
}
function render() {
  $('notes').replaceChildren();
  for (const note of state.notes) {
    const li = document.createElement('li');
    const order = document.createElement('span'); order.className = 'order'; order.textContent = String(note.order).padStart(2, '0');
    const text = document.createElement('p'); text.textContent = note.content;
    const button = document.createElement('button'); button.className = 'quiet'; button.textContent = '删除'; button.setAttribute('aria-label', `删除笔记 ${note.order}`);
    button.onclick = () => run(async () => {state = await deleteNote(anna, note.id); clearSummary(); render();});
    li.append(order, text, button); $('notes').append(li);
  }
  $('count').textContent = state.notes.length;
  $('empty').hidden = state.notes.length > 0;
  controls();
}
function clearSummary() { $('summary').textContent = '笔记已更新，点击 Summarize 生成总结。'; }
async function run(action) {
  if (busy) return;
  busy = true; controls(); $('error').hidden = true;
  $('status').textContent = '正在处理…';
  try {await action(); $('status').textContent = '已与 Anna 同步';}
  catch (error) {
    $('error').textContent = error.message || String(error);
    if (/no-llm|llm_disabled|sampling_disabled/.test($('error').textContent)) $('error').textContent += '（无 LLM 调试模式的预期结果；后端总结请运行独立 sampling 测试。）';
    $('error').hidden = false; $('status').textContent = '操作未完成，可以重试';
  } finally {busy = false; controls();}
}
$('content').oninput = controls;
$('note-form').onsubmit = event => {event.preventDefault(); run(async () => {
  state = await addNote(anna, $('content').value); $('content').value = ''; clearSummary(); render();
});};
$('refresh').onclick = () => run(async () => {state = await readNotes(anna); clearSummary(); render();});
$('summarize').onclick = () => run(async () => {state = await readNotes(anna); render(); $('summary').textContent = '正在总结…'; try { $('summary').textContent = await summarizeNotes(anna, state.notes); } catch(e) { $('summary').textContent = '暂时无法生成总结，请重试。'; throw e; }});
busy = false;
await run(async () => {anna = await connectAnna(); state = await readNotes(anna); render();});
