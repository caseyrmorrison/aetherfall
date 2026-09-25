/** Audio test bench: live playback of every track / SFX + offline level analysis. */
import {
  audio,
  getCompiledSong,
  MUSIC_IDS,
  SFX_IDS,
  type AudioVolumes,
  type MusicId,
  type SfxId,
} from '../src/audio/index';
import {
  activeRms,
  analyze,
  renderMusic,
  renderSfx,
  renderTrackSolo,
  representativeBeat,
  type Analysis,
} from '../src/audio/offline';
import { SFX } from '../src/audio/sfx';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const status = $('status');

// unlock on first gesture
const unlock = (): void => {
  audio.unlock();
  status.textContent = audio.unlocked
    ? `Audio running (${audio.context?.sampleRate} Hz)`
    : 'Audio locked — click to unlock.';
};
window.addEventListener('pointerdown', unlock, true);
window.addEventListener('keydown', unlock, true);
(window as unknown as { audio: typeof audio }).audio = audio;

// ---- volumes
const vols: AudioVolumes = { master: 0.8, music: 0.6, sfx: 0.8 };
audio.setVolumes(vols);
for (const k of ['master', 'music', 'sfx'] as const) {
  const l = document.createElement('label');
  l.innerHTML = `${k} <input type="range" min="0" max="1" step="0.01" value="${vols[k]}" /><b>${vols[k].toFixed(2)}</b>`;
  const input = l.querySelector('input')!;
  const b = l.querySelector('b')!;
  input.addEventListener('input', () => {
    vols[k] = parseFloat(input.value);
    b.textContent = vols[k].toFixed(2);
    audio.setVolumes(vols);
  });
  $('volumes').appendChild(l);
}

// ---- music
const musicButtons = new Map<MusicId, HTMLButtonElement>();
const refreshMusic = (): void =>
  musicButtons.forEach((b, id) => b.classList.toggle('on', audio.currentMusic === id));
for (const id of MUSIC_IDS) {
  const b = document.createElement('button');
  b.textContent = id;
  b.addEventListener('click', () => {
    unlock();
    audio.playMusic(id, { fade: parseFloat(($('fade') as HTMLInputElement).value) || 0 });
    refreshMusic();
  });
  musicButtons.set(id, b);
  $('music').appendChild(b);
}
$('stop').addEventListener('click', () => {
  audio.stopMusic(parseFloat(($('fade') as HTMLInputElement).value) || 0);
  refreshMusic();
});
$('duck').addEventListener('click', () => audio.duckMusic(0.7, 1.5));
const intensity = $<HTMLInputElement>('intensity');
intensity.addEventListener('input', () => {
  audio.setIntensity(parseFloat(intensity.value));
  $('intensityVal').textContent = parseFloat(intensity.value).toFixed(2);
});

// ---- sfx
const GROUPS: [string, RegExp][] = [
  ['ui', /^(ui_|text_)/],
  ['player', /^(swing|staff|dodge|footstep|hurt|low_hp|death|heal|potion|equip|no_mana)/],
  ['combat', /^(hit|crit|enemy|block|arrow|projectile)/],
  [
    'skills',
    /^(dash|whirl|fire|explo|frost|ice|light|blades|meteor|surge|charge|tele|summon|roar|slam|void|telegraph)/,
  ],
  ['world', /^(coin|pickup|chest|door|waypoint|save|quest|shop|upgrade|salvage)/],
  ['stingers', /^stinger_/],
];
const sfxOpts = (): { pan: number; pitch: number } => ({
  pan: parseFloat(($('pan') as HTMLInputElement).value),
  pitch: parseFloat(($('pitch') as HTMLInputElement).value),
});
const placed = new Set<SfxId>();
for (const [name, re] of GROUPS) {
  const g = document.createElement('div');
  g.className = 'group row';
  g.innerHTML = `<span>${name}</span>`;
  for (const id of SFX_IDS) {
    if (placed.has(id) || !re.test(id)) continue;
    placed.add(id);
    const b = document.createElement('button');
    b.textContent = id;
    b.addEventListener('click', () => {
      unlock();
      audio.playSfx(id, sfxOpts());
    });
    g.appendChild(b);
  }
  $('sfx').appendChild(g);
}
const rest = SFX_IDS.filter((id) => !placed.has(id));
if (rest.length) console.warn('ungrouped sfx', rest);

