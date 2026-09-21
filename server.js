const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://rczxhjndnrsjzihmzbqr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hBQ1_MFYQaDBt5jPFWONcg_NXN2NqOV';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

async function getUserByUsername(username) {
  const { data, error } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
  if (error) {
    console.error('[DB SELECT ERROR]:', error.message);
  }
  return data;
}

async function saveUser(userObj) {
  const payload = {
    username: String(userObj.username),
    passwordhash: String(userObj.passwordhash),
    money: Number(userObj.money) || 200000,
    jobindex: Number(userObj.jobindex) || 0,
    hunger: Number(userObj.hunger) || 100,
    maxhunger: Number(userObj.maxhunger) || 100,
    isadmin: Boolean(userObj.isadmin),
    stocks: userObj.stocks || {},
    inventory: userObj.inventory || {},
    upgrades: userObj.upgrades || { fishingRod: 1, pickaxe: 1, stomach: 1 }
  };
  
  const { error } = await supabase.from('users').upsert([payload], { onConflict: 'username' });
  if (error) {
    console.error('🚨 [DB SAVE ERROR 상세]:', error);
    return error.message;
  }
  return null;
}

const JOBS = [
  { id: 'job_0', name: '무직 / 취준생', salary: 0, reqMoney: 0, workEnergyCost: 0 },
  { id: 'job_1', name: '편의점 야간 알바', salary: 40000, reqMoney: 0, workEnergyCost: 2 },
  { id: 'job_2', name: '동네 카페 바리스타', salary: 100000, reqMoney: 150000, workEnergyCost: 3 },
  { id: 'job_3', name: '중소기업 평사원', salary: 300000, reqMoney: 600000, workEnergyCost: 4 },
  { id: 'job_4', name: '대기업 대리', salary: 850000, reqMoney: 2500000, workEnergyCost: 5 },
  { id: 'job_5', name: '대기업 팀장', salary: 2500000, reqMoney: 10000000, workEnergyCost: 6 },
  { id: 'job_6', name: '대기업 임원 (이사)', salary: 7000000, reqMoney: 40000000, workEnergyCost: 7 },
  { id: 'job_7', name: '스타트업 대표 (CEO)', salary: 20000000, reqMoney: 150000000, workEnergyCost: 8 },
  { id: 'job_8', name: '중견기업 총괄 회장', salary: 60000000, reqMoney: 600000000, workEnergyCost: 9 },
  { id: 'job_9', name: '글로벌 대기업 회장', salary: 180000000, reqMoney: 2500000000, workEnergyCost: 10 },
  { id: 'job_10', name: '세계적인 재벌 총수', salary: 550000000, reqMoney: 10000000000, workEnergyCost: 11 },
  { id: 'job_11', name: '우주 개척 기업 총사령관', salary: 2000000000, reqMoney: 40000000000, workEnergyCost: 12 }
];

const VENDING_ITEMS = [
  { id: 'water', name: '생수', cost: 1000, restoreHunger: 25, type: 'food' },
  { id: 'snack', name: '초코바', cost: 3500, restoreHunger: 50, type: 'food' },
  { id: 'gimbap', name: '참치 삼각김밥', cost: 7000, restoreHunger: 80, type: 'food' },
  { id: 'bento', name: '프리미엄 도시락', cost: 25000, restoreHunger: 120, type: 'food' },
  { id: 'steak', name: '한우 특상 스테이크', cost: 120000, restoreHunger: 200, type: 'food' },
  { id: 'bait_normal', name: '지렁이 미끼 (고급 확률 +6%)', cost: 5000, type: 'bait', bonus: 6 },
  { id: 'bait_gold', name: '황금 새우 미끼 (고급 확률 +18%)', cost: 30000, type: 'bait', bonus: 18 }
];

