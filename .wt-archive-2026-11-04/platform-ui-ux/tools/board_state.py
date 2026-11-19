# set a card's State cell in the board README. usage: python board_state.py <NN> "<new state text>"
import re, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
p = r"C:\RnD\development\tasks\platform-ui-ux\README.md"
nn, new = sys.argv[1], sys.argv[2]
lines = open(p, encoding="utf-8").read().split("\n")
hit = 0
for i, l in enumerate(lines):
    if l.startswith("| ") and f"| [{nn}](task-{nn}-" in l:
        cells = l.split(" | ")
        cells[-1] = new + " |"
        lines[i] = " | ".join(cells)
        hit += 1
assert hit == 1, hit
open(p, "w", encoding="utf-8", newline="").write("\n".join(lines))
print("card", nn, "->", new)
