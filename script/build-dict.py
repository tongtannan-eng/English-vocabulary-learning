#!/usr/bin/env python3
"""从 ECDICT 的 ecdict.csv 抽出常用词，生成 public/dict.json。

词库版权归 ECDICT 项目（MIT）：https://github.com/skywind3000/ECDICT
"""

import csv
import json
import sys
from pathlib import Path

csv.field_size_limit(10**7)

EXAM_TAGS = ("cet4", "cet6", "gk", "ky", "ielts", "toefl", "gre")
FORM_KEYS = {"p", "d", "i", "3", "s", "r", "t"}


def as_int(value: str) -> int:
    try:
        return int(value or 0)
    except ValueError:
        return 0


def is_common(row: dict[str, str]) -> bool:
    translation = (row.get("translation") or "").strip()
    if not any("\u4e00" <= char <= "\u9fff" for char in translation):
        return False
    word = (row.get("word") or "").strip().lower()
    if not word or len(word) > 40:
        return False
    if any("\u4e00" <= char <= "\u9fff" for char in word):
        return False
    tag = row.get("tag") or ""
    if as_int(row.get("oxford", "")) or as_int(row.get("collins", "")) >= 1:
        return True
    if any(mark in tag for mark in EXAM_TAGS):
        return True
    frq = as_int(row.get("frq", ""))
    bnc = as_int(row.get("bnc", ""))
    return (0 < frq <= 30000) or (0 < bnc <= 20000)


def parse_exchange(exchange: str) -> dict[str, list[str]]:
    grouped: dict[str, list[str]] = {}
    for item in (exchange or "").split("/"):
        if ":" not in item:
            continue
        key, raw = item.split(":", 1)
        forms = [part.strip().lower() for part in raw.split("|") if part.strip()]
        if forms:
            grouped.setdefault(key, []).extend(forms)
    return grouped


def main() -> None:
    source = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/ecdict.csv")
    target = Path(sys.argv[2] if len(sys.argv) > 2 else "public/dict.json")
    words: dict[str, str] = {}
    pending_forms: dict[str, str] = {}

    with source.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            lemma = (row.get("word") or "").strip().lower()
            if not is_common(row):
                exchange = parse_exchange(row.get("exchange") or "")
                for form in exchange.get("0", []):
                    if form and form != lemma:
                        pending_forms.setdefault(lemma, form)
                continue
            translation = "\n".join(
                line.strip() for line in (row.get("translation") or "").splitlines() if line.strip()
            )
            words[lemma] = translation
            exchange = parse_exchange(row.get("exchange") or "")
            for key in FORM_KEYS:
                for form in exchange.get(key, []):
                    if form != lemma:
                        pending_forms.setdefault(form, lemma)
            for form in exchange.get("0", []):
                if form and form != lemma:
                    pending_forms.setdefault(lemma, form)

    forms = {
        form: lemma
        for form, lemma in pending_forms.items()
        if form not in words and lemma in words
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps({"words": words, "forms": forms}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"words={len(words)} forms={len(forms)} bytes={target.stat().st_size}")
    for sample in ("care", "abandon", "book", "run"):
        print("---", sample)
        print(words.get(sample, "(missing)")[:240])


if __name__ == "__main__":
    main()
