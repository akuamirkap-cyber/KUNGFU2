import { useEffect, useRef, useState, useCallback } from 'react';
import { Game } from './game/game';
import { render } from './game/render';
import { VW, VH, TECHNIQUES, UPGRADES, MAX_LEVEL, SKINS, RANKS, rankFor } from './game/data';
import { initAudio, resumeAudio, setMuted, isMuted } from './game/audio';

const gameSingleton = new Game();

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const game = gameSingleton;
  const [, setTick] = useState(0);
  const [scale, setScale] = useState(2);
  const [muted, setMutedState] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    game.onChange = refresh;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0; let last = performance.now(); let rt = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now; rt += dt;
      game.update(dt);
      render(ctx, game, rt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onResize = () => {
      const s = Math.max(1, Math.floor(Math.min(window.innerWidth / VW, window.innerHeight / VH)));
      setScale(s);
    };
    onResize();
    window.addEventListener('resize', onResize);

    const toCanvas = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      game.mouse.x = (e.clientX - r.left) / r.width * VW;
      game.mouse.y = (e.clientY - r.top) / r.height * VH;
    };
    // --- Virtual / keyboard strike support -------------------------------------------------
    // The sim reads strikes from the MOUSE only (LMB = combo, RMB = parry) and aims with the
    // cursor, so a keyboard-only player would otherwise (a) never throw a punch at all and (b) face
    // whatever stale spot the cursor last hovered. J / K act as LMB / RMB, and when no real cursor
    // has been used for a moment the strike aims at the nearest living enemy. SPACE stays JUMP.
    let realMouseAt = 0;
    const aimAssist = () => {
      if (performance.now() - realMouseAt < 1500) return; // a real cursor is in use: don't fight it
      const p = game.player;
      if (!p) return;
      let bi = -1; let bd = Infinity;
      for (let i = 0; i < game.enemies.length; i++) {
        const e = game.enemies[i];
        if (e.state === 'dead' || e.state === 'victim' || e.state === 'teleport') continue;
        const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
        if (d < bd) { bd = d; bi = i; }
      }
      if (bi < 0) return;
      const t = game.enemies[bi];
      game.mouse.x = (t.x - game.cam.x) * game.zoom + VW / 2;
      game.mouse.y = (t.y - game.cam.y) * game.zoom + VH / 2;
    };
    const strikeDown = (b: number) => {
      initAudio(); resumeAudio();
      if (game.phase !== 'playing') return;
      aimAssist();
      game.mouseDown(b);
    };
    const strikeUp = (b: number) => game.mouseUp(b);

    const kd = (e: KeyboardEvent) => {
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      initAudio(); resumeAudio();
      if (e.code === 'KeyM') { setMuted(!isMuted()); setMutedState(isMuted()); }
      if (e.code === 'KeyB') { game.cycleBlood(); return; }
      if (e.code === 'KeyV') { game.cycleBody(); return; }
      if (game.phase === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) { game.resume(); return; }
      if (game.phase === 'title' && (e.code === 'Enter' || e.code === 'Space')) { game.newRun(false); return; }
      if (game.phase === 'dead' && e.code === 'Enter') { if (game.isEndless) game.startEndless(); else game.newRun(true); return; }
      if (game.phase === 'upgrade' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) { const i = parseInt(e.code.slice(5)) - 1; const u = game.upgradeChoices[i]; if (u) game.pickUpgrade(u); return; }
      if (e.code === 'KeyJ') { strikeDown(0); return; }
      if (e.code === 'KeyK') { strikeDown(2); return; }
      game.keyDown(e.code);
    };
    const ku = (e: KeyboardEvent) => {
      if (e.code === 'KeyJ') { strikeUp(0); return; }
      if (e.code === 'KeyK') { strikeUp(2); return; }
      game.keyUp(e.code);
    };
    const md = (e: MouseEvent) => { realMouseAt = performance.now(); initAudio(); resumeAudio(); toCanvas(e); if (game.phase === 'playing') { e.preventDefault(); game.mouseDown(e.button); } };
    const mu = (e: MouseEvent) => { game.mouseUp(e.button); };
    const mm = (e: MouseEvent) => { realMouseAt = performance.now(); toCanvas(e); };
    const wh = (e: WheelEvent) => { if (game.phase === 'playing') { e.preventDefault(); game.wheel(e.deltaY); } };
    const cm = (e: MouseEvent) => e.preventDefault();
    const blur = () => { game.keys.clear(); game.mouse.down = false; game.mouse.rdown = false; if (game.phase === 'playing') game.setPhase('paused'); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    window.addEventListener('mousedown', md); window.addEventListener('mouseup', mu); window.addEventListener('mousemove', mm);
    window.addEventListener('wheel', wh, { passive: false }); window.addEventListener('contextmenu', cm); window.addEventListener('blur', blur);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      window.removeEventListener('mousedown', md); window.removeEventListener('mouseup', mu); window.removeEventListener('mousemove', mm);
      window.removeEventListener('wheel', wh); window.removeEventListener('contextmenu', cm); window.removeEventListener('blur', blur);
    };
  }, [game, refresh]);

  const phase = game.phase;
  const accent = game.lvl?.biome.accent ?? '#ff3b3b';

  return (
    <div ref={wrapRef} className="fixed inset-0 flex items-center justify-center bg-black select-none overflow-hidden" style={{ cursor: phase === 'playing' ? 'none' : 'default' }}>
      <div className="relative" style={{ width: VW * scale, height: VH * scale }}>
        <canvas ref={canvasRef} width={VW} height={VH} className="block" style={{ width: VW * scale, height: VH * scale, imageRendering: 'pixelated' }} />
        <div className="scanlines pointer-events-none absolute inset-0" />

        {phase === 'title' && <TitleScreen game={game} />}
        {phase === 'paused' && <PauseScreen game={game} muted={muted} />}
        {phase === 'upgrade' && <UpgradeScreen game={game} accent={accent} />}
        {phase === 'dead' && <DeathScreen game={game} />}
        {phase === 'win' && <WinScreen game={game} />}
      </div>
    </div>
  );
}

