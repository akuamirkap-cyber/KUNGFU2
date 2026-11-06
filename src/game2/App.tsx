import { useEffect, useRef, useState, type ReactNode } from 'react';
import { VIEW_H, VIEW_W, ZONES } from './game/constants';
import { Game, type UIState } from './game/game';
import { MOVE_LIST } from './game/moves';
import { MUTATIONS } from './game/mutations';

const initialUI: UIState = {
  state: 'menu', level: 1, zoneName: ZONES[0].name, zoneSub: ZONES[0].sub, score: 0, age: 20, deathCounter: 1, deaths: 0, kills: 0,
  bestCombo: 0, choices: [], save: null, best: { level: 0, score: 0 }, muted: false, mutations: [], ageGain: 0, hp: 5, maxHp: 5, accent: '#ff5a36',
  mode: 'story', wave: 0, survivalTime: 0, bestWave: 0, bestSurvivalScore: 0, blood: 'combined', v2: true, long: false,
};

function useScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const calc = () => {
      const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
      setScale(s > 0 ? s : 1);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  return scale;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [ui, setUi] = useState<UIState>(initialUI);
  const [showControls, setShowControls] = useState(false);
  const scale = useScale();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let g: Game;
    try {
      g = new Game(canvas);
    } catch (err) {
      console.error('[KUNGFU DRIFTER] failed to create game', err);
      return;
    }
    gameRef.current = g;
    (window as unknown as { __kf?: Game }).__kf = g;
    g.onUI = (u) => setUi(u);
    try {
      g.start();
    } catch (err) {
      console.error('[KUNGFU DRIFTER] failed to start game', err);
    }
    g.input.focus();

    // Virtual / keyboard strike support: when no real cursor is over the game, aim the strike at the
    // nearest living enemy. Otherwise a punch sent from the showcase's on-screen button would fly
    // toward whatever stale spot the aim was last left at (the sim aims purely from the cursor).
    const aimAssist = (game: Game) => {
      if (performance.now() - game.input.mouseMovedAt < 1500) return;
      const p = game.player;
      let bi = -1; let bd = Infinity;
      for (let i = 0; i < game.enemies.length; i++) {
        const e = game.enemies[i];
        if (e.dead || e.spawnT > 0) continue;
        const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
        if (d < bd) { bd = d; bi = i; }
      }
      if (bi < 0) return;
      const t = game.enemies[bi];
      game.input.mouse.x = (t.x - game.cam.x - VIEW_W / 2) * game.zoom + VIEW_W / 2;
      game.input.mouse.y = (t.y - game.cam.y - VIEW_H / 2) * game.zoom + VIEW_H / 2;
    };

    const onMsg = (ev: MessageEvent) => {
      if (!ev.data || typeof ev.data !== 'object') return;
      if (ev.data.type === 'KF_KEYDOWN') {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: ev.data.code, key: ev.data.key || '', bubbles: true }));
      } else if (ev.data.type === 'KF_KEYUP') {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: ev.data.code, key: ev.data.key || '', bubbles: true }));
      } else if (ev.data.type === 'KF_MOUSEDOWN') {
        const game = gameRef.current;
        if (!game) return;
        aimAssist(game);
        game.input.synthMouseDown(typeof ev.data.button === 'number' ? ev.data.button : 0);
      } else if (ev.data.type === 'KF_MOUSEUP') {
        gameRef.current?.input.synthMouseUp(typeof ev.data.button === 'number' ? ev.data.button : 0);
      } else if (ev.data.type === 'KF_ACTION') {
        if (ev.data.action === 'start') {
          if (gameRef.current?.state === 'menu') gameRef.current.newGame(null);
          else if (gameRef.current?.state === 'paused') gameRef.current.resume();
          else if (gameRef.current?.state === 'dead') gameRef.current.newGame(null);
        } else if (ev.data.action === 'pause') {
          if (gameRef.current?.state === 'playing') gameRef.current.pause();
          else if (gameRef.current?.state === 'paused') gameRef.current.resume();
        }
      }
    };
    window.addEventListener('message', onMsg);

    return () => {
      window.removeEventListener('message', onMsg);
      g.destroy();
      if (gameRef.current === g) gameRef.current = null;
    };
  }, []);

  const g = () => gameRef.current!;
  // Keyboard focus must be inside the game (it usually runs in an iframe). Every click / menu button grabs it.
  const focusGame = () => gameRef.current?.input.focus();
  const act = (fn: () => void) => () => { focusGame(); fn(); focusGame(); };
  const w = VIEW_W * scale, h = VIEW_H * scale;
  const fontPx = Math.min(22, Math.max(12, Math.round(4.5 * scale)));
  // V2 renders into a display-sized backing store so the picture is resampled exactly ONCE (hard pixel edges).
  // V1 keeps the classic fixed 480x270 buffer that CSS stretches — that is the old, softer look.
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
  const bw = ui.v2 ? Math.max(VIEW_W, Math.min(1920, Math.round(w * dpr))) : VIEW_W;
  const bh = ui.v2 ? Math.max(VIEW_H, Math.round((bw * VIEW_H) / VIEW_W)) : VIEW_H;

  return (
    <div
      className="relative w-screen h-screen bg-black flex items-center justify-center overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={focusGame}
      onPointerDown={focusGame}
      onClick={focusGame}
    >
      {/* V1 / V2 switch: V2 = pixel tajam (satu tahap resample) + ragdoll gabungan game1. V1 = build lama. */}
      <button
        onClick={act(() => g().toggleV2())}
        onPointerDown={(e) => e.stopPropagation()}
        className="pixel absolute top-2 right-2 z-30 cursor-pointer border-2 px-2 py-1 leading-none transition-colors hover:brightness-150"
        style={{
          borderColor: ui.v2 ? '#7df9ff' : '#6a6a6a',
          color: ui.v2 ? '#7df9ff' : '#9a9a9a',
          background: 'rgba(0,0,0,0.78)',
          fontSize: Math.max(9, Math.round(fontPx * 0.62)),
        }}
        title={ui.v2 ? 'V2 aktif: pixel tajam + ragdoll/pusing ala STICK FIST. Klik untuk kembali ke V1 (tampilan lama).' : 'V1 aktif: build lama. Klik untuk menyalakan V2 (pixel tajam + ragdoll baru).'}
      >
        {ui.v2 ? '* V2 NEW' : 'V1 OLD'}
      </button>
      {/* LONG-LIMB switch (L): badan/tangan/kaki 2.5x panjang normal — reach serangan ikut panjang. */}
      <button
        onClick={act(() => g().toggleLong())}
        onPointerDown={(e) => e.stopPropagation()}
        className="pixel absolute top-2 right-24 z-30 cursor-pointer border-2 px-2 py-1 leading-none transition-colors hover:brightness-150"
        style={{
          borderColor: ui.long ? '#ffd27f' : '#6a6a6a',
          color: ui.long ? '#ffd27f' : '#9a9a9a',
          background: 'rgba(0,0,0,0.78)',
          fontSize: Math.max(9, Math.round(fontPx * 0.62)),
        }}
        title={ui.long ? 'LONG LIMBS aktif: badan/tangan/kaki 2.5x panjang normal. Klik untuk kembali normal.' : 'Klik untuk mode LONG LIMBS: badan/tangan/kaki 2.5x panjang normal (atau tekan L).'}
      >
        {ui.long ? '* LONG x2.5' : 'LONG x2.5'}
      </button>
      <div className="relative" style={{ width: w, height: h, fontSize: fontPx }}>
        <canvas
          ref={canvasRef}
          width={bw}
          height={bh}
          tabIndex={0}
          className="block w-full h-full cursor-none outline-none"
          style={{ imageRendering: 'pixelated' }}
        />
        {/* scanlines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.6) 0px, rgba(0,0,0,0.6) 1px, transparent 2px, transparent 4px)' }}
        />
        {ui.state === 'menu' && (
          <div className="absolute inset-0 cursor-default overflow-y-auto">
            {/* dark gradient so the live arena behind stays readable but moody */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.85) 100%)' }} />
            <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: `radial-gradient(60% 50% at 50% 30%, ${ui.accent}33 0%, transparent 70%)` }} />
            <div className="relative min-h-full flex flex-col items-center justify-between py-[1.4em] px-[2em]">
              {/* ---------- TITLE ---------- */}
              <div className="flex flex-col items-center gap-[0.35em] mt-[0.4em]">
                <div className="pixel text-[0.55em] tracking-[0.5em] text-white/50">A 2D KUNG FU ROGUELITE</div>
                <div className="relative">
                  <div className="pixel text-[3.2em] leading-none tracking-wider select-none" style={{ color: ui.accent, textShadow: `0.1em 0.1em 0 #000, 0 0 0.6em ${ui.accent}aa, 0 0 1.6em ${ui.accent}66` }}>
                    KUNGFU
                  </div>
                  <div className="pixel text-[3.2em] leading-none tracking-wider select-none -mt-[0.15em]" style={{ color: '#ffffff', textShadow: '0.1em 0.1em 0 #000, 0 0 0.5em rgba(255,255,255,0.35)' }}>
                    DRIFTER
                  </div>
                  <div className="absolute -right-[1.6em] top-[0.1em] pixel text-[0.5em] rotate-12 px-[0.6em] py-[0.3em] text-black" style={{ background: '#ffd166', boxShadow: '0.2em 0.2em 0 #000' }}>SIFU x NUCLEAR THRONE</div>
                </div>
                <div className="pixel text-[0.6em] text-white/70 mt-[0.4em] tracking-wider">FREESTYLE RHYTHM COMBAT · WING CHUN / BLACK LEG / KUNG FU · RAGE · 15 FATALITIES · 7 WEAPONS</div>
              </div>

              {/* ---------- MODE CARDS ---------- */}
              <div className="flex flex-wrap gap-[1em] justify-center w-full max-w-[52em] mt-[1em]">
                <ModeCard
                  accent={ui.accent}
                  title="STORY"
                  sub="200 FLOORS OF PAIN"
                  lines={['20 zones, a boss every 10 floors', 'Mutations every 3 floors', 'Die and you AGE. Reach 70 and it\'s over']}
                  best={ui.best.level > 0 ? `BEST: FLOOR ${ui.best.level} · ${ui.best.score} PTS` : null}
                  primary={{ label: 'NEW RUN', onClick: act(() => g().newGame(null)) }}
                  secondary={ui.save && ui.save.level > 1 ? { label: `CONTINUE · FLOOR ${ui.save.level}`, onClick: act(() => g().newGame(ui.save)) } : undefined}
                />
                <ModeCard
                  accent="#ff2a2a"
                  title="SURVIVAL"
                  sub="ENDLESS WAVES"
                  lines={['One arena, enemies pour in from the edges', 'Every wave: more, faster, SMARTER', 'Boss every 5 waves · Ambushes from wave 6']}
                  best={ui.bestWave > 0 ? `BEST: WAVE ${ui.bestWave} · ${ui.bestSurvivalScore} PTS` : null}
                  primary={{ label: 'SURVIVE', onClick: act(() => g().newSurvival()) }}
                />
              </div>

              {/* ---------- WEAPON SHOWCASE ---------- */}
              <div className="flex flex-wrap justify-center gap-[0.5em] mt-[1em] max-w-[52em]">
                {[['✊', 'FREESTYLE FISTS', 'your tempo picks the style: wing chun / black leg / kung fu'], ['🔫', 'PISTOL / RIFLE', 'gun-fu with recoil & casings'], ['🥢', 'NUNCHAKU', 'physics chain · Bruce Lee triangle'], ['⚔️', 'KATANA', 'iaijutsu · bleeding cuts'], ['🪓', 'AXE', 'baseball swings · HOME RUN'], ['🗡️', 'DUAL BLADES', 'flurry · X-slash']].map(([ic, nm, ds]) => (
                  <div key={nm} className="flex items-center gap-[0.5em] bg-black/50 border border-white/10 px-[0.7em] py-[0.4em]">
                    <span className="text-[1.1em] leading-none">{ic}</span>
                    <div className="flex flex-col">
                      <span className="pixel text-[0.55em] text-white">{nm}</span>
                      <span className="pixel text-[0.42em] text-white/45">{ds}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ---------- SETTINGS ROW ---------- */}
              <div className="flex flex-wrap items-center justify-center gap-[1.2em] mt-[1em] bg-black/55 border border-white/10 px-[1.2em] py-[0.6em]">
                <BloodPicker ui={ui} onPick={(m) => act(() => g().setBlood(m))()} />
                <div className="w-px h-[2.2em] bg-white/15 hidden sm:block" />
                <button onClick={act(() => g().toggleMute())} className="pixel text-[0.55em] px-[0.8em] py-[0.4em] border border-white/30 text-white/80 hover:bg-white/10 cursor-pointer">
                  {ui.muted ? '🔇 SOUND OFF' : '🔊 SOUND ON'} <span className="text-white/30">[M]</span>
                </button>
                <button onClick={() => setShowControls((v) => !v)} className="pixel text-[0.55em] px-[0.8em] py-[0.4em] border text-black cursor-pointer" style={{ background: '#ffd166', borderColor: '#ffd166' }}>
                  {showControls ? 'HIDE CONTROLS' : 'CONTROLS & MOVE LIST'}
                </button>
              </div>
              {showControls && <div className="mt-[1em]"><Controls /></div>}

              {/* ---------- FOOTER ---------- */}
              <div className="flex flex-col items-center gap-[0.3em] mt-[1em]">
                <div className="pixel text-[0.5em] text-white/35">WASD RUN · SPACE JUMP · SHIFT SHADOW STEP · LMB/RMB ATTACK · SPAM LMB CHAIN PUNCH · R RAGE · X ONE FOR ALL (SLOW-MO) · F FATALITY · E FOCUS · C PARRY · V V1/V2 LOOK · L LONG LIMBS x2.5 · 1-7 WEAPONS</div>
                <div className="pixel text-[0.45em] text-yellow-300/60">IF THE KEYBOARD DOES NOTHING, CLICK THE GAME ONCE TO FOCUS IT</div>
              </div>
            </div>
          </div>
        )}
        {ui.state === 'mutation' && (
          <Overlay dim="bg-black/70">
            <div className="flex flex-col items-center gap-[1em] w-full px-[2em]">
              <div className="pixel text-[1.3em]" style={{ color: ui.accent }}>{ui.mode === 'survival' ? `WAVE ${ui.wave} SURVIVED` : `LEVEL ${ui.level} CLEARED`}</div>
              <div className="pixel text-[0.7em] text-white/70">CHOOSE A MUTATION</div>
              <div className="flex gap-[1em] w-full justify-center">
                {ui.choices.map((m, i) => (
                  <button
                    key={m.id}
                    onClick={act(() => g().chooseMutation(i))}
                    className="group flex flex-col items-center gap-[0.6em] w-[13em] p-[1em] border-[0.2em] bg-black/60 hover:bg-white/10 transition-colors cursor-pointer"
                    style={{ borderColor: m.color }}
                  >
                    <div className="text-[2em] leading-none">{m.icon}</div>
                    <div className="pixel text-[0.75em]" style={{ color: m.color }}>{m.name}</div>
                    <div className="pixel text-[0.5em] text-white/70 leading-relaxed">{m.desc}</div>
                    <div className="pixel text-[0.5em] text-white/40 mt-auto">[{i + 1}]</div>
                  </button>
                ))}
              </div>
              <div className="pixel text-[0.5em] text-white/40">{ui.mode === 'survival' ? `NEXT: WAVE ${ui.wave + 1}${(ui.wave + 1) % 5 === 0 ? ' - BOSS WAVE' : ''}` : `NEXT: LEVEL ${ui.level + 1} - ${ZONES[Math.min(19, Math.floor(ui.level / 10))].name}`}</div>
            </div>
          </Overlay>
        )}
        {ui.state === 'dead' && (
          <Overlay dim="bg-transparent">
            <div className="flex flex-col items-center gap-[0.8em] text-center animate-[fadeIn_1s_ease-in]">
              <div className="pixel text-[2.4em] text-red-500" style={{ textShadow: '0.08em 0.08em 0 #000' }}>YOU DIED</div>
              {ui.mode === 'survival' ? (
                <div className="pixel text-[0.7em] text-yellow-300">YOU SURVIVED {ui.wave} WAVES - {Math.floor(ui.survivalTime / 60)}:{String(Math.floor(ui.survivalTime % 60)).padStart(2, '0')}</div>
              ) : (
                <>
                  <div className="pixel text-[0.8em] text-yellow-300">
                    AGE {ui.age} <span className="text-white/60">→</span> {ui.age + ui.ageGain}
                  </div>
                  <div className="pixel text-[0.55em] text-white/60">YOU GROW OLDER. YOU HIT HARDER. YOU HAVE LESS HEALTH.</div>
                  {ui.age + ui.ageGain >= 70 ? (
                    <div className="pixel text-[0.6em] text-red-400">THIS BODY CANNOT GO ON...</div>
                  ) : (
                    <div className="pixel text-[0.6em] text-white/50">DEATH COUNTER: {ui.deathCounter} (RESETS ON BOSS KILL)</div>
                  )}
                </>
              )}
              <Btn accent={ui.accent} onClick={act(() => g().respawn())} primary>{ui.mode === 'survival' ? 'RESULTS [ENTER]' : 'RISE AGAIN [ENTER]'}</Btn>
            </div>
          </Overlay>
        )}
        {ui.state === 'gameover' && (
          <Overlay dim="bg-black/80">
            <div className="flex flex-col items-center gap-[0.8em] text-center">
              <div className="pixel text-[2em] text-red-500">{ui.mode === 'survival' ? 'OVERRUN' : 'DIED OF OLD AGE'}</div>
              <div className="pixel text-[0.6em] text-white/60">{ui.mode === 'survival' ? `YOU HELD OUT FOR ${ui.wave} WAVES (${Math.floor(ui.survivalTime / 60)}:${String(Math.floor(ui.survivalTime % 60)).padStart(2, '0')})${ui.wave >= ui.bestWave && ui.wave > 0 ? ' - NEW RECORD!' : ''}` : `THE ROAD ENDED AT LEVEL ${ui.level} - ${ui.zoneName}`}</div>
              <Stats ui={ui} />
              <div className="flex gap-[0.8em] mt-[0.5em]">
                <Btn accent={ui.accent} onClick={act(() => g().restartZone())} primary>{ui.mode === 'survival' ? 'SURVIVE AGAIN' : 'RETRY ZONE'}</Btn>
                <Btn accent={ui.accent} onClick={act(() => g().toMenu())}>MENU</Btn>
              </div>
            </div>
          </Overlay>
        )}
        {ui.state === 'victory' && (
          <Overlay dim="bg-black/75">
            <div className="flex flex-col items-center gap-[0.8em] text-center">
              <div className="pixel text-[2em] text-yellow-300" style={{ textShadow: '0 0 1em #ffd700' }}>YOU ARE THE MASTER</div>
              <div className="pixel text-[0.6em] text-white/70">200 FLOORS. ONE FIST. AGE {ui.age}.</div>
              <Stats ui={ui} />
              <Btn accent={ui.accent} onClick={act(() => g().toMenu())} primary>RETURN TO MENU</Btn>
            </div>
          </Overlay>
        )}
        {ui.state === 'paused' && (
          <Overlay dim="bg-black/70">
            <div className="flex flex-col items-center gap-[0.8em] text-center">
              <div className="pixel text-[1.6em] text-white">PAUSED</div>
              <div className="pixel text-[0.55em] text-white/60">{ui.mode === 'survival' ? `SURVIVAL - WAVE ${ui.wave}` : `LEVEL ${ui.level} - ${ui.zoneName} - AGE ${ui.age}`}</div>
              <div className="flex flex-wrap justify-center gap-[0.4em] max-w-[30em]">
                {ui.mutations.map((id, i) => {
                  const m = MUTATIONS.find((mm) => mm.id === id);
                  return m ? <span key={i} title={m.name} className="text-[1em]">{m.icon}</span> : null;
                })}
              </div>
              <div className="flex gap-[0.8em]">
                <Btn accent={ui.accent} onClick={act(() => g().resume())} primary>RESUME [ESC]</Btn>
                <Btn accent={ui.accent} onClick={act(() => g().toggleMute())}>{ui.muted ? 'UNMUTE' : 'MUTE'} [M]</Btn>
                <Btn accent="#ff4d4d" onClick={act(() => g().cycleBlood())}>BLOOD: {ui.blood.toUpperCase()} [B]</Btn>
                <Btn accent={ui.accent} onClick={act(() => g().toMenu())}>QUIT</Btn>
              </div>
              <Controls compact />
            </div>
          </Overlay>
        )}
      </div>
    </div>
  );
}

