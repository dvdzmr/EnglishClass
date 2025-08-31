#!/usr/bin/env python3
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
pattern = re.compile(r"^\d{3}$")

def check_lesson(folder):
    """Optional: basic sanity checks; non-blocking."""
    path = os.path.join(ROOT, folder)
    issues = []
    for fname in ["dialogue_teacher.md", "dialogue_pupil.md", "dialogue_image.png"]:
        if not os.path.exists(os.path.join(path, fname)):
            issues.append(f"missing {folder}/{fname}")
    wt = os.path.join(path, "watch_together.txt")
    if not os.path.exists(wt):
        issues.append(f"optional: {folder}/watch_together.txt not found")
    return issues

def main():
    dirs = [d for d in os.listdir(ROOT) if os.path.isdir(os.path.join(ROOT, d)) and pattern.match(d)]
    # sort numerically (001, 002, 010, …)
    dirs = sorted(dirs, key=lambda x: int(x))
    out = os.path.join(ROOT, "lessons.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(dirs, f, ensure_ascii=False, indent=2)
    # print soft warnings
    warn = []
    for d in dirs:
        warn.extend(check_lesson(d))
    if warn:
        print("[gen_lessons] Warnings:\n  - " + "\n  - ".join(warn))
    print(f"[gen_lessons] wrote lessons.json with {len(dirs)} lessons")

if __name__ == "__main__":
    sys.exit(main())