function Overlay({ children, dim = true }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center ${dim ? 'bg-black/70' : ''} pixel-font text-white`}>
      <div className="w-full max-w-[720px] px-4">{children}</div>
    </div>
  );
}

function Key({ k }: { k: string }) {
  return <span className="inline-block min-w-[28px] text-center border-2 border-white/60 bg-white/10 px-1.5 py-1 text-[9px] text-yellow-300 mr-2 shadow-[2px_2px_0_#000]">{k}</span>;
}

function fmtTime(t: number) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${s < 10 ? '0' : ''}${s}`; }

function Btn({ children, onClick, primary, gold }: { children: React.ReactNode; onClick: () => void; primary?: boolean; gold?: boolean }) {
  return (
    <button onClick={onClick} className={`pixel-font text-[11px] px-5 py-3 border-2 shadow-[4px_4px_0_#000] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 ${primary ? 'bg-red-500 border-red-300 text-white' : gold ? 'bg-yellow-400 border-yellow-200 text-black' : 'bg-white/10 border-white/50 text-white hover:bg-white/20'}`}>
      {children}
    </button>
  );
}

function TitleScreen({ game }: { game: Game }) {
  const [tab, setTab] = useState<'play' | 'rank' | 'skin' | 'board'>('play');
  const [showHow, setShowHow] = useState(false);
  const bloodNames = ['NORMAL', 'PARTIKEL', 'KOMBINASI'];
  const best = game.bestScore();
  const rk = rankFor(best);
  const tabs: ['play' | 'rank' | 'skin' | 'board', string][] = [['play', 'PLAY'], ['rank', 'RANK'], ['skin', 'SKIN'], ['board', 'LEADERBOARD']];
  return (
    <Overlay dim={false}>
      <div className="text-center">
        <div className="text-[8px] tracking-[0.5em] text-white/50 mb-2">— STICK FIST PRESENTS —</div>
        <h1 className="text-[40px] leading-none text-white" style={{ textShadow: '3px 3px 0 #ff3b3b, 6px 6px 0 rgba(0,0,0,0.9), 0 0 26px rgba(255,59,59,0.45)' }}>STICK FIST</h1>
        <div className="mt-2 text-[10px] tracking-[0.4em] text-red-400">THRONE OF THE DRIFTER</div>
        <div className="mt-1 text-[7px] text-yellow-300/90">RANK: {rk.cur.name} · BEST SCORE {best.toLocaleString()}</div>

        <div className="mt-4 flex items-center justify-center gap-2">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`pixel-font text-[9px] px-4 py-2 border-2 shadow-[3px_3px_0_#000] transition-transform hover:-translate-y-0.5 ${tab === id ? 'bg-red-500 border-red-200 text-white' : 'bg-black/60 border-white/40 text-white/70'}`}>{label}</button>
          ))}
        </div>

        {tab === 'play' && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 max-w-[580px] mx-auto text-left">
              <button onClick={() => game.newRun(false)} className="group border-2 border-red-400/80 bg-black/75 p-3 shadow-[5px_5px_0_#000] transition-transform hover:-translate-y-1">
                <div className="flex items-baseline justify-between"><span className="text-[12px] text-white">CAMPAIGN</span><span className="text-[8px] text-red-400">200 FLOORS</span></div>
                <div className="mt-2 text-[7px] leading-relaxed text-white/60">Procedural floors, a boss every 10 — each drops a reward chest. Weapon finishers, upgrades.</div>
                <div className="mt-2 text-[7px] text-red-300">BEST FLOOR {game.best} · ENTER</div>
              </button>
              <button onClick={() => game.startEndless()} className="group border-2 border-yellow-300 bg-yellow-400 p-3 shadow-[5px_5px_0_#000] transition-transform hover:-translate-y-1">
                <div className="flex items-baseline justify-between"><span className="text-[12px] text-black">∞ ENDLESS</span><span className="text-[8px] text-black/70">SURVIVOR</span></div>
                <div className="mt-2 text-[7px] leading-relaxed text-black/70">Endless hordes, XP levels, weapon finishers — and an enemy IQ that keeps climbing.</div>
                <div className="mt-2 text-[7px] text-black/80">BEST LV {game.eBest.level}{game.eBest.level > 0 ? ` · ${fmtTime(game.eBest.time)}` : ''}</div>
              </button>
            </div>
            {game.checkpoint > 1 && <div className="mt-3"><Btn onClick={() => game.newRun(true)}>CONTINUE CAMPAIGN · FLOOR {game.checkpoint}</Btn></div>}
            <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
              <span className="text-[8px] text-red-300 mr-1">BLOOD FX</span>
              {bloodNames.map((n, i) => (
                <button key={n} onClick={() => game.setBloodMode(i)} className={`pixel-font text-[8px] px-2.5 py-1.5 border-2 shadow-[3px_3px_0_#000] transition-transform hover:-translate-y-0.5 ${game.bloodMode === i ? 'bg-red-500 border-red-200 text-white' : 'bg-black/60 border-white/40 text-white/70'}`}>{n}</button>
              ))}
              <span className="text-[8px] text-cyan-300 mr-1 ml-2">BODY</span>
              {['CHIBI', 'TALL'].map((n, i) => (
                <button key={n} onClick={() => game.setBodyScale(i)} className={`pixel-font text-[8px] px-2.5 py-1.5 border-2 shadow-[3px_3px_0_#000] transition-transform hover:-translate-y-0.5 ${game.bodyScale === i ? 'bg-cyan-500 border-cyan-200 text-black' : 'bg-black/60 border-white/40 text-white/70'}`}>{n}</button>
              ))}
              <Btn onClick={() => setShowHow((v) => !v)}>{showHow ? 'CLOSE MANUAL' : 'TECHNIQUES'}</Btn>
            </div>
            <div className="mt-3 text-[7px] text-white/40">WASD MOVE · MOUSE AIM · B = BLOOD · V = BODY · M = MUTE</div>
            {showHow && (
              <div className="mt-4 mx-auto max-w-[640px] bg-black/85 border-2 border-white/30 p-4 text-left shadow-[6px_6px_0_#000] max-h-[240px] overflow-y-auto">
                <div className="text-[9px] text-yellow-300 mb-3">KUNG FU MANUAL</div>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                  <div className="text-[8px] leading-relaxed"><Key k="WASD" />Move</div>
                  {TECHNIQUES.map((t) => (
                    <div key={t.key} className="text-[8px] leading-relaxed"><Key k={t.key} /><span className="text-white">{t.name}</span><div className="text-white/50 ml-1 mt-0.5 text-[7px]">{t.desc}</div></div>
                  ))}
                </div>
                <div className="mt-3 text-[7px] text-white/60 leading-relaxed">
                  Break an enemy's yellow POSTURE bar with hits & parries → they stagger → press F for a weapon-specific FATALITY that heals you. Every boss drops a CHEST: supplies + a free technique. Boss every 10 floors. Checkpoint every 10 floors.
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'rank' && (
          <div className="mt-4 mx-auto max-w-[520px] bg-black/80 border-2 border-white/30 p-4 text-left shadow-[6px_6px_0_#000]">
            <div className="text-[8px] text-white/50">YOUR RANK</div>
            <div className="text-[20px] text-yellow-300 mt-1" style={{ textShadow: '2px 2px 0 #000' }}>{rk.cur.name}</div>
            <div className="mt-3">
              <div className="flex justify-between text-[7px] text-white/60"><span>BEST SCORE {best.toLocaleString()}</span><span>{rk.next ? `NEXT: ${rk.next.name} @ ${rk.next.min.toLocaleString()}` : 'MAX RANK'}</span></div>
              <div className="mt-1 h-3 border border-white/40 bg-black"><div className="h-full bg-gradient-to-r from-red-500 to-yellow-300" style={{ width: `${Math.round(rk.progress * 100)}%` }} /></div>
            </div>
            <div className="mt-4 space-y-1.5">
              {RANKS.map((r, i) => (
                <div key={r.name} className={`flex justify-between text-[8px] px-2 py-1 ${i === rk.idx ? 'bg-red-500/25 text-white border border-red-400/60' : i < rk.idx ? 'text-white/70' : 'text-white/35'}`}>
                  <span>{r.name}</span><span>{r.min.toLocaleString()}+</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[7px] text-white/50 leading-relaxed">Score comes from damage, kills x floor, combos, parries, deflections, takedowns, chest bonuses and level clears. Die harder.</div>
          </div>
        )}

        {tab === 'skin' && (
          <div className="mt-4 mx-auto max-w-[620px]">
            <div className="grid grid-cols-3 gap-3 text-left">
              {SKINS.map((sk, i) => (
                <button key={sk.name} onClick={() => game.setSkin(i)} className={`border-2 p-3 shadow-[4px_4px_0_#000] transition-transform hover:-translate-y-1 ${game.skinIndex === i ? 'border-yellow-300 bg-black/85' : 'border-white/30 bg-black/60'}`}>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-5 w-5 border-2 border-black" style={{ background: sk.body }} />
                    <span className="inline-block h-2 w-6" style={{ background: sk.band }} />
                  </div>
                  <div className="text-[8px] text-white mt-2 leading-relaxed">{sk.name}</div>
                  <div className="text-[6px] text-white/50 mt-1 leading-relaxed">{sk.note}</div>
                  {game.skinIndex === i && <div className="text-[7px] text-yellow-300 mt-2">EQUIPPED</div>}
                </button>
              ))}
            </div>
            <div className="mt-3 text-[7px] text-white/40">Skins change your fighter's body & headband colors. Pure style, zero stats — as it should be.</div>
          </div>
        )}

        {tab === 'board' && (
          <div className="mt-4 mx-auto max-w-[620px] grid grid-cols-2 gap-3 text-left">
            <ScoreList title="CAMPAIGN" color="#ff5a5a" rows={game.scores.campaign} />
            <ScoreList title="∞ ENDLESS" color="#ffd166" rows={game.scores.endless} />
            <div className="col-span-2 text-center text-[7px] text-white/40">Local legends only — set a score, then beat it.</div>
          </div>
        )}
      </div>
    </Overlay>
  );
}

function ScoreList({ title, color, rows }: { title: string; color: string; rows: { score: number; meta: string; when: number }[] }) {
  return (
    <div className="bg-black/80 border-2 border-white/30 p-3 shadow-[5px_5px_0_#000]">
      <div className="text-[9px] mb-2" style={{ color }}>{title}</div>
      {rows.length === 0 && <div className="text-[7px] text-white/40 leading-relaxed">No runs recorded yet.<br />Go make history.</div>}
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className={`flex items-baseline justify-between text-[8px] px-1.5 py-1 ${i === 0 ? 'bg-white/10 text-white' : 'text-white/70'}`}>
            <span><span style={{ color }}>{i + 1}.</span> {r.score.toLocaleString()}</span>
            <span className="text-[6px] text-white/45">{r.meta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PauseScreen({ game, muted }: { game: Game; muted: boolean }) {
  return (
    <Overlay>
      <div className="text-center">
        <h2 className="text-[22px] mb-2">PAUSED</h2>
        <div className="text-[8px] text-white/60 mb-5">{game.isEndless ? `ENDLESS · LV ${game.level} · ${fmtTime(game.endless.time)} · WAVE ${game.endless.wave}` : `FLOOR ${game.level} · ${game.lvl.biome.name}`} · SCORE {game.score}{muted ? ' · MUTED' : ''}</div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-left max-w-[560px] mx-auto mb-6">
          <div className="text-[8px]"><Key k="WASD" />Move</div>
          {TECHNIQUES.map((t) => <div key={t.key} className="text-[8px]"><Key k={t.key} />{t.name}</div>)}
        </div>
        {game.pickedUpgrades.length > 0 && (
          <div className="text-[7px] text-white/50 mb-5">UPGRADES: {game.pickedUpgrades.map((id) => UPGRADES.find((u) => u.id === id)?.name).join(' · ')}</div>
        )}
        <div className="flex justify-center gap-3 flex-wrap">
          <Btn primary onClick={() => game.resume()}>RESUME (ESC)</Btn>
          <Btn onClick={() => game.cycleBlood()}>BLOOD: {['NORMAL', 'PARTIKEL', 'KOMBINASI'][game.bloodMode]}</Btn>
          <Btn onClick={() => { game.setPhase('title'); }}>QUIT TO TITLE</Btn>
        </div>
      </div>
    </Overlay>
  );
}

function UpgradeScreen({ game, accent }: { game: Game; accent: string }) {
  return (
    <Overlay>
      <div className="text-center">
        <div className="text-[8px] text-white/60 mb-1">{game.chestReward ? 'BOSS CHEST OPENED' : game.isEndless ? `LEVEL ${game.level} REACHED · ${fmtTime(game.endless.time)} · WAVE ${game.endless.wave}` : `FLOOR ${game.level - 1} CLEARED`}</div>
        <h2 className="text-[18px] mb-5" style={{ color: accent }}>{game.chestReward ? 'CHOOSE YOUR REWARD' : 'CHOOSE A TECHNIQUE'}</h2>
        <div className="grid grid-cols-3 gap-3">
          {game.upgradeChoices.map((u, i) => (
            <button key={u.id} onClick={() => game.pickUpgrade(u)}
              className="group bg-black/80 border-2 border-white/40 hover:border-white p-4 text-left shadow-[5px_5px_0_#000] transition-all hover:-translate-y-1 hover:shadow-[7px_7px_0_#000]"
              style={{ ['--acc' as any]: accent }}>
              <div className="text-[28px] leading-none mb-3 group-hover:scale-110 transition-transform origin-left" style={{ color: accent }}>{u.icon}</div>
              <div className="text-[9px] text-white mb-2">{u.name}</div>
              <div className="text-[7px] text-white/60 leading-relaxed">{u.desc}</div>
              <div className="text-[7px] text-yellow-300 mt-3">[{i + 1}]</div>
            </button>
          ))}
        </div>
      </div>
    </Overlay>
  );
}

function DeathScreen({ game }: { game: Game }) {
  return (
    <Overlay>
      <div className="text-center">
        <h2 className="text-[30px] text-red-500 drop-shadow-[3px_3px_0_#000] mb-2">YOU DIED</h2>
        {game.lastRunNewBest && <div className="text-[10px] text-yellow-300 mb-1 animate-pulse">★ NEW BEST SCORE! ★</div>}
        <div className="text-[8px] text-white/70 mb-1">SCORE {game.score.toLocaleString()} · RANK {rankFor(game.bestScore()).cur.name}</div>
        {game.isEndless ? (
          <>
            <div className="text-[8px] text-white/60 mb-5">SLAIN BY {game.deathCause.toUpperCase()} · SURVIVED {fmtTime(game.endless.time)}</div>
            <div className="grid grid-cols-3 gap-4 max-w-[420px] mx-auto mb-6 text-[8px]">
              <Stat label="LEVEL" v={`${game.level}`} /><Stat label="WAVE" v={`${game.endless.wave}`} /><Stat label="KILLS" v={`${game.kills}`} />
              <Stat label="SCORE" v={`${game.score}`} /><Stat label="MAX COMBO" v={`${game.maxCombo}`} /><Stat label="BEST LV / TIME" v={`${game.eBest.level} / ${fmtTime(game.eBest.time)}`} />
            </div>
            <div className="flex justify-center gap-3 flex-wrap">
              <Btn gold onClick={() => game.startEndless()}>AGAIN (ENTER)</Btn>
              <Btn onClick={() => game.setPhase('title')}>TITLE</Btn>
            </div>
          </>
        ) : (
          <>
            <div className="text-[8px] text-white/60 mb-5">SLAIN BY {game.deathCause.toUpperCase()} ON FLOOR {game.level}</div>
            <div className="grid grid-cols-3 gap-4 max-w-[420px] mx-auto mb-6 text-[8px]">
              <Stat label="FLOOR" v={`${game.level}`} /><Stat label="KILLS" v={`${game.kills}`} /><Stat label="MAX COMBO" v={`${game.maxCombo}`} />
              <Stat label="SCORE" v={`${game.score}`} /><Stat label="BEST" v={`${game.best}`} /><Stat label="CHECKPOINT" v={`${game.checkpoint}`} />
            </div>
            <div className="flex justify-center gap-3 flex-wrap">
              <Btn primary onClick={() => game.newRun(true)}>RETRY FROM LV {game.checkpoint} (ENTER)</Btn>
              <Btn onClick={() => game.newRun(false)}>FRESH RUN</Btn>
              <Btn onClick={() => game.setPhase('title')}>TITLE</Btn>
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}

function WinScreen({ game }: { game: Game }) {
  return (
    <Overlay>
      <div className="text-center">
        <div className="text-[9px] text-yellow-300 mb-2">ALL {MAX_LEVEL} FLOORS CONQUERED</div>
        <h2 className="text-[28px] text-white drop-shadow-[4px_4px_0_#ff3b3b] mb-4">YOU ARE THE THRONE</h2>
        <div className="grid grid-cols-3 gap-4 max-w-[420px] mx-auto mb-6 text-[8px]">
          <Stat label="KILLS" v={`${game.kills}`} /><Stat label="MAX COMBO" v={`${game.maxCombo}`} /><Stat label="SCORE" v={`${game.score}`} />
        </div>
        <Btn primary onClick={() => game.newRun(false)}>NEW GAME +</Btn>
      </div>
    </Overlay>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return <div className="bg-black/60 border border-white/20 p-2"><div className="text-[6px] text-white/50">{label}</div><div className="text-[11px] text-white mt-1">{v}</div></div>;
}
