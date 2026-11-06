/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  ChevronLeft, 
  ChevronRight, 
  Gamepad2, 
  Flame, 
  Maximize2, 
  HelpCircle,
  LayoutGrid,
  Columns,
  Sparkles,
  Info
} from 'lucide-react';

interface GameInfo {
  id: string;
  title: string;
  subtitle: string;
  version: string;
  htmlPath: string;
  themeColor: string;
  accentBg: string;
  borderGlow: string;
  badgeColor: string;
  description: string;
  /** key that fires this game's FOCUS / super strike (game1 = C, game2 = E) */
  focusKey: string;
  controls: {
    move: string;
    attack: string;
    special: string;
    pause: string;
  };
}

const GAMES: GameInfo[] = [
  {
    id: 'game1',
    title: 'STICK FIST',
    subtitle: 'Throne of the Drifter',
    version: 'v1.0 • 200 Floors',
    htmlPath: '/game1.html',
    themeColor: '#ff3b3b',
    focusKey: 'KeyC',
    accentBg: 'from-rose-600 to-red-950',
    borderGlow: 'border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.45)] ring-2 ring-red-500/50',
    badgeColor: 'bg-red-500/20 text-red-400 border-red-500/40',
    description: 'Fast-paced martial arts roguelite stick brawl. Combo enemies, deflect blades, and climb 200 floors.',
    controls: {
      move: 'W A S D / Panah · Spasi = Lompat',
      attack: 'Klik Kiri / J (tahan = Charge Palm)',
      special: 'C = Focus Strike · R = Rage · X = OFA · K = Parry',
      pause: 'Esc / P'
    }
  },
  {
    id: 'game2',
    title: 'KUNGFU DRIFTER',
    subtitle: '200 Floors of Pain',
    version: 'v2.0 • Survival & Story',
    htmlPath: '/game2.html',
    themeColor: '#38bdf8',
    focusKey: 'KeyE',
    accentBg: 'from-cyan-600 to-sky-950',
    borderGlow: 'border-cyan-400 shadow-[0_0_40px_rgba(56,189,248,0.45)] ring-2 ring-cyan-400/50',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    description: 'Weapon mastery with katana & nunchaku, mutations, age mechanic, and hardcore martial arts survival.',
    controls: {
      move: 'W A S D / Tombol Panah',
      attack: 'Klik Kiri / J',
      special: 'X = One For All · E = Focus · R = Rage · F = Fatality · V = V1/V2',
      pause: 'Esc / P'
    }
  }
];

