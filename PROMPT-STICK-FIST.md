# PROMPT REKONSTRUKSI — "STICK FIST" (Roguelite Kungfu Stickman)

Dokumen ini berisi prompt siap-copy untuk menyuruh AI membuat project baru yang setara
dengan game **STICK FIST — Throne of the Drifter** yang ada di repo ini.
Semua angka, tabel stat, dan nama sistem di bawah **diekstrak langsung dari source code**
(`src/game1/game/data.ts`, `level.ts`, `game.ts`, `render.ts`, `audio.ts`, `App.tsx`),
jadi hasilnya tidak akan "kira-kira".

---

## CARA PAKAI

1. Copy **BAGIAN A** (Prompt Utama) ke AI coding mana pun → itu sudah cukup untuk kerangka + sistem inti.
2. Kalau modelnya kehabisan konteks / hasilnya kurang dalam, pecah per **milestone** (ada di akhir Bagian A) dan kirim satu-satu.
3. Kalau cuma butuh 1 paragraf (buat model kecil / buat ide awal), pakai **BAGIAN B** (Prompt Pendek).
4. Setelah jadi, pakai **BAGIAN C** (Prompt Iterasi) buat naikin game feel.

> Kunci kenapa prompt ini works: **angka konkret** (bukan "musuh cukup kuat"), **tabel data**
> (bukan deskripsi), **pemisahan sim/render**, dan **acceptance criteria** yang bisa dites.

---
---

# BAGIAN A — PROMPT UTAMA (copy dari sini)

Kamu adalah senior game developer. Bangun satu game browser **self-contained, tanpa aset eksternal
sama sekali** (tanpa file gambar, tanpa file audio, tanpa sprite sheet, tanpa font file — semua
digambar prosedural ke Canvas 2D dan semua suara disintesis WebAudio). Nama game: **STICK FIST —
Throne of the Drifter**.

Genre: **top-down roguelite martial-arts brawler stickman**, gaya *Nuclear Throne* + *Downwell* +
*Mortal Kombat* + *Vampire Survivors*. Cepat, brutal, "juicy", dan dalam secara mekanik.

## A0. Tech stack & struktur file

- **Vite + React 19 + TypeScript (strict) + Tailwind CSS 4**, canvas 2D untuk game.
- Pemisahan tegas: **simulasi headless** (kelas `Game`, tidak menyentuh DOM) ↔ **render** (fungsi
  murni `(ctx, game, realTime) => void`) ↔ **shell React** (overlay menu + input + scaling).
- Struktur:

```
index.html
src/main.tsx            # createRoot + StrictMode
src/index.css           # @import "tailwindcss"; html/body/#root full-screen, bg #000, overflow hidden
src/App.tsx             # shell: canvas, scaling, input, overlay screens, postMessage bridge
src/game/data.ts        # SEMUA konstanta, tabel stat, palet, tipe
src/game/level.ts       # seeded RNG + generator dungeon + generator arena
src/game/game.ts        # kelas Game: seluruh logika simulasi (terbesar)
src/game/render.ts      # seluruh penggambaran: tile, stickman, partikel, HUD
src/game/audio.ts       # synth SFX WebAudio
```

- `Game` punya callback `onChange?: () => void` yang dipanggil (`notify()`) tiap state yang dibaca
  React berubah (phase, skor, skin, dll) — **jangan** pakai React state untuk loop game.
- Loop: `requestAnimationFrame`, `dt = Math.min(0.1, (now - last) / 1000)`, lalu `game.update(dt)`
  dan `render(ctx, game, rt)`.

## A1. Konstanta inti (`data.ts`)

```ts
export const VW = 480;        // lebar virtual canvas (logika selalu di ruang ini)
export const VH = 270;        // tinggi virtual canvas
export const TILE = 16;       // ukuran tile dungeon
export const MAX_LEVEL = 200; // panjang kampanye
```

Canvas digambar pada 480×270 lalu **di-scale integer/float ke layar** dengan
`scale = Math.min(window.innerWidth / 480, window.innerHeight / 270)`,
`imageRendering: 'pixelated'`, `ctx.imageSmoothingEnabled = false`.
Tambahkan overlay **scanlines** CSS:
`repeating-linear-gradient(to bottom, transparent 0 2px, rgba(0,0,0,.12) 3px)`, `mix-blend-mode: multiply`, `opacity: .6`.
Font pixel: `'Press Start 2P', monospace` (boleh fallback monospace kalau offline).

## A2. Fase game

```ts
type Phase = 'title' | 'playing' | 'upgrade' | 'dead' | 'win' | 'paused' | 'transition';
```

- `transition` = jeda antar-lantai (~1.0 detik, level baru di-load pada t=0.5).
- `upgrade` = layar pilih 1 dari 3 upgrade.
- Blur window / kehilangan fokus → auto `paused`, dan **bersihkan** semua `keys` + `mouse.down`.

## A3. Pemain (state machine)

```ts
type PState = 'idle' | 'attack' | 'dash' | 'parry' | 'block' | 'stun' | 'kick' | 'sweep'
  | 'takedown' | 'tkdkick' | 'airkick' | 'nunrush' | 'iaidash' | 'axerush' | 'bladerush'
  | 'flurry' | 'ragecharge' | 'ofapose' | 'vault' | 'lancerush' | 'slasherdash';
```

Stat awal: `r = 4.5`, `hp = mods.maxHp (100)`, `focus = 1` (maks 3), `weapon = 0`,
`ammoP = 24`, `ammoR = 40`, `z/vz` untuk lompat (ketinggian visual + bisa melewati peluru).

**Gerak & sprint**
- Kecepatan dasar `92 * mods.moveSpeed` px/detik.
- **Tahan WASD** untuk membangun sprint: `sprint` naik `dt / 1.2` sampai 1.0 → kecepatan
  `speed * (1 + 2 * sprint)` = **maks 3×**. Lepas tombol → sprint reset ke 0.
  Ada *grace* 0.3 detik: kalau sprint ≥ 0.85, momentum disimpan sebentar setelah tap.
- Saat sprint penuh, munculkan partikel asap/debu di belakang dan teks feed `FULL SPRINT x3`.
- `SHIFT` = **Shadow Step** (dash): cooldown `0.55 * mods.dashCd`, i-frames `0.25` detik,
  arah = arah gerak (kalau diam, arah hadap).
- `SPACE` = **Jump** (naikkan `z`, lalu `vz` gravity). Di udara tekan LMB = **Air Kick**
  (diving kick, bisa *bounce* ke musuh lain dan juggle musuh yang terlempar).
- `LMB` saat dash = **DASH STRIKE** (lunge ×1.9, dmg ×1.3, knockback ×1.4).

**Parry / Block**
- **Tahan RMB** = guard. Serangan musuh yang masuk pada `0.22 * mods.parryWindow` detik pertama
  = **PERFECT PARRY**: musuh stun, pemain dapat `focus +0.5`, membuka **Riposte**
  (`riposteT = 0.7` detik; LMB berikutnya = counter mematikan ke target itu), plus
  hitstop 0.1, slow-mo 0.22, shake 5, zoom 1.12, flash putih 0.25.
