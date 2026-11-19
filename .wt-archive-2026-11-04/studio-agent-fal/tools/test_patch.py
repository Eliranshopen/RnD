# review fixes 2a/2b: the structured() calls in the fal test declare allowFal; new tests for the gates and the chat lock.
p = r"C:\RnD\.wt\studio-agent-fal\files\Projects\Habait\habait-walkaround\Habait\studio\test\llm-fal.test.mjs"
s = open(p, encoding="utf-8").read()
n = s.count(", schema });")
s = s.replace(", schema });", ", schema, allowFal: true });")
print("structured calls with allowFal:", n)
anchor = "// ---- the developer chat"
assert s.count(anchor) == 1
s = s.replace(anchor, """await test('review 2a: fal only for a caller that bills it (allowFal) and only with spending on — else no fal request', async () => {
  seen.length = 0;
  const schema = z.object({ rooms: z.number(), name: z.string() });
  const a = await structured({ env: { FAL_KEY: KEY, ALLOW_SPEND: true }, dir: tmp, inputs: [], system: 'S', task: 'T', schema });
  const b = await structured({ env: { FAL_KEY: KEY, ALLOW_SPEND: false, LLM_BACKEND: 'fal' }, dir: tmp, inputs: [], system: 'S', task: 'T', schema, allowFal: true });
  assert.equal(seen.length, 0, 'no request reached fal');
  assert.notEqual(a.backend, 'fal'); assert.notEqual(b.backend, 'fal');
  return `fell back to ${a.backend} / ${b.backend}`;
});

// ---- the developer chat""")
anchor2 = "server.close();"
assert s.count(anchor2) == 1
s = s.replace(anchor2, """await test('review 2b: a second paid question while one is under way is refused (no cap race)', async () => {
  const q = new ProjectStore(path.join(tmp, 'projects3')); const id = q.create({ name: 'chat-3' }).id;
  let release; const gate = new Promise((r) => { release = r; });
  const slow = http.createServer((req, res) => { req.resume(); req.on('end', async () => { await gate; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ output: 'תשובה', usage: { cost: 0.01 } })); }); });
  await new Promise((r) => slow.listen(0, '127.0.0.1', r));
  process.env.HABAIT_FAL_BASE = `http://127.0.0.1:${slow.address().port}`;
  const env = { FAL_KEY: KEY, ALLOW_SPEND: true, CAP_USD: 10 };
  const first = ask({ env, store: q, id, question: 'א' });
  await new Promise((r) => setTimeout(r, 50));
  const second = await ask({ env, store: q, id, question: 'ב' });
  release(); const one = await first; slow.close(); process.env.HABAIT_FAL_BASE = BASE;
  assert.equal(second.ok, false); assert.match(second.error, /עדיין עונה/);
  assert.equal(one.ok, true); assert.equal(q.ledger(id).filter((r) => r.stage === 'chat').length, 1);
});

server.close();""")
open(p, "w", encoding="utf-8", newline="").write(s)
print("tests added")
