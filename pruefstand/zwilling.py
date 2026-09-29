#!/usr/bin/env python3
"""Zwilling: erzeugt en.html aus index.html.

Stil und Skripte gehen 1:1 hinüber — die Skripte tragen beide Sprachen und
schalten über <html lang>. Übersetzt wird nur Text, über die Tabelle unten.
Jede Zeile muss genau so oft treffen wie angegeben; sonst bricht das Werkzeug
ab und nennt die Stelle. Ändert sich ein deutscher Satz, meldet es sich hier,
statt dass die englische Fassung still veraltet.

Aufruf:  python3 pruefstand/zwilling.py        (schreibt en.html)
Prüfen:  node pruefstand/audit.mjs --nur=seo   (Zwillingsprüfung: Stil, Skripte, Aufbau)
"""
import json
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
DE = (WURZEL / "index.html").read_text(encoding="utf-8")

JSON_LD_EN = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": ["Organization", "ProfessionalService"],
            "@id": "https://oroboros-design.com/#organisation",
            "name": "Oroboros Design",
            "url": "https://oroboros-design.com/en",
            "logo": "https://oroboros-design.com/vendor/img/logo.svg",
            "image": "https://oroboros-design.com/vendor/img/og-en.jpg",
            "description": "AI company from Cologne, Germany: design and development in four AI fields — websites, AI visibility, AI automation and AI video.",
            "email": "oroborosdesign@gmail.com",
            "telephone": "+49 151 58775031",
            "priceRange": "€0 – €1,500",
            "founder": {"@type": "Person", "name": "Daouda Ndiaye"},
            "address": {"@type": "PostalAddress", "streetAddress": "Eulenbergstraße 22", "postalCode": "51065", "addressLocality": "Köln", "addressCountry": "DE"},
            "areaServed": ["DE", "AT", "CH", "EU", "US"],
            "knowsAbout": ["Web design", "Web development", "AI visibility", "Generative engine optimization", "AI automation", "AI video", "Chatbots"],
            "sameAs": ["https://www.instagram.com/oroboros.design/"],
        },
        {"@type": "WebSite", "@id": "https://oroboros-design.com/#website", "url": "https://oroboros-design.com/en", "name": "Oroboros Design", "inLanguage": "en", "publisher": {"@id": "https://oroboros-design.com/#organisation"}},
        {"@type": "Service", "name": "Website in 48 hours", "serviceType": "Web design and development", "provider": {"@id": "https://oroboros-design.com/#organisation"}, "url": "https://oroboros-design.com/en#websites",
         "description": "A website with structure, copy, images, contact path and findability, handed over within two working days of the deposit.",
         "offers": {"@type": "Offer", "price": "1500", "priceCurrency": "EUR", "url": "https://oroboros-design.com/en#websites"}},
        {"@type": "Service", "name": "AI automation starter", "serviceType": "Process automation with AI", "provider": {"@id": "https://oroboros-design.com/#organisation"}, "url": "https://oroboros-design.com/en#automation",
         "description": "One workflow automated — enquiries, quotes, bookings or follow-ups — delivered with a handover.",
         "offers": {"@type": "Offer", "price": "990", "priceCurrency": "EUR", "url": "https://oroboros-design.com/en#automation"}},
        {"@type": "Service", "name": "AI chat for websites", "serviceType": "AI assistant for websites", "provider": {"@id": "https://oroboros-design.com/#organisation"}, "url": "https://oroboros-design.com/en#ki-chat",
         "description": "An assistant on your website that answers questions from your own information and takes enquiries — around the clock.",
         "offers": {"@type": "Offer", "price": "99", "priceCurrency": "EUR", "url": "https://oroboros-design.com/en#ki-chat", "priceSpecification": {"@type": "UnitPriceSpecification", "price": "99", "priceCurrency": "EUR", "unitText": "month"}}},
        {"@type": "Service", "name": "AI content, monthly", "serviceType": "Social media content with AI", "provider": {"@id": "https://oroboros-design.com/#organisation"}, "url": "https://oroboros-design.com/en#inhalte",
         "description": "Eight posts a month for Instagram, Facebook or LinkedIn — image and copy, ready to approve.",
         "offers": {"@type": "Offer", "price": "149", "priceCurrency": "EUR", "url": "https://oroboros-design.com/en#inhalte", "priceSpecification": {"@type": "UnitPriceSpecification", "price": "149", "priceCurrency": "EUR", "unitText": "month"}}},
        {"@type": "Product", "name": "Nennbar", "brand": {"@type": "Brand", "name": "Nennbar"}, "url": "https://angel-phi-eight.vercel.app/nennbar/",
         "description": "Makes businesses readable for AI assistants such as ChatGPT, Perplexity and Siri: llms.txt, structured data, questions and answers.",
         "offers": [
             {"@type": "Offer", "name": "Nennbar package", "price": "199", "priceCurrency": "EUR", "url": "https://oroboros-design.com/en#nennbar"},
             {"@type": "Offer", "name": "Installation by us", "price": "99", "priceCurrency": "EUR", "url": "https://oroboros-design.com/en#nennbar"},
             {"@type": "Offer", "name": "Monitor, monthly", "price": "39", "priceCurrency": "EUR", "url": "https://oroboros-design.com/en#nennbar"},
             {"@type": "Offer", "name": "Checklist, 100 websites", "price": "49", "priceCurrency": "EUR", "url": "https://angel-phi-eight.vercel.app/nennbar/pruefliste/"},
             {"@type": "Offer", "name": "Checklist, 500 websites", "price": "149", "priceCurrency": "EUR", "url": "https://angel-phi-eight.vercel.app/nennbar/pruefliste/"}]},
        {"@type": "Product", "name": "Losgeschickt", "brand": {"@type": "Brand", "name": "Losgeschickt"}, "url": "https://angel-phi-eight.vercel.app/losgeschickt/",
         "description": "Finds matching jobs and writes cover letters from your CV — by email, for you to check and send.",
         "offers": [
             {"@type": "Offer", "name": "Beta, seven days", "price": "39", "priceCurrency": "EUR", "url": "https://oroboros-design.com/en#losgeschickt"},
             {"@type": "Offer", "name": "Month", "price": "79", "priceCurrency": "EUR", "url": "https://oroboros-design.com/en#losgeschickt"},
             {"@type": "Offer", "name": "Plus", "price": "129", "priceCurrency": "EUR", "url": "https://oroboros-design.com/en#losgeschickt"}]},
        {"@type": "Product", "name": "Bildtakt", "brand": {"@type": "Brand", "name": "Bildtakt"}, "url": "https://angel-phi-eight.vercel.app/bildtakt/",
         "description": "Short vertical clips made from a business's logo and photos — for Instagram, TikTok and its own website.",
         "offers": [
             {"@type": "Offer", "name": "Auftakt, three clips", "price": "149", "priceCurrency": "EUR", "url": "https://oroboros-design.com/en#bildtakt"},
             {"@type": "Offer", "name": "Takt, eight clips a month", "price": "299", "priceCurrency": "EUR", "url": "https://oroboros-design.com/en#bildtakt"}]},
    ],
}