- Ditahan lebih lama = **BLOCK** biasa (damage direduksi, `guard` meter naik; guard penuh bisa
  membuat pemain stagger).
- Parry juga **men-deflect peluru** → peluru berbalik jadi milik pemain
  (`deflected = true`, damage × `mods.deflectDmg`).
- Musuh tertentu bisa mem-parry balik pemain (lihat A5: `samurai`, dan `boss`).

**Focus / Rage / One For All (3 meter khusus)**
- `FOCUS` (0–3, digambar sebagai 3 pip belah ketupat): `Q` = **Flying Kick**
  (1 focus, menembus beberapa musuh, membanting mereka ke dinding → bonus damage
  `wallSlam`), `E` = **Leg Sweep** (1 focus, mematahkan posture semua musuh di sekitar,
  i-frames 0.35).
- `RAGE` (0–100, naik saat kena hit & saat perfect parry): di **≥ 60** tekan `R` →
  **RAGE MODE**: setiap LMB **teleport** ke musuh terdekat dan menghujani pukulan (state `flurry`).
- `ONE FOR ALL` (0–100, charge naik dari kill/combo): di **≥ 25** tekan `X` → pose dramatis
  (`ofapose`), lalu ~12 detik **slow-mo global** (`timeScale → 0.3`), pemain bergerak **4×**
  dan dapat **AUTO-LOCK** musuh terdekat; begitu target mati, lock **melompat** ke musuh
  berikutnya. Zoom `0.94`, meter berkedip cyan `#57e6ff`.
- **CHAIN PUNCH (Wing Chun)** — khusus FISTS: klik LMB berirama tiap **0.1–0.4 detik**
  (deteksi dari 2 interval klik terakhir) → masuk `chainMode`, pakai serangan
  `CHAIN { dmg 4.5, range 26, arc 2.0, dur 0.105, lunge 110, kb 45, posture 7 }`
  beruntun tanpa henti. Hit terakhir = **CHAIN FINISHER** (slow-mo 0.28, zoom 1.18).
- **Tahan LMB** → `chargeT`; lepas = **CHARGE PALM** (ledakan telapak, knockback besar).
  Selama charging, kecepatan gerak ×0.45.
- `F` = **FATALITY** (lihat A4).

## A4. Sistem POSTURE + FATALITY (inti "kungfu"-nya)

Setiap musuh punya **dua bar**: `hp` dan `posture`. Serangan pemain mengurangi keduanya
(setiap `Attack` punya field `posture` sendiri). Saat `posture` habis → musuh masuk state
`broken` (terbuka, tidak bisa melawan, beberapa detik).

Di saat itu tekan **`F`** = **FATALITY**: pemain otomatis melompat/teleport ke korban,
memilih **finisher acak**, kamera punch-in (zoom 1.3), hitstop 0.09–0.1, shake 9–14,
flash putih 0.5–0.7, slow-mo, teks besar `FATALITY`. **Fatality memulihkan HP**
(`mods.takedownHeal`, dasar 8 HP).

Finisher FISTS (acak 8): `UPPERCUT`, `RUSH PUNCH`, `AXE KICK`, `PALM BLAST`,
`KNEE LAUNCH`, `SUPLEX THROW`, `SPIN STRIKE`, `DRAGON TAIL`.
Setiap senjata punya set finisher sendiri, contoh:
NUNCHAKU → `CHAIN STRANGLE / HELICOPTER STRIKE / SKULL CRUSHER`;
KATANA → `IAI EXECUTION / SKY BURIAL / THOUSAND CUTS`;
AXE → `TIMBER FALL / HOME RUN`;
DUAL → `THOUSAND SLASHES / TWIN REAPER`;
STAFF → `STAFF JUDGMENT / BO CYCLONE`;
SPEAR → `SANADA SKYFALL / CROSS EXECUTION`;
MACHETE → `CAMPFIRE ENDING / SPLIT DECISION`;
PISTOL/RIFLE → `POINT BLANK / GUN KATA`.
(Validasi posisi: kalau `RUSH PUNCH` tidak muat karena dinding, ganti ke `UPPERCUT`/`AXE KICK`;
selalu geser pemain ke titik di sebelah korban yang tidak solid.)

Korban yang mati karena heavy hit → jadi **Corpse** dengan fisika 3D sederhana
(`x,y,z,vx,vy,vz,rot,vrot`), bisa **terbelah** (`split`), menabrak dinding, dan
**menjatuhkan senjata** mereka sebagai pickup.

## A5. 10 SENJATA (slot 0–9, ganti via tombol angka atau scroll mouse)

Setiap senjata = **combo string** (array `Attack`) dengan field:
`{ name, dmg, range, arc (radian), dur (detik), lunge (px/s dorongan maju), kb (knockback), posture, heavy?, kick? }`.
Hit ke-`heavy` = peluncur (musuh terlempar & bisa di-juggle). Pakai angka persis ini:

**0 · FISTS** (7 hit, bisa diperpanjang upgrade `comboLen`, dasar 4)
| # | name | dmg | range | arc | dur | lunge | kb | posture | flag |
|---|---|---|---|---|---|---|---|---|---|
|1|JAB|8|20|1.7|0.17|55|60|9||
|2|CROSS|10|22|1.7|0.19|65|80|11||
|3|HOOK|13|22|2.5|0.21|60|110|15||
|4|ROUNDHOUSE|20|27|3.2|0.30|80|240|28|heavy, kick|
|5|ELBOW|15|20|1.9|0.19|70|130|17||
|6|SPIN KICK|22|29|3.8|0.30|50|220|28|heavy, kick|
|7|DRAGON PALM|34|26|1.5|0.34|110|360|45|heavy|

**3 · NUNCHAKU** (fisika rantai 6 segmen verlet + trail)
`NUN SWING 6/28/3.6/0.145/30/90/15` · `NUN CROSS 6/28/3.6/0.145/30/90/15` ·
`NUN SPIN 5/30/6.3/0.30/10/70/13` · `WHIP CRACK 15/29/2.4/0.26/60/260/32 heavy`
(dmg/range/arc/dur/lunge/kb/posture). Sprint+LMB = **NUNCHAKU CYCLONE**.

**4 · KATANA** — `DRAW CUT 12/28/2.6/0.14/60/90/12` · `IAI CROSS 13/28/2.6/0.15/65/100/13` ·
`OVERHEAD 19/29/2.2/0.24/70/170/20 heavy` · `SPIN IAI 16/30/6.3/0.28/30/140/18 heavy` ·
`THRUST 24/36/1.4/0.26/120/240/26 heavy`. Serangan menyebabkan **BLEED** (DoT).
Tahan LMB lalu lepas = **IAI DASH** menembus garis musuh.

**5 · AXE** (pemukul bisbol) — `BAT SWING 18/30/3.4/0.30/70/430/30` · `BACK SWING 18/30/3.4/0.30/70/430/30` ·
`OVERHEAD CHOP 26/30/2.4/0.36/95/560/45` · `HOME RUN 34/33/3.8/0.42/115/820/60` (semua heavy).
Knockback monster → musuh terbang & mati saat menghantam dinding.

