# Humanity First — Interaktives Dorf (React Three Fiber)

Diorama-Hero mit acht Programmbereichen. Hover (bzw. Tap) hebt einen Bereich an,
animiert ihn und zeigt ein schwebendes Label; Klick öffnet das Programm-Panel.

## Starten

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build

```bash
npm run build    # Ergebnis in dist/
npm run preview  # Build lokal prüfen
```

## In WordPress einbinden

1. `npm run build` ausführen.
2. Den Inhalt von `dist/assets/` in das Theme laden, z. B. nach
   `wp-content/themes/<theme>/hf-village/`.
3. Im Theme (oder per Code-Snippet-Plugin) einbinden:

```php
add_action('wp_enqueue_scripts', function () {
  $base = get_stylesheet_directory_uri() . '/hf-village/';
  wp_enqueue_style('hf-village', $base . 'index.css', [], '1.0');
  wp_enqueue_script_module('hf-village', $base . 'index.js', [], '1.0');
});
```

4. Auf der Seite (Custom-HTML-Block) den Mount-Punkt setzen:

```html
<div id="hf-village-hero"></div>
```

Der Hero füllt die Höhe `100svh`; für eine feste Höhe in einer Seitenspalte
`.hero { height: 640px; }` in `src/styles.css` anpassen.

## Was hier die Bildqualität macht

| Baustein | Wirkung |
|---|---|
| `OrthographicCamera` | parallele Kanten, Diorama-Blick |
| `<Environment preset="park">` | weiches Image-Based-Lighting statt harter Einzellichter |
| `<SoftShadows>` | ausgefranste, realistische Schattenkanten |
| `<ContactShadows>` | dunkler Abdruck der Insel auf dem Untergrund |
| `<N8AO>` | Ambient Occlusion — Verschattung in Ecken und Fugen |
| `ACESFilmicToneMapping` | filmischer Kontrast, keine ausgebrannten Lichter |

Die Geometrie liegt in `src/village.js` (reines Three.js, ~1.400 Zeilen):
`createVillage()` liefert die Szene plus Zonen-Metadaten, `PROGRAMS` die
Programmtexte und Hover-Flächen. `src/Village.jsx` mountet das Ergebnis in R3F
und betreibt Raycast, Zonen-Animation und Labelposition.

## Ideen für den nächsten Schritt

- HDR-Umgebung als eigene Datei (`<Environment files="studio.hdr">`) statt Preset,
  damit kein CDN-Abruf nötig ist.
- `@react-three/drei` `Detailed`/`Instances` für Bäume und Büsche — spart Draw-Calls.
- `useGLTF` falls die Gebäude später aus Blender kommen sollen.
