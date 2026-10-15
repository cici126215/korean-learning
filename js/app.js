/* ============================================================
 * 页面渲染与交互逻辑
 * 功能模块：课文 / 生词 / 语法 / 跟读（慢速整篇 · 原速整篇 · 单句循环）
 * ============================================================ */
'use strict';

/* global LESSONS, TTS */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const AVATAR = { '리에': '#c14e53', '웨이': '#3f5d92' };
const CHIP_COLORS = [
  ['#fdecec', '#b04a4a'], ['#eaf1fd', '#3d5a9e'], ['#e9f6ec', '#3f7d51'],
  ['#fdf3df', '#a1742c'], ['#f4ecfb', '#7c4f9e']
];
const ICON_SPEAKER =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';

let current = LESSONS[0];
const player = { active: false, token: 0, mode: null, idx: -1 };
const prefs = { roman: true, cn: true };

/* ================= 渲染 ================= */

function renderHeader() {
  $('#lessonHead').innerHTML = `
    <div class="lesson-no">${current.no}</div>
    <h1 class="lesson-title">${current.title} <span>· ${current.titleCn}</span></h1>
    <p class="lesson-intro">${current.intro}</p>`;
  const sel = $('#lessonSelect');
  sel.innerHTML = LESSONS.map(l => `<option value="${l.id}">제${l.id}과 ${l.titleCn}</option>`).join('');
  sel.value = String(current.id);
}

function lineHTML(d, i) {
  return `
  <div class="dline" data-i="${i}">
    <div class="avatar" style="background:${AVATAR[d.speaker] || '#7c6f64'}">${d.speaker[0]}</div>
    <div class="bubble">
      <div class="who">${d.speaker}<span>${d.speakerCn}</span></div>
      <div class="kr-row">
        <span class="kr">${d.ko}</span>
        <button class="icon-btn js-say" data-say="${d.ko}" title="播放本句">${ICON_SPEAKER}</button>
      </div>
      <div class="roman">${d.roman}</div>
      <div class="trans">${d.cn}</div>
    </div>
  </div>`;
}

function renderDialogue() {
  $('#tab-dialogue').innerHTML = `
    <div class="panel-toolbar">
      <label class="switch"><input type="checkbox" id="tgRoman" checked>罗马音</label>
      <label class="switch"><input type="checkbox" id="tgCn" checked>中文翻译</label>
    </div>
    <div class="dialogue">${current.dialogue.map(lineHTML).join('')}</div>`;
}

function renderVocab() {
  $('#tab-vocab').innerHTML = `
    <h2 class="sec-title" style="padding-top:18px">本课生词<small>点击右侧喇叭听发音</small></h2>
    <div class="table-card"><table class="vocab">
      <thead><tr><th>生词</th><th>罗马音</th><th>词性</th><th>中文释义</th><th>发音 · 用法</th><th></th></tr></thead>
      <tbody>${current.vocab.map(v => `
        <tr>
          <td class="v-ko">${v.ko}</td>
          <td class="v-roman">${v.roman}</td>
          <td>${v.pos}</td>
          <td class="v-cn">${v.cn}</td>
          <td class="v-note">${v.note || '—'}</td>
          <td><button class="icon-btn js-say" data-say="${v.say || v.ko}" title="播放">${ICON_SPEAKER}</button></td>
        </tr>`).join('')}</tbody>
    </table></div>`;
}

function renderGrammar() {
  const cards = current.grammarByLine.map((g, i) => {
    const chips = g.chips.map((c, j) => {
      const [bg, fg] = CHIP_COLORS[j % CHIP_COLORS.length];
      return `${j ? '<span class="plus">＋</span>' : ''}
        <div class="chip" style="background:${bg};color:${fg}"><b>${c.t}</b><i>${c.d}</i></div>`;
    }).join('');
    return `
    <div class="gram-card">
      <div class="g-head">
        <span class="g-idx">${i + 1}</span>
        <span class="g-kr">${current.dialogue[i].ko}</span>
        <button class="icon-btn js-say" data-say="${current.dialogue[i].ko}" title="播放">${ICON_SPEAKER}</button>
      </div>
      <div class="chips">${chips}</div>
      <p class="g-text">${g.explain}</p>
      ${g.tip ? `<div class="g-tip"><b>${g.tipTag || '提示'}</b>${g.tip}</div>` : ''}
    </div>`;
  }).join('');

  const points = current.points.map(p => `
    <div class="point">
      <div class="p-title">${p.title}</div>
      <div class="p-sub">${p.sub}</div>
      <p>${p.body}</p>
      <div class="p-eg">${p.eg}</div>
    </div>`).join('');

  $('#tab-grammar').innerHTML = `
    <h2 class="sec-title" style="padding-top:18px">逐句拆解</h2>
    ${cards}
    <h2 class="sec-title">本课语法点</h2>
    <div class="points-grid">${points}</div>
    ${current.culture ? `<div class="culture"><b>文化小贴士</b>${current.culture}</div>` : ''}`;
}