**6 · DUAL BLADES** — `L SLASH 9/26/2.8/0.12/58/80/10` · `R SLASH 9/26/2.8/0.12/58/80/10` ·
`CROSS SCISSOR 13/27/3.4/0.155/62/130/14` · `DUAL SPIN 8/28/6.3/0.27/32/110/12` ·
`TWIN FANG 15/29/2.2/0.20/95/210/18 heavy`. String tercepat di game, semua cut bleed.

**7 · BO STAFF** — `STAFF JAB 10/32/1.9/0.15/85/120/16` · `STAFF SWING 12/32/3.4/0.165/60/175/18` ·
`STAFF TWIRL 9/33/6.3/0.26/30/130/16` · `VAULT STRIKE 22/33/3.0/0.30/110/380/34 heavy`.
Sprint/Q = **POLE VAULT slam**.

**8 · SANADA SPEAR** — `SPEAR THRUST 14/38/1.5/0.155/105/140/15` · `SPEAR SWEEP 13/36/3.6/0.175/70/190/17` ·
`WHIRLWIND 11/36/6.3/0.30/40/170/20 heavy` · `SANADA CHARGE 26/40/1.6/0.30/165/330/30 heavy`.
Jangkauan terpanjang. Sprint/Q = **LANCE RUSH**.

**9 · MACHETE** (gaya Jason) — `DIAGONAL CHOP 15/32/3.3/0.17/88/175/20` · `REVERSE HOOK 15/32/3.4/0.17/88/175/20` ·
`SPLIT CLEAVE 34/34/2.6/0.30/130/420/40 heavy` (**membelah musuh jadi dua**) ·
`JUNGLE SPIN 12/33/6.3/0.31/55/210/23 heavy`. Sprint/Q = **SLASHER DASH**.

**1 · PISTOL** (ammo `ammoP`, 6 peluru/mag, reload) dan **2 · RIFLE** (ammo `ammoR`, full-auto).
Ammo didapat dari pickup/musuh yang mati.

**WEAPON RUSH** — saat sprint penuh lalu LMB, tiap senjata punya jurus lari khas:
FISTS = flying kick · NUNCHAKU = cyclone · KATANA = iai dash · AXE = axe rush ·
DUAL = blade rush · STAFF = pole vault · SPEAR = lance rush · MACHETE = slasher dash.

**Deteksi serangan**: sektor lingkaran (`inArc(origin, facing, range, arc, target, targetRadius)`),
**input buffering** (tekanan saat serangan masih berjalan disimpan dan dieksekusi begitu selesai),
`comboTimer` untuk mempertahankan rantai, dan flag `didHit` agar satu ayunan tidak multi-hit
(kecuali senjata ber-`arc` penuh / pierce).

## A6. MUSUH — tabel stat persis

```ts
type EnemyKind = 'thug'|'gunner'|'brute'|'dasher'|'rifleman'|'shield'|'ninja'|'bomber'
               |'smg'|'sniper'|'samurai'|'pipeswing'|'cleaver'|'boss';
```

| kind | hp | posture | speed | radius | dmg | range | windup | cooldown | unlock | weight | score |
|---|---|---|---|---|---|---|---|---|---|---|---|
|thug|30|30|42|5|10|18|0.45|0.9|1|10|10|
|gunner|24|20|34|5|8|120|0.85|1.6|3|6|15|
|dasher|22|22|60|4.5|12|70|0.50|1.4|8|6|20|
|brute|90|80|26|6.5|22|26|0.80|1.6|14|4|40|
|pipeswing|40|34|52|5|12|25|0.55|1.5|16|5|32|
|smg|26|20|38|5|5|130|0.55|2.0|20|4|25|
|cleaver|34|28|62|5|14|22|0.45|1.3|22|4|38|
|shield|55|60|32|5.5|12|20|0.50|1.1|24|4|35|
|samurai|55|42|56|5|16|23|0.38|1.25|26|4|50|
|rifleman|34|26|30|5|6|150|0.80|2.0|32|5|30|
|sniper|30|24|30|5|26|260|1.50|3.4|42|3|45|
|ninja|40|35|70|4.5|14|24|0.32|1.2|45|4|45|
|bomber|20|10|58|5|30|22|0.60|99|60|3|25|
|boss|600|200|40|11|18|30|0.60|1.0|10|0|500|

- `unlock` = lantai kemunculan pertama; `weight` = bobot undian acak; `range` = jarak mulai menyerang.
- **State machine musuh**: `chase → windup (telegraph!) → attack → recover → stun/broken/knock/getup/dead`,
  plus `teleport` (ninja) dan `victim` (sedang jadi korban fatality).
- **Telegraph wajib terbaca**: saat `windup`, gambar garis/arc merah + flash putih + perubahan pose.
  `bomber` = meledak saat mendekat (cooldown 99 → sekali pakai).
- `samurai` bisa **mem-parry serangan melee frontal pemain** lalu riposte;
  `shield` menahan dari depan; `sniper` laser-sight lalu tembakan 26 damage.
- **AI FLANKING**: setiap musuh dapat `slotAng` — mereka menyebar mengelilingi pemain, tidak
  menumpuk di satu titik; ada `allyBlocking()` supaya tidak saling menghalangi.
- Musuh ranged **lead the shot**: `aimAt(target, projectileSpeed)` memprediksi posisi pemain.
- Musuh punya `los()` (line of sight via raycast tile) sebelum memutuskan menyerang/maju.
- Ada `stuckT`, `strafe`, `dodgeCd`, `retreatT`, `cunning`, `react/reactAng` untuk variasi perilaku.

**9 tingkat "ENEMY IQ"** (naik bertahap, tampilkan banner saat naik):
`MINDLESS` (serbu lurus) → `FLANKING` (mengepung) → `LEADING SHOTS` (bidik posisi depan) →
`PARRY BAIT` (menunda serangan saat kamu parry) → `EVASIVE` (menghindari peluru) →
`VOLLEY FIRE` (tembakan sinkron) → `PUNISHER` (menghukum serangan yang whiff) →
`TACTICAL RETREAT` (mundur saat posture lemah untuk pulih) → `BLOODLUST` (mengamuk saat kawannya mati).

## A7. BOSS — 10 "weapon master"

Boss muncul **tiap 5 lantai untuk lantai ≤ 50**, lalu **tiap 10 lantai**. Arena boss = ruang terbuka
`34 × 24` tile dengan 4–6 pilar 2×2. Tiap boss adalah **master satu senjata** dan memakai moveset
senjata itu terhadap pemain:

| # | nama | gelar | style | warna | band |
|---|---|---|---|---|---|
|1|IRON FIST GOREN|master of the bare fist|fists|#d8a06a|#8a3a2a|
|2|QUICKDRAW HOLLOWAY|six rounds, no misses|pistol|#b8b0a0|#3a4a5a|
|3|MASTER BAMBOO|the staff never stops|staff|#9ab87a|#4a5a2a|
|4|CAMP SLASHER KANE|machete in the dark|machete|#c4b8a8|#c02830|
|5|TWIN BLADE VIET|two edges, one motion|dual|#a8a0c4|#5a3a7a|
|6|YUKIMURA THE LAST|the spear that split a sky|spear|#d0b4a8|#7a1c26|
|7|SILENT RYUZO|one cut, one breath|katana|#cfd8e4|#1c2430|
|8|TREESTUMPER MOSS|the axe falls like weather|axe|#b09a7a|#3a5a3a|
|9|WHIRLWIND DAE-SUN|chains that sing|nunchaku|#c8b898|#6a4a2a|
|10|WARDEN CROSS|full-auto judgement|rifle|#a0a8b4|#2a3038|

