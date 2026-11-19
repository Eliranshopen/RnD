"""install-global.py — install the Habait wrapper into Pi's USER configuration, so every Pi session on this machine, started from any
folder, is Habait's simulation agent (2026-11-15, Eliran: «מעטפת לPI שתהיה קיימת כל הזמן ולא רק בייחס לפרויקט»).

  python -I -X utf8 pi-agent/install-global.py [--agent-dir ~/.pi/agent] [--uninstall] [--dry]

- `<agent-dir>/settings.json`: adds this folder's skills/, prompts/ and extensions/habait-guard to the `skills`, `prompts` and
  `extensions` arrays (absolute paths). Every other key is kept as it is (provider, model, ...). The file is backed up once to
  settings.json.bak-<date> before the first change. Idempotent.
- `<agent-dir>/APPEND_SYSTEM.md`: a copy of pi-agent/APPEND_SYSTEM.md with a marker line on top. An existing APPEND_SYSTEM.md
  that is not ours is backed up, never silently replaced.
- `--uninstall` removes our paths and our APPEND_SYSTEM.md (restoring a backed-up one if there is one).
Never reads or touches auth.json. The skills / prompts / guard are read from THIS folder at every start: editing them needs no
reinstall (just /reload); editing APPEND_SYSTEM.md does (re-run this).
"""
import argparse, json, os, shutil, datetime
HERE = os.path.dirname(os.path.abspath(__file__)).replace('\\', '/')
ap = argparse.ArgumentParser(); ap.add_argument('--agent-dir', default=os.path.expanduser('~/.pi/agent')); ap.add_argument('--uninstall', action='store_true'); ap.add_argument('--dry', action='store_true')
a = ap.parse_args(); AD = a.agent_dir; os.makedirs(AD, exist_ok=True)
MARK = '<!-- installed by habait pi-agent/install-global.py: edit the source in ' + HERE + '/APPEND_SYSTEM.md, then re-run it -->'
OURS = {'skills': HERE + '/skills', 'prompts': HERE + '/prompts', 'extensions': HERE + '/extensions/habait-guard'}
today = datetime.date.today().isoformat()
sp = os.path.join(AD, 'settings.json'); s = json.load(open(sp, encoding='utf-8')) if os.path.exists(sp) else {}
before = json.dumps(s, sort_keys=True)
for k, v in OURS.items():
    arr = [x for x in s.get(k, []) if x != v]
    if not a.uninstall: arr.append(v)
    if arr: s[k] = arr
    elif k in s: del s[k]
ap_ = os.path.join(AD, 'APPEND_SYSTEM.md'); src = open(os.path.join(HERE, 'APPEND_SYSTEM.md'), encoding='utf-8').read()
cur = open(ap_, encoding='utf-8').read() if os.path.exists(ap_) else None
print('agent dir:', AD); print('settings:', 'unchanged' if json.dumps(s, sort_keys=True) == before else 'updated ->', {k: s.get(k) for k in OURS})
if a.dry: raise SystemExit('dry: nothing written')
if json.dumps(s, sort_keys=True) != before:
    bk = sp + '.bak-' + today
    if os.path.exists(sp) and not os.path.exists(bk): shutil.copy(sp, bk); print('backed up', bk)
    json.dump(s, open(sp, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
if a.uninstall:
    if cur and cur.startswith(MARK):
        os.remove(ap_); bks = sorted(f for f in os.listdir(AD) if f.startswith('APPEND_SYSTEM.md.bak-'))
        if bks: shutil.copy(os.path.join(AD, bks[-1]), ap_); print('restored', bks[-1])
    print('uninstalled')
else:
    if cur is not None and not cur.startswith(MARK):
        bk = ap_ + '.bak-' + today; shutil.copy(ap_, bk); print('an existing APPEND_SYSTEM.md was not ours: backed up', bk)
    open(ap_, 'w', encoding='utf-8', newline='\n').write(MARK + '\n' + src.replace('\r\n', '\n'))
    print('APPEND_SYSTEM.md installed (', len(src), 'chars )')
print('done: start `pi` from any folder; inside a running session use /reload')