function renderShadow() {
  $('#tab-shadow').innerHTML = `
    <div id="voiceBanner" class="banner ok" style="margin-top:18px"></div>
    <div class="mode-grid">
      <button class="mode-card js-mode" data-mode="slow">
        <span class="m-t">慢速跟读</span>
        <span class="m-d">整篇课文 · 0.6 倍速朗读，每句后留 3 秒跟读</span>
      </button>
      <button class="mode-card js-mode" data-mode="normal">
        <span class="m-t">原速跟读</span>
        <span class="m-d">整篇课文 · 原速朗读，每句后留 2 秒跟读</span>
      </button>
    </div>
    <div class="player">
      <div class="p-status" id="pStatus">选择上方模式开始跟读</div>
      <div class="p-kr" id="pKr">—</div>
      <div class="p-roman" id="pRoman"></div>
      <div class="dots" id="dots">${current.dialogue.map(() => '<i class="dot"></i>').join('')}</div>
      <button class="stop-btn" id="btnStop" disabled>停 止</button>
    </div>
    <h3 class="sec-title small">单句跟读<small>"跟读"会循环播放该句，直到点击停止</small></h3>
    <div class="single-list">${current.dialogue.map((d, i) => `
      <div class="s-row" data-i="${i}">
        <div class="s-main"><span class="s-kr">${d.ko}</span><span class="s-roman">${d.roman}</span></div>
        <div class="s-btns">
          <button class="txt-btn js-one" data-i="${i}" data-rate="0.6">慢速</button>
          <button class="txt-btn js-one" data-i="${i}" data-rate="1">原速</button>
          <button class="txt-btn js-loop" data-i="${i}">跟读 ⟳</button>
        </div>
      </div>`).join('')}</div>`;
  renderBanner();
}

function renderBanner() {
  const b = $('#voiceBanner');
  if (!b) return;
  if (!TTS.supported) {
    b.className = 'banner warn';
    b.innerHTML = '<b>无法使用跟读</b>当前浏览器不支持语音合成，请改用 Chrome 或 Edge 打开本页面。';
  } else if (!TTS.ready) {
    b.className = 'banner warn';
    b.innerHTML = '<b>未检测到韩语语音</b>请在 Windows 设置 → 时间和语言 → 语言和区域 中添加"韩语"语言（含语音包），或改用 Microsoft Edge 浏览器（自带在线韩语语音）。添加后刷新本页。';
  } else {
    b.className = 'banner ok';
    b.innerHTML = `<b>跟读功能已就绪</b>当前语音：${TTS.voice.name}`;
  }
}

function applyPrefs() {
  const main = $('main');
  main.classList.toggle('hide-roman', !prefs.roman);
  main.classList.toggle('hide-cn', !prefs.cn);
}

function renderAll() {
  renderHeader();
  renderDialogue();
  renderVocab();
  renderGrammar();
  renderShadow();
  applyPrefs();
}

/* ================= 跟读播放 ================= */

/* 真人音频：课文句配了 audio 字段时优先播放音频文件，
 * 文件缺失或播放失败时自动回退到浏览器合成语音 */
const audioEl = new Audio();
audioEl.preload = 'auto';

function playClip(src, rate) {
  return new Promise(resolve => {
    audioEl.pause();
    audioEl.src = src;
    audioEl.playbackRate = rate;
    audioEl.onended = () => resolve(true);
    audioEl.onerror = () => resolve(false);
    const p = audioEl.play();
    if (p && p.catch) p.catch(() => resolve(false));
  });
}

/* 播放一句课文：有录音用录音，没有就用 TTS */
async function speakLine(d, rate) {
  if (d.audio) {
    const ok = await playClip(d.audio, rate);
    if (ok) return;
  }
  await TTS.speak(d.ko, { rate });
}

function setStatus(kind) {
  const el = $('#pStatus');
  if (!el) return;
  if (kind === 'listen') el.innerHTML = '<span class="pulse"></span>播放中 · 请听';
  else if (kind === 'repeat') el.innerHTML = '<span class="mic"></span>请跟读';
  else el.textContent = '选择上方模式开始跟读';
}

function setPlayerLine(i) {
  const d = current.dialogue[i];
  $('#pKr').textContent = d.ko;
  $('#pRoman').textContent = d.roman;
  $$('#dots .dot').forEach((el, j) => el.classList.toggle('on', j === i));
}

