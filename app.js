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

let curLvl = 1, curBlock = 0, queue = [], qIdx = 0, score = 100;
let progress = JSON.parse(localStorage.getItem('p903_scores') || '{}');

const menuScreen = document.getElementById('menu-screen');
const quizScreen = document.getElementById('quiz-screen');

document.querySelectorAll('.lvl-btn').forEach(btn => {
    btn.onclick = () => {
        curLvl = Number(btn.dataset.lvl);
        document.querySelectorAll('.lvl-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showMenu();
    };
});

document.getElementById('back-btn').onclick = showMenu;

function saveScore(val) {
    progress[`${curLvl}_${curBlock}`] = val;
    localStorage.setItem('p903_scores', JSON.stringify(progress));
}

function showBanner(text, callback) {
    const banner = document.createElement('div');
    banner.style.cssText = `
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.92);
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; font-weight: bold; color: #f8fafc;
        text-align: center; padding: 20px; z-index: 99;
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
        } else if (typeof saved === 'number') {
            card.className = 'block-card partial';
            card.innerHTML = `<h3>${name}</h3><span>${saved}%</span>`;
        } else {
            card.className = 'block-card';
            card.innerHTML = `<h3>${name}</h3><span>Открыть</span>`;
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

    qIdx = 0;
    score = 100;
    delete progress[`${curLvl}_${curBlock}`];
    localStorage.setItem('p903_scores', JSON.stringify(progress));

    menuScreen.style.display = 'none';
    quizScreen.style.display = 'flex';
    renderQ();
}

function renderQ() {
    const item = queue[qIdx];
    document.getElementById('q-counter').innerText = `Раздел ${curBlock + 1} • ${qIdx + 1}/${queue.length} (${score}%)`;
    
    const qBox = document.getElementById('q-text');
    qBox.innerText = item.q;
    
    // На 1 уровне добавляем кликабельный бейдж пункта со справкой и исключениями
            if (curLvl === 1 && item.p && item.info) {
        const badge = document.createElement('span');
        badge.style.cssText = 'margin-left: 6px; white-space: nowrap;';
        badge.innerHTML = `(<span style="color: #fbbf24; text-decoration: underline; text-underline-offset: 3px; font-weight: bold; cursor: pointer;">${item.p}</span>)`;
        badge.querySelector('span').onclick = () => openRuleModal(item.p, item.info);
        qBox.appendChild(badge);
    }

    const optBox = document.getElementById('options');
    optBox.innerHTML = '';

    if (curLvl <= 3) {
        let opts = [item.a];
        if (curLvl === 1) opts = opts.concat(item.w1);
        if (curLvl === 2) opts = opts.concat(item.w2);
        if (curLvl === 3) opts.push(item.w3);
        opts.sort(() => Math.random() - 0.5);

        const padRow = document.createElement('div');
        padRow.className = 'pad-row';

        opts.forEach((text, i) => {
            const card = document.createElement('div');
            card.className = 'opt-item';
            card.innerHTML = `<b>${letters[i]}.</b> ${text}`;
            optBox.appendChild(card);

            const btn = document.createElement('button');
            btn.className = 'pad-btn';
            btn.innerText = letters[i];
            btn.onclick = () => {
                if (text === item.a) {
                    card.classList.add('correct');
                    btn.classList.add('correct');
                    padRow.querySelectorAll('.pad-btn').forEach(b => b.disabled = true);
                    setTimeout(nextStep, 750);
                } else {
                    card.classList.add('wrong');
                    btn.classList.add('wrong');
                    btn.disabled = true;
                    score = Math.max(0, score - 5);
                    saveScore(score);
                    document.getElementById('q-counter').innerText = `Раздел ${curBlock + 1} • ${qIdx + 1}/${queue.length} (${score}%)`;
                }
            };
            padRow.appendChild(btn);
        });
        optBox.appendChild(padRow);
    } else {
        optBox.innerHTML = `
            <input type="text" id="ans-in" placeholder="Введите ответ...">
            <div class="pad-row">
                <button class="pad-btn" id="chk-btn">Проверить</button>
            </div>
        `;
        document.getElementById('chk-btn').onclick = () => {
            const inp = document.getElementById('ans-in');
            const val = inp.value.trim().toLowerCase();
            if (item.kw.some(k => val.includes(k))) {
                inp.style.borderColor = '#10b981';
                inp.disabled = true;
                setTimeout(nextStep, 750);
            } else {
                inp.style.borderColor = '#ef4444';
                score = Math.max(0, score - 5);
                saveScore(score);
                document.getElementById('q-counter').innerText = `Раздел ${curBlock + 1} • ${qIdx + 1}/${queue.length} (${score}%)`;
            }
        };
    }
}

function nextStep() {
    qIdx++;
    if (qIdx < queue.length) {
        renderQ();
    } else {
        saveScore(score);
        if (score === 100) {
            const hasNext = (window.questionsDB || []).some(x => x.b === curBlock + 1);
            if (curBlock + 1 < blockNames.length && hasNext) {
                showBanner("100%! Следующий раздел...", () => startBlock(curBlock + 1));
            } else {
                showBanner("100%! Раздел пройден", showMenu);
            }
        } else {
            showBanner(`Результат: ${score}%\nЗапускаем заново...`, () => startBlock(curBlock));
        }
    }
}

showMenu();
