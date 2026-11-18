function makeHash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString();
}

const PASS_HASH = makeHash([57, 48, 51].map(c => String.fromCharCode(c)).join(""));

(function initLock() {
    const lockScreen = document.getElementById('lock-screen');
    const passBtn = document.getElementById('pass-btn');
    const passIn = document.getElementById('pass-in');
    if (!lockScreen || !passBtn || !passIn) return;

    if (localStorage.getItem('app_token') === PASS_HASH) {
        lockScreen.style.display = 'none';
        return;
    }
    const check = () => {
        if (makeHash(passIn.value.trim()) === PASS_HASH) {
            localStorage.setItem('app_token', PASS_HASH);
            lockScreen.style.display = 'none';
        } else {
            document.getElementById('pass-err').innerText = "Неверный пароль";
            passIn.value = "";
        }
    };
    passBtn.onclick = check;
    passIn.onkeypress = (e) => { if (e.key === 'Enter') check(); };
})();

const blockNames = [
    "1. Ответственные лица", "2. Группы персонала",
    "3. Выдача наряда", "4. Сроки и продление",
    "5. Распоряжения", "6. Подготовка РМ",
    "7. Допуск и надзор", "8. Особые работы"
];
const letters = ["А", "Б", "В", "Г"];

let curLvl = 1, curBlock = 0, queue = [], viewIdx = 0, maxReachedIdx = 0;
let rawScore = 0, errorsCount = 0, history = [];
let progress = JSON.parse(localStorage.getItem('p903_scores') || '{}');

const menuScreen = document.getElementById('menu-screen');
const quizScreen = document.getElementById('quiz-screen');
const prevQBtn = document.getElementById('prev-q-btn');
const nextQBtn = document.getElementById('next-q-btn');