Untuk kemunculan ulang (lantai > 50) pakai varian nama:
`GOREN REBORN, HOLLOWAY PRIME, BAMBOO GHOST, KANE ETERNAL, VIET PRIME, YUKIMURA REBORN,
RYUZO PRIME, MOSS TITAN, DAE-SUN PRIME, CROSS OMEGA`.

Boss bisa **BOSS PARRY**: membaca melee frontal pemain dan membalas dengan combo 3 hit
(feed text `BOSS PARRY!`). Saat boss mati: slow-mo 0.55, zoom 1.3, flash penuh, banner
`BOSS DEFEATED / THE PATH OPENS`.

**MID-BOSS**: setiap lantai (kecuali lantai boss dan lantai < 4) menaruh 1–2 **elite bersenjata**
(jumlah: `<4 → 0`, `<12 → 1`, `<25 → 1`, `≥25 → 2`) dengan `style` bergilir tiap lantai
(`['fists','pistol','staff','machete','dual','spear','katana','axe','nunchaku','rifle']`) dan jenis
musuh yang tematis (katana→`samurai`, machete→`cleaver`, axe/staff/spear→`pipeswing`,
pistol→`gunner`, rifle→`rifleman`, dual→`ninja`, lain→`brute`). Beri gelar seperti
`RONIN`, `GUNSLINGER`, `CHAIN DANCER`, `REAPER`, dst. Tujuannya: **tidak ada lantai yang terasa kosong**.

## A8. Generator level (`level.ts`) — deterministik dengan seed

- RNG **mulberry32** dengan seed `level * 7919 + 1337` (arena endless: `stage * 48271 + 99991`).
  Level yang sama harus selalu menghasilkan peta yang sama.
- Grid `Uint8Array(w*h)`, `1 = wall`, mulai penuh wall lalu dipahat.
- Ukuran non-boss: `w = floor(28 + prog*22 + rng*6)`, `h = floor(20 + prog*14 + rng*4)`,
  dengan `prog = (level-1)/199` (0..1) → peta makin besar seiring progres.
- Pahatan: **drunkard walk** (1–4 walker, 30% ganti arah tiap langkah, target 42–52% area terbuka,
  guard 200.000 iterasi) + **2–4 ruang terbuka** (5–9 × 4–7 tile).
- Bersihkan "pulau" wall tunggal (wall dengan 0 tetangga terbuka → jadi lantai).
- **Flood fill** dari tile lantai terdekat ke pusat: hanya komponen terhubung utama yang dipertahankan,
  sisanya **disegel jadi wall** (jamin tidak ada area tak terjangkau).
- **Spawn pemain**: tile dengan `openness === 9` (3×3 semuanya lantai), diurutkan berdasarkan X
  (favor sisi kiri), ambil acak dari 12 ter-kiri.
- **Spawn musuh**: `count = min(28, floor(4 + level*0.11 + rng*2))`; jenis diundi dengan `weight`
  dari semua jenis yang `unlock <= level`; posisi minimal **110 px** dari spawn pemain, tanpa duplikat tile.
  Lantai boss: `2 + floor(level/40)` thug + 1 boss di sisi paling kanan.
- **Pickups**: 1–3 buah → 40% `ammoP`, 35% `ammoR`, 25% `hp`.
- **Decor**: ~6% tile lantai dapat titik dekor (3 varian) untuk tekstur.
- **Scaling difficulty** per lantai:
  `hpMult = 1 + prog*4.5 + floor(level/10)*0.08` · `dmgMult = 1 + prog*1.6` · `spdMult = 1 + prog*0.45`.
- **Portal**: begitu semua musuh mati → muncul portal berdenyup (cincin konsentris warna aksen biome);
  dalam radius 60 px pemain **tertarik** ke portal; masuk (<10 px, setelah 0.4 detik) → `completeLevel()`.
- `completeLevel()`: skor `+= 100 * level`; kalau `level >= 200` → phase `win`.

## A9. 10 BIOME (ganti tiap 20 lantai, palet terbatas ala Downwell)

`biomeFor(level) = BIOMES[min(9, floor((level-1)/20))]`. Tiap biome = 8 warna:
`bg, floor, floorDot, wall, wallTop, accent, enemy, enemy2`.

| # | nama | bg | floor | floorDot | wall | wallTop | accent | enemy | enemy2 |
|---|---|---|---|---|---|---|---|---|---|
|1|SLUM ROOFTOPS|#0b0b12|#15151f|#1d1d2a|#2a2a3d|#3b3b55|#ff3b3b|#e8e8ff|#9a9ab8|
|2|NEON DISTRICT|#08060f|#120d20|#1a1330|#2b1b4d|#4b2d85|#ff2d95|#f6e9ff|#b78fff|
|3|BAMBOO DOJO|#070d08|#0f1a10|#15241a|#1e3a22|#2f5a34|#ffcc33|#f3ffe8|#9ccf7a|
|4|SCRAPYARD|#0e0a06|#1b1409|#241b0e|#3a2c14|#5a4520|#ff7a1a|#fff0d8|#d6a86b|
|5|FROZEN PASS|#060a12|#0e1626|#152036|#223a5a|#3a5f8f|#5ff0ff|#ffffff|#9fd4ff|
|6|CRIMSON TEMPLE|#120406|#1e080b|#2a0c10|#4a1218|#7a1c26|#ffd166|#ffe6e6|#ff8a8a|
|7|UNDERWORLD|#050505|#0e0e0e|#161616|#262626|#3d3d3d|#a3ff3b|#ffffff|#8d8d8d|
|8|SKY FORTRESS|#0a0e1c|#141a30|#1b2340|#2c3a66|#4a5f9c|#ffffff|#ffe9a8|#c9b26b|
|9|VOID GARDEN|#07000f|#10021c|#170528|#2c0a4e|#4e1486|#3bffd8|#f0e0ff|#a070e0|
|10|THE THRONE|#0c0a04|#17130a|#1f1a0e|#3d3214|#6b5a22|#ffe14d|#ffffff|#ffd27a|

## A10. UPGRADE roguelite (17 pilihan, ambil 3 acak tiap **2 lantai**)

Objek modifier global:
```ts
interface Mods { maxHp, atkSpeed, dmg, parryWindow, focusGain, dashCd, ammoMult, lifesteal,
  gunDmg, moveSpeed, deflectDmg, takedownHeal, comboLen, critChance, thorns, pickupRange, regen }
const DEFAULT_MODS = { maxHp:100, atkSpeed:1, dmg:1, parryWindow:1, focusGain:1, dashCd:1,
  ammoMult:1, lifesteal:0, gunDmg:1, moveSpeed:1, deflectDmg:1, takedownHeal:8, comboLen:4,
  critChance:0.05, thorns:0, pickupRange:1, regen:0 };
```