$('stress').addEventListener('click', () => {
  unlock();
  for (let i = 0; i < 60; i++) audio.playSfx(i % 2 ? 'hit' : 'enemy_die', { pan: Math.random() * 2 - 1 });
});
$('blips').addEventListener('click', () => {
  unlock();
  let n = 0;
  const iv = setInterval(() => {
    audio.playSfx('text_blip');
    if (++n >= 20) clearInterval(iv);
  }, 60);
});

// ---- offline analysis
// Results are persisted in sessionStorage after every item, so a page reload (e.g. a Vite
// full-reload while other files change) resumes the run instead of losing it.
const STORE = 'aetherfall-audio-analysis-v1';
const SEC = 8;

interface Lvl {
  peak: number;
  rms: number;
  tail: number;
  clipped: number;
  nan: boolean;
}
interface State {
  running: boolean;
  started: number;
  finished?: number;
  sfx: Partial<Record<SfxId, Lvl & { act: number }>>;
  music: Partial<Record<MusicId, { s0: Lvl; s1: Lvl; l0: Lvl; l1: Lvl }>>;
}

const lvl = (a: Analysis): Lvl => ({
  peak: a.peak,
  rms: a.rms,
  tail: a.tail,
  clipped: a.clipped,
  nan: a.nan,
});
const dB = (x: number): number => (x > 0 ? 20 * Math.log10(x) : -Infinity);
const fmtDb = (x: number): string => (Number.isFinite(x) ? x.toFixed(1) : '-inf');

function load(): State | null {
  try {
    const raw = sessionStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as State) : null;
  } catch {
    return null;
  }
}
function save(st: State): void {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(st));
  } catch {
    /* ignore */
  }
}

function sfxFlags(id: SfxId, a: Lvl): string[] {
  const f: string[] = [];
  const def = SFX[id];
  if (a.nan) f.push('NaN');
  if (a.peak < 0.01) f.push('SILENT');
  if (a.peak > 0.99) f.push(`CLIP(${a.clipped})`);
  // `max` is the dry length; effects with a reverb send get room for the (short) sfx reverb tail
  const allow = def.max + (def.rev ? 0.6 : 0.05);
  if (a.tail > allow) f.push(`LONG(${a.tail.toFixed(2)}>${allow.toFixed(2)})`);
  return f;
}

