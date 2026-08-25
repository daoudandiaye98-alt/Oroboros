/**
 * Der Spalter.
 *
 * Zerlegt den Text eines Elements in Wörter oder Zeichen, jedes in einem
 * eigenen `<span class="teil">`. Nur so lässt sich eine Staffelung überhaupt
 * bewegen — ein Textknoten hat keine Transformation.
 *
 * DREI REGELN, DIE NICHT VERHANDELBAR SIND:
 *
 * 1. LEERZEICHEN BLEIBEN AUSSERHALB DER SPANS. Steckte das Leerzeichen im
 *    `inline-block`, könnte der Browser dort nicht mehr umbrechen: eine lange
 *    Zeile liefe aus der Fläche, statt umzubrechen. Der Umbruch muss natürlich
 *    bleiben.
 * 1a. ZEICHENWEISE HEISST TROTZDEM WORTWEISE UMBRECHEN. Zwischen zwei
 *    `inline-block` darf der Browser umbrechen — auch mitten im Wort. Bei
 *    einer einzelnen kurzen Zeile fiel das nie auf; im ersten mehrzeiligen
 *    Absatz stand es sofort da: „den Kopf des Königs und seine F / üße",
 *    „Aus dem Bild wird ein Gedanke, den man a / ufschreiben kann". Deshalb
 *    liegt jedes Wort in einer eigenen Hülle, die als Ganzes unteilbar ist;
 *    die Zeichen darin sind weiterhin einzeln bewegbar.
 * 2. ZERHACKTER TEXT WIRD NIE VORGELESEN. Ein Screenreader liest 30 Spans als
 *    30 Fragmente. Deshalb bekommt das Elternelement `aria-label` mit dem
 *    ORIGINALTEXT, und jedes Stück `aria-hidden="true"`. Wer das weglässt,
 *    macht die Seite für den Bewegungseffekt unbenutzbar.
 * 3. GENAU EINMAL BEIM MOUNT. Nie in einem Rollschritt, nie in einer
 *    Bildschleife: das Zerlegen schreibt DOM und erzwingt ein Neu-Layout.
 */

/** Die Marke, an der ein bereits zerlegtes Element erkannt wird. */
const MARKE = "data-zerlegt";

export type Modus = "wort" | "zeichen";

/**
 * Alle Stücke eines bereits zerlegten Elements.
 *
 * Nicht `querySelectorAll('.teil')` in der Tiefe: ein verschachteltes
 * zerlegtes Element würde seine Stücke mit hochreichen und zweimal bewegt.
 */
function vorhandeneTeile(el: HTMLElement): HTMLElement[] {
  // Im Zeichenmodus liegen die Stücke eine Ebene tiefer, in ihrer Worthülle.
  // `querySelectorAll` liefert in Dokumentreihenfolge — also in Lesereihenfolge.
  return Array.from(el.querySelectorAll<HTMLElement>(":scope > .teil, :scope > .wort > .teil"));
}

/**
 * Zerlegt `el` in Stücke und gibt sie in Lesereihenfolge zurück.
 *
 * IDEMPOTENT: ein zweiter Aufruf auf demselben Element tut nichts und gibt die
 * Stücke des ersten zurück. Ohne diese Zusage würde ein React-Mount im
 * Strict-Modus (zwei Läufe) den Text doppelt zerhacken — einmal in Wörter,
 * einmal in Wörter aus Spans.
 *
 * WARUM NICHT GSAPs SplitText: SplitText löst dieselbe Aufgabe, hängt das
 * Leerzeichen aber je nach Fassung mit in das Wort-Element und setzt keine
 * aria-Regel. Beides müsste hier ohnehin nachgezogen werden — dann kann der
 * Spalter auch gleich die zwanzig Zeilen selbst schreiben und genau das tun,
 * was oben steht. Der Plugin-Aufruf entfiele, die Sonderfälle nicht.
 */
export function zerlege(el: HTMLElement, modus: Modus): HTMLElement[] {
  if (el.getAttribute(MARKE)) return vorhandeneTeile(el);

  const original = (el.textContent ?? "").trim();
  if (!original) return [];

  // Regel 2 zuerst — auch wenn der Aufbau unten scheitert, ist der Text dann
  // bereits als Ganzes ausgezeichnet und nicht als Trümmerfeld.
  el.setAttribute("aria-label", original);

  // `\s+` trennt an jeder Art von Zwischenraum; die Trenner bleiben in der
  // Liste (Klammer im Muster), damit sie als nackte Textknoten zurückkommen.
  // In BEIDEN Modi wird zuerst an Wörtern getrennt — im Zeichenmodus wird
  // danach jedes Wort noch einmal zerlegt, innerhalb seiner Hülle (Regel 1a).
  const stuecke = original.split(/(\s+)/);

  const doku = el.ownerDocument;
  const sammler = doku.createDocumentFragment();
  const teile: HTMLElement[] = [];

  const stueckchen = (text: string): HTMLElement => {
    const teil = doku.createElement("span");
    teil.className = "teil";
    teil.setAttribute("aria-hidden", "true");
    teil.textContent = text;
    teile.push(teil);
    return teil;
  };

  for (const stueck of stuecke) {
    if (stueck === "") continue;
    // Regel 1: Zwischenraum als nackter Textknoten, nie in einem Kasten.
    if (/^\s+$/.test(stueck)) {
      sammler.appendChild(doku.createTextNode(stueck));
      continue;
    }
    if (modus === "wort") {
      sammler.appendChild(stueckchen(stueck));
      continue;
    }
    // Regel 1a: das Wort als unteilbare Hülle, die Zeichen einzeln darin.
    const wort = doku.createElement("span");
    wort.className = "wort";
    wort.setAttribute("aria-hidden", "true");
    for (const zeichen of Array.from(stueck)) wort.appendChild(stueckchen(zeichen));
    sammler.appendChild(wort);
  }

  el.replaceChildren(sammler);
  el.setAttribute(MARKE, modus);
  return teile;
}

/** Ist dieses Element schon zerlegt — und wie? */
export function zerlegtAls(el: HTMLElement): Modus | null {
  return (el.getAttribute(MARKE) as Modus | null) ?? null;
}

/**
 * Macht das Zerlegen rückgängig und stellt den Originaltext her.
 *
 * Gebraucht beim Routenwechsel und vom Schalter in `/werkstatt`, der den
 * ruhigen Zustand aus demselben Markup neu aufbauen muss. Ohne diesen Weg
 * bliebe ein einmal zerlegter Absatz für immer zerlegt.
 */
export function fuege(el: HTMLElement): void {
  if (!el.getAttribute(MARKE)) return;
  const original = el.getAttribute("aria-label") ?? el.textContent ?? "";
  el.replaceChildren(el.ownerDocument.createTextNode(original));
  el.removeAttribute(MARKE);
  el.removeAttribute("aria-label");
}