function highlight(i) {
  $$('.dline').forEach(el => el.classList.toggle('active', +el.dataset.i === i));
  $$('.s-row').forEach(el => el.classList.toggle('active', +el.dataset.i === i));
  $(`.s-row[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function clearHighlights() {
  $$('.dline.active, .s-row.active').forEach(el => el.classList.remove('active'));
  $$('#dots .dot.on').forEach(el => el.classList.remove('on'));
  player.idx = -1;
}

function updatePlayerUI() {
  const on = player.active;
  const btn = $('#btnStop');
  if (btn) btn.disabled = !on;
  $$('.js-mode').forEach(b =>
    b.classList.toggle('playing', on && player.mode !== 'loop' && b.dataset.mode === player.mode));
  $$('.js-loop').forEach(b =>
    b.classList.toggle('on', on && player.mode === 'loop' && player.idx === +b.dataset.i));
  const shadowVisible = $('.tab.active')?.dataset.tab === 'shadow';
  $('#floatStop')?.classList.toggle('hidden', !(on && !shadowVisible));
  $('.player')?.classList.toggle('on', on);
}

/* 跟读停顿倒计时 */
async function countdown(ms, token) {
  const end = Date.now() + ms;
  while (token === player.token && Date.now() < end) {
    const left = Math.ceil((end - Date.now()) / 1000);
    $('#pStatus').innerHTML = `<span class="mic"></span>请跟读 · ${left}s`;
    await sleep(200);
  }
}

function stopAll() {
  player.token++;          /* 使所有正在运行的播放循环失效 */
  player.active = false;
  player.mode = null;
  TTS.stop();
  audioEl.pause();
  clearHighlights();
  setStatus('idle');
  updatePlayerUI();
}

/* 整篇跟读（慢速 / 原速） */
async function startAll(mode) {
  if (!TTS.supported) return;
  stopAll();
  player.active = true;
  player.mode = mode;
  const token = ++player.token;
  const rate = mode === 'slow' ? 0.6 : 1;
  const pause = mode === 'slow' ? 3000 : 2000;
  updatePlayerUI();
  for (let i = 0; i < current.dialogue.length; i++) {
    if (token !== player.token) return;
    player.idx = i;
    setPlayerLine(i);
    highlight(i);
    setStatus('listen');
    await speakLine(current.dialogue[i], rate);
    if (token !== player.token) return;
    setStatus('repeat');
    await countdown(pause, token);
  }
  if (token === player.token) stopAll();
}

/* 单句跟读：循环播放直到停止 */
async function startLoop(i) {
  if (!TTS.supported) return;
  stopAll();
  player.active = true;
  player.mode = 'loop';
  player.idx = i;
  const token = ++player.token;
  updatePlayerUI();
  setPlayerLine(i);
  highlight(i);
  while (token === player.token) {
    setStatus('listen');
    await speakLine(current.dialogue[i], 1);
    if (token !== player.token) return;
    setStatus('repeat');
    await countdown(2600, token);
  }
}

/* 单次快速播放（生词、课文单句等） */
async function quickSpeak(text, rate) {
  stopAll();
  await TTS.speak(text, { rate });
}

/* ================= 事件 ================= */

function switchTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  updatePlayerUI();
}

document.addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (tab) { switchTab(tab.dataset.tab); return; }

  const mode = e.target.closest('.js-mode');
  if (mode) { startAll(mode.dataset.mode); return; }

  const loop = e.target.closest('.js-loop');
  if (loop) {
    const i = +loop.dataset.i;
    if (player.active && player.mode === 'loop' && player.idx === i) stopAll();
    else startLoop(i);
    return;
  }

  const one = e.target.closest('.js-one');
  if (one) { quickSpeak(current.dialogue[+one.dataset.i].ko, +one.dataset.rate); return; }

  const say = e.target.closest('.js-say');
  if (say) { quickSpeak(say.dataset.say, 1); return; }

  if (e.target.closest('#btnStop') || e.target.closest('#floatStop')) stopAll();
});

document.addEventListener('change', e => {
  if (e.target.id === 'lessonSelect') {
    current = LESSONS.find(l => l.id === +e.target.value) || LESSONS[0];
    stopAll();
    renderAll();
  } else if (e.target.id === 'tgRoman') {
    prefs.roman = e.target.checked; applyPrefs();
  } else if (e.target.id === 'tgCn') {
    prefs.cn = e.target.checked; applyPrefs();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') stopAll();
});

/* ================= 初始化 ================= */

TTS.init();
TTS.onChange(renderBanner);
renderAll();
updatePlayerUI();
