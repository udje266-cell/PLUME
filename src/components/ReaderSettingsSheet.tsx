import React from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Check, Headphones, Volume2, Film, Sun, Coffee, Play, Pause, Maximize2 } from 'lucide-react';
import {
  ReaderPrefs, ReaderTheme, READER_THEMES, THEME_ORDER, READER_FONTS, resolveTheme,
} from '../utils/readerPrefs';

type Soundscape = 'none' | 'rain' | 'forest' | 'fireplace' | 'library' | 'ocean' | 'breeze';

interface Props {
  open: boolean;
  onClose: () => void;
  prefs: ReaderPrefs;
  setPrefs: (patch: Partial<ReaderPrefs>) => void;
  onReset: () => void;
  theme: ReaderTheme;
  // Défilement automatique
  autoScrolling: boolean;
  onToggleAutoScroll: () => void;
  // Fonctions existantes de PLUME
  soundscape: Soundscape;
  setSoundscape: (s: Soundscape) => void;
  soundVolume: number;
  setSoundVolume: (v: number) => void;
  spatialAudioOn: boolean;
  setSpatialAudioOn: (v: boolean) => void;
  cinema: boolean;
  setCinema: (v: boolean) => void;
  audiobookEnabled: boolean;
  setAudiobookEnabled: (v: boolean) => void;
  speechRate: number;
  setSpeechRate: (v: number) => void;
  onImmersive: () => void;
}

const SOUNDS: { id: Soundscape; label: string }[] = [
  { id: 'none', label: 'Silence' }, { id: 'rain', label: '🌧️ Pluie' }, { id: 'forest', label: '🌲 Forêt' },
  { id: 'fireplace', label: '🔥 Foyer' }, { id: 'library', label: '🏛️ Salon' }, { id: 'ocean', label: '🌊 Océan' },
  { id: 'breeze', label: '🍃 Vent' },
];

const chipStyle = (T: ReaderTheme, active: boolean): React.CSSProperties => ({
  background: active ? T.accent : T.surface,
  color: active ? '#fff' : T.fg,
  border: `1.5px solid ${active ? T.accent : T.line}`,
});

function Section({ T, title, value, children }: { T: ReaderTheme; title: string; value?: string; children: React.ReactNode }) {
  return (
    <section className="py-4" style={{ borderTop: `1px solid ${T.line}` }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-bold">{title}</h4>
        {value && <span className="text-[12px]" style={{ color: T.muted }}>{value}</span>}
      </div>
      {children}
    </section>
  );
}

function Seg<V extends string>({ T, options, value, onChange }: { T: ReaderTheme; options: [V, string][]; value: V; onChange: (v: V) => void }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className="py-2.5 rounded-xl text-[12px] font-bold transition" style={chipStyle(T, value === v)}>{label}</button>
      ))}
    </div>
  );
}

function Toggle({ T, on, onClick, icon, label, hint }: { T: ReaderTheme; on: boolean; onClick: () => void; icon: React.ReactNode; label: string; hint?: string }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 py-2.5 text-left">
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: T.surface, color: T.accent }}>{icon}</span>
      <span className="flex-1 min-w-0"><span className="block text-[13px] font-semibold">{label}</span>{hint && <span className="block text-[11px]" style={{ color: T.muted }}>{hint}</span>}</span>
      <span className="w-11 h-6 rounded-full relative transition shrink-0" style={{ background: on ? T.accent : T.line }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
      </span>
    </button>
  );
}