# (Deutsch, Englisch, erwartete Treffer)
TABELLE = [
    # ── Kopf ─────────────────────────────────────────────────────────────
    ('<html lang="de">', '<html lang="en">', 1),
    ('<title>Oroboros Design — KI-Unternehmen aus Köln</title>', '<title>Oroboros Design — AI company from Cologne, Germany</title>', 1),
    ('content="KI-Unternehmen aus Köln: Websites in 48 Stunden, Sichtbarkeit in ChatGPT &amp; Co., KI-Automation und KI-Video. Kostenloser Website-Check, Beratung mit Angel."',
     'content="AI company from Cologne: websites in 48 hours, visibility in ChatGPT &amp; co., AI automation and AI video. Free website check and a live consultation with Angel."', 1),
    ('<link rel="canonical" href="https://oroboros-design.com/">', '<link rel="canonical" href="https://oroboros-design.com/en">', 1),
    ('<meta property="og:locale:alternate" content="en_US">', '<meta property="og:locale:alternate" content="de_DE">', 1),
    ('<meta property="og:locale" content="de_DE">', '<meta property="og:locale" content="en_US">', 1),
    ('<meta property="og:title" content="Oroboros Design — KI-Unternehmen aus Köln">', '<meta property="og:title" content="Oroboros Design — AI company from Cologne">', 1),
    ('<meta property="og:description" content="Design und Entwicklung in vier KI-Feldern: Websites, KI-Sichtbarkeit, Automation, Video. Betrieben mit Angel, unserer eigenen KI.">',
     '<meta property="og:description" content="Design and development in four AI fields: websites, AI visibility, automation, video. Run with Angel, our own AI.">', 1),
    ('<meta property="og:url" content="https://oroboros-design.com/">', '<meta property="og:url" content="https://oroboros-design.com/en">', 1),
    ('<meta property="og:image" content="https://oroboros-design.com/vendor/img/og.jpg">', '<meta property="og:image" content="https://oroboros-design.com/vendor/img/og-en.jpg">', 1),
    ('content="Glühender Oroboros aus Bronze auf schwarzer Bühne, Titel: Bauen Sie das Morgen"', 'content="Glowing bronze ouroboros on a black stage, title: Build tomorrow"', 1),
    ('<meta name="twitter:title" content="Oroboros Design — KI-Unternehmen aus Köln">', '<meta name="twitter:title" content="Oroboros Design — AI company from Cologne">', 1),
    ('<meta name="twitter:description" content="Websites in 48 Stunden, Sichtbarkeit in KI-Antworten, KI-Automation und KI-Video. Aus Köln.">',
     '<meta name="twitter:description" content="Websites in 48 hours, visibility in AI answers, AI automation and AI video. From Cologne, Germany.">', 1),
    ('<meta name="twitter:image" content="https://oroboros-design.com/vendor/img/og.jpg">', '<meta name="twitter:image" content="https://oroboros-design.com/vendor/img/og-en.jpg">', 1),

    # ── Kopfzeile ────────────────────────────────────────────────────────
    ('<a class="sprung" href="#doc">Zum Inhalt springen</a>', '<a class="sprung" href="#doc">Skip to content</a>', 1),
    ('aria-label="Oroboros Design — zum Anfang"', 'aria-label="Oroboros Design — back to top"', 2),
    ('<nav class="kopf-nav" aria-label="Seite">', '<nav class="kopf-nav" aria-label="Page">', 1),
    ('    <a href="#was-wir-tun">Was wir tun</a>\n    <a href="#unternehmen">Unternehmen</a>\n    <a href="#arbeiten">Arbeiten</a>\n    <a href="#angel-abschnitt">Angel</a>\n    <a href="#kontakt">Kontakt</a>',
     '    <a href="#was-wir-tun">What we do</a>\n    <a href="#unternehmen">Offers</a>\n    <a href="#arbeiten">Work</a>\n    <a href="#angel-abschnitt">Angel</a>\n    <a href="#kontakt">Contact</a>', 1),
    ('<a href="/en" class="nav-link lang-switch" hreflang="en" lang="en">EN<span class="visually-hidden"> — English version</span></a>',
     '<a href="/" class="nav-link lang-switch" hreflang="de" lang="de">DE<span class="visually-hidden"> — Deutsche Fassung</span></a>', 1),
    ('<span class="lang">Mit Angel sprechen</span><span class="kurz">Angel fragen</span>', '<span class="lang">Talk to Angel</span><span class="kurz">Ask Angel</span>', 1),

    # ── Bühne ────────────────────────────────────────────────────────────
    ('<h1 class="visually-hidden">Oroboros Design — KI-Unternehmen aus Köln</h1>', '<h1 class="visually-hidden">Oroboros Design — AI company from Cologne</h1>', 1),
    ('<h2 class="slide-title">Bauen Sie <br>das Morgen</h2>', '<h2 class="slide-title">Build <br>tomorrow</h2>', 1),
    ('<p class="slide-desc">Ein KI-Unternehmen aus Köln. Wir entwerfen und entwickeln in vier Feldern: Websites, Sichtbarkeit in KI-Antworten, Automation und Video.</p>',
     '<p class="slide-desc">An AI company from Cologne. We design and build in four fields: websites, visibility in AI answers, automation and video.</p>', 1),
    ('<span class="slide-kicker">02 — Sichtbarkeit</span>', '<span class="slide-kicker">02 — Visibility</span>', 1),
    ('<h2 class="slide-title">Werden Sie <br>genannt</h2>', '<h2 class="slide-title">Get <br>named</h2>', 1),
    ('<p class="slide-desc">Wenn Ihre Kundschaft ChatGPT fragt, sollte Ihr Name fallen. Wir machen Ihren Betrieb für KI-Assistenten lesbar.</p>',
     '<p class="slide-desc">When your customers ask ChatGPT, your name should come up. We make your business readable for AI assistants.</p>', 1),
    ('<span class="slide-kicker">03 — Automatik</span>', '<span class="slide-kicker">03 — Autopilot</span>', 1),
    ('<h2 class="slide-title">Geben Sie ab</h2>', '<h2 class="slide-title">Hand it off</h2>', 1),
    ('<p class="slide-desc">Anfragen, Angebote, Termine, Nachfassen: Ein System übernimmt, was heute Ihre Zeit frisst.</p>',
     '<p class="slide-desc">Enquiries, quotes, bookings, follow-ups: a system takes over what eats your time today.</p>', 1),
    ('<span class="slide-kicker">04 — Vorsprung</span>', '<span class="slide-kicker">04 — Edge</span>', 1),
    ('<h2 class="slide-title">Bleiben Sie <br>vorn</h2>', '<h2 class="slide-title">Stay <br>ahead</h2>', 1),
    ('<p class="slide-desc">Angel, unsere KI, prüft Ihre Seite kostenlos und sagt Ihnen, was zuerst kommt.</p>',
     '<p class="slide-desc">Angel, our AI, checks your site for free and tells you what comes first.</p>', 1),
    ('data-angel aria-haspopup="dialog">Mit Angel sprechen <span class="pfeil" aria-hidden="true">→</span></button>',
     'data-angel aria-haspopup="dialog">Talk to Angel <span class="pfeil" aria-hidden="true">→</span></button>', 1),
    ('href="#kontakt" data-anliegen="website_check">Kostenloser Check</a>', 'href="#kontakt" data-anliegen="website_check">Free check</a>', 1),
    ('<nav class="kapitel" aria-label="Kapitel der Bühne">', '<nav class="kapitel" aria-label="Stage chapters">', 1),
    ('<span class="slide-kicker">01 — Zukunft</span>', '<span class="slide-kicker">01 — Future</span>', 1),
    ('data-kapitel="0" data-name="Zukunft">', 'data-kapitel="0" data-name="Future">', 1),
    ('<span class="visually-hidden">Kapitel 1: Zukunft</span>', '<span class="visually-hidden">Chapter 1: Future</span>', 1),
    ('data-kapitel="1" data-name="Sichtbarkeit">', 'data-kapitel="1" data-name="Visibility">', 1),
    ('<span class="visually-hidden">Kapitel 2: Sichtbarkeit</span>', '<span class="visually-hidden">Chapter 2: Visibility</span>', 1),
    ('data-kapitel="2" data-name="Automatik">', 'data-kapitel="2" data-name="Autopilot">', 1),
    ('<span class="visually-hidden">Kapitel 3: Automatik</span>', '<span class="visually-hidden">Chapter 3: Autopilot</span>', 1),
    ('data-kapitel="3" data-name="Vorsprung">', 'data-kapitel="3" data-name="Edge">', 1),
    ('<span class="visually-hidden">Kapitel 4: Vorsprung</span>', '<span class="visually-hidden">Chapter 4: Edge</span>', 1),
    ('<span class="name">Zukunft</span>', '<span class="name">Future</span>', 1),
    ('<i></i>Scrollen</div>', '<i></i>Scroll</div>', 1),
    ('<a class="ueberspringen" href="#unternehmen">Direkt zu den Angeboten ↓</a>', '<a class="ueberspringen" href="#unternehmen">Skip to the offers ↓</a>', 1),
    ('<span class="ort">Köln · The next form is never final.</span>', '<span class="ort">Cologne · The next form is never final.</span>', 1),

    # ── Kostenlos ────────────────────────────────────────────────────────
    ('<span class="tag">Kostenlos · ohne Anmeldung</span>', '<span class="tag">Free · no sign-up</span>', 1),
    ('>Zwei Prüfungen, bevor Sie irgendetwas zahlen.</h2>', '>Two checks before you pay for anything.</h2>', 1),
    ('<span class="gratis-art">Website-Check</span>', '<span class="gratis-art">Website check</span>', 1),
    ('<span class="gratis-titel">Was kostet Ihre Seite Sie an Anfragen?</span>', '<span class="gratis-titel">What is your site costing you in enquiries?</span>', 1),
    ('<span class="gratis-text">Tempo, Mobilansicht, Auffindbarkeit und der Weg zur Anfrage: drei konkrete Punkte und ein Festpreis, um sie zu beheben. Befund in 48 Stunden.</span>',
     '<span class="gratis-text">Speed, mobile view, findability and the path to an enquiry: three concrete points and a fixed price to fix them. Findings within 48 hours.</span>', 1),
    ('<span class="gratis-los">Befund anfordern <span aria-hidden="true">→</span></span>', '<span class="gratis-los">Request findings <span aria-hidden="true">→</span></span>', 1),
    ('<span class="gratis-art">KI-Sichtbarkeits-Check</span>', '<span class="gratis-art">AI visibility check</span>', 1),
    ('<span class="gratis-titel">Nennt ChatGPT Ihren Betrieb?</span>', '<span class="gratis-titel">Does ChatGPT name your business?</span>', 1),
    ('<span class="gratis-text">Ob ChatGPT, Perplexity oder Siri Ihre Website lesen und nennen können — in einer Minute, jede Aussage mit Fundstelle.</span>',
     '<span class="gratis-text">Whether ChatGPT, Perplexity or Siri can read and name your website — in one minute, every finding with its source. The tool runs in German.</span>', 1),
    ('<span class="gratis-los">Jetzt prüfen <span aria-hidden="true">→</span></span>', '<span class="gratis-los">Check now <span aria-hidden="true">→</span></span>', 1),

    # ── 01 Was wir tun ───────────────────────────────────────────────────
    ('<span class="tag rise">01 — Was wir tun</span>', '<span class="tag rise">01 — What we do</span>', 1),
    ('<h2 class="doc-title" id="t-was">Ein KI-Unternehmen. <br>Vier Felder.</h2>', '<h2 class="doc-title" id="t-was">One AI company. <br>Four fields.</h2>', 1),
    ('<p class="lead rise">Oroboros entwirft und entwickelt, was Ihr Betrieb mit künstlicher Intelligenz gewinnt — und betreibt es mit Angel, unserer eigenen KI. Ein Haus, ein Ansprechpartner, Festpreise.</p>',
     '<p class="lead rise">Oroboros designs and builds what your business gains from artificial intelligence — and runs it with Angel, our own AI. One company, one point of contact, fixed prices.</p>', 1),
    ('<span><h3>Websites &amp; Design</h3><p>Seiten, die Anfragen bringen. In 48 Stunden, zum Festpreis, gebaut auf Abschluss statt auf Geschmack.</p></span>',
     '<span><h3>Websites &amp; design</h3><p>Sites that bring enquiries. In 48 hours, at a fixed price, built to convert rather than to decorate.</p></span>', 1),
    ('<span><h3>KI-Sichtbarkeit</h3><p>Damit ChatGPT, Perplexity und Siri Ihren Betrieb lesen, verstehen und nennen können.</p></span>',
     '<span><h3>AI visibility</h3><p>So ChatGPT, Perplexity and Siri can read, understand and name your business.</p></span>', 1),
    ('<span><h3>KI-Automation &amp; Software</h3><p>Anfragen, Angebote, Termine, Bewerbungen: Abläufe, die laufen, ohne dass Sie daneben sitzen.</p></span>',
     '<span><h3>AI automation &amp; software</h3><p>Enquiries, quotes, bookings, applications: workflows that run without you sitting next to them.</p></span>', 1),
    ('<span><h3>KI-Video &amp; Inhalte</h3><p>Clips und Beiträge aus Ihrem Material, jeden Monat neu, fertig zum Posten.</p></span>',
     '<span><h3>AI video &amp; content</h3><p>Clips and posts made from your material, new every month, ready to post.</p></span>', 1),
    ('<a class="next rise" href="#unternehmen">Alle Angebote mit Preis <span aria-hidden="true">→</span></a>', '<a class="next rise" href="#unternehmen">Every offer with a price <span aria-hidden="true">→</span></a>', 1),

    # ── 02 Unternehmen ───────────────────────────────────────────────────
    ('<span class="tag rise">02 — Unternehmen</span>', '<span class="tag rise">02 — Ventures</span>', 1),
    ('<h2 class="doc-title" id="t-unternehmen">Jedes Angebot <br>mit Preis.</h2>', '<h2 class="doc-title" id="t-unternehmen">Every offer <br>with a price.</h2>', 1),
    ('<p class="lead rise">Keine Anfrage ins Blaue: Jede Linie sagt, was sie liefert, für wen und was sie kostet. Kaufen Sie direkt — oder sprechen Sie vorher mit Angel.</p>',
     '<p class="lead rise">No shot in the dark: every line says what it delivers, for whom and what it costs. Buy directly — or talk to Angel first.</p>', 1),
    # Websites
    ('<span class="angebot-art">Websites &amp; Design</span><span class="angebot-marke">Oroboros Websites</span>', '<span class="angebot-art">Websites &amp; design</span><span class="angebot-marke">Oroboros Websites</span>', 1),
    ('<h3 class="angebot-titel" id="t-websites">Website in 48 Stunden</h3>', '<h3 class="angebot-titel" id="t-websites">Website in 48 hours</h3>', 1),
    ('<p class="angebot-was">Eine Website, die Anfragen bringt: Aufbau, Texte, Bilder, Kontaktweg und Auffindbarkeit — entworfen, gebaut und übergeben innerhalb von zwei Werktagen nach der Anzahlung.</p>',
     '<p class="angebot-was">A website that brings enquiries: structure, copy, images, contact path and findability — designed, built and handed over within two working days of the deposit.</p>', 1),
    ('<p class="angebot-fuer"><b>Für</b>Betriebe, die von Anfragen leben — Praxis, Studio, Handwerk, Beratung.</p>', '<p class="angebot-fuer"><b>For</b>Businesses that live on enquiries — clinics, studios, trades, consultancies.</p>', 1),
    ('<li>Erst die Beratung: Angel klärt in Minuten, ob die 48-Stunden-Website zu Ihnen passt.</li>', '<li>Consultation first: Angel works out in minutes whether the 48-hour website fits you.</li>', 1),
    ('<li>Entwurf im Browser, eine Korrekturrunde, mobil, schnell und auffindbar — mit Prüfblatt.</li>', '<li>Design in the browser, one round of changes, mobile, fast and findable — with a checklist.</li>', 1),
    ('<li>Quelltext und Zugänge gehören Ihnen. Kein Abo als Bedingung.</li>', '<li>You own the code and all access. No subscription required.</li>', 1),
    ('<span class="betrag">1.500 €</span>', '<span class="betrag">€1,500</span>', 1),
    ('<span class="betrag-info">Festpreis · 50 % bei Auftrag, der Rest bei Abnahme</span>', '<span class="betrag-info">Fixed price · 50 % on order, the rest on acceptance</span>', 1),
    ('data-angel-text="Ich interessiere mich für eine Website in 48 Stunden." aria-haspopup="dialog">Beratung mit Angel <span',
     'data-angel-text="I’m interested in a website in 48 hours." aria-haspopup="dialog">Consult Angel <span', 1),
    ('ref=oroboros-website">Direkt beauftragen</a>', 'ref=oroboros-website">Order directly</a>', 1),
    # Nennbar
    ('<span class="angebot-art">KI-Sichtbarkeit</span><span class="angebot-marke">Nennbar</span>', '<span class="angebot-art">AI visibility</span><span class="angebot-marke">Nennbar</span>', 1),
    ('<h3 class="angebot-titel" id="t-nennbar">Genannt werden, wenn Kunden KI fragen</h3>', '<h3 class="angebot-titel" id="t-nennbar">Get named when customers ask AI</h3>', 1),
    ('<p class="angebot-was">Wir machen Ihren Betrieb für ChatGPT, Perplexity und Siri lesbar: llms.txt, Strukturdaten, Fragen und Antworten — aus Ihrer Website erzeugt, nie erfunden. Verkauft werden die technischen Voraussetzungen, keine Platzierung.</p>',
     '<p class="angebot-was">We make your business readable for ChatGPT, Perplexity and Siri: llms.txt, structured data, questions and answers — generated from your website, never invented. We sell the technical prerequisites, not a ranking.</p>', 1),
    ('<p class="angebot-fuer"><b>Für</b>Betriebe mit eigener Website.</p>', '<p class="angebot-fuer"><b>For</b>Businesses with their own website.</p>', 1),
    ('<span class="preis-name">Check<small>in einer Minute</small></span>', '<span class="preis-name">Check<small>in one minute</small></span>', 1),
    ('aria-label="Kostenlosen Nennbar-Check starten">Prüfen</a>', 'aria-label="Start the free Nennbar check">Check</a>', 1),
    ('<span class="preis-name">Paket<small>einmalig, in 24 Stunden</small></span><span class="preis-wert">199 €</span>', '<span class="preis-name">Package<small>one-off, within 24 hours</small></span><span class="preis-wert">€199</span>', 1),
    ('aria-label="Nennbar-Paket für 199 € kaufen">Kaufen</a>', 'aria-label="Buy the Nennbar package for €199">Buy</a>', 1),
    ('<span class="preis-name">Einbau durch uns<small>zusätzlich zum Paket</small></span><span class="preis-wert">99 €</span>', '<span class="preis-name">Installation by us<small>on top of the package</small></span><span class="preis-wert">€99</span>', 1),
    ('<span class="gratis-preis">0 €</span>', '<span class="gratis-preis">€0</span>', 2),
    ('aria-label="Nennbar-Einbau für 99 € beauftragen">Kaufen</a>', 'aria-label="Order the Nennbar installation for €99">Buy</a>', 1),
    ('<span class="preis-name">Monitor<small>monatlich kündbar</small></span><span class="preis-wert">39 €<small>/ Monat</small></span>',
     '<span class="preis-name">Monitor<small>cancel monthly</small></span><span class="preis-wert">€39<small>/ month</small></span>', 1),
    ('aria-label="Nennbar-Monitor für 39 € im Monat starten">Starten</a>', 'aria-label="Start the Nennbar monitor for €39 a month">Start</a>', 1),
    ('<p><b>Für Agenturen:</b> die Prüfliste — Ihre Kundenliste technisch geprüft, als CSV und Bericht, ohne Personendaten.</p>',
     '<p><b>For agencies:</b> the checklist — your client list technically checked, as CSV and report, no personal data.</p>', 1),
    ('<span class="preis-name">100 Websites</span><span class="preis-wert">49 €</span>', '<span class="preis-name">100 websites</span><span class="preis-wert">€49</span>', 1),
    ('aria-label="Prüfliste für 100 Websites für 49 € kaufen">Kaufen</a>', 'aria-label="Buy the checklist for 100 websites for €49">Buy</a>', 1),
    ('<span class="preis-name">500 Websites</span><span class="preis-wert">149 €</span>', '<span class="preis-name">500 websites</span><span class="preis-wert">€149</span>', 1),
    ('aria-label="Prüfliste für 500 Websites für 149 € kaufen">Kaufen</a>', 'aria-label="Buy the checklist for 500 websites for €149">Buy</a>', 1),
    ('href="https://angel-phi-eight.vercel.app/nennbar/pruefliste/">Mehr zur Prüfliste <span aria-hidden="true">→</span></a>',
     'href="https://angel-phi-eight.vercel.app/nennbar/pruefliste/" hreflang="de">More about the checklist (in German) <span aria-hidden="true">→</span></a>', 1),
    ('<a class="angebot-weiter" href="https://angel-phi-eight.vercel.app/nennbar/">Zu Nennbar <span aria-hidden="true">→</span></a>',
     '<a class="angebot-weiter" href="https://angel-phi-eight.vercel.app/nennbar/" hreflang="de">To Nennbar (in German) <span aria-hidden="true">→</span></a>', 1),
    ('<span class="preis-wert">0 €</span>', '<span class="preis-wert">€0</span>', 1),
    # Losgeschickt
    ('<span class="angebot-art">Bewerbungen auf Autopilot</span>', '<span class="angebot-art">Applications on autopilot</span>', 1),
    ('<h3 class="angebot-titel" id="t-losgeschickt">Bewerben ist Arbeit. Wir machen sie.</h3>', '<h3 class="angebot-titel" id="t-losgeschickt">Applying is work. We do it.</h3>', 1),
    ('<p class="angebot-was">Losgeschickt findet passende Stellen und schreibt zu jeder ein fertiges Anschreiben aus Ihrem Lebenslauf — per E-Mail, zum Prüfen und selbst Abschicken.</p>',
     '<p class="angebot-was">Losgeschickt finds matching jobs and writes a finished cover letter for each one from your CV — by email, for you to check and send yourself.</p>', 1),
    ('<p class="angebot-fuer"><b>Für</b>Menschen auf Stellensuche.</p>', '<p class="angebot-fuer"><b>For</b>People looking for a job in Germany.</p>', 1),
    ('<span class="preis-name">Beta<small>sieben Tage, bis zu fünf Entwürfe</small></span><span class="preis-wert">39 €</span>',
     '<span class="preis-name">Beta<small>seven days, up to five drafts</small></span><span class="preis-wert">€39</span>', 1),
    ('aria-label="Losgeschickt Beta für 39 € starten">Starten</a>', 'aria-label="Start Losgeschickt Beta for €39">Start</a>', 1),
    ('<span class="preis-name">Monat<small>jeden Tag neue Stellen, monatlich kündbar</small></span><span class="preis-wert">79 €<small>/ Monat</small></span>',
     '<span class="preis-name">Month<small>new jobs every day, cancel monthly</small></span><span class="preis-wert">€79<small>/ month</small></span>', 1),
    ('aria-label="Losgeschickt Monat für 79 € im Monat starten">Starten</a>', 'aria-label="Start Losgeschickt Month for €79 a month">Start</a>', 1),
    ('<span class="preis-name">Plus<small>mit Reihenfolge und Antwortvorlagen</small></span><span class="preis-wert">129 €<small>/ Monat</small></span>',
     '<span class="preis-name">Plus<small>with priorities and reply templates</small></span><span class="preis-wert">€129<small>/ month</small></span>', 1),
    ('aria-label="Losgeschickt Plus für 129 € im Monat starten">Starten</a>', 'aria-label="Start Losgeschickt Plus for €129 a month">Start</a>', 1),
    ('<a class="angebot-weiter" href="https://angel-phi-eight.vercel.app/losgeschickt/">Zu Losgeschickt <span aria-hidden="true">→</span></a>',
     '<a class="angebot-weiter" href="https://angel-phi-eight.vercel.app/losgeschickt/" hreflang="de">To Losgeschickt (in German) <span aria-hidden="true">→</span></a>', 1),
    # Bildtakt
    ('<span class="angebot-art">KI-Video</span><span class="angebot-marke">Bildtakt</span>', '<span class="angebot-art">AI video</span><span class="angebot-marke">Bildtakt</span>', 1),
    ('<h3 class="angebot-titel" id="t-bildtakt">Kurze Clips aus Ihren Fotos</h3>', '<h3 class="angebot-titel" id="t-bildtakt">Short clips from your photos</h3>', 1),
    ('<p class="angebot-was">Aus Logo und Fotos Ihres Betriebs entstehen Clips im Hochformat für Instagram, TikTok und Ihre Website — ohne Kamera, ohne Drehtag. Lieferung in fünf Werktagen.</p>',
     '<p class="angebot-was">Your logo and photos become vertical clips for Instagram, TikTok and your website — no camera, no shoot day. Delivered within five working days.</p>', 1),
    ('<p class="angebot-fuer"><b>Für</b>Läden, Studios und Praxen, die auf Social Media stattfinden wollen.</p>', '<p class="angebot-fuer"><b>For</b>Shops, studios and clinics that want to show up on social media.</p>', 1),
    ('<span class="preis-name">Auftakt<small>drei Clips, einmalig</small></span><span class="preis-wert">149 €</span>',
     '<span class="preis-name">Auftakt<small>three clips, one-off</small></span><span class="preis-wert">€149</span>', 1),
    ('aria-label="Bildtakt Auftakt für 149 € kaufen">Kaufen</a>', 'aria-label="Buy Bildtakt Auftakt for €149">Buy</a>', 1),
    ('<span class="preis-name">Takt<small>acht Clips im Monat, monatlich kündbar</small></span><span class="preis-wert">299 €<small>/ Monat</small></span>',
     '<span class="preis-name">Takt<small>eight clips a month, cancel monthly</small></span><span class="preis-wert">€299<small>/ month</small></span>', 1),
    ('aria-label="Bildtakt Takt für 299 € im Monat starten">Starten</a>', 'aria-label="Start Bildtakt Takt for €299 a month">Start</a>', 1),
    ('<a class="angebot-weiter" href="https://angel-phi-eight.vercel.app/bildtakt/">Zu Bildtakt <span aria-hidden="true">→</span></a>',
     '<a class="angebot-weiter" href="https://angel-phi-eight.vercel.app/bildtakt/" hreflang="de">To Bildtakt (in German) <span aria-hidden="true">→</span></a>', 1),
    # Automation, Chat, Inhalte, Frei
    ('<span class="angebot-art">Automation &amp; Software</span><span class="angebot-marke">KI-Automation</span>', '<span class="angebot-art">Automation &amp; software</span><span class="angebot-marke">AI automation</span>', 1),
    ('<h3 class="angebot-titel" id="t-automation">Ein Ablauf, der ohne Sie läuft</h3>', '<h3 class="angebot-titel" id="t-automation">One workflow that runs without you</h3>', 1),
    ('<p class="angebot-was">Wir automatisieren einen Ablauf, der Sie heute Zeit kostet — Anfragen sortieren, Angebote erstellen, Termine vergeben, nachfassen. Geliefert mit Übergabe: Sie sehen, was läuft und wie.</p>',
     '<p class="angebot-was">We automate one workflow that costs you time today — sorting enquiries, writing quotes, booking appointments, following up. Delivered with a handover: you see what runs and how.</p>', 1),
    ('<p class="angebot-fuer"><b>Für</b>Betriebe mit wiederkehrender Büroarbeit.</p>', '<p class="angebot-fuer"><b>For</b>Businesses with recurring office work.</p>', 1),
    ('<span class="preis-name">Starter<small>ein Workflow, einmalig, mit Übergabe</small></span><span class="preis-wert">990 €</span>',
     '<span class="preis-name">Starter<small>one workflow, one-off, with handover</small></span><span class="preis-wert">€990</span>', 1),
    ('aria-label="KI-Automation Starter für 990 € beauftragen">Beauftragen</a>', 'aria-label="Order AI automation Starter for €990">Order</a>', 1),
    ('data-angel-text="Ich möchte einen Ablauf in meinem Betrieb automatisieren." aria-haspopup="dialog">Erst beraten lassen <span',
     'data-angel-text="I’d like to automate a workflow in my business." aria-haspopup="dialog">Consult first <span', 1),
    ('<span class="angebot-art">Automation &amp; Software</span><span class="angebot-marke">KI-Chat</span>', '<span class="angebot-art">Automation &amp; software</span><span class="angebot-marke">AI chat</span>', 1),
    ('<h3 class="angebot-titel" id="t-chat">Ein Assistent auf Ihrer Website</h3>', '<h3 class="angebot-titel" id="t-chat">An assistant on your website</h3>', 1),
    ('<p class="angebot-was">Beantwortet Fragen aus Ihren eigenen Angaben und nimmt Anfragen an — rund um die Uhr, so wie Angel hier auf dieser Seite.</p>',
     '<p class="angebot-was">Answers questions from your own information and takes enquiries — around the clock, just like Angel on this page.</p>', 1),
    ('<p class="angebot-fuer"><b>Für</b>Betriebe, deren Telefon zu oft klingelt.</p>', '<p class="angebot-fuer"><b>For</b>Businesses whose phone rings too often.</p>', 1),
    ('<span class="preis-name">KI-Chat<small>monatlich kündbar</small></span><span class="preis-wert">99 €<small>/ Monat</small></span>',
     '<span class="preis-name">AI chat<small>cancel monthly</small></span><span class="preis-wert">€99<small>/ month</small></span>', 1),
    ('aria-label="KI-Chat für Websites für 99 € im Monat starten">Starten</a>', 'aria-label="Start AI chat for websites for €99 a month">Start</a>', 1),
    ('<span class="angebot-art">Video &amp; Inhalte</span><span class="angebot-marke">KI-Inhalte im Takt</span>', '<span class="angebot-art">Video &amp; content</span><span class="angebot-marke">AI content, monthly</span>', 1),
    ('<h3 class="angebot-titel" id="t-inhalte">Acht Beiträge im Monat</h3>', '<h3 class="angebot-titel" id="t-inhalte">Eight posts a month</h3>', 1),
    ('<p class="angebot-was">Bild und Text für Instagram, Facebook oder LinkedIn — in Ihrem Ton, zum Freigeben, jeden Monat neu.</p>',
     '<p class="angebot-was">Image and copy for Instagram, Facebook or LinkedIn — in your tone, ready to approve, new every month.</p>', 1),
    ('<p class="angebot-fuer"><b>Für</b>Betriebe ohne Zeit für Social Media.</p>', '<p class="angebot-fuer"><b>For</b>Businesses without time for social media.</p>', 1),
    ('<span class="preis-name">Im Takt<small>monatlich kündbar</small></span><span class="preis-wert">149 €<small>/ Monat</small></span>',
     '<span class="preis-name">Subscription<small>cancel monthly</small></span><span class="preis-wert">€149<small>/ month</small></span>', 1),
    ('aria-label="KI-Inhalte im Takt für 149 € im Monat starten">Starten</a>', 'aria-label="Start AI content, monthly, for €149 a month">Start</a>', 1),
    ('<span class="angebot-art">Etwas anderes</span><span class="angebot-marke">Auf Anfrage</span>', '<span class="angebot-art">Something else</span><span class="angebot-marke">On request</span>', 1),
    ('<h3 class="angebot-titel" id="t-frei">Ihr Vorhaben passt in keine Zeile?</h3>', '<h3 class="angebot-titel" id="t-frei">Your project doesn’t fit a line?</h3>', 1),
    ('<p class="angebot-was">Mehrseitige Marken, Shops, eigene Software, Anbindungen: Nach der Beratung bekommen Sie ein schriftliches Angebot zum Festpreis.</p>',
     '<p class="angebot-was">Multi-page brands, shops, custom software, integrations: after the consultation you get a written fixed-price quote.</p>', 1),
    ('data-angel-text="Ich habe ein größeres Vorhaben und möchte ein Angebot." aria-haspopup="dialog">Mit Angel besprechen <span',
     'data-angel-text="I have a bigger project and would like a quote." aria-haspopup="dialog">Discuss with Angel <span', 1),
    ('<p class="preis-hinweis rise">Alle Preise sind Endpreise. Als Kleinunternehmer nach § 19 UStG berechnen wir keine Umsatzsteuer. Bezahlt wird sicher über Stripe. Es gelten unsere <a href="/agb">AGB</a>; Verbraucher haben ein <a href="/widerruf">Widerrufsrecht</a>.</p>',
     '<p class="preis-hinweis rise">All prices are final. As a small business under § 19 of the German VAT Act we do not charge VAT. Payment is handled securely by Stripe. Our <a href="/agb" hreflang="de">terms</a> apply; consumers have a <a href="/widerruf" hreflang="de">right of withdrawal</a> (both in German).</p>', 1),

    # ── 03 Arbeiten ──────────────────────────────────────────────────────
    ('<span class="tag rise">03 — Arbeiten</span>', '<span class="tag rise">03 — Work</span>', 1),
    ('<h2 class="doc-title" id="t-arbeiten">Sehen Sie selbst. <br>Bevor Sie fragen.</h2>', '<h2 class="doc-title" id="t-arbeiten">See for yourself. <br>Before you ask.</h2>', 1),
    ('<p class="lead rise">Vier Konzeptseiten für vier Branchen, gebaut wie für echte Kunden. Zwei zeigen, wie weit Bewegung und Bild eine Marke tragen. Zwei zeigen, wie eine Seite Termine und Anfragen einsammelt. Öffnen Sie eine und scrollen Sie.</p>',
     '<p class="lead rise">Four concept sites for four industries, built the way we build for clients. Two show how far motion and imagery can carry a brand. Two show how a site collects bookings and enquiries. Open one and scroll.</p>', 1),
    ('alt="Konzeptseite HALDEN, Architekturbüro: große Wortmarke mit einem auskragenden Betonhaus"', 'alt="HALDEN concept site, architecture practice: large wordmark with a cantilevered concrete house"', 1),
    ('<span class="werk-art">Architektur · Showcase</span>', '<span class="werk-art">Architecture · Showcase</span>', 1),
    ('<p>Ein Büro für Häuser an rauen Orten. Scroll-Bühne, Fensterfahrt, Projektband — die Seite als Ausstellung.</p>', '<p>A practice for houses in rough places. Scroll stage, window reveal, project reel: the site as an exhibition.</p>', 1),
    ('alt="Konzeptseite LUMEN, Brow-Atelier: Serifenschrift und Nahaufnahme eines Auges"', 'alt="LUMEN concept site, brow atelier: serif type and a close-up of an eye"', 1),
    ('<span class="werk-art">Beauty · Termine</span>', '<span class="werk-art">Beauty · Bookings</span>', 1),
    ('<p>Ein Brow-Atelier mit Akademie. Vorher-nachher im Scroll, Preise mit Monatsrate, Buchung immer eine Daumenlänge entfernt.</p>', '<p>A brow atelier with an academy. Before and after on scroll, prices with monthly rates, booking always a thumb away.</p>', 1),
    ('alt="Konzeptseite Northside, Zahnarztpraxis: Überschrift und Patientin im Wartebereich"', 'alt="Northside concept site, dental practice: headline and a patient in the waiting area"', 1),
    ('<span class="werk-art">Praxis · Neupatienten</span>', '<span class="werk-art">Clinic · New patients</span>', 1),
    ('<p>Eine Zahnarztpraxis, die Angst abbaut, bevor sie Termine füllt. Festpreise offen, Mitgliedschaft statt Versicherung, Buchung in zwei Klicks.</p>', '<p>A dental practice that removes fear before it fills the calendar. Open prices, a membership instead of insurance, booking in two taps.</p>', 1),
    ('alt="Konzeptseite Ridgeline, Dachdecker: große Überschrift über einem Einfamilienhaus mit Anfrageformular"', 'alt="Ridgeline concept site, roofing company: large headline over a family home with an enquiry form"', 1),
    ('<span class="werk-art">Handwerk · Anfragen</span>', '<span class="werk-art">Trades · Enquiries</span>', 1),
    ('<p>Ein Dachdecker nach dem Sturm. Das Dach wird im Scroll gescannt, das Formular steht schon im ersten Bild.</p>', '<p>A roofer after the storm. The roof is scanned as you scroll, and the enquiry form is in the very first screen.</p>', 1),
    ('<p class="werk-hinweis rise">Konzeptarbeiten: Marken und Bewertungen sind erfunden, Code und Bewegung sind echt — so, wie wir sie für Sie bauen.</p>',
     '<p class="werk-hinweis rise">Concept work: brands and reviews are invented, code and motion are real, exactly as we would build them for you.</p>', 1),
    ('<a class="next rise" href="#websites">So etwas für Ihren Betrieb — in 48 Stunden <span aria-hidden="true">→</span></a>', '<a class="next rise" href="#websites">Something like this for your business — in 48 hours <span aria-hidden="true">→</span></a>', 1),

    # ── 04 Ablauf ────────────────────────────────────────────────────────
    ('<span class="tag rise">04 — Ablauf</span>', '<span class="tag rise">04 — Process</span>', 1),
    ('<h2 class="doc-title" id="t-ablauf">Vier Schritte. <br>Dann läuft es.</h2>', '<h2 class="doc-title" id="t-ablauf">Four steps. <br>Then it runs.</h2>', 1),
    ('<h3>Beratung</h3><p>Mit Angel im Chat, sofort — oder mit Daouda Ndiaye am Telefon. Was brauchen Sie, was kommt zuerst? Kostenlos.</p>',
     '<h3>Consultation</h3><p>With Angel in the chat, right now — or with Daouda Ndiaye on the phone. What do you need, what comes first? Free.</p>', 1),
    ('<h3>Angebot</h3><p>Umfang, Preis und Termin schriftlich, als Festpreis. Pakete und Abos mit Listenpreis kaufen Sie direkt.</p>',
     '<h3>Offer</h3><p>Scope, price and date in writing, as a fixed price. Packages and subscriptions with a list price you buy directly.</p>', 1),
    ('<h3>Anzahlung</h3><p>Bei Websites <b>50 % bei Auftrag</b>, der Rest bei Abnahme. Alles andere zahlen Sie beim Kauf, sicher über Stripe.</p>',
     '<h3>Deposit</h3><p>For websites <b>50 % on order</b>, the rest on acceptance. Everything else you pay at purchase, securely via Stripe.</p>', 1),
    ('<h3>Lieferung in Tagen</h3><p>Website in zwei Werktagen, Nennbar-Paket in 24 Stunden, Clips in fünf Werktagen. Mit Übergabe: Quelltext, Zugänge, Prüfblatt.</p>',
     '<h3>Delivery in days</h3><p>Website in two working days, Nennbar package in 24 hours, clips in five working days. With handover: code, access, checklist.</p>', 1),
    ('aria-haspopup="dialog">Schritt 1: mit Angel sprechen <span aria-hidden="true">→</span></button>', 'aria-haspopup="dialog">Step 1: talk to Angel <span aria-hidden="true">→</span></button>', 1),

    # ── 05 Angel ─────────────────────────────────────────────────────────
    ('<h2 class="doc-title" id="t-angel">Angel arbeitet. <br>Auch nachts.</h2>', '<h2 class="doc-title" id="t-angel">Angel works. <br>Even at night.</h2>', 1),
    ('<p class="lead rise">Angel ist die KI, mit der wir Oroboros betreiben. Für Sie heißt das: schneller eine Antwort, schneller ein Befund, schneller eine Lieferung — als ein Büro sie schreiben könnte.</p>',
     '<p class="lead rise">Angel is the AI we run Oroboros with. For you, that means a faster answer, faster findings and faster delivery than any office could write them.</p>', 1),
    ('<h3>Prüft</h3><p>Ihre Website und Ihre Sichtbarkeit in KI-Antworten — gemessen, jede Aussage mit Fundstelle.</p>', '<h3>Checks</h3><p>Your website and your visibility in AI answers — measured, every finding with its source.</p>', 1),
    ('<h3>Antwortet</h3><p>Hier auf der Seite, rund um die Uhr, auf Deutsch und Englisch — mit Preis und nächstem Schritt.</p>', '<h3>Answers</h3><p>Right here on the page, around the clock, in English and German — with a price and the next step.</p>', 1),
    ('<h3>Liefert</h3><p>Pakete, Clips und Bewerbungen kommen per E-Mail, fertig zum Einsetzen.</p>', '<h3>Delivers</h3><p>Packages, clips and applications arrive by email, ready to use.</p>', 1),
    ('<h3>Erinnert</h3><p>An offene Angaben, Termine und Verlängerungen. Nichts versandet.</p>', '<h3>Reminds</h3><p>Of missing details, appointments and renewals. Nothing gets lost.</p>', 1),
    ('<span class="puls" aria-hidden="true"></span>Beratung, live · Deutsch und Englisch</p>', '<span class="puls" aria-hidden="true"></span>Live consultation · English and German</p>', 1),
    ('<p class="live-zitat">„Sagen Sie mir in einem Satz, was Sie brauchen — ich sage Ihnen, was es kostet und was als Nächstes passiert.“</p>',
     '<p class="live-zitat">“Tell me in one sentence what you need — I’ll tell you what it costs and what happens next.”</p>', 1),
    ('<span>Schreiben Sie Angel, was Sie brauchen …</span>', '<span>Tell Angel what you need …</span>', 1),
    ('<p class="live-klein">Angel ist eine KI. Verbindliche Angebote und Rechnungen kommen von Daouda Ndiaye, Oroboros Design.</p>',
     '<p class="live-klein">Angel is an AI. Binding offers and invoices come from Daouda Ndiaye, Oroboros Design.</p>', 1),

    # ── 06 Standard und Einwände ─────────────────────────────────────────
    ('<h2 class="doc-title" id="t-standard">Verlangen Sie <br>einen Nachweis.</h2>', '<h2 class="doc-title" id="t-standard">Ask for <br>proof.</h2>', 1),
    ('<p class="lead rise">Jede Seite, die wir übergeben, läuft vorher durch eine feste Prüfliste. Sie bekommen sie ausgefüllt — nicht als Beruhigung, als Dokument.</p>',
     '<p class="lead rise">Every site we hand over runs through a fixed checklist first. You get it completed, not as reassurance but as a document.</p>', 1),
    ('<h3>Strategie und Beleg</h3><p>Zielgruppe erkennbar, Angebot eindeutig, eine Handlung, jede Behauptung belegt.</p>', '<h3>Strategy and evidence</h3><p>Audience clear, offer unmistakable, one action, every claim backed up.</p>', 1),
    ('<h3>Oberfläche und Zugänglichkeit</h3><p>Kontrast, Fokus, Trefferflächen, kein Überlauf — auf jedem Gerät geprüft, nicht geschätzt.</p>', '<h3>Interface and accessibility</h3><p>Contrast, focus, tap targets, no overflow. Checked on every device, not estimated.</p>', 1),
    ('<h3>Technik</h3><p>Formulare durchgetestet, Links geprüft, Ladegewicht im Blick, keine Geheimnisse im Quelltext.</p>', '<h3>Engineering</h3><p>Forms tested end to end, links checked, page weight watched, no secrets in the source.</p>', 1),
    ('<h3>Auffindbarkeit</h3><p>Titel, Beschreibung, Strukturdaten und llms.txt — damit Suchmaschinen und KI-Assistenten Sie lesen können.</p>', '<h3>Findability</h3><p>Title, description, structured data and llms.txt — so search engines and AI assistants can read you.</p>', 1),
    ('<h3 class="einwaende-titel rise" id="einwaende">Einwände? Fragen Sie ruhig.</h3>', '<h3 class="einwaende-titel rise" id="einwaende">Objections? Ask away.</h3>', 1),
    ('<summary>Was kosten die Checks?<span', '<summary>What do the checks cost?<span', 1),
    ('<div class="answer">Nichts. Der Website-Check liefert drei konkrete Punkte, die Ihre Seite heute Anfragen kosten, und einen Festpreis, um sie zu beheben. Der KI-Sichtbarkeits-Check zeigt in einer Minute, ob KI-Assistenten Ihre Seite lesen können. Ob Sie danach etwas kaufen, entscheiden Sie.</div>',
     '<div class="answer">Nothing. The website check gives you three concrete points that cost your site enquiries today, plus a fixed price to fix them. The AI visibility check shows in one minute whether AI assistants can read your site. Whether you buy anything afterwards is up to you.</div>', 1),
    ('<summary>Was kostet eine Website?<span', '<summary>What does a website cost?<span', 1),
    ('<div class="answer">1.500 € als Festpreis für die Website in 48 Stunden: Aufbau, Texte, Bilder, Kontaktweg und Auffindbarkeit. 50 % zahlen Sie bei Auftrag, den Rest bei Abnahme. Größere Vorhaben — mehrere Seiten, Shop, eigene Software — bekommen nach der Beratung ein schriftliches Angebot.</div>',
     '<div class="answer">€1,500 as a fixed price for the website in 48 hours: structure, copy, images, contact path and findability. You pay 50 % on order and the rest on acceptance. Bigger projects — several pages, a shop, custom software — get a written quote after the consultation.</div>', 1),
    ('<summary>Geht das wirklich in 48 Stunden?<span', '<summary>Does it really take 48 hours?<span', 1),
    ('<div class="answer">Ja, wenn Texte und Bilder da sind oder Sie uns zehn Minuten Fragen beantworten. Die Frist läuft ab der Anzahlung. Fehlt Material, sagen wir Ihnen am ersten Tag, was — und die Frist verschiebt sich entsprechend.</div>',
     '<div class="answer">Yes, if copy and images exist or you answer ten minutes of questions. The clock starts with the deposit. If material is missing, we tell you on day one what — and the deadline moves accordingly.</div>', 1),
    ('<summary>Ist Angel ein Mensch?<span', '<summary>Is Angel a human?<span', 1),
    ('<div class="answer">Nein. Angel ist eine KI und sagt das auch. Sie beantwortet Fragen, prüft und liefert. Verbindliche Angebote außerhalb der Preisliste und Rechnungen kommen von Daouda Ndiaye, Inhaber von Oroboros Design.</div>',
     '<div class="answer">No. Angel is an AI and says so. She answers questions, runs checks and delivers. Binding offers outside the price list and invoices come from Daouda Ndiaye, owner of Oroboros Design.</div>', 1),
    ('<summary>Wem gehört der Quelltext?<span', '<summary>Who owns the code?<span', 1),
    ('<div class="answer">Ihnen. Vollständig, ohne Lizenz und ohne Abo. Sie bekommen das Repository und alle Zugänge. Wenn Sie danach mit jemand anderem weiterarbeiten, können Sie das.</div>',
     '<div class="answer">You do. Completely, no licence, no subscription. You get the repository and every login. If you want to work with someone else afterwards, you can.</div>', 1),
    ('<summary>Sie sind neu — warum sollte ich Ihnen vertrauen?<span', '<summary>You’re new. Why should I trust you?<span', 1),
    ('<div class="answer">Weil Sie nichts glauben müssen. Der Befund zu Ihrer Seite ist gemessen und nachprüfbar, das Prüfblatt zur Übergabe ist ein Dokument, und den Entwurf sehen Sie im Browser, bevor der Rest fällig wird. Unter „Arbeiten“ sehen Sie vier Seiten, die zeigen, wie wir bauen.</div>',
     '<div class="answer">Because you don’t have to take anything on faith. The findings on your site are measured and verifiable, the handover checklist is a document, and you see the design in the browser before the rest is due. Under “Work” you can see four sites that show how we build.</div>', 1),
    ('<summary>Wie kündige ich ein Abo?<span', '<summary>How do I cancel a subscription?<span', 1),
    ('<div class="answer">Jederzeit zum Ende des laufenden Monats — über den Link in Ihrer Rechnungsmail von Stripe oder mit einer kurzen E-Mail an oroborosdesign@gmail.com. Wir bestätigen die Kündigung per E-Mail.</div>',
     '<div class="answer">Any time, effective at the end of the current month — via the link in your Stripe invoice email or with a short email to oroborosdesign@gmail.com. We confirm the cancellation by email.</div>', 1),
    ('<summary>Was heißt „KI im Ablauf“ konkret?<span', '<summary>What does “AI in your workflow” mean in practice?<span', 1),
    ('<div class="answer">Zum Beispiel: eingehende Anfragen werden automatisch sortiert und beantwortet, Angebote aus Ihren Vorlagen erzeugt, Termine ohne Rückfrage vergeben, Auswertungen einmal pro Woche fertig auf dem Tisch. Wir setzen KI nur dort ein, wo sie Zeit spart und nachprüfbar bleibt — nicht dort, wo sie Fehler in Ihre Prozesse schreibt.</div>',
     '<div class="answer">For example: incoming enquiries sorted and answered automatically, quotes generated from your templates, bookings made without back-and-forth, reports ready on your desk once a week. We only use AI where it saves time and stays verifiable, not where it writes errors into your processes.</div>', 1),
    ('<summary>Können Sie auf meiner bestehenden Seite arbeiten?<span', '<summary>Can you work on my existing site?<span', 1),
    ('<div class="answer">Bei WordPress, Webflow oder Shopify ja — dort verbessern wir gezielt. Bei Baukästen wie Wix ist der Spielraum technisch eng; dort ist ein Neubau meist günstiger als der Kampf gegen das System. Was in Ihrem Fall gilt, sagen wir nach dem Check.</div>',
     '<div class="answer">On WordPress, Webflow or Shopify, yes — there we improve specific things. Site builders like Wix leave little technical room; a rebuild is usually cheaper than fighting the system. We tell you which applies after the check.</div>', 1),
    ('<summary>Arbeiten Sie auch außerhalb Deutschlands?<span', '<summary>We’re not in Germany. Is that a problem?<span', 1),
    ('<div class="answer">Ja. Wir arbeiten ortsunabhängig, auf Deutsch und Englisch, mit Festpreisen in Euro. Gespräche legen wir in Ihre Zeitzone.</div>',
     '<div class="answer">No. We work remotely with clients anywhere, in English and German, at fixed prices in euros. Calls happen in your time zone.</div>', 1),
    ('<summary>Was passiert nach der Übergabe?<span', '<summary>What happens after handover?<span', 1),
    ('<div class="answer">Nichts, was Sie nicht wollen. Kein Wartungsabo als Bedingung. Auf Wunsch gibt es Pflege und Weiterbau als getrennte Vereinbarung, ebenfalls zum Festpreis je Aufgabe.</div>',
     '<div class="answer">Nothing you don’t want. No maintenance contract as a condition. Care and further development are available as a separate agreement, also at a fixed price per task.</div>', 1),

    # ── 07 Kontakt ───────────────────────────────────────────────────────
    ('<span class="tag rise">07 — Kontakt</span>', '<span class="tag rise">07 — Contact</span>', 1),
    ('<h2 class="doc-title" id="t-kontakt">Holen Sie sich <br>den Befund. Kostenlos.</h2>', '<h2 class="doc-title" id="t-kontakt">Get your findings. <br>Free.</h2>', 1),
    ('<p class="lead rise">Nennen Sie uns Ihre Website. Wir prüfen sie auf Tempo, Mobilansicht, Auffindbarkeit und den Weg zur Anfrage — und schicken Ihnen innerhalb von 48 Stunden eine ehrliche Einschätzung. Ohne Verkaufsgespräch, ohne Verpflichtung.</p>',
     '<p class="lead rise">Send us your website. We check speed, mobile view, findability and the path to an enquiry, and send you an honest assessment within 48 hours. No sales call, no obligation.</p>', 1),
    ('<label for="c-name">Ihr Name</label>', '<label for="c-name">Your name</label>', 1),
    ('<label for="c-mail">E-Mail</label>', '<label for="c-mail">Email</label>', 1),
    ('<label for="c-web">Ihre Website <span>(falls vorhanden)</span></label>', '<label for="c-web">Your website <span>(if you have one)</span></label>', 1),
    ('placeholder="ihrbetrieb.de"', 'placeholder="yourbusiness.com"', 1),
    ('<label for="c-anliegen">Worum geht es?</label>', '<label for="c-anliegen">What is it about?</label>', 1),
    ('<option value="website_check">Kostenloser Website-Check</option>', '<option value="website_check">Free website check</option>', 1),
    ('<option value="neue_website">Neue Website</option>', '<option value="neue_website">New website</option>', 1),
    ('<option value="software">Software / Backend</option>', '<option value="software">Software / backend</option>', 1),
    ('<option value="ki">KI in unseren Abläufen</option>', '<option value="ki">AI in our workflows</option>', 1),
    ('<option value="sonstiges">Etwas anderes</option>', '<option value="sonstiges">Something else</option>', 1),
    ('<label for="c-text">Was sollen wir wissen? <span>(optional)</span></label>', '<label for="c-text">Anything we should know? <span>(optional)</span></label>', 1),
    ('placeholder="Zum Beispiel: zu wenige Anfragen über die Seite, Relaunch bis Frühjahr"', 'placeholder="For example: too few enquiries through the site, relaunch planned for spring"', 1),
    ('<label for="c-firma">Firma</label>', '<label for="c-firma">Company</label>', 1),
    ('<span>Befund anfordern</span><span class="go" aria-hidden="true">→</span></button>', '<span>Request findings</span><span class="go" aria-hidden="true">→</span></button>', 1),
    ('<p class="check-klein">Wir verwenden Ihre Angaben nur, um Ihnen zu antworten. Mehr in der <a href="/datenschutz">Datenschutzerklärung</a>.</p>',
     '<p class="check-klein">We only use your details to reply to you. More in our <a href="/datenschutz" hreflang="de">privacy policy</a> (German).</p>', 1),
    ('<p>Lieber sofort? <span class="k">Angel antwortet jetzt.</span></p>', '<p>Prefer right now? <span class="k">Angel answers now.</span></p>', 1),
    ('<span><strong>Mit Angel sprechen</strong><span class="u">Beratung live, mit Preis und nächstem Schritt</span></span>',
     '<span><strong>Talk to Angel</strong><span class="u">Live consultation, with a price and the next step</span></span>', 1),
    ('href="mailto:oroborosdesign@gmail.com?subject=Website-Check"', 'href="mailto:oroborosdesign@gmail.com?subject=Website%20check"', 1),
    ('<p class="cta-note">Antwort innerhalb von 24 Stunden · Köln</p>', '<p class="cta-note">Reply within 24 hours · Cologne, Germany</p>', 1),
    ('<p>Was Sie bekommen: <span class="k">drei konkrete Punkte</span>, die Ihre Seite heute Anfragen kosten, und <span class="k">was es kostet, sie zu beheben</span> — als Festpreis. Ob Sie uns danach beauftragen, entscheiden Sie.</p>',
     '<p>What you get: <span class="k">three concrete points</span> that cost your site enquiries today, and <span class="k">what it costs to fix them</span>, as a fixed price. Whether you hire us afterwards is your call.</p>', 1),
    ('<h3>Empfehlen Sie uns: 20 % vom ersten Auftrag</h3>', '<h3>Recommend us: 20 % of the first order</h3>', 1),
    ('<p>Jeder unserer Kauflinks endet auf <code>ref=…</code>. Setzen Sie dort Ihren Namen ein — zum Beispiel <code>?aktion=checkout&amp;angebot=website_48h&amp;ref=anna-schmidt</code> — oder erzeugen Sie Ihren Link hier rechts. Kauft jemand darüber, gehören Ihnen 20 % seines ersten Auftrags.</p>',
     '<p>Every one of our buy links ends in <code>ref=…</code>. Put your name there — for example <code>?aktion=checkout&amp;angebot=website_48h&amp;ref=anna-smith</code> — or create your link on the right. If someone buys through it, 20 % of their first order is yours.</p>', 1),
    ('<p>Ausgezahlt wird per Überweisung, sobald der Auftrag bezahlt ist und die Widerrufsfrist abgelaufen ist. Damit wir Sie finden, nennen Sie uns Ihren Empfehlungsnamen einmal über das Formular oben.</p>',
     '<p>We pay out by bank transfer once the order is paid and the withdrawal period has passed. So we can find you, tell us your referral name once through the form above.</p>', 1),
    ('<label for="e-name">Ihr Empfehlungsname</label>', '<label for="e-name">Your referral name</label>', 1),
    ('placeholder="anna-schmidt"', 'placeholder="anna-smith"', 1),
    ('<label for="e-angebot">Für welches Angebot?</label>', '<label for="e-angebot">Which offer?</label>', 1),
    ('<option value="website_48h">Website in 48 Stunden · 1.500 €</option>', '<option value="website_48h">Website in 48 hours · €1,500</option>', 1),
    ('<option value="nennbar_paket">Nennbar-Paket · 199 €</option>', '<option value="nennbar_paket">Nennbar package · €199</option>', 1),
    ('<option value="ki_automation_starter">KI-Automation Starter · 990 €</option>', '<option value="ki_automation_starter">AI automation Starter · €990</option>', 1),
    ('<option value="ki_chat_website">KI-Chat für Websites · 99 € / Monat</option>', '<option value="ki_chat_website">AI chat for websites · €99 / month</option>', 1),
    ('<option value="ki_content_takt">KI-Inhalte im Takt · 149 € / Monat</option>', '<option value="ki_content_takt">AI content, monthly · €149 / month</option>', 1),
    ('<option value="bildtakt_auftakt">Bildtakt Auftakt · 149 €</option>', '<option value="bildtakt_auftakt">Bildtakt Auftakt · €149</option>', 1),
    ('<option value="losgeschickt_beta">Losgeschickt Beta · 39 €</option>', '<option value="losgeschickt_beta">Losgeschickt Beta · €39</option>', 1),
    ('aria-live="polite">Geben Sie zuerst Ihren Namen ein.</output>', 'aria-live="polite">Enter your name first.</output>', 1),
    ('<button type="submit" class="knopf knopf-hell">Link kopieren</button>', '<button type="submit" class="knopf knopf-hell">Copy link</button>', 1),

    # ── Fuß ──────────────────────────────────────────────────────────────
    ('<p>KI-Unternehmen aus Köln. Design und Entwicklung in vier Feldern: Websites, KI-Sichtbarkeit, Automation und Video — betrieben mit Angel.</p>',
     '<p>AI company from Cologne, Germany. Design and development in four fields: websites, AI visibility, automation and video — run with Angel.</p>', 1),
    ('<h2>Seite</h2>', '<h2>Page</h2>', 1),
    ('<li><a href="#was-wir-tun">Was wir tun</a></li>', '<li><a href="#was-wir-tun">What we do</a></li>', 1),
    ('<li><a href="#unternehmen">Unternehmen</a></li>', '<li><a href="#unternehmen">Ventures</a></li>', 1),
    ('<li><a href="#arbeiten">Arbeiten</a></li>', '<li><a href="#arbeiten">Work</a></li>', 1),
    ('<li><a href="#ablauf">Ablauf</a></li>', '<li><a href="#ablauf">Process</a></li>', 1),
    ('<li><a href="#kontakt">Kontakt</a></li>', '<li><a href="#kontakt">Contact</a></li>', 1),
    ('<h2>Angebote</h2>', '<h2>Offers</h2>', 1),
    ('<li><a href="#automation">KI-Automation</a></li>', '<li><a href="#automation">AI automation</a></li>', 1),
    ('<li><a href="#ki-chat">KI-Chat</a></li>', '<li><a href="#ki-chat">AI chat</a></li>', 1),
    ('<li><a href="#inhalte">KI-Inhalte</a></li>', '<li><a href="#inhalte">AI content</a></li>', 1),
    ('<h2>Direkt</h2>', '<h2>Direct</h2>', 1),
    ('<div>© 2026 Oroboros Design · Daouda Ndiaye · Köln</div>', '<div>© 2026 Oroboros Design · Daouda Ndiaye · Cologne</div>', 1),
    ('<nav aria-label="Rechtliches">\n        <a href="/impressum">Impressum</a>\n        <a href="/datenschutz">Datenschutz</a>\n        <a href="/agb">AGB</a>\n        <a href="/widerruf">Widerruf</a>',
     '<nav aria-label="Legal">\n        <a href="/impressum" hreflang="de">Legal notice</a>\n        <a href="/datenschutz" hreflang="de">Privacy</a>\n        <a href="/agb" hreflang="de">Terms</a>\n        <a href="/widerruf" hreflang="de">Withdrawal</a>', 1),

    # ── Angel ────────────────────────────────────────────────────────────
    ('<span class="puls" aria-hidden="true"></span>KI-Beraterin von Oroboros · antwortet sofort</p>', '<span class="puls" aria-hidden="true"></span>Oroboros’ AI consultant · answers instantly</p>', 1),
    ('data-angel-zu aria-label="Gespräch schließen">', 'data-angel-zu aria-label="Close conversation">', 1),
    ('aria-label="Gesprächsverlauf"></div>', 'aria-label="Conversation"></div>', 1),
    ('<p>Wohin darf Angel antworten? (optional)</p>', '<p>Where may Angel reply? (optional)</p>', 1),
    ('<label class="visually-hidden" for="angel-mail">E-Mail</label>', '<label class="visually-hidden" for="angel-mail">Email</label>', 1),
    ('maxlength="200" placeholder="E-Mail">', 'maxlength="200" placeholder="Email">', 1),
    ('<label class="visually-hidden" for="angel-text">Ihre Nachricht an Angel</label>', '<label class="visually-hidden" for="angel-text">Your message to Angel</label>', 1),
    ('placeholder="Ihre Nachricht an Angel …"', 'placeholder="Your message to Angel …"', 1),
    ('<button type="submit" class="angel-senden" aria-label="Senden">', '<button type="submit" class="angel-senden" aria-label="Send">', 1),
    ('<p class="angel-fuss"><span>Angel ist eine KI und kann sich irren. Verbindlich ist nur ein schriftliches Angebot oder ein Kauf.</span><a href="/datenschutz#beratung">Datenschutz</a></p>',
     '<p class="angel-fuss"><span>Angel is an AI and can be wrong. Only a written offer or a purchase is binding.</span><a href="/datenschutz#beratung" hreflang="de">Privacy</a></p>', 1),
]


