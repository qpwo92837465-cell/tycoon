const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const readline = require('readline');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'database.json');

// --- 데이터베이스 로드 및 저장 ---
let db = {
  users: {}, // username: { passwordHash, money, jobIndex, hunger, isAdmin, inventory: {}, quests: {}, stocks: {} }
};

if (fs.existsSync(DATA_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error('[DB] 데이터 파일 로드 실패, 새로 생성합니다.');
  }
}

function saveDB() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

// --- 게임 설정 데이터 ---
const JOBS = [
  { id: 'job_0', name: '무직/취준생', salary: 0, reqMoney: 0, workEnergyCost: 0 },
  { id: 'job_1', name: '편의점 알바', salary: 15000, reqMoney: 0, workEnergyCost: 5 },
  { id: 'job_2', name: '중소기업 사원', salary: 45000, reqMoney: 150000, workEnergyCost: 10 },
  { id: 'job_3', name: '대기업 팀장', salary: 120000, reqMoney: 800000, workEnergyCost: 15 },
  { id: 'job_4', name: '스타트업 CEO', salary: 350000, reqMoney: 5000000, workEnergyCost: 20 },
  { id: 'job_5', name: '투자사 회장', salary: 1000000, reqMoney: 30000000, workEnergyCost: 25 },
];

const VENDING_ITEMS = [
  { id: 'water', name: '생수', cost: 1000, restoreHunger: 15 },
  { id: 'snack', name: '초코바', cost: 2500, restoreHunger: 30 },
  { id: 'gimbap', name: '삼각김밥', cost: 4000, restoreHunger: 50 },
  { id: 'bento', name: '혜자 도시락', cost: 9000, restoreHunger: 85 },
  { id: 'steak', name: '특상 한우 스테이크', cost: 45000, restoreHunger: 100 },
];

const QUEST_LIST = [
  { id: 'q_grandma', title: '골목길 할머니 짐 들어드리기', desc: '무거운 짐을 언덕 위까지 옮겨드렸습니다.', rewardMoney: 20000, cooldownSec: 45, hungerCost: 10 },
  { id: 'q_trash', title: '공원 쓰레기 5봉지 수거하기', desc: '길거리에 버려진 플라스틱과 쓰레기를 깔끔히 치웠습니다.', rewardMoney: 35000, cooldownSec: 60, hungerCost: 15 },
  { id: 'q_cat', title: '동네 길고양이 밥 챙겨주기', desc: '배고파하던 삼색 고양이에게 밥을 챙겨주어 감사를 받았습니다.', rewardMoney: 15000, cooldownSec: 30, hungerCost: 5 },
  { id: 'q_flyer', title: '상가 전단지 50장 돌리기', desc: '주변 상가와 아파트 단지에 전단지를 모두 배포했습니다.', rewardMoney: 50000, cooldownSec: 90, hungerCost: 20 },
  { id: 'q_deliver', title: '심야 긴급 서류 퀵배달', desc: '비 내리는 도로를 뚫고 대표님 서류를 제시간에 전달했습니다.', rewardMoney: 120000, cooldownSec: 150, hungerCost: 30 },
  { id: 'q_lostdog', title: '잃어버린 주민의 반려견 찾아주기', desc: '온 동네를 뒤져 마침내 공원 구석에서 강아지를 발견했습니다!', rewardMoney: 200000, cooldownSec: 240, hungerCost: 35 }
];

let STOCKS = [
  { symbol: 'NVX', name: '엔빅스 테크놀로지', price: 150000, min: 20000, max: 800000 },
  { symbol: 'BIO', name: '그린 바이오팜', price: 42000, min: 5000, max: 250000 },
  { symbol: 'SPX', name: '스페이스 코스모', price: 310000, min: 50000, max: 1500000 },
  { symbol: 'COIN', name: '도지 로켓 코인', price: 1200, min: 50, max: 25000 },
];

// 주식 변동 루프 (5초마다)
setInterval(() => {
  STOCKS.forEach(stock => {
    const rate = (Math.random() * 0.24 - 0.11); // -11% ~ +13%
    let newPrice = Math.round(stock.price * (1 + rate));
    newPrice = Math.max(stock.min, Math.min(stock.max, newPrice));
    stock.price = newPrice;
  });
  io.emit('stocks:update', STOCKS);
}, 5000);

