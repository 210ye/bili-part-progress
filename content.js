(function () {
  'use strict';

  const PANEL_ID = 'bili-pp-progress-panel';
  const STYLE_ID = 'bili-pp-progress-style';
  const TICK_MS = 800;

  let enabled = true;
  let cache = { bv: null, data: null };

  // ---------- 样式 ----------
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        top: 90px;
        right: 24px;
        z-index: 999999;
        width: 240px;
        padding: 12px 14px;
        border-radius: 10px;
        background: rgba(30, 30, 34, 0.92);
        color: #fff;
        font-size: 13px;
        line-height: 1.5;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
        font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
      }
      #${PANEL_ID} .bp-title {
        font-weight: 600;
        margin-bottom: 8px;
        color: #fb7299;
      }
      #${PANEL_ID} .bp-bar {
        height: 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.18);
        overflow: hidden;
        margin-bottom: 8px;
      }
      #${PANEL_ID} .bp-fill {
        height: 100%;
        width: 0%;
        border-radius: 4px;
        background: linear-gradient(90deg, #fb7299, #ff9ec1);
        transition: width 0.3s ease;
      }
      #${PANEL_ID} .bp-text {
        color: rgba(255, 255, 255, 0.85);
        font-variant-numeric: tabular-nums;
      }
    `;
    document.documentElement.appendChild(style);
  }

  // ---------- 悬浮窗 ----------
  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    ensureStyle();
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="bp-title">观看进度</div>
      <div class="bp-bar"><div class="bp-fill"></div></div>
      <div class="bp-text">加载中…</div>
    `;
    document.body.appendChild(panel);
    return panel;
  }

  function render(ratio, watchedSec, totalSec, p, totalP) {
    const panel = ensurePanel();
    panel.style.display = enabled ? 'block' : 'none';
    panel.querySelector('.bp-fill').style.width = (ratio * 100).toFixed(1) + '%';
    panel.querySelector('.bp-text').textContent =
      `${(ratio * 100).toFixed(1)}% · P${p}/${totalP} · ${fmt(watchedSec)} / ${fmt(totalSec)}`;
  }

  function hidePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.style.display = 'none';
  }

  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const mm = h ? String(m).padStart(2, '0') : String(m);
    return (h ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
  }

  // ---------- 数据 ----------
  function getBV() {
    const m = location.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/);
    return m ? m[1] : null;
  }

  function getP() {
    const p = parseInt(new URLSearchParams(location.search).get('p'), 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  }

  async function fetchData(bv) {
    const res = await fetch(
      `https://api.bilibili.com/x/web-interface/view?bvid=${bv}`,
      { credentials: 'include' }
    );
    const json = await res.json();
    if (json.code !== 0 || !json.data || !Array.isArray(json.data.pages)) return null;
    return json.data;
  }

  function getCurrentTime() {
    const video = document.querySelector('video');
    return video ? video.currentTime : 0;
  }

  // ---------- 主循环 ----------
  async function tick() {
    const bv = getBV();
    if (!bv || !enabled) { hidePanel(); return; }

    if (cache.bv !== bv) {
      cache = { bv, data: null };
      renderLoading();
      cache.data = await fetchData(bv).catch(() => null);
    }

    const data = cache.data;
    if (!data || !data.pages.length) { hidePanel(); return; }

    const pages = data.pages;
    const totalSec = pages.reduce((sum, pg) => sum + (pg.duration || 0), 0);
    if (!totalSec) { hidePanel(); return; }

    const p = Math.min(getP(), pages.length);
    const idx = p - 1;

    // 当前 P 之前的所有分 P 都算看完，加上当前 P 的实时进度
    let watchedSec = 0;
    for (let i = 0; i < idx; i++) watchedSec += pages[i].duration || 0;
    watchedSec += Math.min(getCurrentTime(), pages[idx].duration || 0);

    render(watchedSec / totalSec, watchedSec, totalSec, p, pages.length);
  }

  function renderLoading() {
    const panel = ensurePanel();
    panel.style.display = enabled ? 'block' : 'none';
    panel.querySelector('.bp-text').textContent = '加载中…';
  }

  // ---------- 开关 ----------
  function syncEnabled() {
    chrome.storage.sync.get({ enabled: true }, (r) => { enabled = r.enabled; });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.enabled) {
      enabled = changes.enabled.newValue;
      if (!enabled) hidePanel();
    }
  });

  syncEnabled();
  setInterval(tick, TICK_MS);
})();