function ModeCard({ accent, title, sub, lines, best, primary, secondary }: { accent: string; title: string; sub: string; lines: string[]; best: string | null; primary: { label: string; onClick: () => void }; secondary?: { label: string; onClick: () => void } }) {
  return (
    <div className="relative flex flex-col gap-[0.5em] w-[24em] max-w-full p-[1em] bg-black/65 border-[0.15em] transition-transform hover:-translate-y-[0.15em]" style={{ borderColor: accent, boxShadow: `0.35em 0.35em 0 #000, inset 0 0 2em ${accent}22` }}>
      <div className="absolute -top-[0.6em] left-[0.8em] pixel text-[0.5em] px-[0.5em] py-[0.15em] text-black" style={{ background: accent }}>{sub}</div>
      <div className="pixel text-[1.4em] leading-none mt-[0.2em]" style={{ color: accent, textShadow: '0.06em 0.06em 0 #000' }}>{title}</div>
      <ul className="pixel text-[0.5em] text-white/70 leading-relaxed list-none m-0 p-0">
        {lines.map((l) => <li key={l}>› {l}</li>)}
      </ul>
      {best && <div className="pixel text-[0.45em] text-yellow-300/80">{best}</div>}
      <div className="flex gap-[0.5em] mt-[0.3em]">
        <button onClick={primary.onClick} className="pixel text-[0.7em] flex-1 px-[0.8em] py-[0.6em] text-black cursor-pointer hover:brightness-110 active:translate-y-[0.1em]" style={{ background: accent, boxShadow: '0.25em 0.25em 0 #000' }}>{primary.label}</button>
        {secondary && <button onClick={secondary.onClick} className="pixel text-[0.55em] px-[0.8em] py-[0.6em] text-white bg-black/60 border cursor-pointer hover:bg-white/10" style={{ borderColor: accent, boxShadow: '0.25em 0.25em 0 #000' }}>{secondary.label}</button>}
      </div>
    </div>
  );
}