function render(st: State): void {
  const flagCell = (f: string[]): string =>
    f.length ? `<td class="flags bad">${f.join(' ')}</td>` : '<td class="flags ok">ok</td>';
  let nFlag = 0;
  let total = 0;
  const report: Record<string, unknown> = {};

  const sfxIds = SFX_IDS.filter((id) => st.sfx[id]);
  const sfxRows = sfxIds.map((id) => {
    const a = st.sfx[id]!;
    const f = sfxFlags(id, a);
    total++;
    if (f.length) nFlag++;
    return `<tr><td>${id}</td><td>${a.peak.toFixed(3)}</td><td>${fmtDb(dB(a.peak))}</td><td>${fmtDb(dB(a.act))}</td><td>${a.tail.toFixed(2)}</td><td>${SFX[id].max.toFixed(2)}</td>${flagCell(f)}</tr>`;
  });
  report.sfx = sfxIds.map((id) => {
    const a = st.sfx[id]!;
    return {
      id,
      peak: +a.peak.toFixed(3),
      actDb: +dB(a.act).toFixed(1),
      tail: +a.tail.toFixed(2),
      max: SFX[id].max,
      flags: sfxFlags(id, a),
    };
  });

  const musIds = MUSIC_IDS.filter((id) => st.music[id]);
  const loopDb = musIds.map((id) => dB(st.music[id]!.l0.rms)).sort((a, b) => a - b);
  const median = loopDb.length ? loopDb[Math.floor(loopDb.length / 2)] : 0;
  const musFlags = (id: MusicId): string[] => {
    const m = st.music[id]!;
    const f: string[] = [];
    for (const [tag, a] of [
      ['i0', m.s0],
      ['i1', m.s1],
      ['loop0', m.l0],
      ['loop1', m.l1],
    ] as const) {
      if (a.nan) f.push(`NaN(${tag})`);
      if (a.rms < 0.004) f.push(`SILENT(${tag})`);
      if (a.peak > 0.99) f.push(`CLIP(${tag}:${a.clipped})`);
    }
    const dev = dB(m.l0.rms) - median;
    if (Math.abs(dev) > 3) f.push(`LEVEL(${dev > 0 ? '+' : ''}${dev.toFixed(1)}dB vs median)`);
    const w = getCompiledSong(id).warnings;
    if (w.length) f.push(`NOTATION(${w.length}): ${w.slice(0, 3).join('; ')}`);
    return f;
  };
  const musRows = musIds.map((id) => {
    const m = st.music[id]!;
    const f = musFlags(id);
    total++;
    if (f.length) nFlag++;
    const c = [
      m.s0.peak.toFixed(3),
      fmtDb(dB(m.s0.rms)),
      m.s1.peak.toFixed(3),
      fmtDb(dB(m.s1.rms)),
      fmtDb(dB(m.l0.rms)),
      fmtDb(dB(m.l1.rms)),
      m.l1.peak.toFixed(3),
      (dB(m.l1.rms) - dB(m.l0.rms)).toFixed(1),
      (dB(m.l0.rms) - median).toFixed(1),
    ];
    return `<tr><td>${id}</td>${c.map((x) => `<td>${x}</td>`).join('')}${flagCell(f)}</tr>`;
  });
  report.music = musIds.map((id) => {
    const m = st.music[id]!;
    return {
      id,
      peak0: +m.s0.peak.toFixed(3),
      rms0: +dB(m.s0.rms).toFixed(1),
      peak1: +m.s1.peak.toFixed(3),
      rms1: +dB(m.s1.rms).toFixed(1),
      loopRms0: +dB(m.l0.rms).toFixed(1),
      loopRms1: +dB(m.l1.rms).toFixed(1),
      loopPeak1: +m.l1.peak.toFixed(3),
      flags: musFlags(id),
    };
  });

  $('results').innerHTML = `
    <h2>SFX (${sfxRows.length}/${SFX_IDS.length}) — rendered through the full mixer at unity volumes</h2>
    <table><tr><th>sfx</th><th>peak</th><th>peak dB</th><th>active rms dB</th><th>tail s</th><th>max s</th><th>flags</th></tr>${sfxRows.join('')}</table>
    <h2 style="margin-top:14px">Music (${musRows.length}/${MUSIC_IDS.length}) — first ${SEC}s at intensity 0 / 1, and ${SEC}s from the loop point</h2>
    <table><tr><th>track</th><th>peak i0</th><th>rms i0</th><th>peak i1</th><th>rms i1</th><th>loop rms i0</th><th>loop rms i1</th><th>loop peak i1</th><th>i1-i0 dB</th><th>vs median</th><th>flags</th></tr>${musRows.join('')}</table>`;

  const sfxPeaks = sfxIds.map((id) => st.sfx[id]!.peak).sort((a, b) => a - b);
  const done = !st.running && st.finished;
  const secs = done ? ((st.finished! - st.started) / 1000).toFixed(1) : '…';
  $('summary').innerHTML =
    `<span class="${nFlag ? 'bad' : 'ok'}">${done ? 'ANALYSIS DONE' : 'ANALYSIS RUNNING'} (${secs}s) — ${nFlag} item(s) flagged of ${total}.</span>\n` +
    (loopDb.length
      ? `Music loop RMS (i0): median ${median.toFixed(1)} dBFS, range ${loopDb[0].toFixed(1)} .. ${loopDb[loopDb.length - 1].toFixed(1)} dBFS.\n`
      : '') +
    (sfxPeaks.length
      ? `SFX peaks: min ${sfxPeaks[0].toFixed(3)}, median ${sfxPeaks[Math.floor(sfxPeaks.length / 2)].toFixed(3)}, max ${sfxPeaks[sfxPeaks.length - 1].toFixed(3)}.`
      : '');
  report.summary = { done: !!done, flagged: nFlag, total, medianLoopRmsDb: +median.toFixed(1) };
  (window as unknown as { __audioReport: unknown }).__audioReport = report;
}