export default function App() {
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'carousel' | 'side-by-side'>('carousel');
  const [mutedStates, setMutedStates] = useState<{ [key: string]: boolean }>({
    game1: false,
    game2: false
  });
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [showVirtualPad, setShowVirtualPad] = useState<boolean>(false);
  const [pressedBtn, setPressedBtn] = useState<string | null>(null);

  const iframe1Ref = useRef<HTMLIFrameElement>(null);
  const iframe2Ref = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getActiveIframe = useCallback(() => {
    return activeSlide === 0 ? iframe1Ref.current : iframe2Ref.current;
  }, [activeSlide]);

  // Activate slide and focus the corresponding iframe
  const handleSelectSlide = (index: number) => {
    if (activeSlide === index) {
      // Re-focus current iframe
      const activeIframe = index === 0 ? iframe1Ref.current : iframe2Ref.current;
      activeIframe?.contentWindow?.focus();
      return;
    }

    // Pause the previously active game
    const prevIframe = activeSlide === 0 ? iframe1Ref.current : iframe2Ref.current;
    prevIframe?.contentWindow?.postMessage({ type: 'KF_ACTION', action: 'pause' }, '*');

    setActiveSlide(index);

    // Focus the newly active iframe
    setTimeout(() => {
      const newIframe = index === 0 ? iframe1Ref.current : iframe2Ref.current;
      newIframe?.contentWindow?.focus();
    }, 120);
  };

  // Send virtual key events to active iframe
  const sendKey = (code: string, isDown: boolean, key = '') => {
    const iframe = getActiveIframe();
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage({
      type: isDown ? 'KF_KEYDOWN' : 'KF_KEYUP',
      code,
      key
    }, '*');
  };

  // Send a real MOUSE button to the active iframe. Both games bind their strike to the LEFT mouse
  // button (in game 1 SPACE is JUMP, in game 2 SPACE is not an attack at all), so a key-only bridge
  // made the on-screen PUKUL button hop instead of punching.
  const sendMouse = (button: number, isDown: boolean) => {
    const iframe = getActiveIframe();
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage({
      type: isDown ? 'KF_MOUSEDOWN' : 'KF_MOUSEUP',
      button
    }, '*');
  };

  const sendAction = (action: 'start' | 'pause' | 'restart') => {
    const iframe = getActiveIframe();
    iframe?.contentWindow?.postMessage({
      type: 'KF_ACTION',
      action
    }, '*');
    iframe?.contentWindow?.focus();
  };

  const toggleMute = (gameId: string) => {
    const next = !mutedStates[gameId];
    setMutedStates(prev => ({ ...prev, [gameId]: next }));
    const targetIframe = gameId === 'game1' ? iframe1Ref.current : iframe2Ref.current;
    targetIframe?.contentWindow?.postMessage({
      type: 'KF_KEYDOWN',
      code: 'KeyM'
    }, '*');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-[#07070a] text-zinc-100 flex flex-col justify-between selection:bg-rose-500 selection:text-white relative overflow-x-hidden"
    >
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none opacity-25">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-red-600 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 bg-cyan-600 rounded-full blur-[150px]" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-violet-600 rounded-full blur-[160px]" />
      </div>

      {/* Top Header & Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Game Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 via-orange-500 to-cyan-500 p-[1.5px] shadow-lg shadow-red-500/20 shrink-0">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-red-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base tracking-wider pixel-font text-white flex items-center gap-1.5">
                  STICK FIST <span className="text-zinc-500 font-normal">VS</span> KUNGFU
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  16:9 Widescreen
                </span>
              </div>
              <p className="text-xs text-zinc-400">Pilih slide untuk bermain • Rasio 16:9 Pas & Tanpa Crop</p>
            </div>
          </div>

          {/* Quick Slide Switcher Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-zinc-900/90 p-1.5 rounded-xl border border-zinc-800">
              {GAMES.map((game, idx) => {
                const isActive = activeSlide === idx;
                return (
                  <button
                    key={game.id}
                    onClick={() => handleSelectSlide(idx)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? idx === 0 
                          ? 'bg-red-600 text-white shadow-md shadow-red-600/30 scale-102'
                          : 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 scale-102'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-zinc-600'}`} />
                    <span className="hidden sm:inline font-mono">Slide {idx + 1}:</span>
                    <span>{game.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Layout view toggle (Carousel single slide vs Side-by-side dual slide) */}
            <div className="hidden lg:flex items-center bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => setViewMode('carousel')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === 'carousel' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                }`}
                title="Mode Slide Fokus (1 per layar)"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('side-by-side')}
                className={`p-1.5 rounded-lg text-xs transition-colors ${
                  viewMode === 'side-by-side' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                }`}
                title="Mode Berjejer (Keduanya berdampingan)"
              >
                <Columns className="w-4 h-4" />
              </button>
            </div>

            {/* Virtual Pad Toggle */}
            <button
              onClick={() => setShowVirtualPad(!showVirtualPad)}
              className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-colors ${
                showVirtualPad 
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white'
              }`}
              title="Tombol Arkade Virtual On-Screen"
            >
              <Gamepad2 className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline font-medium">Gamepad</span>
            </button>

            {/* Guide modal button */}
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
              title="Panduan Kontrol"
            >
              <HelpCircle className="w-4 h-4 text-zinc-400" />
              <span className="hidden md:inline font-medium">Bantuan</span>
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs transition-colors"
              title="Layar Penuh"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Control Help Drawer */}
      {showGuide && (
        <div className="relative z-30 max-w-4xl mx-auto w-full px-4 pt-3">
          <div className="bg-zinc-900/95 border border-amber-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs sm:text-sm pixel-font">
                <Info className="w-4 h-4" />
                PANDUAN KONTROL ARKADE 16:9
              </div>
              <button 
                onClick={() => setShowGuide(false)}
                className="text-zinc-400 hover:text-white text-xs bg-zinc-800 px-2 py-1 rounded"
              >
                Tutup ✕
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 text-xs text-zinc-300">
              <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                <div className="font-bold text-red-400 mb-1.5 pixel-font text-[11px]">🎮 Game 1: STICK FIST</div>
                <ul className="space-y-1 font-mono text-[11px] text-zinc-300">
                  <li>• <span className="text-white font-semibold">W / A / S / D</span> : Gerak & Loncat</li>
                  <li>• <span className="text-white font-semibold">Klik Kiri / Spasi</span> : Serangan Pukulan</li>
                  <li>• <span className="text-white font-semibold">Klik Kanan / Shift</span> : Tendangan / Tangkis</li>
                  <li>• <span className="text-white font-semibold">Esc / P</span> : Jeda (Pause)</li>
                </ul>
              </div>
              <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                <div className="font-bold text-cyan-400 mb-1.5 pixel-font text-[11px]">⚔️ Game 2: KUNGFU DRIFTER</div>
                <ul className="space-y-1 font-mono text-[11px] text-zinc-300">
                  <li>• <span className="text-white font-semibold">W / A / S / D</span> : Gerak & Loncat</li>
                  <li>• <span className="text-white font-semibold">Klik Kiri / Spasi</span> : Kombo Pedang & Pukul</li>
                  <li>• <span className="text-white font-semibold">Shift / Q / E</span> : Jurus Khusus & Hindar</li>
                  <li>• <span className="text-white font-semibold">Angka 1 / 2 / 3</span> : Pilih Mutasi Senjata</li>
                </ul>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2 text-center">
              💡 <em>Klik pada slide mana saja untuk langsung memainkannya secara bergantian!</em>
            </p>
          </div>
        </div>
      )}

      {/* Main Slide Presentation Area */}
      <main className="flex-1 flex flex-col items-center justify-center py-4 px-2 sm:px-6">
        {/* Navigation Bar between Slides */}
        <div className="w-full max-w-6xl flex items-center justify-between mb-3 px-1">
          <button
            onClick={() => handleSelectSlide(activeSlide === 0 ? 1 : 0)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-all shadow-md active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Slide Sebelumnya</span>
          </button>

          {/* Slide Indicator & Title Badge */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold font-mono text-zinc-400 bg-zinc-900/90 px-3 py-1 rounded-full border border-zinc-800">
              SLIDE {activeSlide + 1} DARI {GAMES.length} : {GAMES[activeSlide].title}
            </span>
            <div className="flex items-center gap-2">
              {GAMES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectSlide(i)}
                  className={`transition-all duration-300 rounded-full ${
                    activeSlide === i 
                      ? 'w-8 h-2.5 bg-gradient-to-r from-red-500 to-cyan-400 shadow-md' 
                      : 'w-2.5 h-2.5 bg-zinc-700 hover:bg-zinc-500'
                  }`}
                  title={`Pindah ke Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <button
            onClick={() => handleSelectSlide(activeSlide === 0 ? 1 : 0)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-all shadow-md active:scale-95"
          >
            <span className="hidden sm:inline">Slide Selanjutnya</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* =========================================================================
            SLIDE CONTAINERS: STRICT 16:9 RATIO (aspect-video)
            Zero cropping! The 480x270 native canvas fits 100% perfectly into 16:9.
           ========================================================================= */}
        <div className={`w-full max-w-6xl transition-all duration-500 ${
          viewMode === 'side-by-side' 
            ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' 
            : 'flex flex-col items-center justify-center'
        }`}>
          {GAMES.map((game, index) => {
            const isActive = activeSlide === index;
            const iframeRef = index === 0 ? iframe1Ref : iframe2Ref;

            // In carousel mode, hide non-active slide on mobile/desktop or position it
            const shouldRender = viewMode === 'side-by-side' || isActive;

            if (!shouldRender) return null;

            return (
              <div
                key={game.id}
                onClick={() => {
                  if (!isActive) handleSelectSlide(index);
                }}
                className={`w-full transition-all duration-300 cursor-pointer flex flex-col items-center relative ${
                  viewMode === 'carousel' ? 'max-w-5xl' : ''
                }`}
              >
                {/* Header Information Bar above 16:9 screen */}
                <div className="w-full flex items-center justify-between px-2 py-1.5 bg-zinc-900/90 rounded-t-2xl border border-b-0 border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${game.badgeColor} uppercase tracking-wider`}>
                      SLIDE {index + 1} • 16:9
                    </span>
                    <span className="text-xs font-bold text-white pixel-font">
                      {game.title}
                    </span>
                    <span className="hidden sm:inline text-xs text-zinc-500">
                      — {game.subtitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Active State Badge */}
                    {isActive ? (
                      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        GAME AKTIF
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400 font-mono bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                        PENCET UNTUK JALAN
                      </span>
                    )}

                    {/* Mute and Restart actions for this slide */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute(game.id);
                      }}
                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                      title={mutedStates[game.id] ? "Unmute" : "Mute"}
                    >
                      {mutedStates[game.id] ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sendAction('restart');
                      }}
                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                      title="Restart Game"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* THE 16:9 SCREEN FRAME (aspect-video) */}
                <div 
                  className={`w-full aspect-video rounded-b-2xl bg-black border-2 border-t-0 overflow-hidden relative shadow-2xl transition-all duration-300 ${
                    isActive ? game.borderGlow : 'border-zinc-800 opacity-60 hover:opacity-85'
                  }`}
                >
                  {/* Standalone Game Iframe - 100% 16:9 Fit Without Any Cropping */}
                  <iframe
                    ref={iframeRef}
                    src={game.htmlPath}
                    title={game.title}
                    className="w-full h-full block border-0 select-none bg-black"
                    tabIndex={isActive ? 0 : -1}
                    style={{
                      imageRendering: 'pixelated'
                    }}
                  />

                  {/* Subtle Scanline CRT Overlay */}
                  <div 
                    className="pointer-events-none absolute inset-0 opacity-[0.06]"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.8) 0px, rgba(0,0,0,0.8) 1px, transparent 2px, transparent 3px)'
                    }}
                  />

                  {/* INACTIVE SLIDE OVERLAY (JIKA SLIDE BELUM DIPENCET) */}
                  {!isActive && (
                    <div 
                      className="absolute inset-0 bg-black/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center select-none transition-all group"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-zinc-800 to-zinc-700 border border-zinc-500 flex items-center justify-center shadow-2xl mb-3 group-hover:scale-110 transition-transform">
                        <Play className="w-8 h-8 text-white fill-white ml-1" />
                      </div>
                      <div className="pixel-font text-xs sm:text-sm text-white font-bold tracking-wider">
                        PENCET SLIDE UNTUK MEMULAI
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                        Klik di sini untuk mengaktifkan game ini dan memainkannya dalam rasio 16:9
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick description & Controls Bar below 16:9 screen */}
                <div className="w-full flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 px-3 py-2 mt-1 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-300">Kontrol:</span>
                    <span className="font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 text-[11px] text-zinc-300">
                      {game.controls.move} | {game.controls.attack} | {game.controls.special}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    Resolusi Native: 480×270 (16:9 Sempurna)
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Thumbnail Selector at Bottom when in Carousel Mode */}
        {viewMode === 'carousel' && (
          <div className="flex items-center justify-center gap-3 mt-4">
            {GAMES.map((game, idx) => {
              const isActive = activeSlide === idx;
              return (
                <button
                  key={game.id}
                  onClick={() => handleSelectSlide(idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-zinc-800 border-zinc-600 text-white shadow-md'
                      : 'bg-zinc-950/80 border-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                  <span className="font-bold">Slide {idx + 1}:</span>
                  <span>{game.title}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Optional Virtual Touch/Mouse Arcade Controller Dock */}
        {showVirtualPad && (
          <div className="w-full max-w-xl mx-auto mt-4 bg-zinc-950/95 border border-zinc-800 rounded-2xl p-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-2 border-b border-zinc-800/60 pb-1">
              <span>GAMEPAD VIRTUAL UNTUK SLIDE AKTIF: {GAMES[activeSlide].title}</span>
              <button 
                onClick={() => setShowVirtualPad(false)}
                className="text-zinc-500 hover:text-white"
              >
                Sembunyikan ✕
              </button>
            </div>
            
            <div className="flex items-center justify-between gap-4 px-2">
              {/* D-Pad 4-way */}
              <div className="relative w-24 h-24 bg-zinc-900 rounded-xl p-1 border border-zinc-800 flex flex-col items-center justify-center shadow-inner">
                {/* UP */}
                <button
                  onMouseDown={() => { sendKey('KeyW', true, 'w'); setPressedBtn('w'); }}
                  onMouseUp={() => { sendKey('KeyW', false, 'w'); setPressedBtn(null); }}
                  onTouchStart={(e) => { e.preventDefault(); sendKey('KeyW', true, 'w'); setPressedBtn('w'); }}
                  onTouchEnd={(e) => { e.preventDefault(); sendKey('KeyW', false, 'w'); setPressedBtn(null); }}
                  className={`w-7 h-7 rounded-md text-[10px] font-bold flex items-center justify-center transition-all ${
                    pressedBtn === 'w' ? 'bg-red-500 text-white scale-95 shadow-md shadow-red-500/40' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  ▲
                </button>
                {/* MID ROW */}
                <div className="flex items-center gap-1 my-1">
                  <button
                    onMouseDown={() => { sendKey('KeyA', true, 'a'); setPressedBtn('a'); }}
                    onMouseUp={() => { sendKey('KeyA', false, 'a'); setPressedBtn(null); }}
                    onTouchStart={(e) => { e.preventDefault(); sendKey('KeyA', true, 'a'); setPressedBtn('a'); }}
                    onTouchEnd={(e) => { e.preventDefault(); sendKey('KeyA', false, 'a'); setPressedBtn(null); }}
                    className={`w-7 h-7 rounded-md text-[10px] font-bold flex items-center justify-center transition-all ${
                      pressedBtn === 'a' ? 'bg-red-500 text-white scale-95 shadow-md shadow-red-500/40' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    ◀
                  </button>
                  <div className="w-5 h-5 rounded-full bg-zinc-950 border border-zinc-700" />
                  <button
                    onMouseDown={() => { sendKey('KeyD', true, 'd'); setPressedBtn('d'); }}
                    onMouseUp={() => { sendKey('KeyD', false, 'd'); setPressedBtn(null); }}
                    onTouchStart={(e) => { e.preventDefault(); sendKey('KeyD', true, 'd'); setPressedBtn('d'); }}
                    onTouchEnd={(e) => { e.preventDefault(); sendKey('KeyD', false, 'd'); setPressedBtn(null); }}
                    className={`w-7 h-7 rounded-md text-[10px] font-bold flex items-center justify-center transition-all ${
                      pressedBtn === 'd' ? 'bg-red-500 text-white scale-95 shadow-md shadow-red-500/40' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    ▶
                  </button>
                </div>
                {/* DOWN */}
                <button
                  onMouseDown={() => { sendKey('KeyS', true, 's'); setPressedBtn('s'); }}
                  onMouseUp={() => { sendKey('KeyS', false, 's'); setPressedBtn(null); }}
                  onTouchStart={(e) => { e.preventDefault(); sendKey('KeyS', true, 's'); setPressedBtn('s'); }}
                  onTouchEnd={(e) => { e.preventDefault(); sendKey('KeyS', false, 's'); setPressedBtn(null); }}
                  className={`w-7 h-7 rounded-md text-[10px] font-bold flex items-center justify-center transition-all ${
                    pressedBtn === 's' ? 'bg-red-500 text-white scale-95 shadow-md shadow-red-500/40' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  }`}
                >
                  ▼
                </button>
              </div>

              {/* Start & Pause Buttons */}
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => sendAction('start')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold tracking-wider text-amber-300 border border-amber-500/30 uppercase active:scale-95 transition-all"
                >
                  START / ENTER
                </button>
                <button
                  onClick={() => sendAction('pause')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold tracking-wider text-zinc-300 border border-zinc-700 uppercase active:scale-95 transition-all"
                >
                  PAUSE / ESC
                </button>
              </div>

              {/* Action Buttons A & B */}
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center gap-1">
                  <button
                    onMouseDown={() => { sendMouse(0, true); setPressedBtn('punch'); }}
                    onMouseUp={() => { sendMouse(0, false); setPressedBtn(null); }}
                    onTouchStart={(e) => { e.preventDefault(); sendMouse(0, true); setPressedBtn('punch'); }}
                    onTouchEnd={(e) => { e.preventDefault(); sendMouse(0, false); setPressedBtn(null); }}
                    className={`w-11 h-11 rounded-full font-bold text-xs flex items-center justify-center shadow-lg transition-transform ${
                      pressedBtn === 'punch'
                        ? 'bg-rose-600 text-white scale-90 ring-2 ring-rose-400'
                        : 'bg-gradient-to-b from-rose-500 to-red-700 text-white hover:brightness-110 active:scale-95 shadow-red-900/50'
                    }`}
                  >
                    A
                  </button>
                  <span className="text-[9px] font-mono text-zinc-400">PUKUL</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    onMouseDown={() => { sendKey('ShiftLeft', true, 'shift'); setPressedBtn('kick'); }}
                    onMouseUp={() => { sendKey('ShiftLeft', false, 'shift'); setPressedBtn(null); }}
                    onTouchStart={(e) => { e.preventDefault(); sendKey('ShiftLeft', true, 'shift'); setPressedBtn('kick'); }}
                    onTouchEnd={(e) => { e.preventDefault(); sendKey('ShiftLeft', false, 'shift'); setPressedBtn(null); }}
                    className={`w-11 h-11 rounded-full font-bold text-xs flex items-center justify-center shadow-lg transition-transform ${
                      pressedBtn === 'kick'
                        ? 'bg-cyan-600 text-white scale-90 ring-2 ring-cyan-400'
                        : 'bg-gradient-to-b from-cyan-500 to-blue-700 text-white hover:brightness-110 active:scale-95 shadow-cyan-900/50'
                    }`}
                  >
                    B
                  </button>
                  <span className="text-[9px] font-mono text-zinc-400">JURUS</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    onMouseDown={() => { sendKey(GAMES[activeSlide].focusKey, true); setPressedBtn('focus'); }}
                    onMouseUp={() => { sendKey(GAMES[activeSlide].focusKey, false); setPressedBtn(null); }}
                    onTouchStart={(e) => { e.preventDefault(); sendKey(GAMES[activeSlide].focusKey, true); setPressedBtn('focus'); }}
                    onTouchEnd={(e) => { e.preventDefault(); sendKey(GAMES[activeSlide].focusKey, false); setPressedBtn(null); }}
                    className={`w-11 h-11 rounded-full font-bold text-xs flex items-center justify-center shadow-lg transition-transform ${
                      pressedBtn === 'focus'
                        ? 'bg-amber-500 text-black scale-90 ring-2 ring-amber-300'
                        : 'bg-gradient-to-b from-amber-400 to-orange-600 text-black hover:brightness-110 active:scale-95 shadow-amber-900/50'
                    }`}
                  >
                    C
                  </button>
                  <span className="text-[9px] font-mono text-amber-400">FOKUS</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* App Bottom Footer */}
      <footer className="w-full py-3.5 border-t border-zinc-800/60 bg-zinc-950/80 text-center text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 px-4">
        <span className="flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-red-500 inline" />
          Arcade Stick Kung Fu Drifter Edition
        </span>
        <span className="hidden sm:inline text-zinc-700">•</span>
        <span>Rasio 16:9 Widescreen Pas & Tanpa Crop</span>
        <span className="hidden sm:inline text-zinc-700">•</span>
        <span>Pencet slide mana saja untuk langsung memainkannya</span>
      </footer>
    </div>
  );
}