| id | nama | efek | ikon |
|---|---|---|---|
|hp|IRON BODY|+25 max HP|♥|
|spd|QUICK HANDS|+15% attack speed|»|
|dmg|TIGER PALM|+20% melee damage|✊|
|parry|STILL WATER|+40% parry window|◐|
|focus|INNER CHI|+35% focus gain|✺|
|dash|WIND STEP|−25% dash cooldown|⇢|
|ammo|DEEP POCKETS|+50% ammo drops|▪|
|life|VAMPIRE STYLE|melee hit heal 1 HP|✚|
|gun|GUN KATA|+30% gun damage|▸|
|move|LIGHT FEET|+12% move speed|⤳|
|deflect|MIRROR GUARD|deflected bullets +100% dmg|◇|
|take|SOUL HARVEST|takedown heal +10 HP|☯|
|combo|DRAGON CHAIN|+1 hit dalam combo string (maks 7)|∞|
|crit|PRESSURE POINT|+15% crit chance|✦|
|thorns|THORN STANCE|blocked hits membalas 10 dmg|✶|
|magnet|CHI MAGNET|+60% pickup range|◎|
|regen|MEDITATION|regen 1 HP/detik|☸|

Setiap upgrade = fungsi `apply(m: Mods) => void` (murni, komposabel, bisa diambil berulang).
Kalau `maxHp` naik, HP sekarang ikut naik sebesar selisihnya. Pilih dengan `Digit1/2/3`.
Ada juga **CHEST** langka di level → membuka layar upgrade gratis sebagai hadiah.

## A11. Mode ENDLESS (gaya Vampire Survivors / Survivor.io)

Selain kampanye 200 lantai, ada mode **ENDLESS** di satu arena besar:
- Arena `64 × 44` tile, border wall 2 tile, **10–15 blok** (1–3 × 1–3 tile) + **3–5 segmen dinding**
  panjang 4–9 tile, **pusat arena wajib kosong** (jangan taruh obstacle di ±6×5 dari tengah).
  Biome bergilir tiap stage.
- Musuh **spawn dari tepi peta** terus-menerus:
  `cap = min(48, 8 + menit*3.5 + level*0.8)` musuh hidup;
  `rate = max(0.12, 1.0 - menit*0.06 - level*0.012)` detik antar spawn; jumlah per spawn
  `1 + floor(rng * (1 + menit/2))`.
- **Wave tiap 40 detik**: `n = 5 + wave*2` musuh; tiap wave kelipatan 3 = **HORDE**
  (jenis seragam `dasher/thug/ninja`); tiap wave kelipatan 5 = **BOSS WAVE** (spawn boss,
  style bergilir dari 10 boss). Banner + SFX + shake tiap wave; countdown `WAVE IN n` di 5 detik terakhir.
- **Scaling**: `diffLevel = 1 + level*2.2 + menit*4`;
  `hpMult = 1 + diffLevel*0.045 + menit*0.14 + menit^1.5*0.04`;
  `dmgMult = 1 + diffLevel*0.02 + menit*0.06`; `spdMult = 1 + min(0.5, diffLevel*0.01 + menit*0.03)`.
- **XP gems** jatuh dari musuh, tertarik ke pemain (`pickupRange`), kalau pickup > 260 butir
  maka gem tertua otomatis di-merge (jangan lag). `xpNext = floor(8 + level*4 + level^1.3 * 1.5)`;
  level up → layar pilih 3 upgrade (seperti kampanye) dengan i-frames 0.6 detik.
- AI tier naik seiring `diffLevel` → tampilkan banner `ENEMY IQ ↑ <nama tier>`.

## A12. Kustomisasi & meta-progresi

- **8 SKIN** pemain (`body`, `band`, opsional `hat`: `tophat` / `oni` / `hockey`):
  `CLASSIC DRIFTER (#ffffff/#ff3b3b)`, `NEON RONIN (#e6fbff/#ff2d95)`,
  `GOLDEN MONK (#ffe9a8/#b8860b, tophat)`, `SHADOW (#aab4c4/#14141c)`,
  `JADE SERPENT (#d8ffe8/#22c55e, oni)`, `VOID WALKER (#e9d5ff/#7c3aed)`,
  `CAMP SLASHER (#dfe4ea/#c02830, hockey)`, `GENTLEMAN REAPER (#f2f2f2/#111118, tophat)`.
- **2 mode proporsi tubuh**: `CHIBI` (default) dan `TALL` (tubuh ×1.62, tungkai ×2.15) — tombol `V`.
- **3 mode darah**: `0 NORMAL`, `1 PARTICLE`, `2 COMBINED` (partikel **+ noda darah permanen**
  yang di-stamp ke offscreen canvas seukuran level, digambar di atas lantai & di bawah karakter) — tombol `B`.
- **7 RANK** berbasis skor: `FIST NOVICE 0`, `STREET BRAWLER 5000`, `DOJO FIGHTER 15000`,
  `KUNG FU MASTER 35000`, `GRANDMASTER 75000`, `LIVING WEAPON 150000`, `THRONE LEGEND 300000`
  (+ progress bar ke rank berikutnya).
- **Checkpoint**: mati → boleh lanjut dari lantai checkpoint, mods & upgrade tersimpan.
- **Fast Level**: tahan `L` untuk melewati transisi lantai 3.5× lebih cepat dan auto-pick upgrade
  (buat grinding/testing).
- **Persistence `localStorage`**: `kf_best` (lantai terjauh), `kf_checkpoint`, `kf_mods`, `kf_upg`,
  `kf_endless` (best level/time/kills), `kf_blood`, `kf_body`, `kf_skin`, `kf_scores`
  (riwayat top skor campaign & endless + meta + timestamp).

## A13. GAME FEEL / JUICE (ini yang paling penting — jangan dilewati)

Semua nilai ini dipakai di kode asli; tiru:
- **Hitstop**: `hitStop(t)` membekukan simulasi `t` detik (0.06 pukulan biasa, 0.09–0.1 heavy/fatality).
- **Screen shake**: `addShake(n)` → `shake = min(5, shake + n*0.55)`; 3 (parry kecil),
  5–7 (hit berat), 9–14 (fatality / wall slam / boss mati).
- **Zoom punch-in**: `zoomT` naik sesaat lalu lerp kembali — 1.05–1.08 (hit), 1.12–1.18 (heavy/parry),
  1.22–1.3 (fatality, boss mati, OFA). Saat mati/menang, zoom menetap 1.15.
- **Slow-motion**: `slowMo(t)` → `timeScale` lerp ke `0.22`; OFA → `0.3`; perfect dodge → 0.28 detik.
  Saat `timeScale < 0.8`, gambar **letterbox bar hitam** atas-bawah setinggi `(1-timeScale)*18` px.
- **Flash** layar penuh (`flash`, `flashColor`) untuk parry/fatality/boss death.
- **Squash & stretch** per entitas (`sqx/sqy`), mis. `(0.7, 1.3)` saat meluncur, `(1.5, 0.6)` saat kick.
- **Partikel** (cap **900**, buang yang tertua): jenis
  `dot | ring | spark | text | slash | line | smoke | ghost | shock`, masing-masing punya
  `fric` dan `grav` sendiri; `text` = damage number / nama jurus yang melayang.
