#!/usr/bin/env python3
"""Egyszerű HTML ellenőrző, hogy elkapja a duplikált <body> tageket és az árva </div> elemeket."""

from __future__ import annotations

import sys
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

html_files = sorted(ROOT.rglob("*.html"))
errors: list[str] = []

for html_file in html_files:
    content = html_file.read_text(encoding="utf-8", errors="ignore")
    lowered = content.lower()

    body_count = len(re.findall(r"<body\b", lowered))
    if body_count != 1:
        errors.append(
            f"{html_file.relative_to(ROOT)}: váratlan <body> elemszám ({body_count})."
        )

    open_divs = len(re.findall(r"<div\b", lowered))
    close_divs = lowered.count("</div>")
    if open_divs != close_divs:
        errors.append(
            f"{html_file.relative_to(ROOT)}: <div> ({open_divs}) és </div> ({close_divs}) tagek száma nem egyezik."
        )

if errors:
    print("HTML validációs hibák:")
    for err in errors:
        print(f" - {err}")
    sys.exit(1)

print("Minden HTML fájl megfelel az ellenőrzésnek.")
