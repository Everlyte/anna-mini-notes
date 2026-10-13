export const NOTES_KEY = 'mini-notes/state';
const emptyState = () => ({nextOrder: 1, notes: []});
export async function readNotes(anna) {
  const result = await anna.storage.get({key: NOTES_KEY});
  if (result.exists === false || (result.exists === undefined && result.value == null)) return emptyState();
  const state = result.value;
  if (!state || !Array.isArray(state.notes) || !Number.isSafeInteger(state.nextOrder) || state.nextOrder < 1 ||
      state.notes.some(n => !n || typeof n.id !== 'string' || typeof n.content !== 'string' || !Number.isSafeInteger(n.order) || n.order < 1 || n.order >= state.nextOrder) ||
      new Set(state.notes.map(n => n.id)).size !== state.notes.length) throw new Error('笔记数据格式不正确，未覆盖原有数据。');
  return state;
}
export async function addNote(anna, content) {
  const text = content.trim();
  if (!text || text.length > 2000) throw new Error('请输入 1–2,000 字的笔记。');
  const state = await readNotes(anna);
  if (state.notes.length >= 100) throw new Error('最多保存 100 条笔记，请先删除部分笔记。');
  const next = {nextOrder: state.nextOrder + 1, notes: [...state.notes, {id: crypto.randomUUID(), order: state.nextOrder, content: text, createdAt: new Date().toISOString()}]};
  await anna.storage.set({key: NOTES_KEY, value: next});
  return next;
}
export async function deleteNote(anna, id) {
  const state = await readNotes(anna);
  const next = {...state, notes: state.notes.filter(n => n.id !== id)};
  await anna.storage.set({key: NOTES_KEY, value: next});
  return next;
}
