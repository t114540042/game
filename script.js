(function () {

  /* ── 遊戲容器尺寸 ── */
  const W = 960;
  const H = 540;

  /* ── 蜜蜂尺寸與速度 ── */
  const BEE_W   = 85;
  const BEE_H   = 85;
  const BEE_SPD = 5;

  /* ── 各物件顯示大小 ── */
  const SIZES = {
    flower1:    { w: 90, h: 90 },
    flower4:    { w: 90, h: 90 },
    dragonfly:  { w: 75, h: 75 },
    berry:      { w: 65, h: 65 },
    mangosteen: { w: 70, h: 70 },
    pepper:     { w: 65, h: 65 },
  };

  /* ── 隨機配置參數 ── */
  const PADDING   = 18;
  const MAX_TRIES = 500;

  const FULL_ZONE = {
    xMin: Math.round(W * 0.14),
    xMax: Math.round(W * 0.82),
    yMin: Math.round(H * 0.05),
    yMax: Math.round(H * 0.78),
  };

  const FLOWER_ZONES = {
    flower1: { xMin: Math.round(W * 0.14), xMax: Math.round(W * 0.37) },
    flower4: { xMin: Math.round(W * 0.58), xMax: Math.round(W * 0.82) },
  };

  /* ── 方向鍵控制區保護範圍（隨機配置 & 蜜蜂邊界共用）── */
  const CTRL = {
    xMin: Math.round(W * 0.77),  // ~739px
    yMin: Math.round(H * 0.62),  // ~335px
  };

  /* ════════════════════════════════════
     隨機配置工具函式
     ════════════════════════════════════ */

  function rectsOverlap(a, b, pad) {
    const p = (pad !== undefined) ? pad : PADDING;
    return (
      a.x         < b.x + b.w + p &&
      a.x + a.w + p > b.x         &&
      a.y         < b.y + b.h + p &&
      a.y + a.h + p > b.y
    );
  }

  function hitsCtrl(x, y, w, h) {
    return (x + w + PADDING > CTRL.xMin) && (y + h + PADDING > CTRL.yMin);
  }

  function randomPosInZone(w, h, zone) {
    const x = Math.random() * Math.max(zone.xMax - zone.xMin - w, 0) + zone.xMin;
    const y = Math.random() * Math.max(FULL_ZONE.yMax - FULL_ZONE.yMin - h, 0) + FULL_ZONE.yMin;
    return { x: Math.round(x), y: Math.round(y), w, h };
  }

  function safePos(w, h, others, zone) {
    const gen = zone ? () => randomPosInZone(w, h, zone)
                     : () => randomPosInZone(w, h, FULL_ZONE);
    for (let i = 0; i < MAX_TRIES; i++) {
      const p = gen();
      if (hitsCtrl(p.x, p.y, w, h)) continue;
      if (others.some(o => rectsOverlap(p, o))) continue;
      return p;
    }
    for (let i = 0; i < MAX_TRIES; i++) {
      const p = gen();
      if (hitsCtrl(p.x, p.y, w, h)) continue;
      if (others.some(o => rectsOverlap(p, o, 0))) continue;
      return p;
    }
    let fb;
    do { fb = gen(); } while (hitsCtrl(fb.x, fb.y, w, h));
    return fb;
  }

  function applyPos(id, pos) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.left = pos.x + 'px';
    el.style.top  = pos.y + 'px';
  }

  /* ════════════════════════════════════
     隨機配置其他物件
     ════════════════════════════════════ */

  const placed = [];

  const posF1 = safePos(SIZES.flower1.w, SIZES.flower1.h, placed, FLOWER_ZONES.flower1);
  placed.push(posF1);
  applyPos('flower1', posF1);

  const posF4 = safePos(SIZES.flower4.w, SIZES.flower4.h, placed, FLOWER_ZONES.flower4);
  placed.push(posF4);
  applyPos('flower4', posF4);

  ['dragonfly', 'berry', 'mangosteen', 'pepper'].forEach(id => {
    const { w, h } = SIZES[id];
    const pos = safePos(w, h, placed);
    placed.push(pos);
    applyPos(id, pos);
  });

  /* ════════════════════════════════════
     蜜蜂移動控制
     ════════════════════════════════════ */

  const beeEl = document.getElementById('bee');

  /* 初始位置（像素）*/
  let beeX = Math.round(W * 0.02);          // left: 2%  ≈ 19px
  let beeY = Math.round((H - BEE_H) / 2);  // 垂直置中  ≈ 228px
  let facingRight = true;                    // bee.png 原始朝右

  /** 將蜜蜂位置渲染到畫面 */
  function renderBee() {
    beeEl.style.left      = beeX + 'px';
    beeEl.style.top       = beeY + 'px';
    beeEl.style.transform = facingRight ? 'scaleX(1)' : 'scaleX(-1)';
  }

  /**
   * 邊界限制：
   *   - 四邊不可超出畫面
   *   - 若蜜蜂底邊進入控制區 y 範圍，x 不可超過控制區左邊界
   */
  function clamp(nx, ny) {
    nx = Math.max(0, Math.min(nx, W - BEE_W));
    ny = Math.max(0, Math.min(ny, H - BEE_H));
    if (ny + BEE_H > CTRL.yMin) {
      nx = Math.min(nx, CTRL.xMin - BEE_W);
    }
    return { nx, ny };
  }

  /** 執行移動 */
  function moveBee(dir) {
    let nx = beeX;
    let ny = beeY;

    switch (dir) {
      case 'up':    ny -= BEE_SPD; break;
      case 'down':  ny += BEE_SPD; break;
      case 'left':  nx -= BEE_SPD; facingRight = false; break;
      case 'right': nx += BEE_SPD; facingRight = true;  break;
    }

    const { nx: cx, ny: cy } = clamp(nx, ny);
    beeX = cx;
    beeY = cy;
    renderBee();
  }

  /* 初始渲染（覆蓋 CSS 的 transform: translateY(-50%)）*/
  renderBee();

  /* ── D-Pad 按鈕 ── */
  document.getElementById('btn-up').addEventListener('click',    () => moveBee('up'));
  document.getElementById('btn-down').addEventListener('click',  () => moveBee('down'));
  document.getElementById('btn-left').addEventListener('click',  () => moveBee('left'));
  document.getElementById('btn-right').addEventListener('click', () => moveBee('right'));

  /* ── 鍵盤方向鍵（電腦操作用）── */
  document.addEventListener('keydown', e => {
    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); moveBee('up');    break;
      case 'ArrowDown':  e.preventDefault(); moveBee('down');  break;
      case 'ArrowLeft':  e.preventDefault(); moveBee('left');  break;
      case 'ArrowRight': e.preventDefault(); moveBee('right'); break;
    }
  });

})();