function BloodPicker({ ui, onPick }: { ui: UIState; onPick: (m: 'normal' | 'gore' | 'combined') => void }) {
  const opts: ['normal' | 'gore' | 'combined', string, string][] = [['normal', 'NORMAL', 'classic light particles'], ['gore', 'GORE', 'permanent stains, jets, mist, gibs, camera splatter'], ['combined', 'COMBINED', 'both systems together']];
  return (
    <div className="flex flex-col items-center gap-[0.3em] pixel text-[0.55em]">
      <div className="text-white/60">BLOOD SYSTEM <span className="text-white/30">[B]</span></div>
      <div className="flex gap-[0.4em]">
        {opts.map(([m, label, tip]) => (
          <button key={m} title={tip} onClick={() => onPick(m)} className={`px-[0.8em] py-[0.4em] border cursor-pointer ${ui.blood === m ? 'text-black' : 'text-white/70 hover:bg-white/10'}`} style={ui.blood === m ? { background: '#ff4d4d', borderColor: '#ff4d4d' } : { borderColor: '#ff4d4d' }}>{label}</button>
        ))}
      </div>
    </div>
  );
}

function Overlay({ children, dim = 'bg-black/40' }: { children: ReactNode; dim?: string }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center overflow-y-auto ${dim} cursor-default`}>
      <div className="max-h-full py-[1em] flex items-center justify-center w-full">{children}</div>
    </div>
  );
}

function Btn({ children, onClick, primary, accent }: { children: ReactNode; onClick: () => void; primary?: boolean; accent: string }) {
  return (
    <button
      onClick={onClick}
      className={`pixel text-[0.7em] px-[1.2em] py-[0.7em] border-[0.15em] transition-all cursor-pointer hover:translate-x-[0.1em] hover:-translate-y-[0.1em] active:translate-y-0 ${primary ? 'text-black' : 'text-white bg-black/60 hover:bg-white/10'}`}
      style={primary ? { background: accent, borderColor: accent, boxShadow: '0.25em 0.25em 0 #000' } : { borderColor: accent, boxShadow: '0.25em 0.25em 0 #000' }}
    >
      {children}
    </button>
  );
}

function Stats({ ui }: { ui: UIState }) {
  return (
    <div className="grid grid-cols-2 gap-x-[2em] gap-y-[0.3em] pixel text-[0.6em] text-white/80 bg-black/50 p-[1em] border border-white/20">
      <span className="text-white/50">SCORE</span><span>{ui.score}</span>
      <span className="text-white/50">KILLS</span><span>{ui.kills}</span>
      <span className="text-white/50">BEST COMBO</span><span>{ui.bestCombo}</span>
      <span className="text-white/50">DEATHS</span><span>{ui.deaths}</span>
      <span className="text-white/50">MUTATIONS</span><span>{ui.mutations.length}</span>
      {ui.mode === 'survival' ? <><span className="text-white/50">WAVES</span><span>{ui.wave}</span></> : <><span className="text-white/50">BEST LEVEL</span><span>{ui.best.level}</span></>}
    </div>
  );
}

function Controls({ compact }: { compact?: boolean }) {
  return (
    <div className={`grid ${compact ? 'grid-cols-2 gap-x-[2em]' : 'grid-cols-1 sm:grid-cols-2 gap-x-[2em]'} gap-y-[0.25em] pixel text-[0.5em] text-left bg-black/60 border border-white/15 p-[1em] max-w-[52em]`}>
      <div className="text-white/40 col-span-full mb-[0.3em]">CONTROLS</div>
      <Row k="WASD" v="MOVE (HOLD TO RUN)" /><Row k="MOUSE" v="AIM" />
      <Row k="LMB" v="LIGHT ATTACK / SHOOT" /><Row k="RMB" v="HEAVY (PALM STRIKE)" />
      <Row k="RUN + LMB (FISTS)" v="TAEKWONDO FLYING SIDE KICK" /><Row k="RUN + RMB (FISTS)" v="MK FLYING KICK / RUNNING STRAIGHT" />
      <Row k="RUN + LMB (WEAPON)" v="DRAGON LASH / IAIJUTSU / GRAND SLAM / PHANTOM CROSS" />
      <Row k="SPACE (AIR) + LMB" v="DIVE KICK" />
      <Row k="SPACE" v="JUMP (HOP OVER BULLETS)" /><Row k="SHIFT" v="SHADOW STEP (DASH, I-FRAMES)" />
      <Row k="C" v="PARRY" />
      <Row k="E" v="FOCUS STRIKE" /><Row k="F" v="FATALITY (ANY ENEMY IN REACH)" />
      <Row k="X" v="ONE FOR ALL (AT 25+ CHARGE): WORLD SLOWS TO 30%, YOU RUN AT REAL TIME, STRIKES AUTO-LOCK" />
      <Row k="CLICK TEMPO (FISTS)" v="FAST = WING CHUN  /  MEDIUM = BLACK LEG KICKS  /  SLOW = KUNG FU HEAVIES" /><Row k="R" v="RAGE (WHEN METER FULL): LMB = DASH + EXECUTE" />
            <Row k="Q / 1-7 / WHEEL" v="FIST / PISTOL / RIFLE / NUNCHAKU / KATANA / AXE / DUAL" />
      <Row k="B" v="BLOOD: NORMAL / GORE / COMBINED" /><Row k="ESC" v="PAUSE" />
      <Row k="V" v="SWITCH LOOK: V2 = CRISP PIXELS + GAME1 RAGDOLL (WALL BOUNCE, DIZZY STARS, KICKABLE BODIES) / V1 = CLASSIC BUILD" />
      {!compact && (
        <>
          <div className="text-white/40 col-span-full mt-[0.8em] mb-[0.3em]">KUNG FU TECHNIQUES</div>
          {MOVE_LIST.map((m) => (
            <div key={m.name} className="col-span-full flex gap-[1em] leading-relaxed">
              <span className="text-yellow-300 min-w-[9em]">{m.keys}</span>
              <span className="text-white">{m.name}</span>
              <span className="text-white/50">{m.desc}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-[1em]">
      <span className="text-yellow-300 min-w-[9em]">{k}</span>
      <span className="text-white/80">{v}</span>
    </div>
  );
}