- **Feed text** kanan-bawah: maks 5 baris, dedupe teks sama dalam 0.9 detik (`count++`), hidup 1.5 detik.
  Contoh isi: `PERFECT PARRY`, `CHAIN PUNCH!`, `DASH STRIKE`, `IAI DASH!`, `FULL SPRINT x3`,
  `SAMURAI PARRY!`, `BOSS PARRY!`, `ONE FOR ALL`, `CHAIN FINISHER!`, `NO FOCUS`, `PERFECT DODGE`.
- **Banner** besar tengah layar `{ text, sub, t }` untuk nama boss, wave, kenaikan AI tier.
- **Vignette merah** berdenyap saat HP < 30%: `a = 0.25 + sin(rt*6)*0.1`, radial gradient.
- **Combo counter** + `maxCombo` + streak dengan teks khusus; skor naik dari kill & combo.
- **Bayangan ellipse** di bawah setiap entitas, mengecil/memudar sesuai `z` (ketinggian lompat).
- **Kamera** follow pemain dengan clamp ke batas level + shake offset, dan **culling** tile/entitas
  di luar `viewport + 16 px`.

## A14. RENDER — stickman prosedural (tanpa sprite)

- Helper: `px(ctx,x,y,w,h,color)` = `fillRect` dengan `Math.round` (snap pixel);
  `line`, `circle`, `text` (font `'Press Start 2P'`, selalu dengan drop-shadow hitam 1px).
- **Tile**: lantai = warna `floor` + titik `floorDot` di (7,7) 2×2 + titik acak deterministik
  `(tx*7+ty*13)%5===0`; kalau ada wall di atasnya, gambar gradasi bayangan `rgba(0,0,0,.35)` 5 px.
  Wall: hitung jarak ke lantai terdekat (`near`, maks 9) →
  `near > 2` = gelap (warna `bg`), `near === 2` = muka wall (`wall`) + 2 goresan,
  selain itu = atas wall (`wallTop`) + detail bata + kalau tile di bawahnya lantai, gambar
  "tebing" 6 px warna `wall` + garis pemisah 1 px + highlight aksen di tepi atas.
- **Stickman** (`drawStick`): gambar **dua pass** — pass outline hitam (tebal +2, kepala +1) lalu
  pass warna. Semua garis = tungkai 2-tulang dengan **IK analitik**:
  `limb(ctx, sx, sy, tx, ty, l1, l2, bend, color, width)` (hitung sudut dengan law of cosines,
  clamp jarak ke `l1+l2-0.05`).
- **Kurva pukulan** `strikeCurve(t)`: `t<0.22` tarik ke belakang (`-0.5`), `t<0.45` melesat dengan
  `easeOutBack` sampai `1.15` (overshoot), `t<0.68` tahan `1.0`, lalu recover ke `0`.
  Ini yang bikin pukulan terasa "berbobot".
- Pose per state (idle bernapas, walk cycle dari `p.walk`, attack, dash dengan ghost trail,
  parry dengan lengan silang, jump dengan `z`, takedown/fatality dengan korban, stun, dead).
- Nunchaku = **rantai verlet 6 titik** (`pts` dengan `px,py`) + trail; gambar juga senjata prop
  (katana, axe, spear, staff, machete, pistol, rifle) dengan fungsi `drawWeaponProp`.
- Corpse: digambar sebagai stickman rebah/terbelah dengan rotasi + squash, plus `slashT/slashAng`
  untuk bekas tebasan, dan `nudge` saat tertabrak.
- **HUD digambar di canvas** (bukan DOM), reset transform dulu:
  - HP bar 90×8 di (8,8), background `#2a0a0a`, fill `#ff3b3b` (+ highlight `#ff8a8a` 2px),
    **putih saat `hurtT > 0`**, tick hitam tiap 25 HP, angka HP di sebelahnya.
  - Guard bar 90×3 di bawahnya (`#ffd166`, jadi `#ff3b3b` saat > 70).
  - 3 **FOCUS pip** belah ketupat (rotate 45°) terisi dari bawah, warna = aksen biome kalau penuh.
  - **RAGE** meter 70×4 (`#8a2a1a` → `#ff5a3c` saat ≥60%, berkedip 2 warna saat raging) +
    teks `R!` berkedip saat ≥ 60.
  - **OFA** meter 70×4 (`#14424e` → `#2a9db8`, berkedip `#57e6ff`/`#c8fbff` saat aktif) + `X!` saat ≥ 25.
  - Kiri bawah: kotak senjata (nama + ammo/`∞`, merah kalau 0) + **9 slot senjata** bernomor,
    slot aktif berwarna aksen biome.
  - Kanan atas: `LV n/200`, nama biome (warna aksen), skor, `n KILLS`.
  - Mode endless: **XP bar 220×4 di tengah atas** + `LV`, timer `m:ss`, `WAVE n · n ALIVE`,
    `STAGE n`, `ENEMY IQ <tier>` + 9 bar tier kecil di kanan bawah, dan `WAVE IN n` berkedip.

## A15. AUDIO — synth WebAudio prosedural (0 aset)

- Satu `AudioContext` (dibuat **lazy** pada interaksi user pertama, `resumeAudio()` saat suspended),
  `master GainNode` volume `0.35`, `setMuted()` → gain 0. Tombol `M`.
- Dua primitif:
  `tone(freq, dur, type, vol=0.5, slide=0, delay=0)` — oscillator + gain dengan
  `exponentialRampToValueAtTime(0.001, t+dur)`, dan slide frekuensi eksponensial;
  `noise(dur, vol=0.4, hp=800, delay=0)` — buffer noise putih dengan decay linear
  `(1 - i/len)` lewat `BiquadFilterNode` highpass.
- SFX yang wajib ada: `punch(n)`, `heavy`, `whoosh`, `parry` (2 tone 1200/1800 + noise 3000Hz),
  `block`, `ofa` (arpeggio 330-440-554-659-880), `rage`, `axeSwing`, `axeHit`, `swish`, `shing`,
  `crack`, `jump`, `dash`, `hurt`, `kill`, `takedown`, `pistol`, `rifle`, `enemyShot`, `pickup`,
  `heal` (arpeggio 440-660-880), `portal`, `levelUp` (523-659-784-1046), `focus`, `sweep`, `kick`,
  `explode`, `warn`, `death` (descending 400→120), `select`, `wallSlam`, `slowmo`.

## A16. Shell React & kontrol

- Overlay screen sebagai komponen React di atas canvas (pakai Tailwind + `.pixel-font`):
  **TitleScreen** (judul, pilih CAMPAIGN / ENDLESS, pilih skin, best score, daftar TECHNIQUES),
  **PauseScreen**, **UpgradeScreen** (3 kartu upgrade + ikon + deskripsi),
  **DeathScreen** (penyebab mati, statistik run, rank, tombol lanjut dari checkpoint),
  **WinScreen**.
- Tombol bergaya arcade: border 2px + `shadow-[4px_4px_0_#000]`, hover naik 0.5, active turun.
- Input: `keydown/keyup`, `mousedown/up/move`, `wheel` (ganti senjata, hanya saat `playing`),
  `contextmenu` dicegah (RMB dipakai parry), `blur` → pause.
  `preventDefault` untuk: `Space, KeyW/A/S/D, ArrowUp/Down/Left/Right, Tab`.
  Abaikan `e.repeat`. Konversi koordinat mouse → ruang 480×270 lewat `getBoundingClientRect()`.
