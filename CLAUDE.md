# Kontext für Claude Code

Interaktiver Hero-Bereich für humanityfirst.de: isometrisches 3D-Dorf mit den acht
Programmbereichen. Hover hebt einen Bereich hervor und zeigt Logo + Kurztext im
Titel; Klick öffnet die Programmseite. Beim Scrollen führt eine Kamerafahrt durch
alle Programme und endet in der Abenddämmerung.

## Stack
Vite + React 18 + React Three Fiber, `@react-three/drei` (Environment, Lightformer,
SoftShadows, OrthographicCamera), `@react-three/postprocessing` (N8AO, SMAA).
Kein TypeScript.

## Dateien
- `src/village.js` — reines Three.js. Primitiven-Bibliothek (abgerundete Boxen,
  Dächer, Fenster, Figuren, Tiere, Requisiten, Savannen-Flora), acht Zonen-Builder,
  Insel, Wegenetz, Dorfleben. `createVillage()` → `{ root, stage, zones, island }`,
  `animateLife(island, t, dusk)`, `PROGRAMS`, `ZONE_OFFSET`, `ISLAND_RX/RZ`,
  `STAGE_ROT_Y`.
  Koordinaten in BILD-Raum (+x rechts, +z unten); `stage.rotation.y` dreht in die
  isometrische Lage.
- `src/programs.js` — Programmlogos (PNG mit Alpha), freigestellte Piktogramme und
  Markenfarben.
- `src/Village.jsx` — mountet `root`, Hover-Raycast, Kamera (Schwenken, Tour,
  Zoom), Zonen-Tick.
- `src/App.jsx` — Canvas, Licht, Post-Processing, Titel als Informationsfläche,
  Scroll-Choreografie (Etappen), Chips, Hinweise.
- `src/styles.css` — komplett unter `.hfvh-root` gekapselt (einbettbar).
- `wp-plugin/hf-village-hero/` — WordPress-Plugin (Shortcode + Block).

## Konventionen
- `rb(w,h,d,mat,x,y,z,r,name)`: y ist die MITTE. `bx`/`cy`: y ist die UNTERKANTE.
- Geometrie-Cache-Schlüssel brauchen Trennzeichen (`b|w|h|d`), sonst kollidieren
  unterschiedliche Größen.
- Materialien über `mat(name, color, opts)` mit Cache; Farben in `C`.
  Für zonenspezifische Einfärbung Materialien klonen (Cache ist geteilt!).
- Zonen-Animation: `tick(t, k)` mit `k` = Aktivierungsstärke 0…1. Bei `k = 0` Ruhelage.
- Kamera: Ausdehnung analytisch aus `ISLAND_RX/RZ` + `STAGE_ROT_Y` rechnen —
  `Box3.setFromObject` liefert für die gedrehte Bühne eine zu große Hülle.
- Beim Hovern auf der Karte bleibt die Kamera STEHEN (sonst Fokus-Pendeln).
- Scroll-Fortschritt in Pixeln gegen die Etappenhöhen rechnen, nicht prozentual.

## Build & Plugin
- `npm run dev` — Entwicklung; `index.html` bettet wie das Plugin per
  `[data-hf-village-hero]` ein.
- `npm run build` → `dist/hf-village-hero.{js,css}` + `dist/assets/`.
- Plugin aktualisieren: Build nach `wp-plugin/hf-village-hero/build/` kopieren,
  dann `cd wp-plugin && zip -rq hf-village-hero.zip hf-village-hero`.
- Der Build ist ein ES-Modul; das Plugin ergänzt `type="module"` per
  `script_loader_tag`.

## Offene Punkte
1. Environment ist synthetisch (Lightformer). Bewusst kein CDN-HDRI — ein hängender
   externer Abruf hatte die Szene komplett blockiert.
2. Bündelgröße ~1,4 MB (468 KB gzip), Three.js dominiert. Code-Splitting möglich.
3. Bäume/Büsche über `Instances` bündeln (derzeit ~1.000 Objekte).
4. Wärmerer, trockenerer Grünton und Entsättigung der Kleidungsfarben (offen aus
   der ursprünglichen Phase 2).
5. Texte gegen die Programmseiten prüfen.
6. Plugin wurde nicht in einer echten WordPress-Installation getestet (lokal kein
   PHP verfügbar) — Einbettung nur über eine nachgebaute Themeseite verifiziert.
