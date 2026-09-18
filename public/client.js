const socket = io();
let myData = null, otherPlayers = {}, jobsCache = [], vendingCache = [];
let myPos = { x: 1500, y: 1500 }; // 넓어진 맵 중앙 시작
let currentActionTarget = null, isFishing = false, fishingTimer = null;
const keys = {};

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'e' && currentActionTarget) {
    if (currentActionTarget.type === 'building') {
      openBuildingModal(currentActionTarget.id);
    } else if (currentActionTarget.type === 'teleport') {
      executeTeleport(currentActionTarget.destX, currentActionTarget.destY);
    }
  }
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

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
document.getElementById('btn-login').onclick = () => socket.emit('auth:login', { username: document.getElementById('auth-username').value, password: document.getElementById('auth-password').value });

socket.on('notify', d => showToast(d.msg, d.success));
socket.on('auth:success', ({ username, userData, stocks, jobs, vending }) => {
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
    <div class="card-item" style="${myData.jobIndex === idx ? 'border-color:var(--primary); background:#1e293b;' : ''}">
      <div>
        <h4>${j.name} ${myData.jobIndex === idx ? '(현재)' : ''}</h4>
        <p class="desc-text">월급: ₩${j.salary.toLocaleString()} / 30초 | 에너지: -${j.workEnergyCost}</p>
      </div>
      <div style="font-size:12px; text-align:right;">승진조건<br><strong>₩${j.reqMoney.toLocaleString()}</strong></div>
    </div>`).join('');

  const inv = myData.inventory || {};
  document.getElementById('inventory-list').innerHTML = Object.keys(inv).length === 0 ? '<p style="color:gray;">가방이 비었습니다.</p>' :
    Object.keys(inv).map(id => `<div class="card-item"><span>${id} (${inv[id]}개)</span><button class="btn success" style="width:auto;padding:5px 10px;" onclick="socket.emit('inventory:use','${id}')">사용/판매</button></div>`).join('');
}

// 3000x3000 대형 맵 + 고퀄리티 렌더러 & 텔레포트 시스템
function startCanvasLoop() {
  const canvas = document.getElementById('world-canvas');
  const ctx = canvas.getContext('2d');

  // 대형 맵 건물 정의
  const buildings = [
    { x: 500, y: 500, w: 180, h: 120, name: '🏪 24시 편의점', id: 'vending', color: '#1e3a8a' },
    { x: 2300, y: 500, w: 180, h: 120, name: '🎣 힐링 낚시터', id: 'fishing', color: '#065f46' },
    { x: 1400, y: 2200, w: 180, h: 120, name: '⚡ 캐릭터 상점', id: 'upgrade', color: '#7c2d12' }
  ];

  // 텔레포트 게이트 정의 (도착지 좌표 포함)
  const teleporters = [
    { x: 1400, y: 1300, r: 35, name: '🌀 중앙 광장 포탈', destX: 1500, destY: 1500 },
    { x: 580, y: 700, r: 30, name: '🌀 편의점 포탈', destX: 2380, destY: 700 }
  ];

  setInterval(() => {
    let moved = false;
    let speed = 5;
    if (keys['arrowup'] || keys['w']) { myPos.y -= speed; moved = true; }
    if (keys['arrowdown'] || keys['s']) { myPos.y += speed; moved = true; }
    if (keys['arrowleft'] || keys['a']) { myPos.x -= speed; moved = true; }
    if (keys['arrowright'] || keys['d']) { myPos.x += speed; moved = true; }

    // 맵 이탈 방지 (3000x3000)
    myPos.x = Math.max(50, Math.min(2950, myPos.x));
    myPos.y = Math.max(50, Math.min(2950, myPos.y));

    if (moved) socket.emit('player:move', myPos);

    // 카메라 추적 (캐릭터 정중앙)
    const camX = canvas.width / 2 - myPos.x;
    const camY = canvas.height / 2 - myPos.y;

    // 배경 채우기
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(camX, camY);

    // 대형 월드 격자 무늬 및 고퀄 테두리
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 3000, 3000);

    // 잔디/도로 패턴 느낌의 배경 그리드
    ctx.fillStyle = '#111827';
    ctx.fillRect(100, 100, 2800, 2800);

    let foundTarget = null;

    // 건물 렌더링
    buildings.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(b.name, b.x + 20, b.y + 65);

      const dist = Math.hypot(myPos.x - (b.x + b.w / 2), myPos.y - (b.y + b.h / 2));
      if (dist < 110) {
        foundTarget = { type: 'building', id: b.id, name: b.name };
      }
    });

    // 텔레포트 게이트 렌더링
    teleporters.forEach(t => {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(t.name, t.x - 40, t.y - t.r - 8);

      const dist = Math.hypot(myPos.x - t.x, myPos.y - t.y);
      if (dist < t.r + 20) {
        foundTarget = { type: 'teleport', destX: t.destX, destY: t.destY, name: t.name };
      }
    });

    currentActionTarget = foundTarget;
    const popup = document.getElementById('interaction-popup');
    if (currentActionTarget) {
      popup.textContent = currentActionTarget.type === 'building' ? `⌨️ [E] 키를 눌러 ${currentActionTarget.name} 입장` : `🌀 [E] 키를 눌러 ${currentActionTarget.name} 이용`;
      popup.classList.remove('hidden');
    } else {
      popup.classList.add('hidden');
    }

    // 다른 플레이어 렌더링
    for (let id in otherPlayers) {
      let p = otherPlayers[id];
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = '12px sans-serif'; ctx.fillText(p.username, p.x - 18, p.y - 22);
    }

    // 내 캐릭터 렌더링 (빛나는 효과)
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath(); ctx.arc(myPos.x, myPos.y, 16, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0; // 초기화

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(myData.username + ' (나)', myPos.x - 24, myPos.y - 24);

    ctx.restore();
  }, 1000 / 60);
}

// 텔레포트 실행 함수
function executeTeleport(destX, destY) {
  myPos.x = destX;
  myPos.y = destY;
  socket.emit('player:move', myPos);
  showToast('🌀 텔레포트 성공!', true);
}

// 건물 모달 오픈
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
  if (isFishing) {
    clearTimeout(fishingTimer);
    isFishing = false;
  }
}

function startFishingProcess() {
  if (isFishing) return;
  const btn = document.getElementById('btn-fish-action');
  const status = document.getElementById('fishing-status-text');

  isFishing = true;
  btn.disabled = true;
  btn.style.background = '#374151';

  status.textContent = '⏳ 낚싯대를 던졌습니다... (3초 대기)';
  
  setTimeout(() => {
    status.textContent = '🌊 찌가 물 위에 둥둥 떠 있습니다... 입질 대기 중 (5초)';
    
    fishingTimer = setTimeout(() => {
      socket.emit('fish:catch');
      status.textContent = '🎉 물고기가 걸렸습니다! 가방을 확인하세요.';
      isFishing = false;
      btn.disabled = false;
      btn.style.background = '#3b82f6';
    }, 5000);

  }, 3000);
}
