(function () {

  /* ── 遊戲容器尺寸（動態拳視窗）── */
  const W = window.innerWidth;
  const H = window.innerHeight;

  /* ── 蜜蜂尺寸與速度 ── */
  const BEE_W   = 90;
  const BEE_H   = 90;
  let beeSpd = 10;
  let mangosteenBoosted = false;
  let pepperPenalized   = false;
  let flower1Touched    = false;  // 是否已碰到花1
  let flower4Touched    = false;  // 是否已碰到花4
  let frozen            = false;  // 蜻蜓碰撞期間禁止操作

  /* ── 各物件顯示大小 ── */
  const SIZES = {
    flower1:    { w: 110, h: 110 },
    flower4:    { w: 110, h: 110 },
    dragonfly:  { w: 90,  h: 90  },
    mangosteen: { w: 85,  h: 85  },
    pepper:     { w: 80,  h: 80  },
  };

  /* ── 隨機配置參數 ── */
  const PADDING   = 80;    // 物件間距（確保不重疊）
  const MAX_TRIES = 1000;

  const FULL_ZONE = {
    xMin: Math.round(W * 0.10),
    xMax: Math.round(W * 0.90),
    yMin: Math.round(H * 0.05),
    yMax: Math.round(H * 0.80),
  };

  const FLOWER_ZONES = {
    flower1: { xMin: Math.round(W * 0.10), xMax: Math.round(W * 0.28) },
    flower4: { xMin: Math.round(W * 0.72), xMax: Math.round(W * 0.90) },
  };

  /* ── 中間區域（蜻蜓、山竹、辣椒）：28%~72%，空間充足不重疊 ── */
  const MIDDLE_ZONE = {
    xMin: Math.round(W * 0.28),   // 花一右側
    xMax: Math.round(W * 0.72),   // 花四左側
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

  ['dragonfly', 'mangosteen', 'pepper'].forEach(id => {
    const { w, h } = SIZES[id];
    const pos = safePos(w, h, placed, MIDDLE_ZONE);  // 在兩花中間配置
    placed.push(pos);
    applyPos(id, pos);
  });

  /* ════════════════════════════════════
     蜜蜂移動控制
     ════════════════════════════════════ */

  const beeEl = document.getElementById('bee');

  /* 移動音效 */
  const clickSound = new Audio('click.mp3');
  clickSound.volume = 0.6;

  /* 碰到蜻蜓音效 */
  const errorSound = new Audio('errorse.mp3');
  errorSound.volume = 0.8;

  /* 碰到蜻蜓特效 */
  const wooSound = new Audio('woo.mp3');
  wooSound.volume = 1.0;

  /* 碰到花音效 */
  const rightSound = new Audio('rightse.mp3');
  rightSound.volume = 0.8;

  /* 授粉成功音效 */
  const winSound = new Audio('winse.mp3');
  winSound.volume = 1.0;

  /* 初始位置（像素）*/
  const BEE_INIT_X = Math.round(W * 0.02);          // left: 2%  ≈ 19px
  const BEE_INIT_Y = Math.round((H - BEE_H) / 2);  // 垂直置中  ≈ 228px
  let beeX = BEE_INIT_X;
  let beeY = BEE_INIT_Y;
  let facingRight = true;                            // bee.png 原始朝右

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
    if (frozen) return;   // 凍結期間不可移動
    let nx = beeX;
    let ny = beeY;

    // 播放移動音效（每次重置確保連按都能觸發）
    clickSound.currentTime = 0;
    clickSound.play().catch(() => {});

    switch (dir) {
      case 'up':    ny -= beeSpd; break;
      case 'down':  ny += beeSpd; break;
      case 'left':  nx -= beeSpd; facingRight = false; break;
      case 'right': nx += beeSpd; facingRight = true;  break;
    }

    const { nx: cx, ny: cy } = clamp(nx, ny);
    beeX = cx;
    beeY = cy;
    renderBee();
    checkCollisions();
  }

  /** 蜜蜂碰到蜻蜓 → 遊戲完整重新開始 */
  function restartGame() {
    // 0. 凍結操作
    frozen = true;

    // 1. 播放音效與特效
    errorSound.currentTime = 0;
    errorSound.play().catch(() => {});
    wooSound.currentTime = 0;
    wooSound.play().catch(() => {});

    // 2. 重置蜜蜂位置與方向
    beeX = BEE_INIT_X;
    beeY = BEE_INIT_Y;
    facingRight = true;
    renderBee();

    // 3. 重置所有遊戲狀態
    beeSpd            = 10;
    mangosteenBoosted = false;
    pepperPenalized   = false;
    flower1Touched    = false;
    flower4Touched    = false;

    // 4. 隱藏 ok 圖示
    const ok1 = document.getElementById('ok1');
    const ok4 = document.getElementById('ok4');
    if (ok1) { ok1.style.display = 'none'; ok1.style.animation = 'none'; }
    if (ok4) { ok4.style.display = 'none'; ok4.style.animation = 'none'; }

    // 5. 隱藏成功畫面
    const screen = document.getElementById('success-screen');
    if (screen) screen.classList.remove('show');

    // 6. 重新隨機配置所有物件
    const newPlaced = [];
    const newF1 = safePos(SIZES.flower1.w, SIZES.flower1.h, newPlaced, FLOWER_ZONES.flower1);
    newPlaced.push(newF1); applyPos('flower1', newF1);
    const newF4 = safePos(SIZES.flower4.w, SIZES.flower4.h, newPlaced, FLOWER_ZONES.flower4);
    newPlaced.push(newF4); applyPos('flower4', newF4);
    ['dragonfly', 'mangosteen', 'pepper'].forEach(id => {
      const { w, h } = SIZES[id];
      const pos = safePos(w, h, newPlaced, MIDDLE_ZONE);
      newPlaced.push(pos); applyPos(id, pos);
    });

    // 7. 倒數計時（依 woo.mp3 實際時長）
    const cdScreen = document.getElementById('countdown-screen');
    const cdNumber = document.getElementById('countdown-number');
    cdScreen.classList.add('show');

    // 等 woo.mp3 metadata 載入後取得時長，若已知則直接使用
    function startCountdown(totalSec) {
      let remaining = Math.ceil(totalSec);
      cdNumber.textContent = remaining;
      // 重新觸發數字彈出動畫
      cdNumber.style.animation = 'none';
      requestAnimationFrame(() => {
        cdNumber.style.animation = 'numPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
      });

      const timer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(timer);
          cdScreen.classList.remove('show');
          frozen = false;  // 解凍，可以移動
          console.log('✅ 倒數結束，可以移動');
        } else {
          cdNumber.textContent = remaining;
          cdNumber.style.animation = 'none';
          requestAnimationFrame(() => {
            cdNumber.style.animation = 'numPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
          });
        }
      }, 1000);
    }

    if (wooSound.duration && !isNaN(wooSound.duration)) {
      startCountdown(wooSound.duration);
    } else {
      wooSound.addEventListener('loadedmetadata', () => startCountdown(wooSound.duration), { once: true });
      // 保險：若 3 秒內未觸發，預設 3 秒
      setTimeout(() => { if (frozen) startCountdown(3); }, 300);
    }

    console.log('🔄 碰到蜻蜓！遊戲重新開始');
  }

  /** 偵測蜜蜂碰撞：山竹 +5px（一次）、辣椒 -5px（一次）、蝶趯 → 回到起點 */
  function checkCollisions() {
    // ── 蝶趯：回到起點 ──
    const dfEl = document.getElementById('dragonfly');
    if (dfEl) {
      const dfX = parseInt(dfEl.style.left) || 0;
      const dfY = parseInt(dfEl.style.top)  || 0;
      const hit = (
        beeX         < dfX + SIZES.dragonfly.w &&
        beeX + BEE_W > dfX &&
        beeY         < dfY + SIZES.dragonfly.h &&
        beeY + BEE_H > dfY
      );
      if (hit) { restartGame(); return; } // 遊戲重新開始，直接跳出
    }
    // ── 山竹：加速 +5px ──
    if (!mangosteenBoosted) {
      const mgEl = document.getElementById('mangosteen');
      if (mgEl) {
        const mgX = parseInt(mgEl.style.left) || 0;
        const mgY = parseInt(mgEl.style.top)  || 0;
        const hit = (
          beeX         < mgX + SIZES.mangosteen.w &&
          beeX + BEE_W > mgX &&
          beeY         < mgY + SIZES.mangosteen.h &&
          beeY + BEE_H > mgY
        );
        if (hit) {
          beeSpd += 5;
          mangosteenBoosted = true;
          console.log('🐝 碰到山竹！速度提升至', beeSpd, 'px');
        }
      }
    }

    // ── 辣椒：減速 -5px ──
    if (!pepperPenalized) {
      const ppEl = document.getElementById('pepper');
      if (ppEl) {
        const ppX = parseInt(ppEl.style.left) || 0;
        const ppY = parseInt(ppEl.style.top)  || 0;
        const hit = (
          beeX         < ppX + SIZES.pepper.w &&
          beeX + BEE_W > ppX &&
          beeY         < ppY + SIZES.pepper.h &&
          beeY + BEE_H > ppY
        );
        if (hit) {
          beeSpd = Math.max(1, beeSpd - 5); // 速度最低保留 1px
          pepperPenalized = true;
          console.log('🌶️ 碰到辣椒！速度降低至', beeSpd, 'px');
        }
      }
    }

    // ── 花朵1：碰到顯示 ok ──
    if (!flower1Touched) {
      const f1El = document.getElementById('flower1');
      if (f1El) {
        const f1X = parseInt(f1El.style.left) || 0;
        const f1Y = parseInt(f1El.style.top)  || 0;
        const hit = (
          beeX         < f1X + SIZES.flower1.w &&
          beeX + BEE_W > f1X &&
          beeY         < f1Y + SIZES.flower1.h &&
          beeY + BEE_H > f1Y
        );
        if (hit) {
          flower1Touched = true;
          rightSound.currentTime = 0;
          rightSound.play().catch(() => {});
          showOk('ok1', f1X, f1Y, SIZES.flower1.w);
          console.log('🌸 碰到花1！');
          if (flower4Touched) showSuccess();
        }
      }
    }

    // ── 花朵4：碰到顯示 ok ──
    if (!flower4Touched) {
      const f4El = document.getElementById('flower4');
      if (f4El) {
        const f4X = parseInt(f4El.style.left) || 0;
        const f4Y = parseInt(f4El.style.top)  || 0;
        const hit = (
          beeX         < f4X + SIZES.flower4.w &&
          beeX + BEE_W > f4X &&
          beeY         < f4Y + SIZES.flower4.h &&
          beeY + BEE_H > f4Y
        );
        if (hit) {
          flower4Touched = true;
          rightSound.currentTime = 0;
          rightSound.play().catch(() => {});
          showOk('ok4', f4X, f4Y, SIZES.flower4.w);
          console.log('🌸 碰到花4！');
          if (flower1Touched) showSuccess();
        }
      }
    }
  }

  /** 在花朵正上方顯示 ok 圖示 */
  function showOk(okId, flowerX, flowerY, flowerW) {
    const okEl = document.getElementById(okId);
    if (!okEl) return;
    const okW = 50;
    const okH = 50;
    okEl.style.left = (flowerX + flowerW / 2 - okW / 2) + 'px';
    okEl.style.top  = (flowerY + SIZES[okId === 'ok1' ? 'flower1' : 'flower4'].h / 2 - okH / 2) + 'px';  // 疊在花中央
    okEl.style.display = 'block';
    // 重新觸發動畫
    okEl.style.animation = 'none';
    requestAnimationFrame(() => {
      okEl.style.animation = 'okPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
    });
  }

  /** 授粉成功 */
  function showSuccess() {
    const screen = document.getElementById('success-screen');
    if (screen) screen.classList.add('show');
    winSound.currentTime = 0;
    winSound.play().catch(() => {});
    console.log('🎉 授粉成功！');
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