const FISH_ITEMS = [
  { id: 'f_01', name: '피라미', grade: '일반', value: 300, weight: 45 },
  { id: 'f_02', name: '붕어', grade: '일반', value: 500, weight: 35 },
  { id: 'f_03', name: '망둥어', grade: '일반', value: 700, weight: 28 },
  { id: 'f_04', name: '피라니아(새끼)', grade: '일반', value: 900, weight: 22 },
  { id: 'f_05', name: '잉어', grade: '일반', value: 1200, weight: 18 },
  { id: 'f_06', name: '쏘가리', grade: '고급', value: 2000, weight: 12 },
  { id: 'f_07', name: '메기', grade: '고급', value: 2500, weight: 10 },
  { id: 'f_08', name: '송어', grade: '고급', value: 3200, weight: 8 },
  { id: 'f_09', name: '우럭', grade: '고급', value: 4000, weight: 6 },
  { id: 'f_10', name: '광어', grade: '고급', value: 5000, weight: 5 },
  { id: 'f_11', name: '연어', grade: '희귀', value: 8000, weight: 3.5 },
  { id: 'f_12', name: '참치', grade: '희귀', value: 12000, weight: 2.8 },
  { id: 'f_13', name: '철갑상어', grade: '희귀', value: 18000, weight: 2.0 },
  { id: 'f_14', name: '문어', grade: '희귀', value: 24000, weight: 1.5 },
  { id: 'f_15', name: '전기뱀장어', grade: '희귀', value: 32000, weight: 1.1 },
  { id: 'f_16', name: '대왕 가오리', grade: '영웅', value: 45000, weight: 0.8 },
  { id: 'f_17', name: '청새치', grade: '영웅', value: 65000, weight: 0.6 },
  { id: 'f_18', name: '심해 아귀', grade: '영웅', value: 90000, weight: 0.45 },
  { id: 'f_19', name: '대왕 바다거북', grade: '영웅', value: 120000, weight: 0.3 },
  { id: 'f_20', name: '범고래', grade: '영웅', value: 160000, weight: 0.2 },
  { id: 'f_21', name: '황금 상어', grade: '전설', value: 250000, weight: 0.12 },
  { id: 'f_22', name: '실러캔스', grade: '전설', value: 350000, weight: 0.08 },
  { id: 'f_23', name: '네ส호 고대 괴수', grade: '전설', value: 500000, weight: 0.05 },
  { id: 'f_24', name: '크라켄(새끼)', grade: '전설', value: 750000, weight: 0.03 },
  { id: 'f_25', name: '포세이돈의 수호 잉어', grade: '신화', value: 1200000, weight: 0.015 },
  { id: 'f_26', name: '황금 고래왕', grade: '신화', value: 1800000, weight: 0.008 },
  { id: 'f_27', name: '레바테인의 비늘', grade: '신화', value: 2800000, weight: 0.004 },
  { id: 'f_28', name: '우주 심해의 별빛 고래', grade: '초월', value: 5000000, weight: 0.002 },
  { id: 'f_29', name: '차원 개척자의 환수', grade: '초월', value: 9000000, weight: 0.001 },
  { id: 'f_30', name: '세계관을 삼킨 태초의 리바이아산', grade: '초월', value: 20000000, weight: 0.0003 }
];

// ⛏️ 광석 데이터 (기본 광석 1,000원 ~ 최고급 광석 1억 원, 최고급 확률 정확히 0.676767%)
const ORE_ITEMS = [
  { id: 'ore_01', name: '석탄', grade: '일반', value: 1000, weight: 45 },
  { id: 'ore_02', name: '철광석', grade: '일반', value: 2500, weight: 30 },
  { id: 'ore_03', name: '구리', grade: '일반', value: 4500, weight: 20 },
  { id: 'ore_04', name: '주석', grade: '일반', value: 7000, weight: 15 },
  { id: 'ore_05', name: '은광석', grade: '고급', value: 15000, weight: 10 },
  { id: 'ore_06', name: '금광석', grade: '고급', value: 35000, weight: 6 },
  { id: 'ore_07', name: '백금', grade: '고급', value: 70000, weight: 4 },
  { id: 'ore_08', name: '자수정', grade: '희귀', value: 150000, weight: 2.5 },
  { id: 'ore_09', name: '사파이어', grade: '희귀', value: 300000, weight: 1.8 },
  { id: 'ore_10', name: '루비', grade: '희귀', value: 600000, weight: 1.2 },
  { id: 'ore_11', name: '에메랄드', grade: '영웅', value: 1200000, weight: 0.8 },
  { id: 'ore_12', name: '다이아몬드', grade: '영웅', value: 2500000, weight: 0.5 },
  { id: 'ore_13', name: '흑진주', grade: '전설', value: 6000000, weight: 0.3 },
  { id: 'ore_14', name: '미스릴', grade: '전설', value: 15000000, weight: 0.15 },
  { id: 'ore_15', name: '아다만티움', grade: '신화', value: 40000000, weight: 0.05 },
  { id: 'ore_16', name: '우주 심장 핵 (최고급)', grade: '초월', value: 100000000, weight: 0.00676767 } // 0.676767% 맞춤
];