async function runAnalysis(resume: boolean): Promise<void> {
  const btn = $<HTMLButtonElement>('analyze');
  btn.disabled = true;
  const progress = $('progress');
  const prev = resume ? load() : null;
  const st: State = prev && prev.running ? prev : { running: true, started: Date.now(), sfx: {}, music: {} };
  save(st);
  for (let i = 0; i < SFX_IDS.length; i++) {
    const id = SFX_IDS[i];
    if (st.sfx[id]) continue;
    progress.textContent = `sfx ${i + 1}/${SFX_IDS.length} ${id}`;
    const buf = await renderSfx(id);
    st.sfx[id] = { ...lvl(analyze(buf)), act: activeRms(buf) };
    save(st);
  }
  for (let i = 0; i < MUSIC_IDS.length; i++) {
    const id = MUSIC_IDS[i];
    if (st.music[id]) continue;
    progress.textContent = `music ${i + 1}/${MUSIC_IDS.length} ${id}`;
    // sequential on purpose: parallel offline renders can exhaust the renderer
    const s0 = lvl(analyze(await renderMusic(id, SEC, 0)));
    const s1 = lvl(analyze(await renderMusic(id, SEC, 1)));
    const l0 = lvl(analyze(await renderMusic(id, SEC, 0, true), 0.5));
    const l1 = lvl(analyze(await renderMusic(id, SEC, 1, true), 0.5));
    st.music[id] = { s0, s1, l0, l1 };
    save(st);
    render(st);
  }
  st.running = false;
  st.finished = Date.now();
  save(st);
  render(st);
  progress.textContent = '';
  btn.disabled = false;
}

const fail = (e: unknown): void => {
  console.error(e);
  $('summary').innerHTML = `<span class="bad">Analysis failed: ${String(e)}</span>`;
  $<HTMLButtonElement>('analyze').disabled = false;
};
$('analyze').addEventListener('click', () => runAnalysis(false).catch(fail));

// resume an interrupted run, or show the last results
const prevState = load();
if (prevState?.running) runAnalysis(true).catch(fail);
else if (prevState) render(prevState);

// ---- per-track breakdown (RMS of each track solo, 8 s from a representative point, intensity 1)
const BD_STORE = 'aetherfall-audio-breakdown-v1';
interface BdState {
  running: boolean;
  res: Partial<Record<MusicId, Record<string, number | null>>>;
}
function bdLoad(): BdState | null {
  try {
    const raw = sessionStorage.getItem(BD_STORE);
    return raw ? (JSON.parse(raw) as BdState) : null;
  } catch {
    return null;
  }
}
function bdSave(st: BdState): void {
  try {
    sessionStorage.setItem(BD_STORE, JSON.stringify(st));
  } catch {
    /* ignore */
  }
}
function bdRender(st: BdState): void {
  const rows = MUSIC_IDS.filter((id) => st.res[id]).map((id) => {
    const r = st.res[id]!;
    const cells = Object.entries(r)
      .map(([k, v]) => `${k} <b>${v === null ? '—' : v.toFixed(1)}</b>`)
      .join(' &nbsp; ');
    return `<tr><td>${id}</td><td class="flags">${cells}</td></tr>`;
  });
  $('breakdownOut').innerHTML =
    `<h2 style="margin-top:14px">Per-track RMS dBFS (solo, intensity 1)${st.running ? ' — running…' : ' — done'}</h2><table>${rows.join('')}</table>`;
  (window as unknown as { __audioBreakdown: unknown }).__audioBreakdown = st;
}
async function runBreakdown(resume: boolean): Promise<void> {
  const prev = resume ? bdLoad() : null;
  const st: BdState = prev && prev.running ? prev : { running: true, res: {} };
  bdSave(st);
  for (const id of MUSIC_IDS) {
    if (st.res[id]) continue;
    $('progress').textContent = `breakdown ${id}`;
    const song = getCompiledSong(id);
    const beat = representativeBeat(id);
    const r: Record<string, number | null> = {};
    for (let k = 0; k < song.trackNames.length; k++) {
      const a = analyze(await renderTrackSolo(id, k, SEC, 1, beat), 0.3);
      r[song.trackNames[k]] = Number.isFinite(a.rmsDb) && a.rms > 1e-5 ? +a.rmsDb.toFixed(1) : null;
    }
    st.res[id] = r;
    bdSave(st);
    bdRender(st);
  }
  st.running = false;
  bdSave(st);
  bdRender(st);
  $('progress').textContent = '';
}
$('breakdown').addEventListener('click', () => runBreakdown(false).catch(fail));
const prevBd = bdLoad();
if (prevBd?.running) runBreakdown(true).catch(fail);
else if (prevBd) bdRender(prevBd);
