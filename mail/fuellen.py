#!/usr/bin/env python3
"""Füllt die Mail-Vorlage „Launch-Angebot“.

Ohne Angaben entsteht die neutrale Fassung, die unter /mail/launch im Browser steht
(„Im Browser ansehen“) — und launch.txt als Klartext-Alternative.

  python3 mail/fuellen.py
  python3 mail/fuellen.py --anrede "Guten Tag Frau Meyer," \
      --einstieg "Ihr Salon in Ehrenfeld hat 4,9 Sterne — Ihre Website zeigt davon nichts." \
      --ref mail-salon-meyer --aus /tmp/meyer

Jeder Wert wird für HTML maskiert. --ref lässt nur a–z, 0–9 und : _ . - zu (so nimmt die Kasse ihn an).
Ein leerer Einstieg nimmt seinen Absatz mit. Bleibt ein Platzhalter stehen, bricht das Werkzeug ab.
"""
import argparse
import html
import pathlib
import re
import sys

HIER = pathlib.Path(__file__).resolve().parent
STANDARD = {
    "anrede": "Guten Tag,",
    "einstieg": "",
    "ref": "mail-launch",
    "grund": "Sie erhalten diese E-Mail, weil Sie sich für eine Website von Oroboros Design interessiert haben.",
    "abmelden": "mailto:info@oroboros-design.com?subject=Stopp",
}


def fuellen(vorlage: str, werte: dict, als_html: bool) -> str:
    if not re.fullmatch(r"[A-Za-z0-9:_.-]{1,80}", werte["ref"]):
        sys.exit("--ref: nur a–z, 0–9 und : _ . - (höchstens 80 Zeichen)")
    if not re.match(r"^(https://|mailto:)", werte["abmelden"]):
        sys.exit("--abmelden: nur https:// oder mailto:")
    text = vorlage
    werte = {**werte, "wir": "Wir" if werte["einstieg"].strip() else "wir"}   # nach der Anrede mit Komma klein, nach einem Satz groß
    if not werte["einstieg"].strip():
        # der ganze Absatz bzw. die ganze Zeile fällt weg
        text = re.sub(r"[ \t]*<p[^>]*>\{\{einstieg\}\}</p>\n", "", text)
        text = re.sub(r"\{\{einstieg\}\}\n\n", "", text)
    for name, wert in werte.items():
        text = text.replace("{{" + name + "}}", html.escape(wert, quote=True) if als_html else wert)
    rest = re.findall(r"\{\{[^}]+\}\}", text)
    if rest:
        sys.exit(f"Platzhalter nicht gefüllt: {sorted(set(rest))}")
    return text


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for name, wert in STANDARD.items():
        p.add_argument(f"--{name}", default=wert)
    p.add_argument("--aus", default=str(HIER / "launch"), help="Zielpfad ohne Endung (schreibt .html und .txt)")
    a = p.parse_args()
    werte = {name: getattr(a, name) for name in STANDARD}
    ziel = pathlib.Path(a.aus)
    h = fuellen((HIER / "launch.vorlage.html").read_text(encoding="utf-8"), werte, True)
    t = fuellen((HIER / "launch.vorlage.txt").read_text(encoding="utf-8"), werte, False)
    ziel.with_suffix(".html").write_text(h, encoding="utf-8")
    ziel.with_suffix(".txt").write_text(t, encoding="utf-8")
    print(f"{ziel.with_suffix('.html')}  {len(h.encode('utf-8')) / 1024:.1f} KB (Gmail kürzt ab 102 KB)")
    print(f"{ziel.with_suffix('.txt')}")


if __name__ == "__main__":
    main()