let STOCKS = [
  { symbol: '005930', name: '삼성전자', price: 72000 },
  { symbol: '000660', name: 'SK하이닉스', price: 175000 },
  { symbol: '035420', name: 'NAVER (네이버)', price: 195000 },
  { symbol: '035720', name: '카카오', price: 51000 },
  { symbol: '373220', name: 'LG에너지솔루션', price: 380000 },
  { symbol: '005380', name: '현대차', price: 240000 },
  { symbol: '028260', name: '삼성물산', price: 145000 },
  { symbol: '051910', name: 'LG화학', price: 320000 },
  { symbol: 'AAPL', name: '애플 (Apple)', price: 230000 },
  { symbol: 'MSFT', name: '마이크로소프트 (MS)', price: 540000 },
  { symbol: 'TSLA', name: '테슬라 (Tesla)', price: 310000 },
  { symbol: 'NVDA', name: '엔비디아 (NVIDIA)', price: 1350000 },
  { symbol: 'GOOGL', name: '알파벳 (구글)', price: 210000 },
  { symbol: 'AMZN', name: '아마존 (Amazon)', price: 260000 },
  { symbol: 'META', name: '메타 (Meta)', price: 680000 },
  { symbol: 'NFLX', name: '넷플릭스 (Netflix)', price: 920000 },
  { symbol: 'DIS', name: '월트 디즈니 (Disney)', price: 140000 },
  { symbol: 'COIN', name: '코인베이스 (Coinbase)', price: 340000 },
  { symbol: 'BTC', name: '비트코인 (Bitcoin)', price: 125000000 },
  { symbol: 'ETH', name: '이더리움 (Ethereum)', price: 4800000 },
  { symbol: 'SOL', name: '솔라나 (Solana)', price: 210000 },
  { symbol: 'DOGE', name: '도지코인 (Dogecoin)', price: 220 }
];

setInterval(() => {
  STOCKS.forEach(s => {
    const changePercent = (Math.random() * 0.03) - 0.0145;
    let newPrice = Math.round(s.price * (1 + changePercent));
    if (newPrice < 100) newPrice = 100;
    s.price = newPrice;
  });
  io.emit('stocks:update', STOCKS);
}, 3000);

setInterval(async () => {
  for (let socketId in onlinePlayers) {
    const pInfo = onlinePlayers[socketId];
    if (!pInfo || !pInfo.username) continue;

    const u = await getUserByUsername(pInfo.username);
    if (!u) continue;

    const job = JOBS[u.jobindex] || JOBS[0];
    if (u.hunger > 0 && job.salary > 0) {
      u.money += job.salary;
      u.hunger = Math.max(0, u.hunger - job.workEnergyCost);
      await saveUser(u);

      io.to(socketId).emit('player:sync', {
        username: u.username, money: u.money, jobIndex: u.jobindex,
        hunger: u.hunger, maxHunger: u.maxhunger || 100, isAdmin: u.isadmin,
        inventory: u.inventory || {}, stocks: u.stocks || {}, upgrades: u.upgrades || { fishingRod: 1, pickaxe: 1, stomach: 1 }
      });
    }
  }
}, 90000);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const onlinePlayers = {};
const macroDetectors = {};

