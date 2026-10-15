/* ============================================================
 * 韩语语音合成引擎（基于浏览器 Web Speech API，免费离线）
 * - 自动挑选可用的韩语语音（优先 Natural / Online 音色）
 * - speak(text, { rate }) 返回 Promise，读完自动 resolve
 * ============================================================ */
'use strict';

const TTS = (() => {
  const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  let voice = null;
  let ready = false;
  const changeCbs = [];

  function pick() {
    if (!supported) return;
    const all = speechSynthesis.getVoices() || [];
    const ko = all.filter(v => (v.lang || '').toLowerCase().replace('_', '-').startsWith('ko'));
    let best = null;
    if (ko.length) {
      best =
        ko.find(v => /natural/i.test(v.name)) ||
        ko.find(v => /sunhi|suni|injoon|heami|google/i.test(v.name)) ||
        ko.find(v => v.lang.toLowerCase().replace('_', '-') === 'ko-kr') ||
        ko[0];
    }
    const changed = best !== voice;
    voice = best;
    ready = !!voice;
    if (changed) changeCbs.forEach(cb => cb(voice));
  }

  function init() {
    if (!supported) return;
    pick();
    try { speechSynthesis.addEventListener('voiceschanged', pick); } catch (e) { /* 旧浏览器 */ }
    /* 部分浏览器语音列表异步加载，多探测几次 */
    [300, 800, 1500].forEach(t => setTimeout(pick, t));
  }

  function speak(text, { rate = 1 } = {}) {
    if (!supported) return Promise.resolve();
    speechSynthesis.cancel();
    return new Promise(resolve => {
      /* cancel 后立刻 speak 在 Chrome 上偶发被吞，稍作延迟 */
      setTimeout(() => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'ko-KR';
        if (voice) u.voice = voice;
        u.rate = rate;
        u.pitch = 1;
        u.volume = 1;
        let done = false;
        const finish = () => { if (!done) { done = true; clearTimeout(guard); resolve(); } };
        /* 兜底超时：部分浏览器不触发 onend */
        const est = Math.max(1200, (text.length * 330) / Math.max(rate, 0.4));
        const guard = setTimeout(finish, est + 3000);
        u.onend = finish;
        u.onerror = finish;
        speechSynthesis.speak(u);
      }, 60);
    });
  }

  function stop() {
    if (supported) speechSynthesis.cancel();
  }

  return {
    supported, init, speak, stop,
    onChange(cb) { changeCbs.push(cb); },
    get voice() { return voice; },
    get ready() { return ready; }
  };
})();