- Kursor disembunyikan saat `playing` (`cursor: none`).
- **Bridge iframe** (biar game bisa di-embed ke halaman showcase): dengarkan `window.message`
  `{ type: 'KF_KEYDOWN' | 'KF_KEYUP', code, key }` → teruskan ke handler keyboard;
  `{ type: 'KF_ACTION', action: 'start' | 'pause' | 'restart' }` → kendalikan fase.
- Tombol pintas global: `M` mute, `B` mode darah, `V` proporsi tubuh, `Esc/P` pause,
  `Enter/Space` mulai dari title, `Enter` restart saat mati, `1/2/3` pilih upgrade, `L` fast level.

## A17. Aturan kualitas (hard constraints)

1. **Nol aset eksternal.** Semua visual digambar kode, semua suara disintesis. Tidak boleh ada
   `fetch` gambar/audio, tidak boleh ada base64 sprite.
2. TypeScript strict, tanpa `any` yang tidak perlu; semua "magic number" gameplay masuk `data.ts`
   sebagai konstanta bertabel (mudah di-balance).
3. Simulasi **tidak boleh** menyentuh DOM/React. React hanya membaca snapshot via `notify()`.
4. Performa: target 60 fps; cap partikel 900, cull tile & entitas di luar kamera,
   pakai `Uint8Array` untuk tile, hindari alokasi di dalam loop panas.
5. Deterministik: level dari seed yang sama harus identik.
6. Tidak ada crash saat `localStorage` diblokir (bungkus semua akses dengan `try/catch`).
7. Semua teks UI dalam **huruf kapital gaya arcade**, bahasa Inggris; komentar kode singkat.

## A18. Urutan pengerjaan (milestone — selesaikan berurutan, jangan lompat)

1. **M1 Kerangka**: Vite+React+TS, canvas 480×270, scaling ke layar, scanlines, loop RAF,
   `data.ts` (VW/VH/TILE/MAX_LEVEL), kelas `Game` kosong dengan `phase` + `notify()`, TitleScreen.
2. **M2 Peta & gerak**: `level.ts` (RNG seeded, drunkard walk, rooms, flood-fill seal, spawn),
   render tile 3-tier, kamera follow + clamp + culling, pemain stickman (IK + walk cycle) dengan
   WASD, collision tile (`boxSolid`, `move` dengan pemisahan sumbu), sprint 3×.
3. **M3 Combat inti**: combo string FISTS (7 hit), `inArc` hit detection, input buffering,
   knockback, damage number, hitstop/shake/zoom/flash, musuh `thug` dengan state machine +
   telegraph windup, HP/posture bar, kematian + corpse.
4. **M4 Depth**: parry/block/deflect + riposte, dash + i-frames, jump + air kick, focus + Q/E,
   posture break + FATALITY (8 finisher), Chain Punch, Charge Palm.
5. **M5 Konten**: 13 jenis musuh + 9 AI tier + flanking + aim leading, 10 senjata lengkap dengan
   combo table & weapon rush, ammo & reload, bleed, 10 boss + boss parry, mid-boss elite, 10 biome.
6. **M6 Roguelite**: portal + level flow + transition, upgrade tiap 2 lantai (17 upgrade + Mods),
   scaling difficulty, checkpoint, chest, kematian/menang, skor + 7 rank, localStorage.
7. **M7 Endless**: generator arena, spawn tepi, wave/horde/boss wave, XP gem + level up,
   scaling waktu, AI tier banner, HUD endless.
8. **M8 Polish**: 30 SFX WebAudio, 3 mode darah (+ stain canvas permanen), 8 skin, chibi/tall,
   partikel lengkap, feed text, banner, vignette, letterbox slow-mo, PauseScreen, postMessage bridge,
   fast level, tuning balance.

## A19. Acceptance criteria (verifikasi sendiri sebelum menyatakan selesai)

- [ ] `npm install && npm run dev` jalan tanpa error; TypeScript `tsc --noEmit` bersih.
- [ ] Dari title bisa mulai CAMPAIGN dan ENDLESS.
- [ ] Lantai 1 punya peta terhubung, 4–5 thug, dan portal muncul setelah semua mati.
- [ ] Combo JAB→CROSS→HOOK→ROUNDHOUSE terasa berbeda (dmg/knockback naik), hit ke-4 melontarkan musuh.
- [ ] Tahan RMB tepat sebelum kena = `PERFECT PARRY` (musuh stun, slow-mo, riposte tersedia).
- [ ] Posture habis → `F` = fatality dengan finisher acak + heal.
- [ ] Tahan WASD ~1.2 detik → kecepatan jadi 3× dan ada teks `FULL SPRINT x3`.
- [ ] Lantai 5 = boss `IRON FIST GOREN` di arena berpilar; lantai 10 = `QUICKDRAW HOLLOWAY` (pistol).
- [ ] Lantai genap → layar 3 upgrade; ambil `IRON BODY` → max HP 125 dan HP sekarang ikut naik.
- [ ] Ganti senjata dengan `5` (katana) dan scroll mouse; setiap senjata punya animasi & SFX khas.
- [ ] `Q`/`E` menghabiskan 1 focus pip; saat focus 0 muncul teks `NO FOCUS`.
- [ ] Mode darah `B` mengubah FX; mode COMBINED meninggalkan noda permanen di lantai.
- [ ] Endless: wave tiap 40 detik, wave ke-5 memunculkan boss, XP gem naik level → layar upgrade.
- [ ] Tidak ada aset eksternal di network tab selain font CSS (atau tidak ada sama sekali).
- [ ] 60 fps stabil dengan ~30 musuh + ~500 partikel.

## A20. Format balasan yang saya minta

1. Tampilkan **pohon file** lengkap dulu.
2. Tulis **setiap file secara penuh** (jangan `// ... sisanya sama`, jangan placeholder).
   Kalau terlalu panjang, pecah per milestone dan lanjutkan saat saya bilang "lanjut".
3. Setelah tiap milestone, beri **catatan tuning** (nilai apa yang paling mungkin perlu diubah)
   dan **cara mengetesnya** di browser.
4. Jangan tambahkan dependensi baru selain yang disebut di A0.

**(selesai prompt utama)**

---
---

# BAGIAN B — PROMPT PENDEK (versi 1 paragraf, untuk model kecil / brainstorming)