io.on('connection', (socket) => {
  let currentUser = null;

  async function syncUser() {
    if (!currentUser) return;
    const u = await getUserByUsername(currentUser);
    if (u) {
      socket.emit('player:sync', {
        username: u.username, money: u.money, jobIndex: u.jobindex,
        hunger: u.hunger, maxHunger: u.maxhunger || 100, isAdmin: u.isadmin,
        inventory: u.inventory || {}, stocks: u.stocks || {}, upgrades: u.upgrades || { fishingRod: 1, pickaxe: 1, stomach: 1 }
      });
    }
  }

  socket.on('auth:register', async ({ username, password }) => {
    if (!username || username.trim().length < 2) return socket.emit('notify', { success: false, msg: '아이디는 2자 이상 입력해주세요.' });
    if (!password || password.trim().length < 2) return socket.emit('notify', { success: false, msg: '비밀번호를 입력해주세요.' });
    
    const cleanName = username.trim();
    const existing = await getUserByUsername(cleanName);
    if (existing) return socket.emit('notify', { success: false, msg: '이미 존재하는 아이디입니다.' });

    const saveError = await saveUser({
      username: cleanName,
      passwordhash: password,
      money: 200000,
      jobindex: 0,
      hunger: 100,
      maxhunger: 100,
      isadmin: false,
      inventory: {},
      stocks: {},
      upgrades: { fishingRod: 1, pickaxe: 1, stomach: 1 }
    });

    if (!saveError) {
      socket.emit('notify', { success: true, msg: '가입 완료! 로그인해주세요.' });
    } else {
      socket.emit('notify', { success: false, msg: '가입 실패: ' + saveError });
    }
  });

  socket.on('auth:login', async ({ username, password }) => {
    if (!username || !password) return socket.emit('notify', { success: false, msg: '아이디와 비밀번호를 입력해주세요.' });
    
    const cleanName = username.trim();
    const u = await getUserByUsername(cleanName);
    if (!u || u.passwordhash !== password) return socket.emit('notify', { success: false, msg: '로그인 실패 (아이디/비번 오류 또는 밴 계정)' });
    
    for (let id in onlinePlayers) {
      if (onlinePlayers[id].username === cleanName) delete onlinePlayers[id];
    }

    currentUser = cleanName;
    onlinePlayers[socket.id] = { username: u.username, x: 1500, y: 1500, avatarColor: '#' + Math.floor(Math.random()*16777215).toString(16) };

    socket.emit('auth:success', {
      username: cleanName,
      userData: { 
        username: u.username, money: u.money, jobIndex: u.jobindex, 
        hunger: u.hunger, maxHunger: u.maxhunger || 100, isAdmin: u.isadmin, 
        inventory: u.inventory || {}, stocks: u.stocks || {}, upgrades: u.upgrades || { fishingRod: 1, pickaxe: 1, stomach: 1 }
      },
      jobs: JOBS, vending: VENDING_ITEMS, stocks: STOCKS
    });

    io.emit('players:update', onlinePlayers);
  });

  socket.on('player:move', (pos) => {
    if (!currentUser || !onlinePlayers[socket.id]) return;
    onlinePlayers[socket.id].x = pos.x;
    onlinePlayers[socket.id].y = pos.y;
    socket.broadcast.emit('players:update', onlinePlayers);
  });

  socket.on('action:promote', async () => {
    if (!currentUser) return;
    const u = await getUserByUsername(currentUser);
    const nextJob = JOBS[u.jobindex + 1];
    if (!nextJob) return socket.emit('notify', { success: false, msg: '이미 최고 직급입니다!' });
    if (u.money < nextJob.reqMoney) return socket.emit('notify', { success: false, msg: `승진 자산 부족 (필요: ₩${nextJob.reqMoney.toLocaleString()})` });

    u.jobindex++;
    await saveUser(u);
    await syncUser();
    socket.emit('notify', { success: true, msg: `🎉 승진 축하합니다! [${nextJob.name}] 진급!` });
  });

  // 🎣 낚시 핸들러 (안티치트 적용)
  socket.on('fish:catch', async (data) => {
    if (!currentUser) return;

    const now = Date.now();
    if (!macroDetectors[currentUser]) {
      macroDetectors[currentUser] = { lastTime: 0, intervals: [], macroStrike: 0 };
    }

    const tracker = macroDetectors[currentUser];
    if (tracker.lastTime > 0) {
      const diff = now - tracker.lastTime;
      if (diff < 4000) return socket.emit('notify', { success: false, msg: '⚠️ 너무 빠르게 낚시를 할 수 없습니다!' });

      tracker.intervals.push(diff);
      if (tracker.intervals.length > 3) tracker.intervals.shift();

      if (tracker.intervals.length === 3) {
        const avg = tracker.intervals.reduce((a, b) => a + b, 0) / tracker.intervals.length;
        const variance = tracker.intervals.reduce((a, b) => a + Math.abs(b - avg), 0) / tracker.intervals.length;
        if (variance < 15) tracker.macroStrike++;
      }
    }
    tracker.lastTime = now;

    if (tracker.macroStrike >= 3) {
      const u = await getUserByUsername(currentUser);
      if (u) { u.passwordhash = '밴먹은계정'; await saveUser(u); }
      socket.emit('notify', { success: false, msg: '🚨 매크로 3회 감지로 계정이 정지되었습니다!' });
      setTimeout(() => socket.disconnect(), 500);
      return;
    }

    const u = await getUserByUsername(currentUser);
    if (!u) return;
    if (u.hunger < 5) return socket.emit('notify', { success: false, msg: '배가 고파서 낚시를 할 수 없습니다!' });

    u.hunger -= 5;
    const selectedBait = data && data.selectedBait ? data.selectedBait : 'none';
    let baitBonus = 0;

    if (selectedBait && selectedBait !== 'none') {
      if (u.inventory && u.inventory[selectedBait] && u.inventory[selectedBait] > 0) {
        u.inventory[selectedBait]--;
        if (u.inventory[selectedBait] === 0) delete u.inventory[selectedBait];
        if (selectedBait === 'bait_gold') baitBonus = 18;
        else if (selectedBait === 'bait_normal') baitBonus = 6;
      }
    }

    const adjustedFishList = FISH_ITEMS.map(f => {
      let w = f.weight;
      if (['고급', '희귀', '영웅', '전설', '신화', '초월'].includes(f.grade)) w += baitBonus;
      return { ...f, computedWeight: w };
    });

    const totalWeight = adjustedFishList.reduce((sum, f) => sum + f.computedWeight, 0);
    let randomVal = Math.random() * totalWeight;
    let currentSum = 0;
    let caught = FISH_ITEMS[0];

    for (let f of adjustedFishList) {
      currentSum += f.computedWeight;
      if (randomVal <= currentSum) { caught = f; break; }
    }

    if (!u.inventory || typeof u.inventory !== 'object') u.inventory = {};
    u.inventory[caught.id] = (u.inventory[caught.id] || 0) + 1;
    
    await saveUser(u); 
    await syncUser();
    socket.emit('notify', { success: true, msg: `🎣 [낚시 성공] [${caught.grade}] ${caught.name} 획득!` });
  });

  // ⛏️ 광산 채광 핸들러 (요청하신 광석 시스템 및 매크로 방어)
  socket.on('mine:dig', async () => {
    if (!currentUser) return;

    const now = Date.now();
    if (!macroDetectors[currentUser]) {
      macroDetectors[currentUser] = { lastTime: 0, intervals: [], macroStrike: 0 };
    }

    const tracker = macroDetectors[currentUser];
    if (tracker.lastTime > 0) {
      const diff = now - tracker.lastTime;
      if (diff < 4000) return socket.emit('notify', { success: false, msg: '⚠️ 너무 빠르게 곡괭이질을 할 수 없습니다!' });

      tracker.intervals.push(diff);
      if (tracker.intervals.length > 3) tracker.intervals.shift();

      if (tracker.intervals.length === 3) {
        const avg = tracker.intervals.reduce((a, b) => a + b, 0) / tracker.intervals.length;
        const variance = tracker.intervals.reduce((a, b) => a + Math.abs(b - avg), 0) / tracker.intervals.length;
        if (variance < 15) tracker.macroStrike++;
      }
    }
    tracker.lastTime = now;

    if (tracker.macroStrike >= 3) {
      const u = await getUserByUsername(currentUser);
      if (u) { u.passwordhash = '밴먹은계정'; await saveUser(u); }
      socket.emit('notify', { success: false, msg: '🚨 채광 매크로 3회 감지로 계정이 정지되었습니다!' });
      setTimeout(() => socket.disconnect(), 500);
      return;
    }

    const u = await getUserByUsername(currentUser);
    if (!u) return;
    if (u.hunger < 5) return socket.emit('notify', { success: false, msg: '배가 고파서 광산 작업을 할 수 없습니다!' });

    u.hunger -= 5;
    if (!u.upgrades) u.upgrades = { fishingRod: 1, pickaxe: 1, stomach: 1 };
    const pickaxeLv = u.upgrades.pickaxe || 1;

    // 곡괭이 레벨에 따른 고급 광석 가중치 보너스
    const adjustedOreList = ORE_ITEMS.map(o => {
      let w = o.weight;
      if (['고급', '희귀', '영웅', '전설', '신화', '초월'].includes(o.grade)) {
        w += (pickaxeLv - 1) * 2;
      }
      return { ...o, computedWeight: w };
    });

    const totalWeight = adjustedOreList.reduce((sum, o) => sum + o.computedWeight, 0);
    let randomVal = Math.random() * totalWeight;
    let currentSum = 0;
    let mined = ORE_ITEMS[0];

    for (let o of adjustedOreList) {
      currentSum += o.computedWeight;
      if (randomVal <= currentSum) { mined = o; break; }
    }

    if (!u.inventory || typeof u.inventory !== 'object') u.inventory = {};
    u.inventory[mined.id] = (u.inventory[mined.id] || 0) + 1;

    await saveUser(u);
    await syncUser();
    socket.emit('notify', { success: true, msg: `⛏️ [채광 성공] [${mined.grade}] ${mined.name} 획득!` });
  });

  // ⚡ 업그레이드 핸들러 (요청하신 곡괭이 비용 구조 적용: 100만 → 500만 → 1000만 → 3000만 → 6000만 → 1억 → 5억 → 100억)
  socket.on('upgrade:buy', async (type) => {
    if (!currentUser) return;
    const u = await getUserByUsername(currentUser);
    if (!u) return;
    if (!u.upgrades) u.upgrades = { fishingRod: 1, pickaxe: 1, stomach: 1 };

    const PICKAXE_COSTS = [0, 1000000, 5000000, 10000000, 30000000, 60000000, 100000000, 500000000, 10000000000];

    if (type === 'pickaxe') {
      const curLv = u.upgrades.pickaxe || 1;
      if (curLv >= PICKAXE_COSTS.length) return socket.emit('notify', { success: false, msg: '곡괭이가 이미 최고 레벨입니다.' });
      const cost = PICKAXE_COSTS[curLv];
      if (u.money < cost) return socket.emit('notify', { success: false, msg: `곡괭이 업그레이드 비용 부족 (필요: ₩${cost.toLocaleString()})` });

      u.money -= cost;
      u.upgrades.pickaxe++;
      socket.emit('notify', { success: true, msg: `⛏️ 곡괭이 업그레이드 완료! (Lv.${u.upgrades.pickaxe})` });
    } else if (type === 'fishingRod') {
      const curLv = u.upgrades.fishingRod;
      const cost = curLv * 150000;
      if (curLv >= 10) return socket.emit('notify', { success: false, msg: '낚싯대가 이미 최고 레벨입니다.' });
      if (u.money < cost) return socket.emit('notify', { success: false, msg: `비용 부족 (필요: ₩${cost.toLocaleString()})` });
      u.money -= cost; u.upgrades.fishingRod++;
      socket.emit('notify', { success: true, msg: `✨ 낚싯대 업그레이드 완료! (Lv.${u.upgrades.fishingRod})` });
    } else if (type === 'stomach') {
      const curLv = u.upgrades.stomach;
      const cost = Math.round(200000 * Math.pow(1.3, curLv - 1));
      if (curLv >= 19) return socket.emit('notify', { success: false, msg: '위장이 이미 최고 레벨입니다!' });
      if (u.money < cost) return socket.emit('notify', { success: false, msg: `비용 부족 (필요: ₩${cost.toLocaleString()})` });
      u.money -= cost; u.upgrades.stomach++;
      u.maxhunger = Math.min(1000, 100 + (u.upgrades.stomach - 1) * 50);
      socket.emit('notify', { success: true, msg: `🍖 위장 업그레이드! (최대 포만감: ${u.maxhunger})` });
    }
    await saveUser(u); await syncUser();
  });

  socket.on('vending:buy', async ({ itemId, count }) => {
    if (!currentUser || !count || count <= 0) return;
    const u = await getUserByUsername(currentUser);
    if (!u) return;
    const item = VENDING_ITEMS.find(v => v.id === itemId);
    const totalCost = item.cost * count;

    if (!item || u.money < totalCost) return socket.emit('notify', { success: false, msg: '잔액 부족' });
    u.money -= totalCost;
    if (!u.inventory || typeof u.inventory !== 'object') u.inventory = {};
    u.inventory[itemId] = (u.inventory[itemId] || 0) + count;
    
    await saveUser(u); 
    await syncUser();
    socket.emit('notify', { success: true, msg: `${item.name} ${count}개 구매 완료!` });
  });

  socket.on('inventory:use', async (itemId) => {
    if (!currentUser) return;
    const u = await getUserByUsername(currentUser);
    if (!u) return;
    const item = VENDING_ITEMS.find(v => v.id === itemId);
    const fish = FISH_ITEMS.find(f => f.id === itemId);
    const ore = ORE_ITEMS.find(o => o.id === itemId);
    const maxH = u.maxhunger || 100;

    if (!u.inventory || !u.inventory[itemId] || u.inventory[itemId] <= 0) return;
    u.inventory[itemId]--;
    if(u.inventory[itemId] === 0) delete u.inventory[itemId];

    if (item && item.type !== 'bait') {
      u.hunger = Math.min(maxH, u.hunger + item.restoreHunger);
      socket.emit('notify', { success: true, msg: `${item.name} 섭취 완료` });
    } else if (fish) {
      u.money += fish.value;
      socket.emit('notify', { success: true, msg: `[${fish.grade}] ${fish.name} 판매 완료 (+₩${fish.value.toLocaleString()})` });
    } else if (ore) {
      u.money += ore.value;
      socket.emit('notify', { success: true, msg: `[${ore.grade}] ${ore.name} 판매 완료 (+₩${ore.value.toLocaleString()})` });
    }
    await saveUser(u); await syncUser();
  });

  socket.on('stock:buy', async ({ symbol, amount }) => {
    if (!currentUser || amount <= 0) return;
    const u = await getUserByUsername(currentUser);
    if (!u) return;
    const stock = STOCKS.find(s => s.symbol === symbol);
    const cost = stock.price * amount;
    if (u.money < cost) return socket.emit('notify', { success: false, msg: '잔액 부족' });
    u.money -= cost;
    if (!u.stocks || typeof u.stocks !== 'object') u.stocks = {};
    u.stocks[symbol] = (u.stocks[symbol] || 0) + amount;
    await saveUser(u); await syncUser();
    socket.emit('notify', { success: true, msg: `${stock.name} ${amount}주 매수 완료` });
  });

  socket.on('stock:sell', async ({ symbol, amount }) => {
    if (!currentUser || amount <= 0) return;
    const u = await getUserByUsername(currentUser);
    if (!u) return;
    const stock = STOCKS.find(s => s.symbol === symbol);
    const owned = (u.stocks && u.stocks[symbol]) || 0;
    if (owned < amount) return socket.emit('notify', { success: false, msg: '보유 주식 부족' });
    u.stocks[symbol] -= amount;
    if (u.stocks[symbol] === 0) delete u.stocks[symbol];
    u.money += stock.price * amount;
    await saveUser(u); await syncUser();
    socket.emit('notify', { success: true, msg: `${stock.name} ${amount}주 매도 완료` });
  });

  socket.on('disconnect', () => {
    delete onlinePlayers[socket.id];
    currentUser = null;
    io.emit('players:update', onlinePlayers);
  });
});

server.listen(PORT, () => console.log(`[SERVER] 광산 시스템 및 안티치트 서버 가동 완료 (포트: ${PORT})`));