def teile(html):
    """Stil und Skripte herauslösen: sie gehen unverändert hinüber."""
    platz = {}

    def merke(m):
        k = f"\x00BLOCK{len(platz)}\x00"
        platz[k] = m.group(0)
        return k

    ohne = re.sub(r"<style>.*?</style>|<script(?![^>]*ld\+json)[^>]*>.*?</script>", merke, html, flags=re.S)
    return ohne, platz


def main():
    text, bloecke = teile(DE)
    fehler = []
    for de, en, n in TABELLE:
        gefunden = text.count(de)
        if gefunden != n:
            fehler.append(f"{gefunden}× statt {n}×: {de[:110]}")
            continue
        text = text.replace(de, en)
    # JSON-LD: der ganze Block auf Englisch
    ld = re.search(r'(<script type="application/ld\+json">\n)(.*?)(\n</script>)', text, flags=re.S)
    if not ld:
        fehler.append("JSON-LD-Block nicht gefunden")
    else:
        text = text[: ld.start(2)] + json.dumps(JSON_LD_EN, ensure_ascii=False, indent=2) + text[ld.end(2):]
    if fehler:
        print("Zwilling nicht geschrieben — diese Zeilen treffen nicht:", *fehler, sep="\n  ")
        sys.exit(1)
    for k, v in bloecke.items():
        text = text.replace(k, v)
    # Was nach Deutsch aussieht und nicht in Skript, Stil, Eigennamen oder Adresse steht
    sichtbar = re.sub(r"<style>.*?</style>|<script.*?</script>", "", text, flags=re.S)
    verdacht = [w for w in re.findall(r">[^<>]*[äöüÄÖÜß][^<>]*<", sichtbar) if not re.search(r"Eulenbergstraße|Köln|Oroboros’|Takt|Auftakt|§ 19", w)]
    (WURZEL / "en.html").write_text(text, encoding="utf-8")
    print(f"en.html geschrieben: {len(TABELLE)} Textzeilen, Stil und {sum(1 for v in bloecke.values() if v.startswith('<script'))} Skripte unverändert.")
    if verdacht:
        print("Bitte ansehen — sieht deutsch aus:", *verdacht[:20], sep="\n  ")


if __name__ == "__main__":
    main()
