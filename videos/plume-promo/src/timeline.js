/* PLUME promo — timeline unique (seekable, déterministe).
   Repères musicaux : 120 BPM → 1 temps = 0,5 s, 1 mesure = 2 s. */
(function () {
  "use strict";
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => Array.from(r.querySelectorAll(s));
  // pseudo-aléatoire déterministe (index → [0,1))
  const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");

  function build() {
    let tl = gsap.timeline({ paused: true });

    /* ---------- mesures (avant toute transformation) ---------- */
    const line1 = q("#s1-line1");
    const L1W = Math.ceil(line1.scrollWidth) + 24;
    line1.style.width = L1W + "px";
    const sepia = q("#rd-sepia");
    const sb = sepia.getBoundingClientRect();
    const k = sb.width / 608 || 1;
    const rel = (r) => ({ x: (r.left - sb.left) / k, y: (r.top - sb.top) / k, w: r.width / k, h: r.height / k });
    const tRects = Array.from(q("#rd-target").getClientRects()).map(rel).filter((r) => r.w > 4);
    const paraRects = qa("#rd-sepia .rd-p").map((p) => rel(p.getBoundingClientRect()));

    /* ---------- intentions de mise en page (pour hyperframes check) ---------- */
    qa(".sat, #rd-note, #rd-tools, #wr-toast, #ch-spoil-cover, #ch-spoil-txt, #ch-banner, #xp-pop").forEach((n) => {
      n.setAttribute("data-layout-allow-overlap", "");
      n.setAttribute("data-layout-allow-occlusion", "");
      qa("*", n).forEach((c) => { c.setAttribute("data-layout-allow-overlap", ""); c.setAttribute("data-layout-allow-occlusion", ""); });
    });
    qa("#fan, #fan *").forEach((n) => n.setAttribute("data-layout-ignore", ""));
    qa(".feather-tip, .feather-tip *, #ghosts, #ghosts *").forEach((n) => n.setAttribute("data-layout-allow-overflow", ""));

    /* ---------- réglages statiques ---------- */
    gsap.set("#phone-cam", { transformPerspective: 1800 });
    gsap.set(".sat, .mini-phone", { transformPerspective: 1400 });
    qa("#s2-rays .ray").forEach((r, i) => gsap.set(r, { rotation: (i * 360) / 14, transformOrigin: "3px 620px" }));
    // les cercles de tap vont dans l'écran (ils suivent le téléphone)
    const ov = q("#ui-overlay");
    qa("#taps .tap, #taps .tap-dot").forEach((n) => ov.appendChild(n));
    // surlignage positionné sur la vraie phrase
    if (tRects[0]) {
      const [a, b] = tRects;
      tRects.slice(0, 3).forEach((r, i) => gsap.set("#rd-hl" + (i + 1), { left: r.x - 6, top: r.y + 2, width: r.w + 12, height: r.h - 2 }));
      for (let i = tRects.length; i < 3; i++) gsap.set("#rd-hl" + (i + 1), { display: "none" });
      gsap.set("#rd-tools", { top: a.y - 92, left: Math.max(18, Math.min(a.x - 40, 600 - 470)) });
      const last = tRects[Math.min(2, tRects.length - 1)];
      gsap.set("#rd-note", { top: last.y + last.h + 26 });
      gsap.set("#rd-pin", { top: a.y + a.h / 2 - 11 });
    }
    // compteurs : état initial (les clones du final gardent l'état final)
    q("#dash-reads").textContent = "0";
    q("#dash-comp").textContent = "0\u202f%";
    qa("#scr-chat .ch-pct").forEach((n) => (n.textContent = "0\u202f%"));
    q("#tr-lvl").textContent = "12";
    q("#tr-xpv").textContent = fmt(3000 * 0.78);
    q("#tr-ring").setAttribute("stroke-dashoffset", String(2 * Math.PI * 84 * 0.22));
    q("#tr-xp").style.transform = "scaleX(0.78)";
    gsap.set("#s2-word span, #s10-word span", { transformPerspective: 600 });
    // textes « tapés » : état initial vide
    const typed = {};
    ["#ex-q", "#wr-title", "#wr-body"].forEach((s) => { const n = q(s); typed[s] = n.dataset.full; n.textContent = ""; });

    let tapN = 0;
    function tapAt(x, y, t) {
      const ring = q("#tap" + tapN), dot = q("#tapd" + tapN);
      tapN += 1;
      tl.set([ring, dot], { x, y }, t - 0.2);
      tl.fromTo(dot, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 0.9, duration: 0.12, ease: "power2.out" }, t - 0.14);
      tl.to(dot, { scale: 0.75, opacity: 0, duration: 0.3, ease: "power2.in" }, t + 0.08);
      tl.fromTo(ring, { scale: 0.3, opacity: 0.95 }, { scale: 1.7, opacity: 0, duration: 0.6, ease: "power2.out" }, t);
    }
    function press(sel, t, depth) {
      tl.to(sel, { scale: depth || 0.93, duration: 0.11, ease: "power2.in" }, t);
      tl.to(sel, { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.45)" }, t + 0.11);
    }
    function typeText(sel, t, dur) {
      const n = q(sel), full = typed[sel], st = { c: 0 };
      tl.to(st, { c: full.length, duration: dur, ease: "none", onUpdate: () => { n.textContent = full.slice(0, Math.round(st.c)); } }, t);
    }
    function blink(sel, t, dur) {
      const half = 0.4;
      const reps = Math.max(0, Math.floor(dur / half) - 1);
      tl.fromTo(sel, { opacity: 1 }, { opacity: 0, duration: half, ease: "steps(1)", yoyo: true, repeat: reps }, t);
    }
    function hlIn(id, t) {
      tl.set("#" + id, { visibility: "inherit" }, t);
      tl.fromTo(`#${id} .lab > span`, { yPercent: 115 }, { yPercent: 0, duration: 0.55, ease: "expo.out" }, t);
      tl.fromTo(`#${id} .ln > span`, { yPercent: 115, rotation: 4 }, { yPercent: 0, rotation: 0, duration: 0.85, ease: "expo.out", stagger: 0.09 }, t + 0.06);
    }
    function hlOut(id, t) {
      tl.to(`#${id} .lab > span, #${id} .ln > span`, { yPercent: -115, duration: 0.34, ease: "power3.in", stagger: 0.03 }, t);
      tl.set("#" + id, { visibility: "hidden" }, t + 0.5);
    }
    function push(from, to, t) {
      tl.set(to, { visibility: "inherit" }, t);
      tl.fromTo(to, { xPercent: 100 }, { xPercent: 0, duration: 0.75, ease: "expo.inOut" }, t);
      tl.to(from, { xPercent: -38, duration: 0.75, ease: "expo.inOut" }, t);
      tl.set(from, { visibility: "hidden" }, t + 0.8);
    }
    function ghost(id, t0, t1) {
      tl.fromTo(id, { opacity: 0, x: 60 }, { opacity: 0.11, x: 0, duration: 1.2, ease: "power2.out" }, t0);
      tl.to(id, { x: -140, duration: t1 - t0, ease: "none" }, t0);
      tl.to(id, { opacity: 0, duration: 0.6, ease: "power1.in" }, t1 - 0.4);
    }

    /* ================= FOND ================= */
    tl.fromTo("#glow-a", { x: 0, y: 0, scale: 1 }, { x: 200, y: 280, scale: 1.18, duration: 46, ease: "sine.inOut" }, 0);
    tl.to("#glow-a", { x: -40, y: 60, scale: 1.05, duration: 54, ease: "sine.inOut" }, 46);
    tl.fromTo("#glow-b", { x: 0, y: 0, scale: 1 }, { x: -280, y: -420, scale: 1.25, duration: 46, ease: "sine.inOut" }, 0);
    tl.to("#glow-b", { x: -60, y: -120, scale: 1.1, duration: 54, ease: "sine.inOut" }, 46);
    tl.fromTo("#glow-c", { opacity: 0 }, { opacity: 0.85, duration: 0.6, ease: "sine.inOut" }, 40.1);
    tl.to("#glow-c", { opacity: 0, duration: 1.5, ease: "sine.inOut" }, 54.6);
    ghost("#g-histoire", 0.4, 8);
    ghost("#g-plume", 8.6, 14);
    ghost("#g-decouvrir", 15.0, 24);
    ghost("#g-explorer", 24.4, 32);
    ghost("#g-choisir", 32.3, 38);
    ghost("#g-lire", 38.4, 56);
    ghost("#g-ecrire", 56.4, 66);
    ghost("#g-ensemble", 66.4, 78);
    ghost("#g-progresser", 78.4, 86);

    /* ================= S1 — la plume écrit (0 → 8) ================= */
    const fw = "#s1-feather-wrap", wob = "#s1-feather-wobble";
    const BASE = 736;
    tl.fromTo("#s1-kicker", { opacity: 0, x: -60, clipPath: "inset(0% 100% 0% 0%)" }, { opacity: 1, x: 0, clipPath: "inset(0% 0% 0% 0%)", duration: 1.3, ease: "power3.out" }, 0.25);
    tl.set(fw, { visibility: "inherit" }, 0.15);
    tl.fromTo(fw, { y: -160 }, { y: BASE, duration: 1.8, ease: "power1.inOut" }, 0.2);
    tl.set(fw, { x: 980, rotation: -55 }, 0);
    tl.to(fw, { keyframes: [{ x: 640, duration: 0.55, ease: "sine.inOut" }, { x: 880, duration: 0.55, ease: "sine.inOut" }, { x: 100, duration: 0.7, ease: "power2.inOut" }] }, 0.2);
    tl.to(fw, { keyframes: [{ rotation: 12, duration: 0.55, ease: "sine.inOut" }, { rotation: -30, duration: 0.55, ease: "sine.inOut" }, { rotation: -6, duration: 0.7, ease: "power2.out" }] }, 0.2);
    // écriture de « Il était une fois… »
    tl.fromTo("#s1-line1", { clipPath: "inset(-20% 100% -20% 0%)" }, { clipPath: "inset(-20% 0% -20% 0%)", duration: 1.65, ease: "none" }, 2.0);
    tl.to(fw, { x: 100 + L1W - 20, duration: 1.65, ease: "none" }, 2.0);
    tl.to(fw, { keyframes: [{ rotation: 6, duration: 0.5 }, { rotation: -10, duration: 0.6 }, { rotation: 2, duration: 0.55 }] }, 2.0);
    tl.fromTo(wob, { y: 0 }, { y: -16, duration: 0.11, ease: "sine.inOut", yoyo: true, repeat: 13 }, 2.0);
    // étincelles le long de la ligne
    for (let i = 0; i < 15; i++) {
      const t = 2.05 + i * 0.105, x = 100 + (L1W - 20) * (i / 14), y = BASE - 6;
      const s = "#sp" + i;
      tl.fromTo(s, { x, y, opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1.2, duration: 0.1, ease: "power2.out", immediateRender: false }, t);
      tl.to(s, { x: x + (rnd(i, 1) - 0.5) * 70, y: y + 40 + rnd(i, 2) * 90, opacity: 0, scale: 0.2, duration: 0.95, ease: "power1.out" }, t + 0.1);
    }
    // la plume repart et vient souligner « une plume. »
    tl.fromTo(".s1-line2 .w", { yPercent: 105 }, { yPercent: 0, duration: 0.9, ease: "expo.out", stagger: 0.14 }, 4.15);
    tl.to(fw, { keyframes: [{ x: 1000, duration: 0.3, ease: "power2.out" }, { x: 110, duration: 0.75, ease: "power3.inOut" }] }, 3.65);
    tl.to(fw, { keyframes: [{ y: 600, duration: 0.4, ease: "power2.out" }, { y: 1052, duration: 0.65, ease: "power3.inOut" }] }, 3.65);
    tl.to(fw, { rotation: -14, duration: 0.6, ease: "sine.inOut" }, 3.9);
    const swash = q("#s1-swash-path");
    const SL = swash.getTotalLength();
    gsap.set(swash, { strokeDasharray: SL, strokeDashoffset: SL });
    const SWN = 240;
    const SWP = Array.from({ length: SWN + 1 }, (_, i) => { const p = swash.getPointAtLength((i / SWN) * SL); return [p.x, p.y]; });
    const fwEl = q(fw);
    const sw = { d: 0 };
    tl.to(sw, {
      d: 1, duration: 1.25, ease: "power2.inOut",
      onUpdate: () => {
        const f = sw.d * SWN, i0 = Math.min(SWN - 1, Math.floor(f)), u = f - i0;
        const x = SWP[i0][0] + (SWP[i0 + 1][0] - SWP[i0][0]) * u, y = SWP[i0][1] + (SWP[i0 + 1][1] - SWP[i0][1]) * u;
        gsap.set(fwEl, { x, y });
        swash.style.strokeDashoffset = String(SL * (1 - sw.d));
      },
    }, 4.72);
    for (let i = 15; i < 26; i++) {
      const f = (i - 15) / 10, p = swash.getPointAtLength(f * SL), t = 4.75 + f * 1.2;
      const s = "#sp" + i;
      tl.fromTo(s, { x: p.x, y: p.y, opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1.3, duration: 0.1, immediateRender: false }, t);
      tl.to(s, { x: p.x + (rnd(i, 3) - 0.5) * 80, y: p.y + 50 + rnd(i, 4) * 100, opacity: 0, scale: 0.2, duration: 1.0, ease: "power1.out" }, t + 0.1);
    }
    // légère poussée caméra puis plongée de la plume vers l'objectif
    tl.fromTo("#s1-cam", { scale: 1 }, { scale: 1.05, duration: 3.2, ease: "sine.inOut", transformOrigin: "50% 45%" }, 3.8);
    tl.to(fw, { x: 540, y: 980, rotation: 18, duration: 0.85, ease: "power2.inOut" }, 6.15);
    tl.to(wob, { scale: 1.5, duration: 0.85, ease: "power2.inOut" }, 6.15);
    tl.to(fw, { x: 560, y: 1010, rotation: 48, duration: 0.95, ease: "power3.in" }, 7.0);
    tl.to(wob, { scale: 13, filter: "blur(14px)", duration: 0.95, ease: "power3.in" }, 7.0);
    tl.to("#s1-cam", { scale: 1.45, filter: "blur(12px)", opacity: 0, duration: 0.9, ease: "power3.in" }, 7.05);
    tl.to("#s1-kicker", { opacity: 0, y: -40, duration: 0.5, ease: "power2.in" }, 7.0);
    tl.set("#flash", { visibility: "inherit" }, 7.78);
    tl.fromTo("#flash", { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power2.in" }, 7.78);
    tl.to("#flash", { opacity: 0, duration: 0.7, ease: "power2.out" }, 7.98);
    tl.set("#flash", { visibility: "hidden" }, 8.7);
    tl.set("#s1", { visibility: "hidden" }, 8.0);

    /* ================= S2 — logo (8 → 14) ================= */
    tl.set("#s2", { visibility: "inherit" }, 7.96);
    tl.fromTo("#s2-mark", { scale: 0, rotation: -50 }, { scale: 1, rotation: 0, duration: 0.95, ease: "back.out(1.7)" }, 8.0);
    tl.fromTo("#s2-shock", { scale: 0.15, opacity: 0.95 }, { scale: 1.6, opacity: 0, duration: 1.2, ease: "power2.out" }, 8.02);
    tl.fromTo("#s2-rays .ray", { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1, duration: 0.32, ease: "expo.out", stagger: 0.012 }, 8.03);
    tl.to("#s2-rays .ray", { opacity: 0, scaleY: 1.3, duration: 0.7, ease: "power2.out" }, 8.4);
    tl.fromTo("#s2-word span", { yPercent: 110, rotationX: -80, opacity: 0 }, { yPercent: 0, rotationX: 0, opacity: 1, duration: 0.85, ease: "expo.out", stagger: 0.075 }, 8.55);
    const tw2 = qa("#s2-tag .tw");
    tw2.forEach((w, i) => tl.fromTo(w, { scale: 1.9, opacity: 0, filter: "blur(10px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.34, ease: "power4.out" }, 10.0 + i * 0.5));
    tl.fromTo("#s2-mark", { y: 0 }, { y: -18, duration: 1.2, ease: "sine.inOut", yoyo: true, repeat: 1, immediateRender: false }, 9.1);
    tl.fromTo("#s2-sheen", { x: 0, opacity: 1 }, { x: 1600, duration: 1.0, ease: "power2.inOut" }, 12.0);
    // transition : le logo devient l'icône de l'app, le téléphone monte
    tl.to(["#s2-word", "#s2-tag"], { y: -280, opacity: 0, filter: "blur(8px)", duration: 0.6, ease: "power3.in", stagger: 0.06 }, 13.25);
    tl.to("#s2-mark", { y: 450, scale: 0.625, duration: 0.95, ease: "power3.inOut" }, 13.35);
    tl.set("#stage", { visibility: "inherit" }, 13.3);
    tl.set("#scr-splash", { visibility: "inherit" }, 13.3);
    tl.fromTo("#phone-cam", { y: 1500, rotationX: 28 }, { y: 0, rotationX: 0, duration: 1.05, ease: "expo.out" }, 13.35);
    tl.to("#s2-mark", { opacity: 0, duration: 0.25, ease: "power1.in" }, 14.15);
    tl.set("#s2", { visibility: "hidden" }, 14.45);
    // lancement de l'app (iris depuis le centre de l'écran)
    tl.to("#scr-splash .feather-svg", { scale: 0.45, opacity: 0, duration: 0.4, ease: "power2.in" }, 14.5);
    tl.set("#scr-home", { visibility: "inherit" }, 14.55);
    tl.fromTo("#scr-home", { clipPath: "circle(0px at 304px 634px)" }, { clipPath: "circle(1500px at 304px 634px)", duration: 0.75, ease: "power3.inOut" }, 14.55);
    tl.set("#scr-splash", { visibility: "hidden" }, 15.4);

    /* ================= S3 — Accueil (14 → 24) ================= */
    tl.fromTo("#phone-float", { y: 0 }, { y: -16, duration: 2, ease: "sine.inOut", yoyo: true, repeat: 31, immediateRender: false }, 14.6);
    tl.fromTo("#phone-float", { rotation: -0.7 }, { rotation: 0.7, duration: 3, ease: "sine.inOut", yoyo: true, repeat: 20 }, 14.6);
    hlIn("hl-s3", 15.0);
    tl.fromTo("#scr-home .hm-top", { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, 14.85);
    tl.fromTo("#scr-home .hm-greet", { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: "expo.out" }, 14.95);
    tl.fromTo("#scr-home .hm-sec1", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }, 15.1);
    tl.fromTo("#hm-car .hm-cv", { x: 160, opacity: 0, rotationY: -25 }, { x: 0, opacity: 1, rotationY: 0, duration: 0.85, ease: "expo.out", stagger: 0.07 }, 15.15);
    tl.fromTo("#scr-home .hm-sec2", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }, 15.35);
    tl.fromTo("#scr-home .hm-row", { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "back.out(1.4)", stagger: 0.1 }, 15.45);
    tl.fromTo("#scr-home .nav", { y: 140 }, { y: 0, duration: 0.6, ease: "expo.out" }, 15.2);
    // les couvertures jaillissent du carrousel
    const s3 = [["#sat3-a", 480, 136, -20], ["#sat3-b", -110, -4, 18], ["#sat3-c", -552, 336, 14]];
    s3.forEach(([s, fx, fy, ry], i) => {
      tl.fromTo(s, { x: fx, y: fy, scale: 0.95, rotationY: 0, opacity: 0 }, { x: 0, y: 0, scale: 1, rotationY: ry, opacity: 1, duration: 1.0, ease: "expo.out" }, 16.5 + i * 0.16);
    });
    tl.fromTo("#sat3-chip", { scale: 0.3, opacity: 0, y: 40 }, { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: "back.out(2)" }, 17.4);
    ["#sat3-a", "#sat3-b", "#sat3-c", "#sat3-chip"].forEach((s, i) => {
      tl.to(s, { y: -22 - i * 4, duration: 1.6 + i * 0.2, ease: "sine.inOut", yoyo: true, repeat: 1 }, 17.6 + i * 0.25);
    });
    tl.to("#hm-car", { x: -464, duration: 1.6, ease: "power3.inOut" }, 18.3);
    tl.to("#hm-car", { x: -232, duration: 1.2, ease: "power3.inOut" }, 20.7);
    tl.fromTo("#hm-badge", { scale: 0 }, { scale: 1, duration: 0.5, ease: "back.out(3)" }, 19.4);
    tl.to("#phone-cam", { rotationY: 7, duration: 3, ease: "sine.inOut" }, 16.0);
    tl.to("#phone-cam", { rotationY: -3, duration: 3, ease: "sine.inOut" }, 19.6);
    // → S4
    hlOut("hl-s3", 23.72);
    tl.to("#sat3-a", { x: -700, rotationY: -60, opacity: 0, duration: 0.55, ease: "power3.in" }, 23.7);
    tl.to("#sat3-chip", { x: -900, opacity: 0, duration: 0.55, ease: "power3.in" }, 23.72);
    tl.to(["#sat3-b", "#sat3-c"], { x: -1400, rotationY: -50, opacity: 0, duration: 0.6, ease: "power3.in", stagger: 0.05 }, 23.74);
    push("#scr-home", "#scr-explore", 23.8);
    tl.to("#phone-cam", { rotationY: -8, duration: 1.3, ease: "power2.inOut" }, 23.85);

    /* ================= S4 — Explorer (24 → 32) ================= */
    hlIn("hl-s4", 24.05);
    blink("#ex-caret", 24.2, 7.6);
    typeText("#ex-q", 24.7, 0.9);
    tl.fromTo("#scr-explore .ex-pill", { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2.2)", stagger: 0.05 }, 24.9);
    tapAt(126, 304, 26.2);
    press('#scr-explore .ex-pill[data-i="0"]', 26.2, 0.9);
    tl.to('#scr-explore .ex-pill[data-i="0"]', { backgroundColor: "#7c3aed", borderColor: "#7c3aed", color: "#ffffff", duration: 0.25, ease: "power1.out" }, 26.25);
    tl.fromTo("#ex-sort", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power2.out" }, 26.5);
    tl.fromTo("#scr-explore .ex-res", { y: 140, opacity: 0, scale: 0.88 }, { y: 0, opacity: 1, scale: 1, duration: 0.85, ease: "expo.out", stagger: 0.09 }, 26.6);
    qa(".sat4").forEach((p, i) => {
      tl.fromTo(p, { scale: 0, opacity: 0, rotation: (rnd(i, 5) - 0.5) * 40 }, { scale: 1, opacity: 1, rotation: (rnd(i, 6) - 0.5) * 10, duration: 0.6, ease: "back.out(2)" }, 27.5 + i * 0.07);
      tl.to(p, { y: -24 - rnd(i, 7) * 20, duration: 1.4 + rnd(i, 8) * 0.6, ease: "sine.inOut", yoyo: true, repeat: 1 }, 28.2 + i * 0.1);
    });
    const r0 = qa("#scr-explore .ex-res")[0];
    tl.to(r0, { scale: 1.05, duration: 0.35, ease: "power2.out" }, 30.6);
    tapAt(162, 690, 31.05);
    press(r0, 31.05, 0.95);
    // → S5
    hlOut("hl-s4", 31.45);
    qa(".sat4").forEach((p, i) => {
      const cx = parseFloat(p.style.left) + 100 - 540, cy = parseFloat(p.style.top) + 38 - 1170;
      tl.to(p, { x: cx * 0.9, y: cy * 0.9, scale: 0.5, opacity: 0, duration: 0.5, ease: "power3.in" }, 31.4 + i * 0.03);
    });
    tl.set("#scr-detail", { visibility: "inherit" }, 31.5);
    tl.fromTo("#scr-detail", { yPercent: 100 }, { yPercent: 0, duration: 0.8, ease: "expo.out" }, 31.5);
    tl.set("#scr-explore", { visibility: "hidden" }, 32.4);
    tl.to("#phone-cam", { rotationY: 6, duration: 1.4, ease: "power2.inOut" }, 31.6);

    /* ================= S5 — Fiche (32 → 38) ================= */
    hlIn("hl-s5", 31.75);
    tl.fromTo("#dt-cover", { scale: 0.75, rotation: -6, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.8, ease: "back.out(1.6)" }, 32.05);
    tl.fromTo("#scr-detail .dt-hero > *", { x: 50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "power3.out", stagger: 0.07 }, 32.2);
    tl.fromTo("#scr-detail .dt-syn > *", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "power2.out", stagger: 0.09 }, 32.75);
    tl.fromTo("#scr-detail .dt-tome", { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.5, ease: "power2.out" }, 33.45);
    tl.fromTo("#scr-detail .dt-ch", { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: "expo.out", stagger: 0.08 }, 33.6);
    tl.fromTo("#dt-btn", { y: 140 }, { y: 0, duration: 0.7, ease: "back.out(1.5)" }, 33.9);
    tl.fromTo("#scr-detail .dt-check", { scale: 0 }, { scale: 1, duration: 0.45, ease: "back.out(3)", stagger: 0.16 }, 34.3);
    tl.fromTo("#sat5-cv", { x: 256, y: -22, scale: 0.87, rotationY: 0, opacity: 0 }, { x: 0, y: 0, scale: 1, rotationY: 24, opacity: 1, duration: 1.0, ease: "expo.out" }, 32.9);
    tl.fromTo("#sat5-rate", { scale: 0.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(2)" }, 33.7);
    tl.to("#sat5-cv", { y: -24, rotation: -2, duration: 1.5, ease: "sine.inOut", yoyo: true, repeat: 1 }, 34.0);
    tl.to("#scr-detail .dt-ch.cur", { scale: 1.035, duration: 0.3, ease: "power2.out", yoyo: true, repeat: 1 }, 35.2);
    tapAt(304, 1193, 36.55);
    press("#dt-btn", 36.55, 0.94);
    // → S6
    hlOut("hl-s5", 37.25);
    tl.to(["#sat5-cv", "#sat5-rate"], { x: -600, rotationY: -40, opacity: 0, duration: 0.55, ease: "power3.in", stagger: 0.05 }, 37.2);
    push("#scr-detail", "#scr-read", 37.3);
    tl.to("#phone-cam", { rotationY: 0, duration: 1.0, ease: "power2.inOut" }, 37.3);

    /* ================= S6 — Lecture (38 → 48) ================= */
    tl.set(["#rd-night", "#rd-sepia"], { opacity: 0 }, 0);
    tl.set(["#rd-sheet"], { yPercent: 105 }, 0);
    tl.set(["#rd-player"], { yPercent: 140 }, 0);
    tl.set(["#rd-sheet", "#rd-player"], { visibility: "hidden" }, 0);
    tl.set(["#rd-hl1", "#rd-hl2", "#rd-hl3"], { scaleX: 0 }, 0);
    tl.set(["#rd-tools", "#rd-note", "#rd-pin", "#rd-karaoke", "#rd-pause-i"], { opacity: 0 }, 0);
    hlIn("hl-s6a", 37.55);
    tapAt(488, 112, 39.4);
    tl.set("#rd-sheet", { visibility: "inherit" }, 39.5);
    tl.to("#rd-sheet", { yPercent: 0, duration: 0.55, ease: "expo.out" }, 39.55);
    tapAt(476, 1040, 40.1);
    tl.to("#rd-ring", { x: 360, duration: 0.35, ease: "power3.inOut" }, 40.1);
    tl.to("#rd-night", { opacity: 1, duration: 0.4, ease: "power1.inOut" }, 40.15);
    tapAt(296, 1040, 40.9);
    tl.to("#rd-ring", { x: 180, duration: 0.35, ease: "power3.inOut" }, 40.9);
    tl.to("#rd-sepia", { opacity: 1, duration: 0.4, ease: "power1.inOut" }, 40.95);
    tl.to("#rd-sheet", { yPercent: 105, duration: 0.45, ease: "power3.in" }, 41.5);
    tl.set("#rd-sheet", { visibility: "hidden" }, 42.0);
    tl.set("#rd-light", { visibility: "hidden" }, 40.6);
    tl.set("#rd-night", { visibility: "hidden" }, 41.4);
    hlOut("hl-s6a", 41.85);
    hlIn("hl-s6b", 42.1);
    tl.to("#rd-hl1", { scaleX: 1, duration: 0.38, ease: "power2.inOut" }, 42.25);
    tl.to("#rd-hl2", { scaleX: 1, duration: 0.3, ease: "power2.inOut" }, 42.55);
    tl.to("#rd-hl3", { scaleX: 1, duration: 0.22, ease: "power2.inOut" }, 42.8);
    tl.fromTo("#rd-tools", { scale: 0.6, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: "back.out(2)", immediateRender: false }, 42.7);
    tapAt(330, (tRects[0] ? tRects[0].y - 56 : 690), 43.1);
    tl.to("#rd-tools", { opacity: 0, scale: 0.9, duration: 0.25, ease: "power2.in" }, 43.3);
    tl.fromTo("#rd-note", { scale: 0.5, opacity: 0, rotation: -4 }, { scale: 1, opacity: 1, rotation: 0, duration: 0.6, ease: "back.out(1.8)", immediateRender: false, transformOrigin: "30% 0%" }, 43.35);
    tl.fromTo("#rd-pin", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(3)", immediateRender: false }, 43.7);
    hlOut("hl-s6b", 44.15);
    hlIn("hl-s6c", 44.4);
    tl.to("#rd-note", { opacity: 0, y: -20, duration: 0.35, ease: "power2.in" }, 44.3);
    tl.set("#rd-player", { visibility: "inherit" }, 44.35);
    tl.to("#rd-player", { yPercent: 0, duration: 0.65, ease: "back.out(1.4)" }, 44.4);
    tapAt(92, 1114, 44.95);
    press("#rd-play", 44.95, 0.88);
    tl.to("#rd-play-i", { opacity: 0, duration: 0.12 }, 45.0);
    tl.to("#rd-pause-i", { opacity: 1, duration: 0.12 }, 45.02);
    // ===== livre audio : vraie voix ElevenLabs (données inlinées par build.py)
    const V = window.__plumeVoice;
    const VEND = 55.3;
    const SPAN = VEND - 45.0;
    const bars = qa("#rd-wave .wv");
    const wv = { t: 0 };
    tl.fromTo(wv, { t: 0 }, {
      t: SPAN, duration: SPAN, ease: "none", immediateRender: false,
      onUpdate: () => {
        const T = wv.t, played = 13 + Math.floor((T / SPAN) * 21);
        const k = Math.min(V.env.length - 1, Math.max(0, Math.floor((45.0 + T - V.envStart) * V.fps)));
        const e = V.env[k];
        for (let i = 0; i < bars.length; i++) {
          const w = Math.abs(0.6 * Math.sin(T * 9.1 + i * 0.9) + 0.4 * Math.sin(T * 4.3 + i * 0.37 + 1.3));
          const s = 0.14 + 0.86 * Math.min(1, e * (0.45 + 0.8 * w));
          bars[i].style.transform = `scaleY(${s.toFixed(3)})`;
          bars[i].style.background = i < played ? "#a78bfa" : "rgba(255,255,255,0.28)";
        }
      },
    }, 45.0);
    // karaoké : le paragraphe lu, puis chaque mot au moment où la voix le prononce
    if (paraRects.length >= 2) {
      const P0 = paraRects[0], P1 = paraRects[1];
      tl.set("#rd-karaoke", { y: P0.y - 190 - 8, scaleY: (P0.h + 16) / 150, transformOrigin: "50% 0%" }, 45.05);
      tl.to("#rd-karaoke", { opacity: 1, duration: 0.3 }, 45.1);
      tl.to("#rd-karaoke", { y: P1.y - 190 - 8, scaleY: (P1.h + 16) / 150, duration: 0.45, ease: "power3.inOut" }, V.vs[1] - 0.35);
    }
    [[qa("#rd-sepia .kw0"), V.words, V.vs[0]], [qa("#rd-sepia .kw1"), V.words1, V.vs[1]]].forEach(([els, ws, vs]) => {
      els.forEach((el, i) => {
        const w = ws[Math.min(i, ws.length - 1)];
        tl.to(el, { color: "#5b21b6", backgroundColor: "rgba(124,58,237,0.2)", duration: 0.06, ease: "none" }, vs + w[1]);
        tl.to(el, { backgroundColor: "rgba(124,58,237,0)", duration: 0.3, ease: "power1.out" }, vs + Math.max(w[2], w[1] + 0.12));
      });
    });
    tl.fromTo("#rd-sepia .rd-prog", { scaleX: 0.42 }, { scaleX: 0.56, duration: SPAN, ease: "none" }, 45.0);
    qa("#rings .ring").forEach((r, i) => {
      const t0 = 45.2 + i * 0.44;
      const reps = Math.max(0, Math.floor((54.9 - t0) / 2.2) - 1);
      tl.fromTo(r, { scale: 0.55, opacity: 0.8 }, { scale: 1.95, opacity: 0, duration: 2.2, ease: "power1.out", repeat: reps, immediateRender: false }, t0);
    });
    // la caméra s'approche du texte pendant la lecture
    tl.to("#phone-cam", { scale: 1.1, y: 40, duration: 5, ease: "sine.inOut" }, 45.4);
    tl.to("#phone-cam", { scale: 1, y: 0, duration: 0.6, ease: "power2.inOut" }, 54.7);
    // pastille « voix naturelle · ElevenLabs »
    tl.fromTo("#sat6-voice", { scale: 0.3, opacity: 0, x: -60 }, { scale: 1, opacity: 1, x: 0, duration: 0.7, ease: "back.out(1.8)" }, 45.7);
    tl.to("#sat6-voice", { y: -24, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: 3 }, 46.5);
    const vb = qa("#sat6-voice .vb");
    const vv = { t: 0 };
    tl.fromTo(vv, { t: 0 }, {
      t: 9.6, duration: 9.6, ease: "none", immediateRender: false,
      onUpdate: () => {
        const k = Math.min(V.env.length - 1, Math.max(0, Math.floor((45.7 + vv.t - V.envStart) * V.fps)));
        const e = V.env[k];
        vb.forEach((b, i) => { b.style.transform = `scaleY(${(0.2 + 0.8 * Math.min(1, e * (0.6 + 0.5 * Math.abs(Math.sin(vv.t * 8 + i * 1.3))))).toFixed(3)})`; });
      },
    }, 45.7);
    tl.to("#sat6-voice", { x: -500, opacity: 0, duration: 0.45, ease: "power3.in" }, 55.0);

    /* ---- tout ce qui suit est décalé de D s (scène audio rallongée pour la voix) ---- */
    const D = 8;
    const master = tl;
    tl = gsap.timeline();
    // → S7 : retournement 3D du téléphone
    hlOut("hl-s6c", 47.5);
    tl.to("#phone-cam", { rotationY: 90, duration: 0.32, ease: "power2.in" }, 47.55);
    tl.set("#scr-read", { visibility: "hidden" }, 47.87);
    tl.set("#scr-write", { visibility: "inherit" }, 47.87);
    tl.fromTo("#phone-cam", { rotationY: -90 }, { rotationY: 0, duration: 0.6, ease: "back.out(1.3)", immediateRender: false }, 47.87);

    /* ================= S7 — Écrire (48 → 58) ================= */
    tl.set(["#wr-toast"], { yPercent: -170 }, 0);
    tl.set(["#wr-caret2"], { opacity: 0 }, 0);
    tl.set("#scr-write .wr-chip0 .wr-fill, #scr-write .wr-chip1 .wr-fill", { opacity: 0 }, 0);
    tl.set("#scr-write .wr-chip0 .wr-lab, #scr-write .wr-chip1 .wr-lab", { color: "#3d3456" }, 0);
    hlIn("hl-s7a", 47.95);
    blink("#wr-caret1", 48.3, 2.4);
    typeText("#wr-title", 48.6, 1.3);
    tapAt(110, 357, 50.15);
    press("#scr-write .wr-chip0", 50.15, 0.88);
    tl.to("#scr-write .wr-chip0 .wr-fill", { opacity: 1, duration: 0.2 }, 50.2);
    tl.to("#scr-write .wr-chip0 .wr-lab", { color: "#ffffff", duration: 0.2 }, 50.2);
    tapAt(252, 357, 50.45);
    press("#scr-write .wr-chip1", 50.45, 0.88);
    tl.to("#scr-write .wr-chip1 .wr-fill", { opacity: 1, duration: 0.2 }, 50.5);
    tl.to("#scr-write .wr-chip1 .wr-lab", { color: "#ffffff", duration: 0.2 }, 50.5);
    tl.set("#wr-caret1", { visibility: "hidden" }, 50.75);
    tl.set("#wr-caret2", { opacity: 1 }, 50.75);
    typeText("#wr-body", 50.8, 2.25);
    blink("#wr-caret2", 53.1, 1.2);
    tapAt(422, 1155, 53.4);
    press("#wr-pub", 53.4, 0.9);
    hlOut("hl-s7a", 53.5);
    hlIn("hl-s7b", 53.75);
    tl.to("#wr-toast", { yPercent: 0, duration: 0.6, ease: "back.out(1.6)" }, 53.75);
    const conf = qa("#wr-confetti .cf");
    const cs = { t: 0 };
    tl.fromTo(cs, { t: 0 }, {
      t: 1.6, duration: 1.6, ease: "none", immediateRender: false,
      onUpdate: () => {
        const T = cs.t;
        conf.forEach((c, i) => {
          const ang = (-90 + (rnd(i, 9) - 0.5) * 150) * (Math.PI / 180);
          const v = 520 + rnd(i, 10) * 560;
          const x = 422 + Math.cos(ang) * v * T;
          const y = 1150 + Math.sin(ang) * v * T + 0.5 * 1500 * T * T;
          const o = T <= 0 ? 0 : T < 1.1 ? 1 : Math.max(0, 1 - (T - 1.1) / 0.5);
          c.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(T * (300 + rnd(i, 11) * 500)).toFixed(1)}deg)`;
          c.style.opacity = String(o);
        });
      },
    }, 53.55);
    tl.to("#wr-toast", { yPercent: -170, duration: 0.4, ease: "power3.in" }, 55.3);
    // statistiques auteur
    hlOut("hl-s7b", 54.85);
    hlIn("hl-s7c", 55.1);
    tl.to("#phone-cam", { x: 200, scale: 0.86, rotationY: -16, duration: 0.95, ease: "power3.inOut" }, 54.9);
    tl.fromTo("#sat7-dash", { x: -760, rotationY: 40, opacity: 0 }, { x: 0, rotationY: 7, opacity: 1, duration: 1.05, ease: "expo.out" }, 55.0);
    const st = { r: 0, c: 0 };
    const dR = q("#dash-reads"), dC = q("#dash-comp");
    tl.fromTo(st, { r: 0, c: 0 }, {
      r: 1248, c: 78, duration: 1.5, ease: "power2.out", immediateRender: false,
      onUpdate: () => { dR.textContent = fmt(st.r); dC.textContent = Math.round(st.c) + "\u202f%"; },
    }, 55.55);
    tl.fromTo("#sat7-dash .db", { scaleY: 0 }, { scaleY: 1, duration: 0.75, ease: "power3.out", stagger: 0.08 }, 55.75);
    tl.fromTo("#dash-drop", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2.4)", transformOrigin: "20% 100%" }, 56.6);
    tl.to("#sat7-dash", { y: -18, duration: 1.0, ease: "sine.inOut", yoyo: true, repeat: 1 }, 56.0);
    // → S8
    hlOut("hl-s7c", 57.55);
    tl.to("#sat7-dash", { x: -800, rotationY: -35, opacity: 0, duration: 0.55, ease: "power3.in" }, 57.55);
    tl.to("#phone-cam", { x: 0, scale: 1, rotationY: 0, duration: 0.8, ease: "power3.inOut" }, 57.6);
    push("#scr-write", "#scr-chat", 57.75);

    /* ================= S8 — Partager (58 → 70) ================= */
    tl.set(["#ch-m1", "#ch-m2", "#ch-m3", "#ch-m4", "#ch-m5", "#ch-typing"], { opacity: 0 }, 0);
    tl.set("#ch-banner", { yPercent: -160 }, 0);
    tl.set("#ch-spoil-txt", { filter: "blur(9px)" }, 0);
    tl.set(["#sub1", "#sub2", "#sub3"], { yPercent: 110, opacity: 0 }, 0);
    tl.set("#scr-chat .ch-bar", { scaleX: 0 }, 0);
    hlIn("hl-s8", 57.95);
    const pop = (s, t, origin) => tl.fromTo(s, { y: 40, scale: 0.8, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.55, ease: "back.out(1.7)", transformOrigin: origin || "0% 100%", immediateRender: false }, t);
    const subIn = (s, t) => tl.to(s, { yPercent: 0, opacity: 1, duration: 0.5, ease: "expo.out" }, t);
    const subOut = (s, t) => tl.to(s, { yPercent: -110, opacity: 0, duration: 0.3, ease: "power2.in" }, t);
    pop("#ch-m1", 58.5);
    tl.to("#ch-tag", { scale: 1.12, duration: 0.18, ease: "power2.out", yoyo: true, repeat: 1 }, 58.95);
    pop("#ch-m2", 59.3);
    pop("#ch-m3", 60.1);
    subIn("#sub2", 60.4);
    tapAt(300, 522, 61.2);
    tl.to("#ch-spoil-cover", { opacity: 0, scale: 1.12, duration: 0.3, ease: "power2.in" }, 61.3);
    tl.to("#ch-spoil-txt", { filter: "blur(0px)", duration: 0.45, ease: "power2.out" }, 61.3);
    subOut("#sub2", 61.95);
    pop("#ch-m4", 62.0, "100% 100%");
    subIn("#sub1", 62.2);
    tl.to("#ch-mention", { backgroundColor: "rgba(250,204,21,0.55)", duration: 0.2, yoyo: true, repeat: 1 }, 62.45);
    tl.fromTo("#rx2", { scale: 0, opacity: 0, rotation: -14 }, { scale: 1, opacity: 1, rotation: -4, duration: 0.55, ease: "back.out(2.2)" }, 62.5);
    subOut("#sub1", 63.15);
    pop("#ch-m5", 63.3);
    subIn("#sub3", 63.4);
    tl.to("#scr-chat .ch-bar", { scaleX: 1, duration: 0.9, ease: "power3.out", stagger: 0.12 }, 63.75);
    const pv = { a: 0 };
    const pcts = qa("#scr-chat .ch-pct");
    tl.fromTo(pv, { a: 0 }, { a: 1, duration: 0.9, ease: "power3.out", immediateRender: false, onUpdate: () => pcts.forEach((n) => (n.textContent = Math.round(pv.a * +n.dataset.v) + "\u202f%")) }, 63.75);
    tl.fromTo("#rx3", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(2.2)" }, 64.2);
    pop("#ch-typing", 64.9);
    qa("#ch-typing .td").forEach((d, i) => tl.fromTo(d, { y: 0 }, { y: -9, duration: 0.24, ease: "sine.inOut", yoyo: true, repeat: 9 }, 65.0 + i * 0.12));
    tl.to("#ch-banner", { yPercent: 0, duration: 0.55, ease: "back.out(1.5)" }, 65.8);
    tl.to("#ch-head", { opacity: 0, duration: 0.15 }, 66.05);
    tl.to("#ch-head", { opacity: 1, duration: 0.2 }, 68.45);
    tl.fromTo("#rx1", { scale: 0, opacity: 0, rotation: 12 }, { scale: 1, opacity: 1, rotation: 3, duration: 0.55, ease: "back.out(2.4)" }, 66.0);
    tl.to("#ch-banner", { yPercent: -160, duration: 0.4, ease: "power3.in" }, 68.2);
    // réseau d'avatars autour du téléphone
    qa(".avl").forEach((l, i) => tl.fromTo(l, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.out" }, 66.4 + i * 0.05));
    qa(".av").forEach((a, i) => {
      tl.fromTo(a, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(2.2)" }, 66.35 + i * 0.06);
      tl.to(a, { y: -16 - rnd(i, 12) * 14, duration: 1.1 + rnd(i, 13) * 0.4, ease: "sine.inOut", yoyo: true, repeat: 1 }, 67.0 + i * 0.05);
    });
    tl.to(["#rx1", "#rx2", "#rx3"], { y: -20, duration: 1.2, ease: "sine.inOut", yoyo: true, repeat: 1, stagger: 0.2 }, 66.6);
    // → S9
    hlOut("hl-s8", 69.45);
    subOut("#sub3", 69.45);
    qa(".av").forEach((a, i) => {
      const cx = 540 - (parseFloat(a.style.left) + 50), cy = 1170 - (parseFloat(a.style.top) + 50);
      tl.to(a, { x: cx, y: cy, scale: 0, duration: 0.5, ease: "power3.in" }, 69.4 + i * 0.025);
    });
    tl.to(".avl", { opacity: 0, duration: 0.3 }, 69.4);
    tl.to(["#rx1", "#rx2", "#rx3"], { scale: 0, opacity: 0, duration: 0.35, ease: "power2.in" }, 69.4);
    push("#scr-chat", "#scr-trophy", 69.7);

    /* ================= S9 — Succès (70 → 78) ================= */
    const RING = q("#tr-ring");
    const C = 2 * Math.PI * 84;
    const lv = { p: 0.78 };
    const XP = q("#tr-xp"), XPV = q("#tr-xpv"), LVL = q("#tr-lvl");
    tl.set(["#tr-up"], { opacity: 0 }, 0);
    tl.set("#scr-trophy .tr-med", { scale: 0 }, 0);
    tl.set("#tr-leg", { opacity: 0, y: 160 }, 0);
    tl.set("#xp-pop", { opacity: 0 }, 0);
    tl.fromTo(lv, { p: 0.78 }, {
      p: 1, duration: 1.25, ease: "power2.inOut", immediateRender: false,
      onUpdate: () => {
        RING.setAttribute("stroke-dashoffset", String(C * (1 - lv.p)));
        XP.style.transform = `scaleX(${lv.p.toFixed(4)})`;
        XPV.textContent = fmt(3000 * lv.p);
        LVL.textContent = lv.p >= 0.999 ? "13" : "12";
      },
    }, 70.8);
    hlIn("hl-s9", 69.95);
    tl.to("#tr-lvl", { scale: 1.4, duration: 0.14, ease: "power2.out" }, 72.05);
    tl.to("#tr-lvl", { scale: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" }, 72.19);
    tl.fromTo("#tr-up", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: "back.out(2)", immediateRender: false }, 72.15);
    const lb = qa("#lvl-burst .lb");
    const lbs = { t: 0 };
    tl.fromTo(lbs, { t: 0 }, {
      t: 1, duration: 1.0, ease: "none", immediateRender: false,
      onUpdate: () => {
        const T = lbs.t;
        lb.forEach((d, i) => {
          const a = (i / lb.length) * Math.PI * 2 + rnd(i, 14) * 0.3;
          const r = (90 + rnd(i, 15) * 140) * (1 - Math.pow(1 - T, 3));
          d.style.transform = `translate(${(394 + Math.cos(a) * r).toFixed(1)}px, ${(844 + Math.sin(a) * r).toFixed(1)}px) scale(${(1 - T * 0.7).toFixed(3)})`;
          d.style.opacity = T <= 0 ? "0" : String(Math.max(0, 1 - T));
        });
      },
    }, 72.08);
    tl.fromTo("#xp-pop", { scale: 0.3, opacity: 0, y: 30 }, { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: "back.out(2.4)", immediateRender: false }, 72.2);
    tl.to("#xp-pop", { y: -90, opacity: 0, duration: 1.1, ease: "power1.in" }, 72.9);
    tl.to("#scr-trophy .tr-med", { scale: 1, duration: 0.55, ease: "back.out(2)", stagger: 0.08 }, 70.75);
    tl.to("#tr-leg", { opacity: 1, y: 0, duration: 0.75, ease: "expo.out" }, 72.9);
    tl.fromTo("#tr-sheen", { x: 0 }, { x: 820, duration: 0.95, ease: "power2.inOut" }, 73.7);
    [[-24, 30, -18], [56, 116, 10], [-140, -110, 14]].forEach(([fx, fy, rot], i) => {
      tl.fromTo("#med" + i, { x: fx * 4, y: fy * 2, scale: 0.4, opacity: 0, rotation: rot * 3 }, { x: 0, y: 0, scale: 1, opacity: 1, rotation: rot, duration: 0.95, ease: "expo.out" }, 74.0 + i * 0.12);
      tl.to("#med" + i, { y: -26, rotation: -rot / 2, duration: 1.2, ease: "sine.inOut", yoyo: true, repeat: 1 }, 75.1 + i * 0.15);
    });
    tl.to("#phone-cam", { scale: 0.94, y: -30, duration: 2.4, ease: "sine.in" }, 75.4);
    hlOut("hl-s9", 77.6);
    tl.to(["#med0", "#med1", "#med2"], { scale: 0, opacity: 0, duration: 0.35, ease: "back.in(2)", stagger: 0.04 }, 77.5);

    /* ================= S10 — Final (78 → 92) ================= */
    tl.to("#stage", { opacity: 0, scale: 0.86, duration: 0.45, ease: "power2.in", transformOrigin: "50% 62%" }, 77.75);
    tl.set("#stage", { visibility: "hidden" }, 78.3);
    tl.set("#s10", { visibility: "inherit" }, 77.85);
    const FAN = [["#fp-c", 540, 1180, 0, 0, 0.6], ["#fp-l", 300, 1250, -11, 22, 0.52], ["#fp-r", 780, 1250, 11, -22, 0.52]];
    FAN.forEach(([s, cx, cy, rot, ry, sc], i) => {
      const n = q(s);
      n.style.left = cx - 320 + "px";
      n.style.top = cy - 650 + "px";
      tl.fromTo(s, { x: 540 - cx, y: 1180 - cy + 120, scale: 0.25, rotation: 0, rotationY: 0, opacity: 0 }, { x: 0, y: 0, scale: sc, rotation: rot, rotationY: ry, opacity: 1, duration: 1.0, ease: "back.out(1.3)" }, 77.95 + i * 0.08);
      tl.to(s, { y: -22 - i * 6, duration: 1.3 + i * 0.25, ease: "sine.inOut", yoyo: true, repeat: 1 }, 79.3 + i * 0.2);
    });
    gsap.set("#fp-c", { zIndex: 3 });
    tl.fromTo("#bw1", { x: -500, skewX: -18, opacity: 0 }, { x: 0, skewX: 0, opacity: 1, duration: 0.45, ease: "expo.out" }, 78.5);
    tl.fromTo("#bw2", { scale: 2.2, opacity: 0, transformOrigin: "0% 60%" }, { scale: 1, opacity: 1, duration: 0.4, ease: "power4.out" }, 79.0);
    tl.fromTo("#bw3", { y: 140, rotation: 8, opacity: 0, transformOrigin: "0% 100%" }, { y: 0, rotation: 0, opacity: 1, duration: 0.6, ease: "back.out(1.8)" }, 79.5);
    tl.to(["#bw1", "#bw2", "#bw3"], { x: 26, duration: 3.2, ease: "sine.inOut", stagger: 0.1 }, 80.2);
    // repli vers la plume
    tl.to(["#bw1", "#bw2", "#bw3"], { y: -160, opacity: 0, duration: 0.5, ease: "power3.in", stagger: 0.06 }, 83.55);
    FAN.forEach(([s, cx, cy], i) => tl.to(s, { x: 540 - cx, y: 900 - cy, scale: 0, rotation: (i - 1) * 30, rotationY: 0, opacity: 0, duration: 0.7, ease: "power3.in" }, 83.7 + i * 0.05));
    const shock2 = document.createElement("div");
    shock2.className = "shock";
    shock2.style.top = "660px";
    q("#s10-lock").prepend(shock2);
    tl.fromTo(shock2, { scale: 0.15, opacity: 0.95 }, { scale: 1.7, opacity: 0, duration: 1.3, ease: "power2.out", immediateRender: false }, 84.45);
    tl.fromTo("#s10-mark", { scale: 0, rotation: -70 }, { scale: 1, rotation: 0, duration: 1.05, ease: "back.out(1.6)" }, 84.45);
    tl.fromTo("#s10-word span", { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.85, ease: "expo.out", stagger: 0.07 }, 85.0);
    qa("#s10-tag .tw").forEach((w, i) => tl.fromTo(w, { scale: 1.8, opacity: 0, filter: "blur(8px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.34, ease: "power4.out" }, 86.0 + i * 0.5));
    tl.fromTo("#s10-pill", { y: 160, opacity: 0, scale: 0.8 }, { y: 0, opacity: 1, scale: 1, duration: 0.75, ease: "back.out(1.7)" }, 87.5);
    tl.fromTo("#s10-sheen", { x: 0, opacity: 1 }, { x: 1600, duration: 1.0, ease: "power2.inOut" }, 88.2);
    tl.fromTo("#s10-mark", { y: 0 }, { y: -14, duration: 1.2, ease: "sine.inOut", yoyo: true, repeat: 1, immediateRender: false }, 88.0);
    tl.set("#fade-out", { visibility: "inherit" }, 90.5);
    tl.fromTo("#fade-out", { opacity: 0 }, { opacity: 1, duration: 1.4, ease: "power1.inOut" }, 90.55);

    master.add(tl, D);
    window.__timelines["main"] = master;
    if (window.__hfForceTimelineRebind) window.__hfForceTimelineRebind();
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  else build();
})();