document.querySelectorAll('.lvl-btn').forEach(btn => {
    btn.onclick = () => {
        curLvl = Number(btn.dataset.lvl);
        document.querySelectorAll('.lvl-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showMenu();
    };
});

prevQBtn.onclick = () => {
    if (viewIdx > 0) {
        viewIdx--;
        renderQ();
    }
};

nextQBtn.onclick = () => {
    if (viewIdx < maxReachedIdx) {
        viewIdx++;
        renderQ();
    }
};

function getDisplayScore() {
    return Math.max(0, Math.min(100, Math.round(rawScore)));
}

function saveScore() {
    progress[`${curLvl}_${curBlock}`] = getDisplayScore();
    localStorage.setItem('p903_scores', JSON.stringify(progress));
}

function showBanner(text, callback) {
    const banner = document.createElement('div');
    banner.style.cssText = `
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.92);
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; font-weight: bold; color: #f8fafc;
        text-align: center; padding: 20px; z-index: 99; white-space: pre-line;
    `;
    banner.innerText = text;
    document.body.appendChild(banner);
    setTimeout(() => {
        banner.remove();
        callback();
    }, 1300);
}

function openRuleModal(title, text) {
    const bg = document.createElement('div');
    bg.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(15, 23, 42, 0.88);
        display: flex; align-items: center; justify-content: center;
        padding: 16px; z-index: 999;
    `;
    bg.innerHTML = `
        <div style="background:#1e293b; border:2px solid #3b82f6; border-radius:16px; padding:20px; width:100%; max-width:390px; max-height:80vh; overflow-y:auto; box-sizing:border-box;">
            <h4 style="margin:0 0 10px 0; color:#38bdf8; font-size:16px;">📖 Справка: ${title}</h4>
            <p style="margin:0 0 16px 0; font-size:14px; line-height:1.5; color:#e2e8f0; white-space:pre-line;">${text}</p>
            <button id="m-close" style="width:100%; padding:12px; background:#2563eb; color:#fff; border:none; border-radius:10px; font-weight:bold; font-size:15px; cursor:pointer;">Понятно, закрыть</button>
        </div>
    `;
    bg.querySelector('#m-close').onclick = () => bg.remove();
    bg.onclick = (e) => { if (e.target === bg) bg.remove(); };
    document.body.appendChild(bg);
}

function showMenu() {
    quizScreen.style.display = 'none';
    menuScreen.style.display = 'grid';
    menuScreen.innerHTML = '';

    blockNames.forEach((name, idx) => {
        const saved = progress[`${curLvl}_${idx}`];
        const card = document.createElement('div');
        
        if (saved === 100) {
            card.className = 'block-card done';
            card.innerHTML = `<h3>${name}</h3><span>100%</span>`;
        } else if (typeof saved === 'number' && saved > 0) {
            card.className = 'block-card partial';
            card.innerHTML = `<h3>${name}</h3><span>${saved}%</span>`;
        } else {
            card.className = 'block-card';
            card.innerHTML = `<h3>${name}</h3><span>${saved === 0 ? '0%' : 'Открыть'}</span>`;
        }
        
        card.onclick = () => startBlock(idx);
        menuScreen.appendChild(card);
    });
}

function startBlock(bIdx) {
    curBlock = bIdx;
    const data = window.questionsDB || [];
    queue = data.filter(item => item.b === bIdx).sort(() => Math.random() - 0.5);
    if (queue.length === 0) return;

    viewIdx = 0;
    maxReachedIdx = 0;
    rawScore = 0;
    errorsCount = 0;
    history = [];
    saveScore();

    menuScreen.style.display = 'none';
    quizScreen.style.display = 'flex';
    renderQ();
}

function updateHeader() {
    document.getElementById('q-counter').innerText = `Раздел ${curBlock + 1} • ${viewIdx + 1}/${queue.length} • Ошибок: ${errorsCount}`;
    prevQBtn.style.opacity = viewIdx > 0 ? '1' : '0.3';
    prevQBtn.disabled = viewIdx === 0;
    nextQBtn.style.opacity = viewIdx < maxReachedIdx ? '1' : '0.3';
    nextQBtn.disabled = viewIdx === maxReachedIdx;
}

function renderQ() {
    const item = queue[viewIdx];
    const stepPoints = 100 / queue.length;
    updateHeader();
    
    const qBox = document.getElementById('q-text');
    qBox.innerText = item.q;
    
    if (curLvl === 1 && item.p && item.info) {
        const badge = document.createElement('span');
        badge.style.cssText = 'margin-left: 6px; white-space: nowrap;';
        badge.innerHTML = `(<span style="color: #fbbf24; text-decoration: underline; text-underline-offset: 3px; font-weight: bold; cursor: pointer;">${item.p}</span>)`;
        badge.querySelector('span').onclick = () => openRuleModal(item.p, item.info);
        qBox.appendChild(badge);
    }

    const optBox = document.getElementById('options');
    optBox.innerHTML = '';

    // Создаем или достаем состояние вопроса из истории для безопасного просмотра
    if (!history[viewIdx]) {
        let opts = [item.a];
        if (curLvl === 1) opts = opts.concat(item.w1);
        if (curLvl === 2) opts = opts.concat(item.w2);
        if (curLvl === 3) opts.push(item.w3);
        opts.sort(() => Math.random() - 0.5);
        history[viewIdx] = { opts: opts, wrongPicked: [], solved: false, userText: '' };
    }
    const state = history[viewIdx];

    if (curLvl <= 3) {
        const padRow = document.createElement('div');
        padRow.className = 'pad-row';

        state.opts.forEach((text, i) => {
            const card = document.createElement('div');
            card.className = 'opt-item';
            card.innerHTML = `<b>${letters[i]}.</b> ${text}`;
            optBox.appendChild(card);

            const btn = document.createElement('button');
            btn.className = 'pad-btn';
            btn.innerText = letters[i];

            // Восстанавливаем подсветку и блокировку, если вернулись к этому вопросу
            if (state.wrongPicked.includes(text)) {
                card.classList.add('wrong');
                btn.classList.add('wrong');
                btn.disabled = true;
            }
            if (state.solved) {
                btn.disabled = true;
                if (text === item.a) {
                    card.classList.add('correct');
                    btn.classList.add('correct');
                }
            }

            const handleSelect = () => {
                if (btn.disabled || state.solved) return;

                if (text === item.a) {
                    state.solved = true;
                    card.classList.add('correct');
                    btn.classList.add('correct');
                    padRow.querySelectorAll('.pad-btn').forEach(b => b.disabled = true);
                    rawScore += stepPoints;
                    saveScore();
                    updateHeader();
                    
                    const targetIdx = viewIdx;
                    setTimeout(() => {
                        if (viewIdx === targetIdx) advanceProgress();
                    }, 750);
                } else {
                    state.wrongPicked.push(text);
                    card.classList.add('wrong');
                    btn.classList.add('wrong');
                    btn.disabled = true;
                    errorsCount++;
                    rawScore -= 5;
                    saveScore();
                    updateHeader();
                }
            };

            card.onclick = handleSelect;
            btn.onclick = handleSelect;
            padRow.appendChild(btn);
        });
        optBox.appendChild(padRow);
    } else {
        optBox.innerHTML = `
            <input type="text" id="ans-in" placeholder="Введите ответ..." value="${state.userText}">
            <div class="pad-row">
                <button class="pad-btn" id="chk-btn">Проверить</button>
            </div>
        `;
        const inp = document.getElementById('ans-in');
        const chkBtn = document.getElementById('chk-btn');

        if (state.solved) {
            inp.style.borderColor = '#10b981';
            inp.disabled = true;
            chkBtn.disabled = true;
        }

        chkBtn.onclick = () => {
            if (state.solved) return;
            const val = inp.value.trim().toLowerCase();
            state.userText = inp.value;
            if (item.kw.some(k => val.includes(k))) {
                state.solved = true;
                inp.style.borderColor = '#10b981';
                inp.disabled = true;
                chkBtn.disabled = true;
                rawScore += stepPoints;
                saveScore();
                updateHeader();
                
                const targetIdx = viewIdx;
                setTimeout(() => {
                    if (viewIdx === targetIdx) advanceProgress();
                }, 750);
            } else {
                inp.style.borderColor = '#ef4444';
                errorsCount++;
                rawScore -= 5;
                saveScore();
                updateHeader();
            }
        };
    }
}

function advanceProgress() {
    if (maxReachedIdx + 1 < queue.length) {
        maxReachedIdx++;
        viewIdx = maxReachedIdx;
        renderQ();
    } else {
        const finalScore = getDisplayScore();
        saveScore();
if (finalScore === 100) {
const hasNext = (window.questionsDB || []).some(x => x.b === curBlock + 1);
if (curBlock + 1 < blockNames.length && hasNext) {
showBanner("100%! Следующий раздел...", () => startBlock(curBlock + 1));
} else {
showBanner("100%! Раздел пройден", showMenu);
}
} else {
showBanner(Результат: ${finalScore}%\nОшибок: ${errorsCount}\nЗапускаем заново..., () => startBlock(curBlock));
}
}
}
showMenu();
