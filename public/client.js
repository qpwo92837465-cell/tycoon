const socket = io();
let myData = null, otherPlayers = {}, jobsCache = [], vendingCache = [];
let myPos = { x: 1500, y: 1500 };
let currentActionTarget = null, isFishing = false, fishingTimer = null;
const keys = {};

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

document.getElementById('btn-register').onclick = () => socket.emit('auth:register', { username: document.getElementById('auth-username').value, password: document.getElementById('auth-password').value });
document.getElementById('btn-login').onclick = () => {
  const u = document.getElementById('auth-username').value;
  const p = document.getElementById('auth-password').value;
  localStorage.setItem('tycoon_user', u);
  localStorage.setItem('tycoon_pass', p);
  socket.emit('auth:login', { username: u, password: p });
};

socket.on('notify', d => showToast(d.msg, d.success));
socket.on('auth:success', ({ username, userData, jobs, vending }) => {
  document.getElementById('auth-modal').classList.add('hidden');
  document.getElementById('game-app').classList.remove('hidden');
  myData = userData; jobsCache = jobs; vendingCache = vending;
  renderAll();
  startCanvasLoop();
});

socket.on('player:sync', data => { myData = data; renderAll(); });
socket.on('players:update', players => { otherPlayers = players; });

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
        <p class="desc-text">월급: ₩${j.salary.toLocaleString()} / 30초 | 에너지: -${j.workEnergyCost}</p>
      </div>
      <div style="font-size:12px; text-align:right;">승진조건<br><strong>₩${j.reqMoney.toLocaleString()}</strong></div>
    </div>`).join('');

  const inv = myData.inventory || {};
  document.getElementById('inventory-list').innerHTML = Object.keys(inv).length === 0 ? '<p style="color:gray;">가방이 비었습니다.</p>' :
    Object.keys(inv).map(id => {
      const koreanName = ITEM_NAMES[id] || id;
      return `<div class="card-item"><span>${koreanName} (${inv[id]}개)</span><button class="btn success" style="width:auto;padding:5px 10px;" onclick="socket.emit('inventory:use','${id}')">사용/판매</button></div>`;
    }).join('');
}

// 상단 버튼용 텔레포트 함수
function teleportTo(x, y) {
  myPos.x = x;
  myPos.y = y;
  socket.emit('player:move', myPos);
  showToast('🌀 해당 장소로 즉시 이동했습니다!', true);
}

// ZEP 감성 아바타 및 타일 맵 렌더러
function startCanvasLoop() {
  const canvas = document.getElementById('world-canvas');
  const ctx = canvas.getContext('2d');

  const buildings = [
    { x: 500, y: 500, w: 180, h: 120, name: '🏪 24시 편의점', id: 'vending', color: '#3b82f6' },
    { x: 2300, y: 500, w: 180, h: 120, name: '🎣 힐링 낚시터', id: 'fishing', color: '#10b981' },
    { x: 1400, y: 2200, w: 180, h: 120, name: '⚡ 캐릭터 상점', id: 'upgrade', color: '#f59e0b' }
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

    // 알록달록한 잔디 타일 격자 패턴 그리기
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

    // 건물 렌더링
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

    // 다른 플레이어 아바타 그리기
    for (let id in otherPlayers) {
      let p = otherPlayers[id];
      drawAvatar(ctx, p.x, p.y, p.username, p.avatarColor || '#f43f5e');
    }

    // 내 아바타 그리기
    drawAvatar(ctx, myPos.x, myPos.y, myData.username + ' (나)', '#4f46e5');

    ctx.restore();
  }, 1000 / 60);
}

// ZEP 감성 아바타 그리기 함수
function drawAvatar(ctx, x, y, name, color) {
  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(x, y + 16, 12, 6, 0, 0, Math.PI * 2); ctx.fill();

  // 몸통
  ctx.fillStyle = color;
  ctx.fillRect(x - 10, y - 4, 20, 20);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x - 10, y - 4, 20, 20);

  // 머리
  ctx.fillStyle = '#fde68a';
  ctx.beginPath(); ctx.arc(x, y - 12, 12, 0, Math.PI * 2); ctx.fill();
  ctx.stroke();

  // 닉네임 뱃지
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - name.length * 3.5 - 6, y - 38, name.length * 7 + 12, 18);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText(name, x - name.length * 3.5, y - 25);
}

function openBuildingModal(id) {
  const modal = document.getElementById('building-modal');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  modal.classList.remove('hidden');

  if (id === 'vending') {
    title.textContent = '🏪 24시 편의점 & 미끼 상점';
    body.innerHTML = vendingCache.map(i => `
      <div class="card-item">
        <span>${i.name} (₩${i.cost.toLocaleString()})</span>
        <button class="btn primary" style="width:auto;padding:6px 12px;" onclick="socket.emit('vending:buy','${i.id}')">구매</button>
      </div>`).join('');
  } else if (id === 'upgrade') {
    title.textContent = '⚡ 캐릭터 강화 상점';
    const up = myData.upgrades || { fishingRod: 1, stomach: 1 };
    const maxH = myData.maxHunger || 100;
    body.innerHTML = `
      <div class="card-item">
        <div><h4>🎣 낚싯대 강화 (현재 Lv.${up.fishingRod})</h4><p class="desc-text">비용: ₩${(up.fishingRod * 150000).toLocaleString()}</p></div>
        <button class="btn success" style="width:auto;padding:8px;" onclick="socket.emit('upgrade:buy','fishingRod')">강화</button>
      </div>
      <div class="card-item">
        <div><h4>🍖 위장 강화 (현재 최대 포만감: ${maxH})</h4><p class="desc-text">비용: ₩${(up.stomach * 250000).toLocaleString()}</p></div>
        <button class="btn success" style="width:auto;padding:8px;" onclick="socket.emit('upgrade:buy','stomach')">강화</button>
      </div>`;
  } else if (id === 'fishing') {
    title.textContent = '🎣 힐링 낚시터';
    body.innerHTML = `
      <p>미끼를 장착하고 대어를 낚아보세요!</p>
      <button class="btn primary huge" id="btn-fish-action" style="margin-top:15px;padding:15px;" onclick="startFishingProcess()">🎣 낚싯대 던지기 (3초 쿨타임)</button>
      <div id="fishing-status-text" style="margin-top:10px;text-align:center;color:#f59e0b;font-weight:bold;"></div>`;
  }
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
  const btn = document.getElementById('btn-fish-action');
  const status = document.getElementById('fishing-status-text');

  isFishing = true;
  btn.disabled = true;
  btn.style.background = '#cbd5e1';

  status.textContent = '⏳ 낚싯대를 던졌습니다... (3초 대기)';
  
  setTimeout(() => {
    status.textContent = '🌊 찌가 물 위에 둥둥 떠 있습니다... 입질 대기 중 (5초)';
    
    fishingTimer = setTimeout(() => {
      socket.emit('fish:catch');
      status.textContent = '🎉 물고기가 걸렸습니다! 가방을 확인하세요.';
      isFishing = false;
      btn.disabled = false;
      btn.style.background = '#4f46e5';
    }, 5000);

  }, 3000);
}
