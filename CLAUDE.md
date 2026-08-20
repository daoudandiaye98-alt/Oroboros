# CLAUDE.md

Regeln für die Arbeit an diesem Repo. Jeder Abschnitt steht für sich.

## React

Gilt für jeden, der an der Landing arbeitet.

### Die eine Regel

**Die Choreografie läuft außerhalb von React.**

React rendert neu, wenn State sich ändert. Die Landing ändert ihren Zustand
60-mal pro Sekunde. Beides zusammen ergibt 60 Renderdurchläufe je Sekunde für
eine Bewegung, die nur `drawImage` braucht.

```jsx
// FALSCH — jeder Frame löst einen Renderdurchlauf aus
const [fortschritt, setFortschritt] = useState(0);
useEffect(() => {
  const lauf = () => { setFortschritt(p(buehne)); requestAnimationFrame(lauf); };
  requestAnimationFrame(lauf);
}, []);
```

```jsx
// RICHTIG — der Wert lebt in einem Ref, React sieht ihn nie
const fortschritt = useRef(0);
const cv = useRef(null);
useEffect(() => {
  let id;
  const lauf = () => {
    fortschritt.current += (p(buehne) - fortschritt.current) * 0.13;
    male(cv.current, fortschritt.current);      // direkt auf den Canvas
    id = requestAnimationFrame(lauf);
  };
  id = requestAnimationFrame(lauf);
  return () => cancelAnimationFrame(id);         // aufräumen, sonst zwei Schleifen
}, []);
```

**`useState` nur für Zustände, die der Nutzer als Wechsel wahrnimmt** —
Prolog läuft / Bühne frei / Reduced-Motion. Das sind drei Wechsel auf der
ganzen Seite, nicht sechzig pro Sekunde.

### Was daraus folgt

**Aufräumen ist Pflicht.** Jeder `useEffect` mit `requestAnimationFrame`,
`IntersectionObserver` oder `addEventListener` gibt eine Abräumfunktion zurück.
Ohne sie laufen nach einem Hot-Reload zwei Schleifen gleichzeitig und die
Bewegung wird doppelt so schnell — ein Fehler, der sich als „ruckelt" tarnt.

**Der Canvas gehört nicht React.** `<canvas ref={cv} />` wird einmal gerendert
und danach nie wieder von React angefasst. Keine Props, die sich je Frame ändern.

**`key` bei Listen ist Pflicht**, aber nirgends in der Landing relevant — dort
gibt es keine Listen. Wird erst bei den Werkseiten wichtig.

**Kein `style={{}}` je Frame.** Ein neues Objekt bei jedem Durchlauf erzwingt
Vergleiche. Bewegte Werte gehen über `element.style.transform` direkt oder über
eine CSS-Variable, die im rAF gesetzt wird.

**Messen erst nach `document.fonts.ready`.** `measureText` gegen die
Ersatzschrift liefert falsche Breiten — das war die Ursache des schiefen
Lockups. Kein React-Thema, aber derselbe Fehlertyp: zu früh gemessen.

### Wo React trotzdem gebraucht wird

Für die Struktur: Bühne, Textelemente, Reduced-Motion-Zweig, später die
Sektionen der Werkseiten. Dort ist es das richtige Werkzeug — deklarativ,
zusammensetzbar, prüfbar.

Die Trennlinie ist einfach: **Was der Nutzer als Zustand erlebt, gehört React.
Was er als Bewegung erlebt, gehört dem rAF.**