// 배고픔 감소 루프 (12초마다 전원 2 감소)
setInterval(() => {
  Object.keys(db.users).forEach(u => {
    if (db.users[u].hunger > 0) {
      db.users[u].hunger = Math.max(0, db.users[u].hunger - 2);
    }
  });
  saveDB();
  io.emit('hunger:tick');
}, 12000);

// --- 미들웨어 & 정적 파일 ---
app.use(express.static(path.join(__dirname, 'public')));

// --- 소켓 세션 처리 ---
io.on('connection', (socket) => {
  let currentUser = null;

  function getUserData() {
    if (!currentUser || !db.users[currentUser]) return null;
    return {
      username: currentUser,
      money: db.users[currentUser].money,
      jobIndex: db.users[currentUser].jobIndex,
      hunger: db.users[currentUser].hunger,
      isAdmin: db.users[currentUser].isAdmin,
      stocks: db.users[currentUser].stocks || {},
      quests: db.users[currentUser].quests || {}
    };
  }

  function syncUser() {
    if (currentUser) {
      socket.emit('player:sync', getUserData());
    }
  }

  // 1. 회원가입
  socket.on('auth:register', ({ username, password }) => {
    if (!username || !password || username.trim().length < 2) {
      return socket.emit('notify', { success: false, msg: '아이디는 2자 이상 입력해주세요.' });
    }
    if (db.users[username]) {
      return socket.emit('notify', { success: false, msg: '이미 존재하는 아이디입니다.' });
    }
    db.users[username] = {
      passwordHash: hashPassword(password),
      money: 100000, // 시작 기본 지원금 10만원
      jobIndex: 0,
      hunger: 100,
      isAdmin: false,
      stocks: {},
      quests: {}
    };
    saveDB();
    socket.emit('notify', { success: true, msg: '회원가입이 완료되었습니다. 로그인해주세요.' });
  });

  // 2. 로그인
  socket.on('auth:login', ({ username, password }) => {
    const user = db.users[username];
    if (!user || user.passwordHash !== hashPassword(password)) {
      return socket.emit('notify', { success: false, msg: '아이디 또는 비밀번호가 잘못되었습니다.' });
    }
    currentUser = username;
    socket.emit('auth:success', { username, userData: getUserData(), stocks: STOCKS, jobs: JOBS, vending: VENDING_ITEMS, questList: QUEST_LIST });
  });

  // 3. 일하기 / 월급 수령
  socket.on('action:work', () => {
    if (!currentUser) return;
    const user = db.users[currentUser];
    const job = JOBS[user.jobIndex];

    if (user.hunger < job.workEnergyCost) {
      return socket.emit('notify', { success: false, msg: '배가 너무 고파서 일할 수 없습니다! 음식을 섭취하세요.' });
    }

    user.hunger = Math.max(0, user.hunger - job.workEnergyCost);
    user.money += job.salary;
    saveDB();
    syncUser();
    socket.emit('notify', { success: true, msg: `${job.name} 업무 완료! 급여 ₩${job.salary.toLocaleString()} 지급됨.` });
  });

  // 4. 승진 / 이직
  socket.on('action:promote', () => {
    if (!currentUser) return;
    const user = db.users[currentUser];
    const nextJobIndex = user.jobIndex + 1;

    if (nextJobIndex >= JOBS.length) {
      return socket.emit('notify', { success: false, msg: '이미 최고 직급(투자사 회장)에 도달했습니다!' });
    }

    const nextJob = JOBS[nextJobIndex];
    if (user.money < nextJob.reqMoney) {
      return socket.emit('notify', { success: false, msg: `승진 조건 부족: 보유 자산 ₩${nextJob.reqMoney.toLocaleString()} 이상 필요합니다.` });
    }

    user.jobIndex = nextJobIndex;
    saveDB();
    syncUser();
    socket.emit('notify', { success: true, msg: `축하합니다! [${nextJob.name}] (으)로 승진했습니다!` });
  });

  // 5. 자판기 음식 구매
  socket.on('vending:buy', (itemId) => {
    if (!currentUser) return;
    const user = db.users[currentUser];
    const item = VENDING_ITEMS.find(v => v.id === itemId);
    if (!item) return;

    if (user.money < item.cost) {
      return socket.emit('notify', { success: false, msg: '돈이 부족하여 구매할 수 없습니다.' });
    }
    if (user.hunger >= 100) {
      return socket.emit('notify', { success: false, msg: '이미 포만감이 가득 찼습니다.' });
    }

    user.money -= item.cost;
    user.hunger = Math.min(100, user.hunger + item.restoreHunger);
    saveDB();
    syncUser();
    socket.emit('notify', { success: true, msg: `${item.name} 섭취 완료! 포만감 +${item.restoreHunger}` });
  });

  // 6. 주식 매수/매도
  socket.on('stock:buy', ({ symbol, amount }) => {
    if (!currentUser) return;
    const user = db.users[currentUser];
    const stock = STOCKS.find(s => s.symbol === symbol);
    if (!stock || amount <= 0) return;

    const totalCost = stock.price * amount;
    if (user.money < totalCost) {
      return socket.emit('notify', { success: false, msg: '매수할 잔액이 부족합니다.' });
    }

    user.money -= totalCost;
    user.stocks[symbol] = (user.stocks[symbol] || 0) + amount;
    saveDB();
    syncUser();
    socket.emit('notify', { success: true, msg: `${stock.name} ${amount}주 매수 완료 (-₩${totalCost.toLocaleString()})` });
  });

  socket.on('stock:sell', ({ symbol, amount }) => {
    if (!currentUser) return;
    const user = db.users[currentUser];
    const stock = STOCKS.find(s => s.symbol === symbol);
    if (!stock || amount <= 0) return;

    const owned = user.stocks[symbol] || 0;
    if (owned < amount) {
      return socket.emit('notify', { success: false, msg: '보유 주식 수가 부족합니다.' });
    }

    const totalIncome = stock.price * amount;
    user.stocks[symbol] -= amount;
    if (user.stocks[symbol] === 0) delete user.stocks[symbol];
    user.money += totalIncome;
    saveDB();
    syncUser();
    socket.emit('notify', { success: true, msg: `${stock.name} ${amount}주 매도 완료 (+₩${totalIncome.toLocaleString()})` });
  });

  // 7. 카지노 룰렛 / 슬롯머신
  socket.on('casino:bet', ({ type, betAmount }) => {
    if (!currentUser) return;
    const user = db.users[currentUser];
    betAmount = parseInt(betAmount, 10);

    if (isNaN(betAmount) || betAmount < 1000) {
      return socket.emit('notify', { success: false, msg: '최소 배팅 금액은 ₩1,000 입니다.' });
    }
    if (user.money < betAmount) {
      return socket.emit('notify', { success: false, msg: '배팅할 돈이 부족합니다.' });
    }

    user.money -= betAmount;

    if (type === 'slot') {
      const symbols = ['🍒', '🍋', '🍇', '💎', '7️⃣'];
      const s1 = symbols[Math.floor(Math.random() * symbols.length)];
      const s2 = symbols[Math.floor(Math.random() * symbols.length)];
      const s3 = symbols[Math.floor(Math.random() * symbols.length)];

      let winMultiplier = 0;
      if (s1 === s2 && s2 === s3) {
        winMultiplier = s1 === '7️⃣' ? 25 : s1 === '💎' ? 12 : 6;
      } else if (s1 === s2 || s2 === s3 || s1 === s3) {
        winMultiplier = 1.5;
      }

      const reward = Math.floor(betAmount * winMultiplier);
      user.money += reward;
      saveDB();
      syncUser();

      socket.emit('casino:result', {
        type: 'slot',
        reels: [s1, s2, s3],
        reward,
        won: winMultiplier > 0,
        msg: winMultiplier > 0 ? `[${s1} | ${s2} | ${s3}] 잭팟! ₩${reward.toLocaleString()} 획득!` : `[${s1} | ${s2} | ${s3}] 꽝입니다.`
      });
    } else if (type === 'coinflip') {
      const isWin = Math.random() < 0.48; // 48% 확률
      const reward = isWin ? betAmount * 2 : 0;
      user.money += reward;
      saveDB();
      syncUser();

      socket.emit('casino:result', {
        type: 'coinflip',
        won: isWin,
        reward,
        msg: isWin ? `홀짝 승리! ₩${reward.toLocaleString()} 획득!` : `예측 실패! 배팅금을 잃었습니다.`
      });
    }
  });

  // 8. 퀘스트 수행
  socket.on('quest:start', (questId) => {
    if (!currentUser) return;
    const user = db.users[currentUser];
    const quest = QUEST_LIST.find(q => q.id === questId);
    if (!quest) return;

    const now = Date.now();
    const lastDone = (user.quests && user.quests[questId]) || 0;
    const remainingSec = Math.ceil((lastDone + quest.cooldownSec * 1000 - now) / 1000);

    if (remainingSec > 0) {
      return socket.emit('notify', { success: false, msg: `재수행 쿨타임 대기 중: ${remainingSec}초 남음` });
    }

    if (user.hunger < quest.hungerCost) {
      return socket.emit('notify', { success: false, msg: `지쳐서 퀘스트를 할 수 없습니다! 포만감 ${quest.hungerCost} 이상 필요.` });
    }

    user.hunger -= quest.hungerCost;
    user.money += quest.rewardMoney;
    if (!user.quests) user.quests = {};
    user.quests[questId] = now;

    saveDB();
    syncUser();
    socket.emit('notify', { success: true, msg: `[퀘스트 완료] ${quest.title} (+₩${quest.rewardMoney.toLocaleString()})` });
  });

  // 9. 관리자 전용 패널 액션
  socket.on('admin:action', ({ targetUser, action, value }) => {
    if (!currentUser || !db.users[currentUser] || !db.users[currentUser].isAdmin) {
      return socket.emit('notify', { success: false, msg: '관리자 권한이 없습니다.' });
    }

    const target = db.users[targetUser];
    if (!target) {
      return socket.emit('notify', { success: false, msg: '대상 유저를 찾을 수 없습니다.' });
    }

    if (action === 'give_money') {
      const add = parseInt(value, 10) || 0;
      target.money += add;
      socket.emit('notify', { success: true, msg: `${targetUser}님에게 ₩${add.toLocaleString()}을 지급했습니다.` });
    } else if (action === 'full_hunger') {
      target.hunger = 100;
      socket.emit('notify', { success: true, msg: `${targetUser}님의 포만감을 100으로 채웠습니다.` });
    }

    saveDB();
    io.emit('player:sync:all'); // 전원 갱신 신호
  });

  socket.on('disconnect', () => {
    currentUser = null;
  });
});

// --- 터미널 콘솔 명령어 리스너 (/admin add <아이디>) ---
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (line) => {
  const input = line.trim();

  if (input.startsWith('/admin add ')) {
    const targetId = input.replace('/admin add ', '').trim();
    if (!db.users[targetId]) {
      console.log(`\x1b[31m[ADMIN ERROR] '${targetId}' 아이디를 가진 유저가 데이터베이스에 없습니다.\x1b[0m`);
    } else {
      db.users[targetId].isAdmin = true;
      saveDB();
      console.log(`\x1b[32m[ADMIN SUCCESS] '${targetId}' 계정에 관리자(Admin) 권한이 영구 부여되었습니다.\x1b[0m`);
      io.emit('player:sync:all');
    }
  } else if (input === '/list') {
    console.log('[USER LIST]', Object.keys(db.users).map(u => `${u} (Admin: ${!!db.users[u].isAdmin})`));
  } else {
    console.log(`알 수 없는 명령어입니다. 사용 가능 명령어: /admin add <아이디>, /list`);
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` [TYCOON SERVER] 서버가 포트 ${PORT}에서 정상 시작되었습니다.`);
  console.log(` 콘솔 명령어 입력 가능: /admin add <아이디>`);
  console.log(`======================================================\n`);
});
