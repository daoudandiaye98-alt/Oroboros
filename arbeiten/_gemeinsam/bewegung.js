/* Oroboros Design · Bewegung für die Konzeptseiten (arbeiten/*).
   Eine Quelle für alle vier Seiten: Lenis als einziger Scroller, GSAP-Ticker
   als einzige Uhr, Wort-Reveal über [data-woerter], Auftritt über
   [data-auftritt]. Drei Kurven, wie im Werk festgelegt:
     standard  cubic-bezier(.4,0,.2,1)    → "power2.inOut"
     klein     cubic-bezier(.22,.61,.36,1) → "power3.out"
     drama     cubic-bezier(.77,0,.175,1)  → "expo.inOut"
   Ohne JS (oder mit reduzierter Bewegung) ist alles sofort sichtbar: der
   Startzustand „unsichtbar" hängt an html.ob-bewegt, die dieses Skript setzt. */
(function () {
  "use strict";
  var reduziert = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var OB = (window.OB = { reduziert: reduziert, lenis: null });
  if (!window.gsap || !window.ScrollTrigger || reduziert) {
    document.documentElement.classList.remove("ob-bewegt");
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add("ob-bewegt");

  if (window.Lenis) {
    var lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    OB.lenis = lenis;
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var ziel = document.querySelector(a.getAttribute("href"));
      if (!ziel) return;
      e.preventDefault();
      lenis.scrollTo(ziel, { offset: -40, duration: 1.2 });
    });
  }

  /* Wörter einzeln verpacken — Text bleibt für Screenreader am Element (aria-label). */
  function zerlege(el) {
    if (el.dataset.zerlegt) return el.querySelectorAll(".ob-wi");
    var text = el.textContent.replace(/\s+/g, " ").trim();
    el.setAttribute("aria-label", text);
    var teile = [];
    el.childNodes.forEach(function (n) { teile.push(n); });
    var frag = document.createDocumentFragment();
    teile.forEach(function (n) {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (w) {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(" ")); return; }
          var a = document.createElement("span"); a.className = "ob-w"; a.setAttribute("aria-hidden", "true");
          var i = document.createElement("span"); i.className = "ob-wi"; i.textContent = w;
          a.appendChild(i); frag.appendChild(a);
        });
      } else if (n.nodeType === 1) {
        var a = document.createElement("span"); a.className = "ob-w"; a.setAttribute("aria-hidden", "true");
        var i = document.createElement("span"); i.className = "ob-wi";
        i.appendChild(n.cloneNode(true)); a.appendChild(i); frag.appendChild(a);
      }
    });
    el.textContent = ""; el.appendChild(frag); el.dataset.zerlegt = "1";
    return el.querySelectorAll(".ob-wi");
  }
  OB.zerlege = zerlege;

  document.querySelectorAll("[data-woerter]").forEach(function (el) {
    var w = zerlege(el);
    gsap.set(w, { yPercent: 110 });
    el.style.visibility = "visible";
    ScrollTrigger.create({
      trigger: el, start: "top 88%", once: true,
      onEnter: function () {
        el.classList.add("ob-da");
        gsap.to(w, { yPercent: 0, duration: 1.1, ease: "power3.out", stagger: Number(el.dataset.woerter) || 0.06 });
      },
    });
  });

  document.querySelectorAll("[data-auftritt]").forEach(function (el) {
    ScrollTrigger.create({
      trigger: el, start: "top 90%", once: true,
      onEnter: function () {
        gsap.fromTo(el, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 1, ease: "power3.out", delay: Number(el.dataset.auftritt) || 0 });
      },
    });
  });

  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
