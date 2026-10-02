#!/usr/bin/env python3
"""Build a small, local-only classic-script archive for later platform checks."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re

ROOT = Path(__file__).resolve().parents[1]
FILES = ("index.html", "styles.css", "logic.js", "levels.js", "game.js", "icon.svg", "THIRD_PARTY_NOTICES.md")
output = ROOT / "dist" / "apricot-pantry-offline.zip"

for filename in FILES:
    text = (ROOT / filename).read_text(encoding="utf-8")
    if filename in ("index.html", "styles.css", "logic.js", "levels.js", "game.js"):
        if re.search(r"https?://|@import\s+url|<script[^>]+type=[\"']module", text, re.I):
            raise SystemExit(f"Remote or module dependency in {filename}")

output.parent.mkdir(exist_ok=True)
with ZipFile(output, "w", ZIP_DEFLATED, compresslevel=9) as archive:
    for filename in FILES:
        archive.write(ROOT / filename, filename)
    archive.write(ROOT.parents[1] / "LICENSE", "LICENSE")

with ZipFile(output) as archive:
    assert set(archive.namelist()) == set(FILES) | {"LICENSE"}
    assert archive.testzip() is None

size = output.stat().st_size
if size > 2 * 1024 * 1024:
    raise SystemExit(f"Archive exceeds 2 MiB: {size} bytes")
print(f"{output} ({size} bytes)")
