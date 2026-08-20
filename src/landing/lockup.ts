/**
 * Die Verwandlung am Ende: aus dem Ring wird das erste O.
 *
 * Der Film hält auf seinem letzten Frame. Darüber wandert und schrumpft der
 * Ausschnitt, bis der Ring des Tieres genau in dem Kasten steht, den das Wort
 * für sein erstes O freigelassen hat. Danach ist die Schlange nicht mehr NEBEN
 * dem Wort, sie ist ein Buchstabe darin.
 *
 * WARUM DAS HIER RECHNET UND NICHT DAS STYLESHEET. Wo der Ring landen muss,
 * weiß erst der Umbruch: die Breite von „ROBOROS" hängt an der geladenen
 * Schrift, und die Zeile ist mittig. Der Kasten wird deshalb GEMESSEN, nicht
 * gerechnet. Damit können Wort und Bild per Bauart nicht auseinanderlaufen —
 * es gibt keine zweite Stelle, an der dieselbe Zahl gepflegt wird.
 *
 * WARUM NIE ÜBER 1. Ein Maßstab über 1 hieße: das Bild wird an der Stelle
 * hochgerechnet, an der die Seite am schärfsten sein muss. Der Maßstab ist
 * deshalb gekappt. Reicht der Film nicht bis an das gewünschte Maß, wird das
 * Wort kleiner — nicht das Bild unschärfer. Welcher Satz wie weit reicht,
 * steht als Messung in `choreografie.ts`.
 */
import type { Ringmass } from "./choreografie";

/**
 * Der Ring auf dem Schirm, BEVOR irgendetwas verwandelt wird.
 *
 * Rechnet denselben `cover`-Zuschnitt nach, den `zeichneDeckend` zeichnet:
 * das Bild wird so weit vergrößert, dass es beide Achsen füllt, und mittig
 * beschnitten. Läuft das hier auseinander, sitzt der Ring daneben.
 */
export function ringAufSchirm(r: Ringmass, breite: number, hoehe: number) {
  const deckung = Math.max(breite / r.breite, hoehe / r.hoehe);
  const bb = r.breite * deckung;
  const bh = r.hoehe * deckung;
  return {
    x: (breite - bb) / 2 + r.cx * bb,
    y: (hoehe - bh) / 2 + r.cy * bh,
    d: r.d * bb,
  };
}

/** Was das Lockup an Maßen braucht — ohne Umbruch, also vor dem Messen. */
export interface Masse {
  /** Durchmesser des Rings auf dem Schirm, in Bildpunkten. */
  ring: number;
  /** Schriftgröße von „ROBOROS", in Bildpunkten. */
  schrift: number;
  /** Um wie viel der Ausschnitt am Ende kleiner ist. Höchstens 1. */
  maßstab: number;
}

/**
 * Das Verhältnis von Ring zu Schrift.
 *
 * 330 zu 198 auf 1440, 90 zu 54 auf 390 — beides derselbe Faktor. Der Ring
 * ist absichtlich größer als die Versalhöhe: ein O in Schriftgröße läse sich
 * als Satzfehler, ein deutlich größeres als Zeichen.
 */
const RING_ZU_SCHRIFT = 5 / 3;

/** Wie breit der Ring im Verhältnis zum Fenster stehen soll. */
const RING_ANTEIL = 0.229;

/**
 * Die Maße für dieses Fenster.
 *
 * Erst das Wunschmaß aus der Fensterbreite, dann die Kappung am Film: mehr
 * als der Film hergibt, gibt es nicht. `schrift` folgt dem ERREICHTEN Ring,
 * nicht dem gewünschten — sonst stünde bei gekapptem Maßstab ein zu großes
 * Wort neben einem zu kleinen O.
 */
export function masse(r: Ringmass, breite: number, hoehe: number): Masse {
  const natur = ringAufSchirm(r, breite, hoehe);
  const maßstab = Math.min(1, (RING_ANTEIL * breite) / natur.d);
  const ring = natur.d * maßstab;
  return { ring, schrift: ring / RING_ZU_SCHRIFT, maßstab };
}

/** Eine Verwandlung, wie sie als CSS-`transform` auf den Canvas geht. */
export interface Verwandlung {
  maßstab: number;
  x: number;
  y: number;
}

/**
 * Die Verwandlung an der Stelle `a` (0 = unverändert, 1 = im Lockup).
 *
 * Gemischt wird über die MITTE DES RINGS, nicht über die Verschiebung. Der
 * Ring läuft dadurch auf gerader Bahn und mit gleichmäßigem Tempo an seinen
 * Platz. Mischte man stattdessen `x`/`y` der Verschiebung, liefe er eine
 * Kurve, weil der Maßstab gleichzeitig den Bezugspunkt verschiebt.
 *
 * `zielX`/`zielY` ist die Mitte des freigelassenen Kastens, gemessen am
 * Umbruch. Die Kappung steckt schon in `m.maßstab`.
 */
export function verwandlung(
  r: Ringmass,
  breite: number,
  hoehe: number,
  m: Masse,
  zielX: number,
  zielY: number,
  a: number,
): Verwandlung {
  const natur = ringAufSchirm(r, breite, hoehe);
  const s = 1 + (m.maßstab - 1) * a;
  const rx = natur.x + (zielX - natur.x) * a;
  const ry = natur.y + (zielY - natur.y) * a;
  return {
    maßstab: s,
    x: rx - breite / 2 - (natur.x - breite / 2) * s,
    y: ry - hoehe / 2 - (natur.y - hoehe / 2) * s,
  };
}