export default function ReaderSettingsSheet(p: Props) {
  if (!p.open) return null;
  const T = p.theme;
  const { prefs } = p;
  const chip = (active: boolean) => chipStyle(T, active);
  return createPortal(
    <div className="fixed inset-0 z-[2147483100] flex items-end justify-center" onClick={p.onClose}>
      <div className="absolute inset-0 bg-black/45" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-t-[28px] shadow-2xl animate-slide-up"
        style={{ background: T.bg, color: T.fg, maxHeight: '86vh', display: 'flex', flexDirection: 'column', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto mt-2.5 mb-1 w-10 h-1.5 rounded-full" style={{ background: T.line }} />
        <div className="flex items-center gap-3 px-5 pt-2 pb-3">
          <div className="flex-1">
            <h3 className="text-[19px] font-black">Affichage</h3>
            <p className="text-[12px]" style={{ color: T.muted }}>Chaque réglage s’applique en direct.</p>
          </div>
          <button type="button" onClick={p.onReset} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold" style={{ background: T.surface, color: T.muted }}>
            <RotateCcw className="w-3.5 h-3.5" /> Rétablir
          </button>
          <button type="button" onClick={p.onClose} aria-label="Fermer" className="p-2 rounded-xl" style={{ color: T.muted }}><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 pb-6" style={{ overscrollBehavior: 'contain' }}>
          {/* Taille */}
          <Section T={T} title="Taille du texte" value={`${prefs.fontSize} px`}>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => p.setPrefs({ fontSize: Math.max(14, prefs.fontSize - 1) })} className="w-10 h-10 rounded-full font-serif text-sm" style={{ background: T.surface }}>A</button>
              <input type="range" min={14} max={32} value={prefs.fontSize} onChange={(e) => p.setPrefs({ fontSize: Number(e.target.value) })} className="flex-1" style={{ accentColor: T.accent }} />
              <button type="button" onClick={() => p.setPrefs({ fontSize: Math.min(32, prefs.fontSize + 1) })} className="w-10 h-10 rounded-full font-serif text-xl" style={{ background: T.surface }}>A</button>
            </div>
          </Section>

          {/* Thème */}
          <Section T={T} title="Thème" value={prefs.theme === 'system' ? 'Système' : READER_THEMES[prefs.theme].label}>
            <div className="grid grid-cols-4 gap-2.5">
              {THEME_ORDER.map((k) => {
                const t = resolveTheme(k);
                const on = prefs.theme === k;
                return (
                  <button key={k} type="button" onClick={() => p.setPrefs({ theme: k })} className="flex flex-col items-center gap-1.5">
                    <span className="relative w-full aspect-[4/3] rounded-2xl flex items-end justify-between px-2.5 pb-2" style={{ background: t.bg, color: t.fg, border: `2px solid ${on ? T.accent : t.line}` }}>
                      <span className="font-serif text-[17px] font-bold">Aa</span>
                      <span className="flex flex-col gap-1 items-end"><i className="block h-[2px] w-5 rounded" style={{ background: t.accent }} /><i className="block h-[2px] w-6 rounded" style={{ background: t.muted }} /><i className="block h-[2px] w-6 rounded" style={{ background: t.muted }} /></span>
                      {on && <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: T.accent }}><Check className="w-3 h-3 text-white" /></span>}
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: on ? T.fg : T.muted }}>{k === 'system' ? 'Système' : t.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Police */}
          <Section T={T} title="Police" value={READER_FONTS.find((f) => f.key === prefs.font)?.label}>
            <div className="grid grid-cols-3 gap-2">
              {READER_FONTS.map((f) => {
                const on = prefs.font === f.key;
                return (
                  <button key={f.key} type="button" onClick={() => p.setPrefs({ font: f.key })} className="rounded-2xl py-3 px-2 flex flex-col items-center gap-1 transition" style={{ background: on ? `${T.accent}22` : T.surface, border: `2px solid ${on ? T.accent : 'transparent'}` }}>
                    <span style={{ fontFamily: f.css, fontSize: 22, lineHeight: 1.1 }}>Aa</span>
                    <span className="text-[11px] font-semibold truncate max-w-full" style={{ color: on ? T.fg : T.muted }}>{f.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Mise en page */}
          <Section T={T} title="Mise en page">
            <div className="flex items-center justify-between mb-2"><span className="text-[12px]" style={{ color: T.muted }}>Interligne</span><span className="text-[12px] font-bold">{prefs.lineHeight.toFixed(1).replace('.', ',')}</span></div>
            <input type="range" min={1.3} max={2.4} step={0.1} value={prefs.lineHeight} onChange={(e) => p.setPrefs({ lineHeight: Number(e.target.value) })} className="w-full mb-4" style={{ accentColor: T.accent }} />
            <p className="text-[12px] mb-2" style={{ color: T.muted }}>Alignement</p>
            <Seg T={T} options={[['left', 'À gauche'], ['justify', 'Justifié']]} value={prefs.align} onChange={(v) => p.setPrefs({ align: v })} />
            <p className="text-[12px] mt-4 mb-2" style={{ color: T.muted }}>Marges</p>
            <Seg T={T} options={[['narrow', 'Étroites'], ['normal', 'Normales'], ['wide', 'Larges']]} value={prefs.margins} onChange={(v) => p.setPrefs({ margins: v })} />
            <p className="text-[12px] mt-4 mb-2" style={{ color: T.muted }}>Espace entre paragraphes</p>
            <Seg T={T} options={[['compact', 'Serré'], ['normal', 'Normal'], ['airy', 'Aéré']]} value={prefs.paraSpacing} onChange={(v) => p.setPrefs({ paraSpacing: v })} />
          </Section>

          {/* Défilement automatique */}
          <Section T={T} title="Défilement automatique" value={`${prefs.autoScrollWpm} mots/min`}>
            <input type="range" min={100} max={600} step={10} value={prefs.autoScrollWpm} onChange={(e) => p.setPrefs({ autoScrollWpm: Number(e.target.value) })} className="w-full mb-3" style={{ accentColor: T.accent }} />
            <p className="text-[12px] mb-2" style={{ color: T.muted }}>À la fin du chapitre</p>
            <Seg T={T} options={[['next', 'Chapitre suivant'], ['stop', 'S’arrêter']]} value={prefs.autoScrollEnd} onChange={(v) => p.setPrefs({ autoScrollEnd: v })} />
            <button type="button" onClick={() => { p.onToggleAutoScroll(); p.onClose(); }} className="mt-3 w-full py-3 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2 text-white" style={{ background: T.accent }}>
              {p.autoScrolling ? <><Pause className="w-4 h-4" /> Arrêter le défilement</> : <><Play className="w-4 h-4" /> Lancer le défilement</>}
            </button>
          </Section>

          {/* Confort de lecture */}
          <Section T={T} title="Confort de lecture">
            <div className="flex items-center justify-between mb-1"><span className="text-[12px] flex items-center gap-1.5" style={{ color: T.muted }}><Sun className="w-3.5 h-3.5" /> Filtre lumière bleue</span><span className="text-[12px] font-bold">{Math.round(prefs.warmth / 0.45 * 100)} %</span></div>
            <input type="range" min={0} max={0.45} step={0.05} value={prefs.warmth} onChange={(e) => p.setPrefs({ warmth: Number(e.target.value) })} className="w-full mb-2" style={{ accentColor: T.accent }} />
            <Toggle T={T} on={prefs.keepAwake} onClick={() => p.setPrefs({ keepAwake: !prefs.keepAwake })} icon={<Coffee className="w-4 h-4" />} label="Garder l’écran allumé" hint="L’écran ne se met pas en veille pendant la lecture." />
            <Toggle T={T} on={p.cinema} onClick={() => p.setCinema(!p.cinema)} icon={<Film className="w-4 h-4" />} label="Mode cinéma" hint="Seul le paragraphe en cours reste net." />
            <Toggle T={T} on={false} onClick={p.onImmersive} icon={<Maximize2 className="w-4 h-4" />} label="Mode immersion" hint="Plein écran, sans aucune barre. Touchez « Fermer » en haut pour sortir." />
          </Section>

          {/* Audio */}
          <Section T={T} title="Livre audio & ambiance">
            <Toggle T={T} on={p.audiobookEnabled} onClick={() => p.setAudiobookEnabled(!p.audiobookEnabled)} icon={<Headphones className="w-4 h-4" />} label="Livre audio" hint="Écoute le chapitre ; le texte se surligne au fil de la voix." />
            {p.audiobookEnabled && (
              <div className="mt-1 mb-3"><Seg T={T} options={[['0.75', '0,75×'], ['1', '1×'], ['1.25', '1,25×'], ['1.5', '1,5×'], ['2', '2×']]} value={String(p.speechRate) as any} onChange={(v) => p.setSpeechRate(Number(v))} /></div>
            )}
            <p className="text-[12px] mt-2 mb-2 flex items-center gap-1.5" style={{ color: T.muted }}><Volume2 className="w-3.5 h-3.5" /> Ambiance sonore</p>
            <div className="grid grid-cols-4 gap-2">
              {SOUNDS.map((s) => (
                <button key={s.id} type="button" onClick={() => p.setSoundscape(s.id)} className="py-2 rounded-xl text-[11px] font-bold" style={chip(p.soundscape === s.id)}>{s.label}</button>
              ))}
            </div>
            {p.soundscape !== 'none' && (
              <>
                <input type="range" min={0} max={1} step={0.05} value={p.soundVolume} onChange={(e) => p.setSoundVolume(Number(e.target.value))} className="w-full mt-3" style={{ accentColor: T.accent }} />
                <Toggle T={T} on={p.spatialAudioOn} onClick={() => p.setSpatialAudioOn(!p.spatialAudioOn)} icon={<Headphones className="w-4 h-4" />} label="Son immersif 3D" hint="Pour casque et écouteurs." />
              </>
            )}
          </Section>

          <p className="text-[11px] text-center pt-3" style={{ color: T.muted }}>Vos réglages restent sur cet appareil, en ligne comme hors ligne.</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
