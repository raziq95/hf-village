import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createVillage, PROGRAMS, animateLife, ISLAND_RX, ISLAND_RZ, STAGE_ROT_Y } from './village.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** exponentielle Annäherung, unabhängig von der Bildrate */
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));
/** sanftes Ein-/Ausblenden ohne harte Kanten */
const easeInOut = k => k * k * (3 - 2 * k);

/**
 * Mountet die Three.js-Szene des Dorfs, betreibt Hover-Raycast,
 * Zonen-Animation und die Bildschirmposition des Labels.
 */
export default function Village({ activeKey, onHover, shiftX = 0, lookY = 0 }) {
  const { root, zones, island } = useMemo(() => createVillage(), []);
  const { camera, size, gl } = useThree();
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const hitMeshes = useMemo(() => Object.values(zones).flatMap(z => z.hits), [zones]);
  const pointer = useRef(new THREE.Vector2(-10, -10));
  const lookAt = useRef(new THREE.Vector3());
  const camTarget = useRef(new THREE.Vector3());
  const parallax = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const anchorVec = useMemo(() => new THREE.Vector3(), []);
  // R3F behält die letzte NDC-Zeigerposition (Default: Bildmitte), auch wenn die Maus
  // den Canvas verlässt — sonst würde der Hover-Raycast pro Frame weiterfeuern und
  // z. B. einen per Chip gehoverten Bereich sofort wieder überschreiben.
  const pointerOver = useRef(false);
  const drag = useRef({ active: false, x: 0, z: 0 });
  const isTouch = useRef(false);
  const baseZoom = useRef(1);
  // Welcher Teilbereich einer Zone liegt gerade unter dem Zeiger? Die Kamera muss genau
  // diesen anfahren — sonst wandert das Ziel weg und Hover/Fokus pendeln (z. B. Brunnen vs. Wasserturm).
  const brandCol = useMemo(() => new THREE.Color(), []);
  const focusVec = useRef(new THREE.Vector3());
  const focusKey = useRef(null);
  useEffect(() => {
    const el = gl.domElement;
    const enter = () => { pointerOver.current = true; };
    const leave = e => {
      // Touch: pointerleave feuert beim Abheben des Fingers — noch VOR dem click.
      // Würde hier gelöscht, wäre die Auswahl beim Tap schon weg und der Tap wirkungslos.
      // Auf Touch bleibt die Auswahl daher stehen, bis woanders getippt wird.
      if (isTouch.current) return;
      pointerOver.current = false;
      // Wandert der Zeiger vom Canvas direkt auf ein Overlay (Chips, Textblock),
      // darf die dortige Auswahl nicht sofort wieder gelöscht werden.
      const to = e.relatedTarget;
      if (to && to.closest && to.closest('.chips, .copy')) return;
      onHover(null);
    };
    // Touch: kein Hover verfügbar — Karte wird mit dem Finger verschoben.
    let id = null, sx = 0, sz = 0, ox = 0, oz = 0;
    const down = e => {
      if (e.pointerType === 'mouse') return;
      isTouch.current = true;
      pointerOver.current = true;
      id = e.pointerId; sx = e.clientX; sz = e.clientY;
      ox = drag.current.x; oz = drag.current.z;
      drag.current.active = true;
    };
    const move = e => {
      if (id !== e.pointerId || !drag.current.active) return;
      const perUnit = camera.zoom || 1;
      drag.current.x = ox - (e.clientX - sx) / perUnit;
      drag.current.z = oz - (e.clientY - sz) / perUnit / Math.sin(0.86);
    };
    const up = e => { if (id === e.pointerId) { id = null; drag.current.active = false; } };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [gl, onHover, camera]);

  // Der Orthokamera-Zoom ist in Pixel-pro-Welteinheit definiert — bei fixem Zoom wirkt
  // das Dorf auf einem großen Monitor (mehr CSS-Pixel Canvas-Fläche) winzig, weil dann
  // einfach mehr Weltraum sichtbar ist. Zoom daher an die tatsächliche Canvas-Größe koppeln,
  // damit die Insel auf jeder Bildschirmgröße einen ähnlichen Bildanteil einnimmt.
  // Ausdehnung der Szene für die Begrenzung des Schwenks — so lässt sich die Karte
  // nie über den Inselrand hinaus in den leeren Hintergrund schieben.
  const bounds = useMemo(() => {
    // Nicht über Box3.setFromObject: die Bühne ist gedreht, und die Hülle einer
    // gedrehten Hülle fällt deutlich zu groß aus (hier 70x66 statt 54x41). Dadurch
    // wurde der Zoom zu klein gewählt. Für die elliptische Insel gilt exakt:
    const c = Math.abs(Math.cos(STAGE_ROT_Y)), si = Math.abs(Math.sin(STAGE_ROT_Y));
    const a = ISLAND_RX + 0.9, b = ISLAND_RZ + 0.9;   // + Randbewuchs
    return {
      hx: Math.hypot(a * c, b * si),
      hz: Math.hypot(a * si, b * c)
    };
  }, []);

  useLayoutEffect(() => {
    if (camera.isOrthographicCamera) {
      // Zoom aus der gemessenen Szenengröße ableiten statt aus festen Werten: so passt
      // die Karte auch nach Layout-Änderungen, ohne Randbereiche anzuschneiden.
      // In der Höhe wirkt die isometrische Verkürzung (sin(pitch)).
      const ISO = Math.sin(0.86);
      const fitW = size.width / (2 * bounds.hx * 1.04);
      const fitH = size.height / (2 * bounds.hz * ISO * 1.06);
      const narrow = size.width < 760;
      // Etwas vertikaler Überstand ist gewollt (oben weich ausgeblendet, unten hinter
      // der Programmleiste) — so nutzt die Karte die Breite besser aus.
      baseZoom.current = narrow ? Math.min(fitW, fitH) : Math.min(fitW, fitH * 1.34);
      camera.zoom = baseZoom.current;
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height, bounds]);

  useMemo(() => {
    root.traverse(o => {
      if (o.material && o.material.isMeshStandardMaterial) {
        o.material.envMapIntensity = 0.9;
        o.material.roughness = Math.min(o.material.roughness, 0.82);
      }
    });
  }, [root]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    pointer.current.copy(state.pointer);
    parallax.current.tx = state.pointer.x * 0.5;
    parallax.current.ty = state.pointer.y * 0.22;

    // Hover — nur solange der Zeiger wirklich über dem Canvas ist (siehe pointerOver oben)
    if (pointerOver.current) {
      ray.setFromCamera(pointer.current, camera);
      const hit = ray.intersectObjects(hitMeshes, false)[0];
      if (hit) {
        hit.object.getWorldPosition(focusVec.current);
        focusKey.current = hit.object.userData.zoneKey;
      } else {
        focusKey.current = null;
      }
      onHover(hit ? hit.object.userData.zoneKey : null);
    }

    // ---- Kamerafahrt ----
    const p = parallax.current;
    p.x = damp(p.x, p.tx, 3.0, delta);
    p.y = damp(p.y, p.ty, 3.0, delta);
    const pitchBase = 0.86;

    // Wie weit darf geschwenkt werden? Nur so weit, wie die Szene über den
    // sichtbaren Ausschnitt hinausragt — sonst käme leerer Hintergrund ins Bild.
    const visHalfX = size.width / camera.zoom / 2;
    const visHalfZ = size.height / camera.zoom / Math.sin(pitchBase) / 2;
    const limX = Math.max(0, bounds.hx - visHalfX);
    const limZ = Math.max(0, bounds.hz - visHalfZ);

    if (activeKey && zones[activeKey]) {
      if (focusKey.current === activeKey) {
        // Direkt auf der Karte gehovert: Kamera bleibt STEHEN. Würde sie den Bereich in die
        // Bildmitte fahren, wanderte er unter dem Zeiger weg — der Hover bräche ab, die Kamera
        // fuhr zurück, und Fokus/Label begannen zu pendeln.
        drag.current.x = camTarget.current.x;
        drag.current.z = camTarget.current.z;
      } else {
        // Per Chip ausgewählt: bewusste Navigation, Kamera fährt den Bereich an.
        zones[activeKey].anchor.getWorldPosition(anchorVec);
        camTarget.current.x = damp(camTarget.current.x, clamp(anchorVec.x, -limX, limX), 3.2, delta);
        camTarget.current.z = damp(camTarget.current.z, clamp(anchorVec.z, -limZ, limZ), 3.2, delta);
      }
    } else if (drag.current.active) {
      // Touch/Drag: die Karte folgt direkt dem Finger
      camTarget.current.x = clamp(drag.current.x, -limX, limX);
      camTarget.current.z = clamp(drag.current.z, -limZ, limZ);
    } else {
      // Cursor-Schwenk mit toter Zone in der Bildmitte: dort bleibt das Bild ruhig,
      // damit Ziele beim Anfahren nicht ausweichen. Erst außerhalb wird geschwenkt.
      const DEAD = 0.45;
      const beyond = v => {
        const a = Math.abs(v);
        if (a <= DEAD) return 0;
        const f = (a - DEAD) / (1 - DEAD);
        return Math.sign(v) * f * f;          // weiches Anlaufen nach außen
      };
      const tx = beyond(state.pointer.x) * limX;
      const tz = -beyond(state.pointer.y) * limZ;   // Zeiger nach oben => in die Tiefe schwenken
      const lam = pointerOver.current ? 2.6 : 1.2;
      camTarget.current.x = damp(camTarget.current.x, tx, lam, delta);
      camTarget.current.z = damp(camTarget.current.z, tz, lam, delta);
      drag.current.x = camTarget.current.x;
      drag.current.z = camTarget.current.z;
    }
    lookAt.current.x = damp(lookAt.current.x, camTarget.current.x, 6, delta);
    lookAt.current.z = damp(lookAt.current.z, camTarget.current.z, 6, delta);

    const dist = 160, pitch = pitchBase + p.y * 0.01, yaw = p.x * 0.015;
    const cx = lookAt.current.x - shiftX, cz = lookAt.current.z;
    camera.position.set(
      cx + Math.sin(yaw) * dist * Math.cos(pitch),
      Math.sin(pitch) * dist,
      cz + Math.cos(yaw) * dist * Math.cos(pitch)
    );
    camera.lookAt(cx, lookY, cz);

    // Zonen animieren
    const fire = island && island.userData.campfire;
    if (fire) {
      fire.userData.flames.forEach(([f, baseH, i]) => {
        const fl = 0.82 + 0.18 * Math.sin(t * (7 + i * 2.3) + i);
        f.scale.y = baseH * fl;
        f.position.y = 0.16 + (baseH * fl) / 2;
      });
    }

    animateLife(island, t);

    Object.entries(zones).forEach(([key, z]) => {
      const target = key === activeKey ? 1 : 0;
      z.k = damp(z.k, target, 5.5, delta);
      const e = easeInOut(clamp(z.k, 0, 1));
      z.tick(t, z.k);
      // Kein Anheben der Zone: das löste die Gruppe sichtbar von der Insel und wirkte
      // sprunghaft. Stattdessen wird der Bereich am Boden in der Programmfarbe markiert —
      // ruhiger, kartentypisch und ohne Verschieben der Geometrie unter dem Zeiger.
      if (z.padMats && z.brand) {
        for (let i = 0; i < z.padMats.length; i++) {
          const pm = z.padMats[i];
          pm.m.color.copy(pm.base).lerp(brandCol.setHex(z.brand.color), e * 0.72);
        }
      }
      z.rings.forEach(r => {
        r.material.color.setHex(z.brand ? z.brand.color : 0xfff3c2);
        r.material.opacity = e * 0.95;
        r.scale.setScalar(0.99 + e * 0.06);
      });
    });

  });

  return <primitive object={root} />;
}

export { PROGRAMS };
