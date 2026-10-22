/* PLUME promo — construction du DOM (déterministe, exécuté une fois au chargement).
   Toutes les maquettes d'écran sont dessinées ici dans leur ÉTAT FINAL ; le
   timeline (timeline.js) anime ensuite depuis/vers cet état. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------------- plume ---------------- */
  let gid = 0;
  function featherSVG(mode) {
    gid += 1;
    const id = "fg" + gid;
    const fill = mode === "white" ? "#ffffff" : `url(#${id})`;
    const rach = mode === "white" ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.55)";
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0.15" y1="0.95" x2="0.9" y2="0.05">
        <stop offset="0" stop-color="#6D28D9"/><stop offset="0.55" stop-color="#A855F7"/><stop offset="1" stop-color="#F472B6"/>
      </linearGradient></defs>
      <path d="M33 77 L 12 97" stroke="${fill}" stroke-width="4.2" stroke-linecap="round"/>
      <path d="M31 74 C 22 52, 40 24, 86 6 C 85 17, 83 24, 81 29 L 66 34 L 78 37 C 75 45, 72 50, 68 54 L 53 56 L 64 60 C 58 68, 48 74, 37 79 Z" fill="${fill}"/>
      <path d="M33 76 C 47 57, 62 36, 82 11" stroke="${rach}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    </svg>`;
  }
  $$(".feather-svg").forEach((el) => { el.innerHTML = featherSVG(el.classList.contains("white") ? "white" : "grad"); });

  /* ---------------- icônes (style trait) ---------------- */
  const P = {
    home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3",
    msg: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
    user: "M20 21a8 8 0 0 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
    bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0",
    back: "M15 18l-6-6 6-6",
    heart: "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z",
    eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM20 17v4H6.5A2.5 2.5 0 0 1 4 18.5",
    check: "M20 6 9 17l-5-5",
    phones: "M3 14v-2a9 9 0 0 1 18 0v2M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z",
    call: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
    star: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.8l-5.4 2.7 1.2-6-4.5-4.2 6.1-.7z",
    flame: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.3 1.3 2.3 2.5 2.8z",
    crown: "M2 19h20M3 7l5 4 4-7 4 7 5-4-2 12H5z",
    send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
    chart: "M3 3v18h18M8 17v-5M13 17V8M18 17v-9",
    share: "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
    pen: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
    quote: "M3 21c3 0 7-1 7-8V5H3v7h4M14 21c3 0 7-1 7-8V5h-7v7h4",
    note: "M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5zM15 3v6h6",
    hl: "M9 11l-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4",
    more: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
    sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
    sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8",
    lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
    android: "M5 16V10a7 7 0 0 1 14 0v6zM8.5 5.2 6.8 2.5M15.5 5.2l1.7-2.7M9 9.5h.01M15 9.5h.01M7 16v4M17 16v4",
  };
  function ico(name, size, color, sw) {
    const s = size || 30;
    const c = color || "currentColor";
    const w = sw || 2;
    return `<span class="ico" style="width:${s}px;height:${s}px;color:${c}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${P[name]}"/></svg></span>`;
  }
  const playIco = (s, c) => `<span class="ico" style="width:${s}px;height:${s}px"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z" fill="${c}"/></svg></span>`;
  const pauseIco = (s, c) => `<span class="ico" style="width:${s}px;height:${s}px"><svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="${c}"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="${c}"/></svg></span>`;
  window.__plumeIco = ico;

  /* ---------------- couvertures (fictives) ---------------- */
  const COVERS = [
    { t: "L'Héritière des Cendres", a: "Inès K.", c1: "#431407", c2: "#EA580C", m: "flame" },
    { t: "Nuits de Dakar", a: "Malik D.", c1: "#1E1B4B", c2: "#6366F1", m: "moon" },
    { t: "Le Dernier Griot", a: "Awa S.", c1: "#3F2A06", c2: "#CA8A04", m: "sun" },
    { t: "Code Rouge", a: "Yann B.", c1: "#3B0A0A", c2: "#DC2626", m: "bolt" },
    { t: "Les Murmures du Fleuve", a: "Moussa T.", c1: "#042F3A", c2: "#0891B2", m: "wave" },
    { t: "Sous la Pluie d'Étoiles", a: "Léa M.", c1: "#2E1065", c2: "#A855F7", m: "stars" },
    { t: "Le Royaume Oublié", a: "Kofi A.", c1: "#052E16", c2: "#15803D", m: "mount" },
  ];
  function motif(m) {
    switch (m) {
      case "flame": return `<path d="M50 18c6 14 20 22 20 40a20 20 0 0 1-40 0c0-10 6-14 8-22 4 6 4 10 8 12 2-10-2-18 4-30z" fill="rgba(255,237,213,0.85)"/><circle cx="50" cy="62" r="8" fill="rgba(255,255,255,0.9)"/>`;
      case "moon": return `<circle cx="62" cy="32" r="16" fill="rgba(224,231,255,0.92)"/><circle cx="69" cy="27" r="14" fill="#1E1B4B" opacity="0.85"/><path d="M0 70 L20 58 L32 66 L50 50 L68 64 L82 56 L100 68 V100 H0Z" fill="rgba(10,8,40,0.7)"/>`;
      case "sun": return `<circle cx="50" cy="40" r="17" fill="rgba(254,240,138,0.95)"/><path d="M0 72 Q25 60 50 70 T100 66 V100 H0Z" fill="rgba(41,24,2,0.6)"/>`;
      case "bolt": return `<path d="M56 10 L30 52 H48 L40 86 L72 40 H54 Z" fill="rgba(254,226,226,0.9)"/>`;
      case "wave": return `<path d="M0 46 Q12 38 25 46 T50 46 T75 46 T100 46" stroke="rgba(207,250,254,0.9)" stroke-width="3" fill="none"/><path d="M0 58 Q12 50 25 58 T50 58 T75 58 T100 58" stroke="rgba(207,250,254,0.6)" stroke-width="3" fill="none"/><path d="M0 70 Q12 62 25 70 T50 70 T75 70 T100 70" stroke="rgba(207,250,254,0.35)" stroke-width="3" fill="none"/>`;
      case "stars": return `<g fill="rgba(250,245,255,0.95)"><circle cx="22" cy="20" r="2"/><circle cx="70" cy="14" r="2.5"/><circle cx="50" cy="34" r="1.6"/><circle cx="84" cy="40" r="2"/><circle cx="30" cy="48" r="1.4"/><circle cx="64" cy="56" r="1.8"/></g><path d="M40 22 l2.6 5.4 5.9.8-4.3 4.1 1 5.8L40 35.3l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="rgba(253,224,71,0.95)"/>`;
      default: return `<path d="M0 74 L28 34 L46 56 L64 26 L100 74 V100 H0Z" fill="rgba(220,252,231,0.55)"/><circle cx="74" cy="22" r="7" fill="rgba(240,253,244,0.9)"/>`;
    }
  }
  function cover(i, w, h, extraClass) {
    const c = COVERS[i % COVERS.length];
    const ts = Math.round(w * 0.135);
    const as = Math.max(9, Math.round(w * 0.06));
    return `<div class="cover ${extraClass || ""}" style="width:${w}px;height:${h}px;background:linear-gradient(165deg, ${c.c2} 0%, ${c.c1} 78%);">
      <svg class="cv-motif" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${motif(c.m)}</svg>
      <div class="cv-band"></div>
      <div class="cv-title" style="font-size:${ts}px">${c.t}</div>
      <div class="cv-author" style="font-size:${as}px">${c.a}</div>
    </div>`;
  }
  window.__plumeCover = cover;

  /* ---------------- éléments communs des écrans ---------------- */
  const status = () => `<div class="status"><span>9:41</span><span class="st-ico"><span class="sig"><i style="height:6px"></i><i style="height:10px"></i><i style="height:14px"></i><i style="height:18px"></i></span><span class="bat"></span></span></div>`;
  function nav(active) {
    const it = (k, icon, label) => `<div class="it ${active === k ? "on" : ""}">${ico(icon, 34)}<span>${label}</span></div>`;
    return `<div class="nav">
      ${it("home", "home", "Accueil")}
      ${it("trophy", "trophy", "Succès")}
      <div class="it"><div class="fab-wrap"><div class="fab"><div class="feather-svg">${featherSVG("white")}</div></div><div class="fab-label">ÉCRIRE</div></div></div>
      ${it("msg", "msg", "Message")}
      ${it("user", "user", "Profil")}
    </div>`;
  }
  const css = (el, o) => Object.assign(el.style, o);

  /* ---------------- ACCUEIL ---------------- */
  (function home() {
    const el = $("#scr-home");
    let carousel = "";
    for (let i = 0; i < 6; i++) carousel += `<div class="hm-cv" style="position:absolute;left:${i * 232}px;top:0">${cover(i, 210, 315)}</div>`;
    el.innerHTML = `${status()}
      <div class="hm-top" style="position:absolute;left:32px;top:84px;width:544px;height:60px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:12px"><div class="feather-svg" style="width:46px;height:46px">${featherSVG("grad")}</div><span style="font-family:Montserrat,sans-serif;font-weight:700;font-size:28px;letter-spacing:0.2em;color:#1d1530">PLUME</span></div>
        <div style="display:flex;gap:22px;align-items:center;color:#1d1530">${ico("search", 34)}<span style="position:relative">${ico("bell", 34)}<span id="hm-badge" style="position:absolute;right:-6px;top:-6px;width:22px;height:22px;border-radius:11px;background:#EC4899;color:#fff;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center">3</span></span></div>
      </div>
      <div class="hm-greet" style="position:absolute;left:32px;top:168px">
        <div style="font-family:'Source Serif 4',serif;font-weight:600;font-size:44px;color:#1d1530">Bonsoir, Awa</div>
        <div style="font-size:22px;color:#625a78;margin-top:6px">Que vas-tu lire ce soir ?</div>
      </div>
      <div class="hm-sec1" style="position:absolute;left:32px;top:300px;width:544px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-family:'Source Serif 4',serif;font-weight:900;font-size:32px;color:#1d1530">Pour toi</span>
        <span style="font-size:18px;font-weight:600;color:#6d28d9;background:#f1eafe;padding:8px 16px;border-radius:20px">Selon tes lectures</span>
      </div>
      <div id="hm-car-clip" style="position:absolute;left:32px;top:360px;width:576px;height:345px;overflow:hidden">
        <div id="hm-car" style="position:absolute;left:0;top:0;width:1400px;height:345px">${carousel}</div>
      </div>
      <div class="hm-sec2" style="position:absolute;left:32px;top:722px;width:544px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-family:'Source Serif 4',serif;font-weight:900;font-size:32px;color:#1d1530">Tendances</span>
        <span style="font-size:20px;font-weight:600;color:#6d28d9">Voir tout</span>
      </div>
      ${[0, 1].map((k) => {
        const c = COVERS[k + 4];
        return `<div class="hm-row" style="position:absolute;left:32px;top:${782 + k * 168}px;width:544px;height:150px;display:flex;gap:22px;align-items:center">
          <div style="position:relative;width:100px;height:150px;flex:none">${cover(k + 4, 100, 150)}</div>
          <div style="flex:1">
            <div style="font-family:'Source Serif 4',serif;font-weight:600;font-size:28px;color:#1d1530;line-height:1.15">${c.t}</div>
            <div style="font-size:20px;color:#625a78;margin-top:6px">par ${c.a}</div>
            <div style="display:flex;gap:18px;margin-top:12px;font-size:19px;color:#625a78;align-items:center">${ico("eye", 22)}<span>${k ? "8,7k" : "12,4k"}</span>${ico("heart", 22)}<span>${k ? "1,3k" : "2,1k"}</span></div>
          </div>
          <div style="font-family:'Source Serif 4',serif;font-weight:900;font-size:40px;color:#ddd3f5">${k + 1}</div>
        </div>`;
      }).join("")}
      ${nav("home")}`;
  })();

  /* ---------------- EXPLORER ---------------- */
  const GENRES = ["Fantasy", "Romance", "Thriller", "Science-fiction", "Poésie", "Horreur", "Aventure", "Drame"];
  (function explore() {
    const el = $("#scr-explore");
    el.innerHTML = `${status()}
      <div style="position:absolute;left:32px;top:88px;font-family:'Source Serif 4',serif;font-weight:900;font-size:50px;color:#1d1530">Explorer</div>
      <div id="ex-search" style="position:absolute;left:32px;top:170px;width:544px;height:78px;border-radius:39px;background:#f4f0fb;border:2px solid #e4dcf6;display:flex;align-items:center;gap:16px;padding:0 26px;color:#6d28d9">
        ${ico("search", 32)}<span id="ex-q" data-full="dragons" style="font-size:28px;font-weight:600;color:#1d1530">dragons</span><span id="ex-caret" style="display:inline-block;width:3px;height:34px;background:#7c3aed;margin-left:-12px"></span>
      </div>
      <div id="ex-pills" style="position:absolute;left:32px;top:276px;width:560px;display:flex;flex-wrap:wrap;gap:12px">
        ${GENRES.map((g, i) => `<span class="ex-pill" data-i="${i}" style="display:inline-block;font-size:21px;font-weight:600;padding:12px 22px;border-radius:26px;border:2px solid #e4dcf6;color:#3d3456;background:#ffffff">${g}</span>`).join("")}
      </div>
      <div id="ex-sort" style="position:absolute;left:32px;top:478px;width:544px;display:flex;justify-content:space-between;font-size:20px;color:#625a78">
        <span><b style="color:#1d1530">4 œuvres</b> pour « dragons »</span><span>Trier : <b style="color:#6d28d9">Populaires</b></span>
      </div>
      ${[0, 1, 2, 3].map((k) => {
        const ci = [0, 6, 5, 2][k];
        const c = COVERS[ci];
        const x = 32 + (k % 2) * 284, y = 530 + Math.floor(k / 2) * 500;
        return `<div class="ex-res" style="position:absolute;left:${x}px;top:${y}px;width:260px">
          <div style="position:relative;width:260px;height:380px">${cover(ci, 260, 380)}</div>
          <div style="font-family:'Source Serif 4',serif;font-weight:600;font-size:24px;color:#1d1530;margin-top:12px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.t}</div>
          <div style="font-size:18px;color:#625a78;margin-top:4px">${c.a} · Fantasy</div>
        </div>`;
      }).join("")}
      ${nav("")}`;
  })();

  /* ---------------- FICHE D'ŒUVRE ---------------- */
  (function detail() {
    const el = $("#scr-detail");
    const chap = [
      ["1", "L'étincelle", "12 min", "done"],
      ["2", "La fuite", "15 min", "done"],
      ["3", "La forge", "14 min", "cur"],
      ["4", "Les cendres", "18 min", ""],
    ];
    el.innerHTML = `${status()}
      <div style="position:absolute;left:32px;top:80px;width:544px;display:flex;justify-content:space-between;color:#1d1530">${ico("back", 36)}<span style="display:flex;gap:22px">${ico("heart", 34, "#ec4899")}${ico("share", 34)}</span></div>
      <div id="dt-cover" style="position:absolute;left:32px;top:142px;width:200px;height:300px">${cover(0, 200, 300)}</div>
      <div class="dt-hero" style="position:absolute;left:258px;top:146px;width:318px">
        <div style="font-family:'Source Serif 4',serif;font-weight:900;font-size:38px;line-height:1.05;color:#1d1530">L'Héritière des Cendres</div>
        <div style="font-size:21px;color:#625a78;margin-top:10px">par <b style="color:#6d28d9">Inès K.</b></div>
        <div style="display:flex;gap:8px;margin-top:14px"><span style="font-size:17px;font-weight:600;color:#6d28d9;background:#f1eafe;padding:6px 14px;border-radius:16px">Fantasy</span><span style="font-size:17px;font-weight:600;color:#6d28d9;background:#f1eafe;padding:6px 14px;border-radius:16px">Aventure</span></div>
        <div style="display:flex;gap:14px;margin-top:16px;font-size:18px;color:#625a78;align-items:center">${ico("eye", 22)}<span>12,4k</span>${ico("heart", 22)}<span>2,1k</span>${ico("book", 22)}<span>24 ch.</span></div>
      </div>
      <div class="dt-syn" style="position:absolute;left:32px;top:470px;width:544px">
        <div style="font-family:'Source Serif 4',serif;font-weight:900;font-size:30px;color:#1d1530;margin-bottom:10px">Synopsis</div>
        ${[
          "Dans un royaume où le feu est interdit,",
          "Naïa découvre qu'elle peut parler aux",
          "braises. Traquée par l'Ordre, elle devra",
          "choisir : se cacher… ou tout embraser.",
        ].map((l) => `<div class="dt-l" style="font-size:22px;line-height:34px;color:#3d3456;white-space:nowrap">${l}</div>`).join("")}
        <div class="dt-l" style="font-size:21px;line-height:34px;color:#6d28d9;font-weight:600">Lire la suite</div>
      </div>
      <div class="dt-tome" style="position:absolute;left:32px;top:740px;width:544px;display:flex;justify-content:space-between;align-items:baseline">
        <span style="font-family:'Source Serif 4',serif;font-weight:900;font-size:28px;color:#1d1530">Tome 1 — Les Braises</span><span style="font-size:19px;color:#625a78">4 chapitres</span>
      </div>
      ${chap.map((c, i) => `<div class="dt-ch ${c[3]}" style="position:absolute;left:32px;top:${790 + i * 78}px;width:544px;height:68px;border-radius:18px;display:flex;align-items:center;gap:16px;padding:0 18px;${c[3] === "cur" ? "background:#f1eafe;" : ""}">
          <span style="width:40px;height:40px;border-radius:20px;background:${c[3] === "cur" ? "#7c3aed" : "#f4f0fb"};color:${c[3] === "cur" ? "#fff" : "#6d28d9"};font-weight:700;font-size:19px;display:flex;align-items:center;justify-content:center">${c[0]}</span>
          <span style="flex:1;font-size:22px;font-weight:600;color:${c[3] === "cur" ? "#5b21b6" : "#1d1530"}">${c[1]}${c[3] === "cur" ? ' <span style="font-size:16px;font-weight:700;color:#7c3aed;letter-spacing:0.06em">· EN COURS</span>' : ""}</span>
          <span style="font-size:18px;color:#625a78">${c[2]}</span>
          ${c[3] === "done" ? `<span class="dt-check" style="color:#16a34a">${ico("check", 28, "#16a34a", 3)}</span>` : `<span style="width:28px"></span>`}
        </div>`).join("")}
      <div id="dt-btn" style="position:absolute;left:32px;top:1150px;width:544px;height:86px;border-radius:43px;background:#7c3aed;color:#fff;display:flex;align-items:center;justify-content:center;gap:14px;font-size:25px;font-weight:700;box-shadow:0 14px 30px rgba(124,58,237,0.35)">${ico("book", 30, "#fff")}Reprendre au chapitre 3</div>`;
  })();

  /* ---------------- LECTURE (3 thèmes) ---------------- */
  const PARAS = [
    "La forge dormait depuis cent ans. Naïa posa la main sur l'enclume froide, et sous sa paume, quelque chose répondit.",
    "— Tu m'entends ? murmura-t-elle.",
    "Une lueur orange s'éveilla dans les cendres, timide d'abord, puis vive comme un cœur qui recommence à battre.",
    "Dehors, les cloches de l'Ordre se mirent à sonner.",
  ];
  const THEMES = {
    light: { bg: "#ffffff", fg: "#221a33", mute: "#625a78", bar: "#ece6f7", dark: false },
    night: { bg: "#120f1c", fg: "#ddd6ee", mute: "#a79fbe", bar: "#2a2338", dark: true },
    sepia: { bg: "#f4ecd8", fg: "#4a3826", mute: "#7a634a", bar: "#e6d9bb", dark: false },
  };
  (function read() {
    const host = $("#scr-read");
    host.style.background = "transparent";
    host.innerHTML = Object.keys(THEMES).map((k) => {
      const T = THEMES[k];
      return `<div class="rd-theme ${T.dark ? "dark" : ""}" id="rd-${k}" style="position:absolute;inset:0;background:${T.bg};color:${T.fg}">
        ${status()}
        <div style="position:absolute;left:30px;top:80px;width:548px;height:60px;display:flex;align-items:center;justify-content:space-between;color:${T.fg}">
          ${ico("back", 34)}<span style="font-size:21px;font-weight:600;color:${T.mute}">Chapitre 3 · La forge</span><span style="display:flex;gap:18px;align-items:center"><span class="rd-aa" style="font-family:'Source Serif 4',serif;font-weight:600;font-size:30px">Aa</span>${ico("phones", 30)}</span>
        </div>
        <div style="position:absolute;left:30px;top:148px;width:548px;height:5px;border-radius:3px;background:${T.bar}"><div class="rd-prog" style="width:100%;height:5px;border-radius:3px;background:#7c3aed;transform-origin:0 50%;transform:scaleX(0.42)"></div></div>
        <div class="rd-text" style="position:absolute;left:44px;top:196px;width:520px;font-family:'Source Serif 4',serif;font-size:29px;line-height:47px;color:${T.fg}">
          ${PARAS.map((p, i) => `<p class="rd-p rd-p${i}" style="position:relative;margin-bottom:26px">${p}</p>`).join("")}
        </div>
      </div>`;
    }).join("");
    // Surlignage + note (sur le thème sépia, final)
    const sep = $("#rd-sepia");
    sep.insertAdjacentHTML("beforeend", `
      <div id="rd-hl1" class="rd-hl" style="position:absolute;left:40px;top:744px;width:524px;height:46px;border-radius:8px;background:rgba(250,204,21,0.55);transform-origin:0 50%"></div>
      <div id="rd-hl3" class="rd-hl" style="position:absolute;left:40px;top:838px;width:200px;height:46px;border-radius:8px;background:rgba(250,204,21,0.55);transform-origin:0 50%"></div>
      <div id="rd-hl2" class="rd-hl" style="position:absolute;left:40px;top:791px;width:300px;height:46px;border-radius:8px;background:rgba(250,204,21,0.55);transform-origin:0 50%"></div>
      <div id="rd-tools" style="position:absolute;left:120px;top:650px;height:72px;border-radius:36px;background:#1d1530;color:#fff;display:flex;align-items:center;gap:6px;padding:0 10px;box-shadow:0 14px 30px rgba(29,21,48,0.35)">
        <span style="display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:26px;background:#facc15;color:#1d1530;font-size:19px;font-weight:700">${ico("hl", 24, "#1d1530")}Surligner</span>
        <span id="rd-tool-note" style="display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:26px;font-size:19px;font-weight:600">${ico("note", 24, "#fff")}Note</span>
        <span style="display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:19px;font-weight:600">${ico("quote", 24, "#fff")}Citer</span>
      </div>
      <div id="rd-note" style="position:absolute;left:150px;top:860px;width:410px;border-radius:22px;background:#ffffff;color:#1d1530;padding:20px 22px;box-shadow:0 18px 40px rgba(74,56,38,0.28);border:2px solid #f1e3b8">
        <div style="display:flex;align-items:center;gap:10px;font-size:17px;font-weight:700;color:#a16207;letter-spacing:0.08em">${ico("note", 22, "#a16207")}MA NOTE</div>
        <div style="font-family:'Source Serif 4',serif;font-style:italic;font-size:25px;line-height:1.35;margin-top:8px">Ce passage… des frissons. À relire !</div>
      </div>
      <div id="rd-pin" style="position:absolute;left:14px;top:752px;width:22px;height:22px;border-radius:11px;background:#a16207;box-shadow:0 0 0 5px rgba(161,98,7,0.2)"></div>`);
    // Feuille de thèmes + lecteur audio (overlay commun au-dessus des 3 thèmes)
    host.insertAdjacentHTML("beforeend", `
      <div id="rd-sheet" style="position:absolute;left:0;top:860px;width:608px;height:408px;border-radius:40px 40px 0 0;background:#ffffff;box-shadow:0 -14px 40px rgba(20,8,40,0.25);padding:26px 36px;color:#1d1530">
        <div style="width:70px;height:7px;border-radius:4px;background:#ddd3f5;margin:0 auto 22px"></div>
        <div style="font-family:'Source Serif 4',serif;font-weight:900;font-size:30px">Apparence</div>
        <div style="display:flex;gap:20px;margin-top:22px">
          ${[["light", "Clair", "#ffffff", "#221a33"], ["sepia", "Sépia", "#f4ecd8", "#4a3826"], ["night", "Nuit", "#120f1c", "#ddd6ee"]].map((s) => `<div class="sw sw-${s[0]}" style="position:relative;width:160px;height:120px;border-radius:22px;background:${s[2]};border:3px solid #e4dcf6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:${s[3]}"><span style="font-family:'Source Serif 4',serif;font-weight:600;font-size:36px">Aa</span><span style="font-size:18px;font-weight:600">${s[1]}</span></div>`).join("")}
        </div>
        <div id="rd-ring" style="position:absolute;left:30px;top:120px;width:172px;height:132px;border-radius:26px;border:5px solid #7c3aed"></div>
        <div style="display:flex;align-items:center;gap:18px;margin-top:30px;font-size:20px;color:#625a78"><span style="font-family:'Source Serif 4',serif;font-size:22px">A</span><div style="position:relative;flex:1;height:6px;border-radius:3px;background:#ece6f7"><div style="position:absolute;left:0;top:0;width:55%;height:6px;border-radius:3px;background:#7c3aed"></div><div style="position:absolute;left:55%;top:-11px;width:28px;height:28px;margin-left:-14px;border-radius:14px;background:#fff;border:3px solid #7c3aed"></div></div><span style="font-family:'Source Serif 4',serif;font-size:34px">A</span></div>
      </div>
      <div id="rd-player" style="position:absolute;left:24px;top:1050px;width:560px;height:190px;border-radius:36px;background:#1d1530;color:#fff;box-shadow:0 20px 44px rgba(20,8,40,0.45);padding:22px 26px">
        <div style="display:flex;align-items:center;gap:18px">
          <div id="rd-play" style="position:relative;width:84px;height:84px;border-radius:42px;background:#7c3aed;flex:none">
            <span id="rd-play-i" style="position:absolute;left:24px;top:22px">${playIco(40, "#fff")}</span>
            <span id="rd-pause-i" style="position:absolute;left:22px;top:22px">${pauseIco(40, "#fff")}</span>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:16px;font-weight:700;letter-spacing:0.14em;color:#c4b5fd">LIVRE AUDIO · VOIX NATURELLE</div>
            <div style="font-family:'Source Serif 4',serif;font-weight:600;font-size:26px;margin-top:4px;white-space:nowrap">Chapitre 3 · La forge</div>
          </div>
          <span style="font-size:19px;font-weight:700;padding:8px 14px;border-radius:16px;background:rgba(255,255,255,0.12)">1,0×</span>
        </div>
        <div id="rd-wave" style="position:absolute;left:26px;top:128px;width:508px;height:44px;display:flex;align-items:center;gap:5px">
          ${Array.from({ length: 34 }, (_, i) => `<i class="wv" style="display:block;width:10px;height:44px;border-radius:5px;background:${i < 13 ? "#a78bfa" : "rgba(255,255,255,0.28)"};transform-origin:50% 50%"></i>`).join("")}
        </div>
      </div>
      <div id="rd-karaoke" style="position:absolute;left:30px;top:190px;width:548px;height:150px;border-radius:16px;background:rgba(124,58,237,0.13);border-left:6px solid #7c3aed"></div>`);
  })();

  /* ---------------- ÉCRIRE ---------------- */
  (function write() {
    const el = $("#scr-write");
    el.innerHTML = `${status()}
      <div style="position:absolute;left:32px;top:84px;width:544px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-family:'Source Serif 4',serif;font-weight:900;font-size:42px;color:#1d1530">Nouvelle œuvre</span>
        <span style="font-size:17px;font-weight:700;color:#16a34a;background:#dcfce7;padding:8px 14px;border-radius:16px">Enregistré</span>
      </div>
      <div style="position:absolute;left:32px;top:168px;font-size:18px;font-weight:700;letter-spacing:0.12em;color:#625a78">TITRE</div>
      <div style="position:absolute;left:32px;top:198px;width:544px;height:78px;border-radius:20px;border:2px solid #e4dcf6;background:#faf8fe;display:flex;align-items:center;padding:0 22px">
        <span id="wr-title" data-full="Les Murmures du Fleuve" style="font-family:'Source Serif 4',serif;font-weight:600;font-size:30px;color:#1d1530;white-space:nowrap">Les Murmures du Fleuve</span><span id="wr-caret1" style="display:inline-block;width:3px;height:36px;background:#7c3aed;margin-left:3px"></span>
      </div>
      <div style="position:absolute;left:32px;top:300px;font-size:18px;font-weight:700;letter-spacing:0.12em;color:#625a78">GENRES</div>
      <div style="position:absolute;left:32px;top:332px;width:560px;display:flex;flex-wrap:wrap;gap:12px">
        ${["Fantasy", "Aventure", "Mystère"].map((g, i) => `<span class="wr-chip wr-chip${i}" style="position:relative;display:inline-block;font-size:21px;font-weight:600;padding:12px 22px;border-radius:26px;border:2px solid #e4dcf6;color:#3d3456;background:#ffffff;overflow:hidden"><span class="wr-fill" style="position:absolute;inset:0;background:#7c3aed;border-radius:26px;opacity:${i < 2 ? 1 : 0}"></span><span class="wr-lab" style="position:relative;color:${i < 2 ? "#fff" : "#3d3456"}">${g}</span></span>`).join("")}
      </div>
      <div style="position:absolute;left:32px;top:424px;width:544px;display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:18px;font-weight:700;letter-spacing:0.12em;color:#625a78">CHAPITRE 1 — L'ORAGE</span>
        <span style="display:flex;gap:14px;color:#625a78;font-family:'Source Serif 4',serif;font-weight:900;font-size:22px"><b>B</b><i>I</i>${ico("quote", 22)}</span>
      </div>
      <div style="position:absolute;left:32px;top:462px;width:544px;height:560px;border-radius:24px;border:2px solid #e4dcf6;background:#faf8fe;padding:24px 26px">
        <div style="font-family:'Source Serif 4',serif;font-size:28px;line-height:45px;color:#221a33"><span id="wr-body" data-full="Le fleuve ne parlait qu'aux enfants nés pendant l'orage. Moussa était l'un d'eux. Cette nuit-là, l'eau prononça son nom.">Le fleuve ne parlait qu'aux enfants nés pendant l'orage. Moussa était l'un d'eux. Cette nuit-là, l'eau prononça son nom.</span><span id="wr-caret2" style="display:inline-block;width:3px;height:34px;background:#7c3aed;margin-left:2px;vertical-align:-6px"></span></div>
      </div>
      <div style="position:absolute;left:32px;top:1046px;width:544px;font-size:18px;color:#625a78;display:flex;justify-content:space-between"><span>182 mots</span><span>Lecture : 1 min</span></div>
      <div style="position:absolute;left:32px;top:1110px;width:544px;height:90px;display:flex;gap:16px">
        <div style="flex:1;border-radius:45px;border:2px solid #e4dcf6;display:flex;align-items:center;justify-content:center;font-size:23px;font-weight:700;color:#3d3456">Aperçu</div>
        <div id="wr-pub" style="flex:1.4;border-radius:45px;background:#7c3aed;color:#fff;display:flex;align-items:center;justify-content:center;gap:12px;font-size:25px;font-weight:700;box-shadow:0 14px 30px rgba(124,58,237,0.38)">${ico("send", 28, "#fff")}Publier</div>
      </div>
      <div id="wr-toast" style="position:absolute;left:40px;top:84px;width:528px;height:104px;border-radius:30px;background:#1d1530;color:#fff;display:flex;align-items:center;gap:18px;padding:0 24px;box-shadow:0 18px 40px rgba(20,8,40,0.4)">
        <span style="width:58px;height:58px;border-radius:29px;background:#16a34a;display:flex;align-items:center;justify-content:center">${ico("check", 32, "#fff", 3)}</span>
        <span><div style="font-size:24px;font-weight:700">Publié !</div><div style="font-size:19px;color:#c4b5fd;margin-top:2px">Tes abonnés sont prévenus.</div></span>
      </div>
      <div id="wr-confetti" style="position:absolute;left:0;top:0;width:608px;height:1268px"></div>`;
    const conf = $("#wr-confetti");
    const cols = ["#7c3aed", "#ec4899", "#facc15", "#22c55e", "#38bdf8", "#a78bfa"];
    for (let i = 0; i < 44; i++) {
      const d = document.createElement("i");
      d.className = "cf";
      css(d, { position: "absolute", left: "0px", top: "0px", width: (i % 3 === 0 ? 12 : 9) + "px", height: (i % 3 === 0 ? 20 : 9) + "px", borderRadius: i % 3 === 0 ? "3px" : "50%", background: cols[i % cols.length], opacity: "0" });
      conf.appendChild(d);
    }
  })();

  /* ---------------- MESSAGERIE (groupe) ---------------- */
  (function chat() {
    const el = $("#scr-chat");
    const av = (l, c) => `<span style="width:52px;height:52px;border-radius:26px;background:${c};color:#fff;font-weight:700;font-size:22px;display:flex;align-items:center;justify-content:center;flex:none">${l}</span>`;
    const left = (id, top, name, nameCol, avL, avC, body) => `<div id="${id}" class="ch-m" style="position:absolute;left:24px;top:${top}px;display:flex;gap:12px;align-items:flex-end">${av(avL, avC)}<div style="max-width:440px;background:#ffffff;border-radius:26px 26px 26px 8px;padding:14px 20px;box-shadow:0 4px 14px rgba(29,21,48,0.07)"><div style="font-size:17px;font-weight:700;color:${nameCol};margin-bottom:4px">${name}</div>${body}</div></div>`;
    el.innerHTML = `${status()}
      <div style="position:absolute;left:0;top:70px;width:608px;height:100px;background:#ffffff;border-bottom:2px solid #ebe6f5"></div><div id="ch-head" style="position:absolute;left:0;top:70px;width:608px;height:100px;display:flex;align-items:center;gap:14px;padding:0 26px;color:#1d1530">
        ${ico("back", 34)}
        <span style="width:62px;height:62px;border-radius:31px;background:#7c3aed;display:flex;align-items:center;justify-content:center">${ico("book", 32, "#fff")}</span>
        <span style="flex:1"><div style="font-size:24px;font-weight:700">Club des Dévoreurs</div><div style="font-size:17px;color:#625a78;display:flex;align-items:center;gap:8px;margin-top:2px"><i style="display:block;width:10px;height:10px;border-radius:5px;background:#22c55e"></i>24 membres · 6 en ligne</div></span>
        ${ico("call", 30)}
      </div>
      <div style="position:absolute;left:0;top:170px;width:608px;height:960px;background:#f7f5fb"></div>
      ${left("ch-m1", 196, "Inès", "#be185d", "I", "#be185d", `<div style="font-size:22px;line-height:1.4;color:#1d1530">Vous en êtes où dans <span id="ch-tag" style="display:inline-block;font-weight:700;color:#6d28d9;background:#f1eafe;padding:2px 12px;border-radius:12px">#Nuits de Dakar</span> ?</div>`)}
      ${left("ch-m2", 348, "Malik", "#0e7490", "M", "#0e7490", `<div style="font-size:22px;line-height:1.4;color:#1d1530">Chapitre 9 !! Ce twist…</div>`)}
      ${left("ch-m3", 466, "Sarah", "#a16207", "S", "#a16207", `<div style="position:relative;font-size:22px;line-height:1.4;color:#1d1530;white-space:nowrap"><span id="ch-spoil-txt">Kofi était le traître depuis le début</span><span id="ch-spoil-cover" style="position:absolute;left:-6px;top:-4px;right:-6px;bottom:-4px;border-radius:12px;background:#3d3456;color:#f5f0ff;font-size:17px;font-weight:700;letter-spacing:0.12em;display:flex;align-items:center;justify-content:center;gap:10px">${ico("eye", 22, "#f5f0ff")}SPOIL · AFFICHER</span></div>`)}
      <div id="ch-m4" class="ch-m" style="position:absolute;right:24px;top:600px;max-width:470px;background:#7c3aed;color:#fff;border-radius:26px 26px 8px 26px;padding:16px 22px;font-size:22px;line-height:1.4;box-shadow:0 8px 20px rgba(124,58,237,0.3)"><span id="ch-mention" style="font-weight:700;background:rgba(255,255,255,0.22);padding:2px 10px;border-radius:10px">@Malik</span> lis la suite ce soir !</div>
      <div id="ch-m5" class="ch-m" style="position:absolute;left:24px;top:716px;display:flex;gap:12px;align-items:flex-end">${av("I", "#be185d")}
        <div style="width:440px;background:#ffffff;border-radius:26px 26px 26px 8px;padding:18px 22px;box-shadow:0 4px 14px rgba(29,21,48,0.07)">
          <div style="display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;letter-spacing:0.12em;color:#7c3aed">${ico("chart", 22, "#7c3aed")}SONDAGE</div>
          <div style="font-family:'Source Serif 4',serif;font-weight:600;font-size:25px;color:#1d1530;margin:8px 0 14px">Prochaine lecture du club ?</div>
          ${[["Le Dernier Griot", 62, true], ["Code Rouge", 38, false]].map((o, i) => `<div style="position:relative;height:56px;border-radius:16px;border:2px solid ${o[2] ? "#7c3aed" : "#e4dcf6"};margin-top:10px;overflow:hidden">
              <div class="ch-bar ch-bar${i}" style="position:absolute;left:0;top:0;width:${o[1]}%;height:100%;background:${o[2] ? "rgba(124,58,237,0.18)" : "rgba(98,90,120,0.1)"};transform-origin:0 50%"></div>
              <div style="position:relative;display:flex;justify-content:space-between;align-items:center;height:100%;padding:0 16px;font-size:20px;font-weight:600;color:#1d1530"><span>${o[0]}</span><span class="ch-pct" data-v="${o[1]}">${o[1]} %</span></div>
            </div>`).join("")}
          <div style="font-size:16px;color:#625a78;margin-top:10px">13 votes · appuie pour voter</div>
        </div></div>
      <div id="ch-typing" class="ch-m" style="position:absolute;left:88px;top:1060px;height:52px;width:96px;border-radius:26px;background:#ffffff;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 14px rgba(29,21,48,0.07)"><i class="td" style="display:block;width:12px;height:12px;border-radius:6px;background:#a79fbe"></i><i class="td" style="display:block;width:12px;height:12px;border-radius:6px;background:#a79fbe"></i><i class="td" style="display:block;width:12px;height:12px;border-radius:6px;background:#a79fbe"></i></div>
      <div style="position:absolute;left:0;top:1130px;width:608px;height:138px;background:#ffffff;border-top:2px solid #ebe6f5;display:flex;align-items:flex-start;gap:14px;padding:22px 24px 0">
        <div style="flex:1;height:68px;border-radius:34px;background:#f4f0fb;display:flex;align-items:center;padding:0 24px;font-size:21px;color:#625a78">Écris un message…</div>
        <div style="width:68px;height:68px;border-radius:34px;background:#7c3aed;display:flex;align-items:center;justify-content:center">${ico("send", 30, "#fff")}</div>
      </div>
      <div id="ch-banner" style="position:absolute;left:22px;top:84px;width:564px;height:110px;border-radius:30px;background:rgba(29,21,48,0.96);color:#fff;display:flex;align-items:center;gap:16px;padding:0 22px;box-shadow:0 18px 40px rgba(20,8,40,0.35);z-index:6">
        <span style="width:58px;height:58px;border-radius:16px;background:#7c3aed;display:flex;align-items:center;justify-content:center"><span class="feather-svg" style="width:38px;height:38px">${featherSVG("white")}</span></span>
        <span style="flex:1"><div style="font-size:16px;font-weight:700;letter-spacing:0.1em;color:#c4b5fd">PLUME · MAINTENANT</div><div style="font-size:21px;font-weight:600;margin-top:4px">Malik a réagi à ton message</div></span>
      </div>`;
  })();

  /* ---------------- SUCCÈS ---------------- */
  const MEDALS = [
    ["book", "Dévoreur", "#f59e0b", true],
    ["pen", "Première plume", "#a855f7", true],
    ["flame", "7 jours d'affilée", "#ef4444", true],
    ["msg", "Bavard", "#0ea5e9", true],
    ["star", "Critique", "#22c55e", false],
    ["crown", "Mécène", "#ec4899", false],
  ];
  (function trophy() {
    const el = $("#scr-trophy");
    const R = 84, C = 2 * Math.PI * R;
    el.innerHTML = `${status()}
      <div style="position:absolute;left:32px;top:86px;font-family:'Source Serif 4',serif;font-weight:900;font-size:50px;color:#1d1530">Succès</div>
      <div style="position:absolute;left:300px;top:96px;width:276px;height:56px;border-radius:28px;background:#f4f0fb;display:flex;padding:5px"><span style="flex:1;border-radius:24px;background:#7c3aed;color:#fff;font-size:19px;font-weight:700;display:flex;align-items:center;justify-content:center">Lecteur</span><span style="flex:1;color:#625a78;font-size:19px;font-weight:600;display:flex;align-items:center;justify-content:center">Auteur</span></div>
      <div id="tr-card" style="position:absolute;left:32px;top:184px;width:544px;height:250px;border-radius:32px;background:#1d1530;color:#fff;overflow:hidden">
        <svg style="position:absolute;left:26px;top:24px;width:200px;height:200px" viewBox="0 0 200 200"><circle cx="100" cy="100" r="${R}" stroke="rgba(255,255,255,0.14)" stroke-width="16" fill="none"/><circle id="tr-ring" cx="100" cy="100" r="${R}" stroke="#a78bfa" stroke-width="16" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0" transform="rotate(-90 100 100)"/></svg>
        <div style="position:absolute;left:26px;top:66px;width:200px;text-align:center"><div style="font-size:18px;font-weight:700;letter-spacing:0.18em;color:#c4b5fd">NIV.</div><div id="tr-lvl" style="font-family:'Source Serif 4',serif;font-weight:900;font-size:64px;line-height:1;font-variant-numeric:tabular-nums">13</div></div>
        <div style="position:absolute;left:252px;top:50px;width:270px">
          <div style="font-family:'Source Serif 4',serif;font-weight:600;font-size:30px;line-height:1.1">Lecteur passionné</div>
          <div style="position:relative;margin-top:22px;width:262px;height:16px;border-radius:8px;background:rgba(255,255,255,0.14)"><div id="tr-xp" style="position:absolute;left:0;top:0;width:262px;height:16px;border-radius:8px;background:#a78bfa;transform-origin:0 50%"></div></div>
          <div style="font-size:19px;color:#c4b5fd;margin-top:12px;font-variant-numeric:tabular-nums"><span id="tr-xpv">3 000</span> / 3 000 XP</div>
        </div>
        <div id="tr-up" style="position:absolute;left:252px;top:172px;font-size:20px;font-weight:700;color:#facc15;letter-spacing:0.06em">NIVEAU SUPÉRIEUR !</div>
      </div>
      <div style="position:absolute;left:32px;top:462px;width:544px;display:flex;justify-content:space-between;align-items:baseline"><span style="font-family:'Source Serif 4',serif;font-weight:900;font-size:32px;color:#1d1530">Trophées</span><span style="font-size:20px;color:#625a78">4 / 6</span></div>
      ${MEDALS.map((m, i) => {
        const x = 32 + (i % 3) * 186, y = 520 + Math.floor(i / 3) * 214;
        return `<div class="tr-med" style="position:absolute;left:${x}px;top:${y}px;width:172px;display:flex;flex-direction:column;align-items:center;gap:10px">
          <div style="position:relative;width:124px;height:124px;border-radius:62px;background:${m[3] ? m[2] : "#ece8f3"};display:flex;align-items:center;justify-content:center;box-shadow:${m[3] ? "0 10px 24px " + m[2] + "55, inset 0 -6px 0 rgba(0,0,0,0.15)" : "none"}">${ico(m[3] ? m[0] : "lock", 54, m[3] ? "#fff" : "#a79fbe", 2.2)}</div>
          <div style="font-size:18px;font-weight:600;color:${m[3] ? "#1d1530" : "#6b6380"};text-align:center;line-height:1.2">${m[1]}</div>
        </div>`;
      }).join("")}
      <div id="tr-leg" style="position:absolute;left:32px;top:966px;width:544px;height:136px;border-radius:30px;background:linear-gradient(120deg,#2e1065 0%,#4c1d95 55%,#831843 100%);color:#fff;display:flex;align-items:center;gap:20px;padding:0 24px;overflow:hidden">
        <span style="width:92px;height:92px;border-radius:46px;background:radial-gradient(circle at 35% 30%,#fde68a,#d97706);display:flex;align-items:center;justify-content:center;box-shadow:0 0 30px rgba(250,204,21,0.55)"><span class="feather-svg" style="width:56px;height:56px">${featherSVG("white")}</span></span>
        <span style="flex:1"><div style="font-size:16px;font-weight:700;letter-spacing:0.16em;color:#fde68a">LÉGENDAIRE</div><div style="font-family:'Source Serif 4',serif;font-weight:900;font-size:34px;margin-top:2px">Plume d'or</div><div style="font-size:18px;color:#e9d5ff;margin-top:2px">Trophée secret débloqué</div></span>
        <div id="tr-sheen" style="position:absolute;top:0;left:-200px;width:140px;height:136px;background:linear-gradient(100deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.45) 50%,rgba(255,255,255,0) 100%);transform:skewX(-18deg)"></div>
      </div>
      ${nav("trophy")}`;
  })();

  /* ---------------- titres de section ---------------- */
  const HL = [
    ["hl-s3", "01", "Découvrir", ["Des histoires", '<span class="it">faites pour toi.</span>']],
    ["hl-s4", "02", "Explorer", ["Tous les genres.", '<span class="it">Une recherche.</span>']],
    ["hl-s5", "03", "Choisir", ["Le synopsis,", '<span class="it">tous les chapitres.</span>']],
    ["hl-s6a", "04", "Lire", ["Lis à", '<span class="it">ta façon.</span>']],
    ["hl-s6b", "04", "Lire", ["Surligne.", '<span class="it">Annote.</span>']],
    ["hl-s6c", "04", "Écouter", ["Ou laisse-toi", '<span class="it">raconter.</span>']],
    ["hl-s7a", "05", "Écrire", ["Écris", '<span class="it">ton histoire.</span>']],
    ["hl-s7b", "05", "Publier", ["Publie-la", '<span class="it">en un geste.</span>']],
    ["hl-s7c", "05", "Comprendre", ["Comprends", '<span class="it">tes lecteurs.</span>']],
    ["hl-s8", "06", "Partager", ["Lis", '<span class="it">ensemble.</span>']],
    ["hl-s9", "07", "Progresser", ["Chaque page", '<span class="it">compte.</span>']],
  ];
  $("#headlines").innerHTML = HL.map((h) => `<div class="hl" id="${h[0]}">
      <div class="lab"><span><span class="num">Chapitre ${h[1]}</span> · ${h[2]}</span></div>
      ${h[3].map((l) => `<div class="ln"><span>${l}</span></div>`).join("")}
    </div>`).join("");
  $("#hl-s8").insertAdjacentHTML("beforeend", `<div class="sub"><span id="sub1">Mentionne tes amis.</span><span id="sub2">Cache les spoilers.</span><span id="sub3">Lance des sondages.</span></div>`);

  /* ---------------- satellites ---------------- */
  // S3 : 3 couvertures qui jaillissent du carrousel
  const sb = $("#sats-back"), sf = $("#sats-front");
  sf.insertAdjacentHTML("beforeend", `
    <div id="sat3-a" class="sat" style="left:20px;top:760px;width:200px;height:300px">${cover(1, 200, 300)}</div>
    <div id="sat3-b" class="sat" style="left:842px;top:900px;width:200px;height:300px">${cover(5, 200, 300)}</div>
    <div id="sat3-c" class="sat" style="left:820px;top:560px;width:170px;height:255px">${cover(2, 170, 255)}</div>
    <div id="sat3-chip" class="sat" style="left:30px;top:1120px;height:84px;border-radius:42px;background:#f5f0ff;color:#140b22;display:flex;align-items:center;gap:14px;padding:0 30px 0 14px;box-shadow:0 16px 40px rgba(124,58,237,0.4)">
      <span style="width:58px;height:58px;border-radius:29px;background:#7c3aed;display:flex;align-items:center;justify-content:center">${ico("heart", 30, "#fff")}</span>
      <span style="font-size:27px;font-weight:700">Recommandé pour toi</span>
    </div>`);
  // S4 : pastilles de genres flottantes
  const PILLS4 = [["Fantasy", 26, 600, "#7c3aed", "#fff"], ["Romance", 820, 640, "#f5f0ff", "#4c1d95"], ["Thriller", 30, 1020, "#f5f0ff", "#4c1d95"], ["Poésie", 870, 1010, "#ec4899", "#fff"], ["Science-fiction", 600, 1430, "#f5f0ff", "#4c1d95"], ["Horreur", 20, 1400, "#1d1530", "#f5f0ff"]];
  sf.insertAdjacentHTML("beforeend", PILLS4.map((p, i) => `<div id="sat4-${i}" class="sat sat4" style="left:${p[1]}px;top:${p[2]}px;height:76px;border-radius:38px;background:${p[3]};color:${p[4]};display:flex;align-items:center;padding:0 30px;font-size:30px;font-weight:700;box-shadow:0 16px 36px rgba(10,4,24,0.45)">${p[0]}</div>`).join(""));
  // S5 : couverture choisie + note
  sf.insertAdjacentHTML("beforeend", `<div id="sat5-cv" class="sat" style="left:12px;top:700px;width:230px;height:345px">${cover(0, 230, 345)}</div>
    <div id="sat5-rate" class="sat" style="left:60px;top:1080px;height:70px;border-radius:35px;background:#f5f0ff;color:#140b22;display:flex;align-items:center;gap:10px;padding:0 24px;font-size:26px;font-weight:700;box-shadow:0 14px 34px rgba(10,4,24,0.45)">${ico("star", 30, "#f59e0b")}4,8 · 24 chapitres</div>`);
  // S6 : pastille « voix naturelle · ElevenLabs »
  sf.insertAdjacentHTML("beforeend", `<div id="sat6-voice" class="sat" style="left:24px;top:1430px;height:118px;border-radius:59px;background:#f5f0ff;color:#140b22;display:flex;align-items:center;gap:18px;padding:0 34px 0 18px;box-shadow:0 20px 50px rgba(124,58,237,0.45)">
      <span style="width:82px;height:82px;border-radius:41px;background:#140b22;display:flex;align-items:center;justify-content:center;gap:5px">${Array.from({ length: 5 }, () => '<i class="vb" style="display:block;width:7px;height:40px;border-radius:4px;background:#a78bfa;transform-origin:50% 50%"></i>').join("")}</span>
      <span style="display:flex;flex-direction:column;line-height:1.1"><span style="font-family:'Source Serif 4',serif;font-weight:900;font-size:36px">Voix naturelle</span><span style="font-size:22px;font-weight:700;letter-spacing:0.06em;color:#5b21b6">par ElevenLabs</span></span>
    </div>`);
  // S6 : ondes sonores (anneaux) — dans le fond
  $("#rings").innerHTML = Array.from({ length: 5 }, (_, i) => `<div class="ring" id="ring${i}"></div>`).join("");
  // S7 : carte statistiques auteur
  const CH = [92, 86, 81, 58, 74, 70];
  sf.insertAdjacentHTML("beforeend", `<div id="sat7-dash" class="sat" style="left:40px;top:640px;width:600px;height:700px;border-radius:44px;background:#fbf9ff;color:#1d1530;box-shadow:0 40px 90px rgba(6,2,16,0.6);padding:40px 42px">
      <div style="display:flex;align-items:center;gap:12px;font-size:20px;font-weight:700;letter-spacing:0.14em;color:#7c3aed">${ico("chart", 28, "#7c3aed")}STATISTIQUES</div>
      <div style="font-family:'Source Serif 4',serif;font-weight:900;font-size:36px;margin-top:8px">Les Murmures du Fleuve</div>
      <div style="display:flex;gap:40px;margin-top:26px">
        <div><div id="dash-reads" style="font-family:'Source Serif 4',serif;font-weight:900;font-size:76px;line-height:1;font-variant-numeric:tabular-nums">1 248</div><div style="font-size:20px;color:#625a78;margin-top:6px">lectures</div></div>
        <div><div id="dash-comp" style="font-family:'Source Serif 4',serif;font-weight:900;font-size:76px;line-height:1;color:#7c3aed;font-variant-numeric:tabular-nums">78 %</div><div style="font-size:20px;color:#625a78;margin-top:6px">lisent jusqu'au bout</div></div>
      </div>
      <div style="font-size:19px;font-weight:700;letter-spacing:0.1em;color:#625a78;margin-top:34px">RÉTENTION PAR CHAPITRE</div>
      <div id="dash-bars" style="position:relative;margin-top:18px;height:250px;display:flex;align-items:flex-end;gap:22px">
        ${CH.map((v, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:10px"><div style="position:relative;width:100%;height:${Math.round(v * 2)}px"><div class="db" style="position:absolute;inset:0;border-radius:12px 12px 6px 6px;background:${i === 3 ? "#f43f5e" : "#7c3aed"};transform-origin:50% 100%"></div></div><span style="font-size:18px;font-weight:600;color:#625a78">Ch.${i + 1}</span></div>`).join("")}
        <div id="dash-drop" style="position:absolute;left:210px;top:30px;height:44px;border-radius:22px;background:#ffe4e6;color:#be123c;font-size:18px;font-weight:700;display:flex;align-items:center;padding:0 16px">Décrochage ici</div>
      </div>
    </div>`);
  // S8 : nuage d'avatars + réactions
  const AV = [["A", "#7c3aed", 70, 640], ["M", "#0891b2", 900, 600], ["I", "#db2777", 30, 980], ["S", "#ca8a04", 930, 920], ["K", "#16a34a", 80, 1340], ["L", "#9333ea", 890, 1290], ["Y", "#dc2626", 140, 1640], ["N", "#0d9488", 860, 1640]];
  sb.insertAdjacentHTML("beforeend", `<svg id="av-lines" style="position:absolute;left:0;top:0;width:1080px;height:1920px" viewBox="0 0 1080 1920">${AV.map((a, i) => `<line class="avl" id="avl${i}" x1="${a[2] + 50}" y1="${a[3] + 50}" x2="540" y2="1170" stroke="rgba(167,139,250,0.55)" stroke-width="3" stroke-dasharray="8 10"/>`).join("")}</svg>`);
  sf.insertAdjacentHTML("beforeend", AV.map((a, i) => `<div id="av${i}" class="sat av" style="left:${a[2]}px;top:${a[3]}px;width:100px;height:100px;border-radius:50px;background:${a[1]};border:5px solid #f5f0ff;color:#fff;font-size:42px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 14px 30px rgba(6,2,16,0.5)">${a[0]}<i style="position:absolute;right:-2px;bottom:2px;width:24px;height:24px;border-radius:12px;background:#22c55e;border:4px solid #f5f0ff"></i></div>`).join(""));
  sf.insertAdjacentHTML("beforeend", `
    <div id="rx1" class="sat" style="left:860px;top:760px;height:72px;border-radius:36px;background:#f5f0ff;display:flex;align-items:center;gap:8px;padding:0 22px;font-size:28px;font-weight:700;color:#be185d;box-shadow:0 14px 30px rgba(6,2,16,0.45)">${ico("heart", 30, "#ec4899")}12</div>
    <div id="rx2" class="sat" style="left:40px;top:820px;height:72px;border-radius:36px;background:#7c3aed;display:flex;align-items:center;padding:0 26px;font-size:30px;font-weight:700;color:#fff;box-shadow:0 14px 30px rgba(6,2,16,0.45)">@Malik</div>
    <div id="rx3" class="sat" style="left:830px;top:1450px;height:72px;border-radius:36px;background:#1d1530;border:3px solid #a78bfa;display:flex;align-items:center;gap:10px;padding:0 24px;font-size:26px;font-weight:700;color:#f5f0ff;box-shadow:0 14px 30px rgba(6,2,16,0.45)">${ico("chart", 28, "#a78bfa")}62 %</div>`);
  // S9 : médailles en orbite
  sf.insertAdjacentHTML("beforeend", [0, 1, 2].map((k) => {
    const m = MEDALS[k];
    return `<div id="med${k}" class="sat" style="left:${[40, 870, 830][k]}px;top:${[860, 760, 1280][k]}px;width:170px;height:170px;border-radius:85px;background:${m[2]};border:6px solid #f5f0ff;display:flex;align-items:center;justify-content:center;box-shadow:0 18px 40px ${m[2]}88">${ico(m[0], 80, "#fff", 2.2)}</div>`;
  }).join("") + `<div id="xp-pop" class="sat" style="left:700px;top:560px;height:84px;border-radius:42px;background:#facc15;color:#1d1530;display:flex;align-items:center;padding:0 30px;font-size:36px;font-weight:900;box-shadow:0 16px 40px rgba(250,204,21,0.45)">+120 XP</div>`);
  // étincelles (S1) + particules niveau (S9)
  $("#s1-sparks").innerHTML = Array.from({ length: 26 }, (_, i) => `<i class="spark" id="sp${i}"></i>`).join("");
  sf.insertAdjacentHTML("beforeend", `<div id="lvl-burst" style="position:absolute;left:0;top:0;width:1080px;height:1920px">${Array.from({ length: 20 }, (_, i) => `<i class="lb" style="position:absolute;left:0;top:0;width:${i % 2 ? 14 : 10}px;height:${i % 2 ? 14 : 10}px;margin:-7px 0 0 -7px;border-radius:50%;background:${["#facc15", "#a78bfa", "#f472b6", "#ffffff"][i % 4]};opacity:0"></i>`).join("")}</div>`);
  // taps
  $("#taps").innerHTML = Array.from({ length: 12 }, (_, i) => `<div class="tap" id="tap${i}"></div><div class="tap-dot" id="tapd${i}"></div>`).join("");
  // rayons du logo
  $("#s2-rays").innerHTML = Array.from({ length: 14 }, () => `<i class="ray"></i>`).join("");
  // phrase surlignée (thème sépia uniquement)
  // mots du karaoké (thème sépia) : chaque mot alphabétique devient un <span>
  [["#rd-sepia .rd-p0", "kw0"], ["#rd-sepia .rd-p1", "kw1"]].forEach(([sel, cls]) => {
    const p = $(sel);
    p.innerHTML = p.textContent.split(" ").map((w) => (/[A-Za-zÀ-ÿœ]/.test(w) ? `<span class="kw ${cls}">${w}</span>` : w)).join(" ");
  });
  const p2 = $("#rd-sepia .rd-p2");
  p2.innerHTML = p2.innerHTML.replace("vive comme un cœur qui recommence à battre.", '<span id="rd-target">vive comme un cœur qui recommence à battre.</span>');

  /* ---------------- S10 : grands mots + téléphones en éventail ---------------- */
  $("#s10-words").innerHTML = `<div class="bigword" id="bw1" style="top:150px">Lis.</div><div class="bigword" id="bw2" style="top:310px">Écris.</div><div class="bigword accent" id="bw3" style="top:470px">Partage.</div>`;
  const fan = $("#fan");
  [["scr-read", "fp-l"], ["scr-home", "fp-c"], ["scr-chat", "fp-r"]].forEach(([src, id]) => {
    const ph = document.createElement("div");
    ph.className = "mini-phone";
    ph.id = id;
    ph.innerHTML = `<div class="mp-body"></div><div class="mp-screen"></div><div class="mp-island"></div>`;
    const clone = $("#" + src).cloneNode(true);
    clone.removeAttribute("id");
    $$("[id]", clone).forEach((n) => n.removeAttribute("id"));
    clone.style.visibility = "visible";
    $(".mp-screen", ph).appendChild(clone);
    fan.appendChild(ph);
  });
  // le clone de lecture montre le thème sépia, sans feuille ni lecteur
  const rl = $("#fp-l .mp-screen");
  $$(".rd-theme", rl).forEach((n, i) => { n.style.opacity = i === 2 ? "1" : "0"; });
  // nettoyage des overlays dans les clones
  $$("#fp-l .mp-screen > .scr > div", fan).forEach((n) => {
    if (!n.classList.contains("rd-theme")) n.style.display = "none";
  });
  $$("#fp-r .mp-screen [style*='z-index:6']").forEach((n) => (n.style.display = "none"));
  $("#s10-pill .store-ico").innerHTML = ico("android", 64, "#16a34a", 2);

  window.__plume = { COVERS, PARAS, CH, AV, PILLS4 };
})();
