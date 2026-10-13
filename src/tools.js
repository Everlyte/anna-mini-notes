export const TOOL_ID = 'tool-mini-notes-summarizer';
export async function summarizeNotes(anna, notes) {
  if (!notes.length) throw new Error('请先添加笔记。');
  const result = await anna.tools.invoke({
    tool_id: TOOL_ID, method: 'summarize',
    args: {text: notes.map(n => `${n.order}. ${n.content}`).join('\n')}
  }, {timeoutMs: 90000});
  if (result?.success === false) throw new Error(String(result.error || '总结失败'));
  const data = result?.data ?? result;
  if (typeof data?.summary !== 'string' || !data.summary.trim()) throw new Error('Tool 未返回有效总结。');
  return data.summary;
}
