#!/usr/bin/env python3
"""Build the self-contained Xiaohongshu mini-tool ZIP from this game's sources."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dist" / "xhs"
ARCHIVE = ROOT / "dist" / "apricot-pantry-xhs.zip"
FILES = ("index.html", "styles.css", "logic.js", "levels.js", "game.js", "icon.svg")


def rgba(match):
    color = match.group(1)
    red, green, blue, alpha = (int(color[index:index + 2], 16) for index in (0, 2, 4, 6))
    return f"rgba({red},{green},{blue},{alpha / 255:.3f})"


if OUTPUT.exists():
    shutil.rmtree(OUTPUT)
OUTPUT.mkdir(parents=True)

for name in FILES:
    content = (ROOT / name).read_text(encoding="utf-8")
    if name == "index.html":
        content = re.sub(r'(\b(?:src|href)=")(?=[\w.-]+\.(?:js|css|svg))', r"\1./", content)
        content = re.sub(r"\?v=\d+", "", content)
    elif name == "styles.css":
        content = re.sub(r"#([0-9a-fA-F]{8})(?![0-9a-fA-F])", rgba, content)
    (OUTPUT / name).write_text(content, encoding="utf-8")

html = (OUTPUT / "index.html").read_text(encoding="utf-8")
assert len(re.findall(r"<script\b", html)) == 3
assert not re.search(r"<script(?![^>]*\bsrc=)|\bonclick=|javascript:|https?://|type=[\"']module", html, re.I)
for name in ("logic.js", "levels.js", "game.js"):
    script = (OUTPUT / name).read_text(encoding="utf-8")
    assert not re.search(r"\?\.|\?\?|\.at\(|\bcatch\s*\{|\b(?:import|export)\b", script)

with ZipFile(ARCHIVE, "w", ZIP_DEFLATED, compresslevel=9) as archive:
    for name in FILES:
        info = ZipInfo(name, date_time=(2026, 9, 25, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, (OUTPUT / name).read_bytes(), compress_type=ZIP_DEFLATED, compresslevel=9)

with ZipFile(ARCHIVE) as archive:
    assert set(archive.namelist()) == set(FILES)
    assert archive.testzip() is None
assert ARCHIVE.stat().st_size <= 10 * 1024 * 1024
print(f"{ARCHIVE} ({ARCHIVE.stat().st_size} bytes)")
