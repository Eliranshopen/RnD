#!/usr/bin/env python3
"""Carry the place card's brand element from viewer/template.html into a BUILT tour (dist/<id>/index.html) without a full rebuild
(round 9, 2026-11-09: Eliran's Habait wordmark replaces the text «Habait»). It replaces exactly ONE occurrence of the old element
and refuses otherwise; the next build-tour.mjs run produces the same bytes from the template. Dry run by default; --go writes, and a
copy of the previous file goes to <dist parent>/<id>.index.pre-brand.html first (outside the staged folder).
usage: python tools/apply-brand-to-dist.py <dist dir or index.html> [--go]"""
import os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, '..', 'viewer', 'template.html')
OLD = '<span class="t-brand" dir="ltr" lang="en">Habait</span>'

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: sys.exit('usage: apply-brand-to-dist.py <dist dir or index.html> [--go]')
    target = args[0] if args[0].endswith('.html') else os.path.join(args[0], 'index.html')
    tpl = open(TEMPLATE, encoding='utf-8').read()
    m = re.search(r'<span class="t-brand" dir="ltr" lang="en"><svg class="t-brand-logo".*?</svg></span>', tpl, re.S)
    if not m: sys.exit('apply-brand: the template has no wordmark brand element')
    new = m.group(0)
    css = re.search(r'\.t-brand-logo \{[^}]*\}', open(os.path.join(HERE, '..', 'viewer', 'tour.css'), encoding='utf-8').read())
    s = open(target, encoding='utf-8').read()
    if new in s: print('already applied:', target); return
    n = s.count(OLD)
    if n != 1: sys.exit(f'apply-brand: expected exactly one old brand element in {target}, found {n}')
    out = s.replace(OLD, new, 1)
    if css and css.group(0) not in out:
        out = out.replace('</style>', css.group(0) + '\n</style>', 1)
    print(('write ' if '--go' in sys.argv else 'dry: ') + target, len(s), '->', len(out), 'bytes')
    if '--go' in sys.argv:
        d = os.path.dirname(os.path.abspath(target))
        shutil.copy2(target, os.path.join(os.path.dirname(d), os.path.basename(d) + '.index.pre-brand.html'))
        open(target, 'w', encoding='utf-8').write(out)

if __name__ == '__main__':
    main()