> Buat game browser **"STICK FIST"** dengan Vite + React 19 + TypeScript + Canvas 2D, **tanpa aset
> eksternal sama sekali** (visual digambar prosedural, suara disintesis WebAudio). Resolusi logika
> 480×270, tile 16px, di-scale `pixelated` ke layar + overlay scanlines. Top-down roguelite brawler
> stickman: kampanye **200 lantai** dengan dungeon prosedural (seeded mulberry32, drunkard walk +
> ruangan + flood-fill, peta membesar seiring progres), **10 biome** berganti tiap 20 lantai,
> **13 jenis musuh** + **10 boss "weapon master"** tiap 5 lantai, dan mode **ENDLESS** ala Vampire
> Survivors (arena 64×44, spawn dari tepi, wave tiap 40 detik, XP gem → level up).
> Pemain: stickman chibi dengan tungkai **IK 2-tulang** dan kurva pukulan cock→overshoot→hold→recover;
> gerak WASD dengan **sprint tahan sampai 3×**, dash ber-i-frame, lompat, **parry/block** dengan
> jendela perfect parry 0.22 detik yang membuka **riposte** dan men-deflect peluru; **10 senjata**
> (fists, pistol, rifle, nunchaku, katana, axe, dual blades, bo staff, sanada spear, machete) tiap
> punya combo string 4–7 hit dengan damage/range/arc/durasi/lunge/knockback/posture berbeda + jurus
> "weapon rush" saat sprint; sistem **posture** yang kalau habis membuka **FATALITY** (8 finisher acak,
> memulihkan HP); meter **FOCUS** (flying kick / leg sweep), **RAGE** (≥60 → flurry teleport ke musuh
> terdekat), **ONE FOR ALL** (≥25 → ~12 detik slow-mo, pemain 4×, auto-lock berantai); **Chain Punch**
> Wing Chun dari klik berirama 0.1–0.4 detik; Charge Palm dari tahan LMB. Musuh punya state machine
> `chase→windup(telegraph)→attack→recover→stun/broken/knock/getup/dead`, mengepung dengan slot angle,
> membidik posisi depan pemain, dan naik lewat **9 tingkat ENEMY IQ**. Roguelite: **17 upgrade**
> (pilih 3 tiap 2 lantai) yang memodifikasi objek `Mods`, checkpoint, 7 rank skor, 8 skin,
> 3 mode darah (termasuk noda permanen), mode tubuh chibi/tall, semua tersimpan di localStorage.
> Game feel wajib: hitstop, screen shake, zoom punch-in, flash, slow-mo + letterbox, squash & stretch,
> damage number, partikel (cap 900), feed text, banner boss, vignette HP rendah, corpse berfisika yang
> menjatuhkan senjata. HUD digambar di canvas (HP/guard/focus/rage/OFA/slot senjata/level/skor/kills).
> Pisahkan tegas: kelas `Game` headless (`update(dt)`, tanpa DOM) + fungsi `render(ctx, game, rt)` +
> shell React untuk overlay title/pause/upgrade/death/win dan input. Kerjakan bertahap 8 milestone
> (kerangka → peta & gerak → combat → depth → konten → roguelite → endless → polish) dan tulis setiap
> file secara lengkap tanpa placeholder.

---
---

# BAGIAN C — PROMPT ITERASI (kirim setelah game jadi, untuk naikin kualitas)

**C1. Game feel**
> Game-nya sudah jalan, tapi pukulan terasa "datar". Perbaiki game feel tanpa mengubah balance:
> (1) tambah hitstop 0.06–0.10 detik proporsional berat serangan, (2) zoom punch-in 1.05→1.3
> sesuai tingkat kejadian, (3) squash & stretch pada pemain & musuh saat hit/dash/landing,
> (4) ghost trail saat dash dan weapon rush, (5) partikel `slash arc` mengikuti arah ayunan,
> (6) damage number dengan crit lebih besar & warna berbeda, (7) shake teredam (`shake = min(5, …)`),
> (8) slow-mo + letterbox untuk perfect parry, perfect dodge, fatality, dan boss death.
> Semua nilai harus jadi konstanta di `data.ts`.

**C2. Keterbacaan (readability)**
> Buat setiap ancaman terbaca dalam < 0.3 detik: telegraph `windup` musuh (arc merah + garis arah +
> pose tarik-belakang), laser sight untuk sniper, indikator spawn di tepi layar untuk endless,
> tanda off-screen untuk boss, dan warna aksen biome yang konsisten untuk pickup/portal.
> Pastikan tidak ada informasi penting yang tertutup partikel.

**C3. Balance**
> Buatkan tabel balance lengkap (CSV/markdown) dari `data.ts`: HP/damage efektif per detik pemain
> tiap senjata vs TTK tiap jenis musuh per biome, lalu usulkan 5 perubahan angka spesifik supaya
> lantai 40–80 tidak terasa "sponge" dan senjata non-fists tidak dominan. Jangan ubah struktur kode.

**C4. Konten**
> Tambahkan 4 jenis musuh baru yang memaksa pemain memakai mekanik yang sudah ada
> (parry, dash, posture, fatality), lengkap dengan stat `hp/posture/speed/radius/dmg/range/windup/
> cooldown/unlock/weight/score`, perilaku state machine, dan cara menggambar stickman-nya.
> Ikuti pola `EnemyDef` yang sudah ada dan daftarkan ke undian spawn.

**C5. Port ke game kedua**
> Pakai arsitektur yang sama (`data.ts`/`level.ts`/`game.ts`/`render.ts`/`audio.ts` + shell React)
> untuk membuat game kedua bertema berbeda. Pertahankan: resolusi 480×270, pemisahan sim/render,
> sistem posture + fatality, 9 AI tier, juice pipeline, dan postMessage bridge `KF_KEYDOWN/KF_KEYUP/KF_ACTION`.

**C6. Halaman showcase (opsional, seperti `index.html` repo ini)**
> Buat halaman **arcade showcase** React + Tailwind yang menampilkan dua game dalam slide **16:9**
> yang bisa di-resize, dengan mode `carousel` dan `side-by-side`. Tiap game di-`iframe`
> (`/game1.html`, `/game2.html`) dan dikendalikan lewat `postMessage`
> (`KF_ACTION: start|pause|restart`, `KF_KEYDOWN/KF_KEYUP`). Sediakan: play/pause/restart per game,
> tombol mute, fullscreen, panduan kontrol, tabel info game (judul, subtitle, versi, deskripsi,
> kontrol), dan **tombol keyboard virtual** untuk perangkat sentuh yang mengirim event ke iframe aktif.
> Saat slide berganti: pause game sebelumnya dan `focus()` iframe yang baru.

---

## LAMPIRAN — Kenapa prompt ini efektif (baca kalau mau bikin prompt sendiri)

| Prinsip | Contoh di prompt ini | Efek kalau dihilangkan |
|---|---|---|
| Angka, bukan kata sifat | "sprint 3× dalam 1.2 detik", "parry window 0.22s" | AI mengarang balance, terasa hambar |
| Tabel data lengkap | 14 stat musuh, 17 upgrade, 10 biome hex | AI bikin 3 musuh generik lalu berhenti |
| Pemisahan arsitektur | `Game` headless ↔ `render` ↔ React shell | Kode jadi spaghetti, susah di-extend |
| Nama sistem yang spesifik | POSTURE, FATALITY, ONE FOR ALL, ENEMY IQ | AI bikin "brawler" generik tanpa identitas |
| Milestone berurutan | M1–M8 | AI melompat ke polish sebelum core jalan |
| Acceptance criteria | checkbox yang bisa dites di browser | Tidak ada cara memverifikasi hasil |
| Hard constraint "tanpa aset" | A17.1 | AI berhalusinasi path gambar & gagal build |
| Larangan placeholder | A20.2 | AI kirim `// ... rest of code` |
