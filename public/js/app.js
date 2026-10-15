/**
 * Main application coordinator: state machine, socket communication,
 * collaborative lobby role-claiming, trial cycle, and results visualization.
 */

// Global Application State
const AppState = {
    role: null,                  // 'sender' | 'receiver' | null
    isCreator: false,
    roomCode: null,
    targetTrials: 25,            // 10 | 25 | 50 | 'unlimited' | custom integer
    feedbackMode: 'end',         // 'end' (Blind Run - Rhine protocol) | 'immediate' (Training)
    partnerConnected: false,
    trial: 1,
    secretTarget: null,          // Sender only (blinded from Receiver during trial)
    hits: 0,
    total: 0,
    awaitingGuess: false,
    trialLog: [],                // Array of { trial, target, guess, isHit }
    symbolStats: ZENER_SYMBOLS.map(s => ({
        id: s.id,
        name: s.name,
        targetCount: 0,
        guesses: 0,
        hits: 0
    }))
};

const socket = io();

// ---- Live Connection Badge ----
function updateConnectionBadge(status) {
    const badge = document.getElementById('connectionBadge');
    if (!badge) return;
    if (status === 'connected') {
        badge.className = 'px-2.5 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium transition-colors';
        badge.textContent = 'LAN Connected';
    } else if (status === 'disconnected') {
        badge.className = 'px-2.5 py-1 text-xs rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium transition-colors';
        badge.textContent = 'Offline';
    } else {
        badge.className = 'px-2.5 py-1 text-xs rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium transition-colors';
        badge.textContent = 'Connecting...';
    }
}

socket.on('connect', () => updateConnectionBadge('connected'));
socket.on('disconnect', () => updateConnectionBadge('disconnected'));
socket.on('connect_error', () => updateConnectionBadge('disconnected'));

// ---- Sound Controls ----
function handleToggleSound() {
    const enabled = SoundManager.toggleSound();
    document.getElementById('soundStatus').textContent = enabled ? 'On' : 'Off';
    document.getElementById('soundIcon').textContent = enabled ? '🔊' : '🔇';
}

// ---- Setup Mode Tabs (Host vs Join) ----
function switchSetupTab(mode) {
    SoundManager.initAudio();
    const hostBtn = document.getElementById('tabHostBtn');
    const joinBtn = document.getElementById('tabJoinBtn');
    const hostContent = document.getElementById('hostTabContent');
    const joinContent = document.getElementById('joinTabContent');

    const activeClass = 'flex-1 py-2.5 text-xs font-bold rounded-xl border border-indigo-500 bg-indigo-600/20 text-indigo-300 transition text-center flex items-center justify-center gap-1.5 shadow';
    const inactiveClass = 'flex-1 py-2.5 text-xs font-semibold rounded-xl border border-transparent text-slate-400 hover:text-slate-200 transition text-center flex items-center justify-center gap-1.5';

    if (mode === 'host') {
        hostBtn.className = activeClass;
        joinBtn.className = inactiveClass;
        hostContent.classList.remove('hidden');
        joinContent.classList.add('hidden');
    } else {
        joinBtn.className = activeClass;
        hostBtn.className = inactiveClass;
        joinContent.classList.remove('hidden');
        hostContent.classList.add('hidden');
        const input = document.getElementById('roomCodeInput');
        if (input) {
            setTimeout(() => input.focus(), 50);
        }
    }
}

// ---- Feedback Mode Toggle (Blind vs Immediate) ----
function setFeedbackMode(mode) {
    SoundManager.initAudio();
    AppState.feedbackMode = mode;

    const endBtn = document.getElementById('feedbackModeEndBtn');
    const immBtn = document.getElementById('feedbackModeImmBtn');

    if (mode === 'end') {
        endBtn.className = 'flex-1 py-2 text-xs font-semibold rounded-lg border border-indigo-500 bg-indigo-600/20 text-indigo-300 transition text-center';
        immBtn.className = 'flex-1 py-2 text-xs font-medium rounded-lg border border-slate-700 bg-surfaceBg/60 text-slate-400 hover:border-slate-600 transition text-center';
        document.getElementById('feedbackModeDesc').textContent = 'Pure Blind Run: Results are withheld and revealed only at the end to prevent counting bias.';
    } else {
        immBtn.className = 'flex-1 py-2 text-xs font-semibold rounded-lg border border-indigo-500 bg-indigo-600/20 text-indigo-300 transition text-center';
        endBtn.className = 'flex-1 py-2 text-xs font-medium rounded-lg border border-slate-700 bg-surfaceBg/60 text-slate-400 hover:border-slate-600 transition text-center';
        document.getElementById('feedbackModeDesc').textContent = 'Training Mode: Immediate hit/miss feedback after each guess.';
    }
}

// ---- Trial Limits ----
function setTrialLimit(val) {
    SoundManager.initAudio();
    AppState.targetTrials = val;

    document.querySelectorAll('.trial-limit-btn').forEach(btn => {
        btn.className = 'trial-limit-btn py-2 text-xs font-semibold rounded-lg border border-slate-700 bg-surfaceBg/70 text-slate-300 hover:border-indigo-500 transition';
    });

    const subtitle = document.getElementById('trialsSubtitle');
    if (val === 10) {
        document.getElementById('limitBtn10').className = 'trial-limit-btn py-2 text-xs font-semibold rounded-lg border border-indigo-500 bg-indigo-600/20 text-indigo-300 transition';
        subtitle.textContent = 'Quick (10)';
    } else if (val === 25) {
        document.getElementById('limitBtn25').className = 'trial-limit-btn py-2 text-xs font-semibold rounded-lg border border-indigo-500 bg-indigo-600/20 text-indigo-300 transition';
        subtitle.textContent = 'Standard (25)';
    } else if (val === 50) {
        document.getElementById('limitBtn50').className = 'trial-limit-btn py-2 text-xs font-semibold rounded-lg border border-indigo-500 bg-indigo-600/20 text-indigo-300 transition';
        subtitle.textContent = 'Extended (50)';
    } else if (val === 'unlimited') {
        document.getElementById('limitBtnUnlimited').className = 'trial-limit-btn py-2 text-xs font-semibold rounded-lg border border-indigo-500 bg-indigo-600/20 text-indigo-300 transition';
        subtitle.textContent = 'Unlimited (∞)';
    }
    document.getElementById('customTrialInput').value = '';
}

function setCustomTrialLimit(val) {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
        AppState.targetTrials = num;
        document.querySelectorAll('.trial-limit-btn').forEach(btn => {
            btn.className = 'trial-limit-btn py-2 text-xs font-semibold rounded-lg border border-slate-700 bg-surfaceBg/70 text-slate-300 hover:border-indigo-500 transition';
        });
        document.getElementById('trialsSubtitle').textContent = `Custom (${num})`;
    }
}

// ---- Inline Errors ----
function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = msg;
        el.classList.remove('hidden');
    }
}
function hideError(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
}

// ---- Room Creation & Joining (Connection First) ----
function createRoom() {
    SoundManager.initAudio();
    hideError('roomError');

    const code = generateRoomCode();
    AppState.roomCode = code;
    AppState.isCreator = true;

    socket.emit('join_room', {
        roomCode: code,
        targetTrials: AppState.targetTrials,
        feedbackMode: AppState.feedbackMode,
        isCreating: true
    });

    transitionToLobby();
}

function joinRoom() {
    SoundManager.initAudio();
    const inputEl = document.getElementById('roomCodeInput');
    const code = inputEl.value.trim().toUpperCase();
    if (code.length < 4) {
        showError('roomError', 'Please enter a valid room code (4 to 8 characters).');
        return;
    }
    hideError('roomError');

    AppState.roomCode = code;
    AppState.isCreator = false;

    socket.emit('join_room', {
        roomCode: code,
        targetTrials: AppState.targetTrials,
        feedbackMode: AppState.feedbackMode,
        isCreating: false
    });
}

function transitionToLobby() {
    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('lobbyScreen').classList.remove('hidden');

    document.getElementById('lobbyRoomDisplay').textContent = AppState.roomCode;
    document.getElementById('displayRoomCode').textContent = AppState.roomCode;
    document.getElementById('lobbyTrialsDisplay').textContent =
        AppState.targetTrials === 'unlimited' ? 'Unlimited (∞)' : `${AppState.targetTrials} Trials`;
    document.getElementById('lobbyModeDisplay').textContent =
        AppState.feedbackMode === 'end' ? 'Blind Run' : 'Immediate Feedback';

    updatePartnerLobbyUI(AppState.partnerConnected);
}

// Copy Room Code & Direct Invite URL
async function copyRoomCode() {
    SoundManager.initAudio();
    try {
        await navigator.clipboard.writeText(AppState.roomCode);
        const btn = document.getElementById('copyCodeBtn');
        btn.textContent = '✅';
        setTimeout(() => { btn.textContent = '📋'; }, 1500);
    } catch (e) {
        console.warn('Clipboard copy error:', e);
    }
}

async function copyInviteLink() {
    SoundManager.initAudio();
    try {
        const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(AppState.roomCode)}`;
        await navigator.clipboard.writeText(inviteUrl);
        const btn = document.getElementById('copyLinkBtn');
        btn.textContent = '✅ Invite Link Copied!';
        setTimeout(() => { btn.textContent = '🔗 Copy Direct Invite Link'; }, 2000);
    } catch (e) {
        console.warn('Clipboard copy error:', e);
    }
}

// Auto-fill room code from URL ?room=CODE and switch to join tab
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
        switchSetupTab('join');
        const input = document.getElementById('roomCodeInput');
        if (input) input.value = roomParam.trim().toUpperCase();
    }
});

// ---- Collaborative Role Selection in Lobby ----
function claimRole(role) {
    SoundManager.initAudio();
    socket.emit('claim_role', { role });
}

function swapRoles() {
    SoundManager.initAudio();
    socket.emit('swap_roles');
}

function startExperiment() {
    SoundManager.initAudio();
    socket.emit('start_experiment');
}

// Update the visual appearance of Sender & Receiver cards in Lobby
function updateRoleCardsUI(senderId, receiverId) {
    const myId = socket.id;
    const isSender = (senderId === myId);
    const isReceiver = (receiverId === myId);

    if (isSender) AppState.role = 'sender';
    else if (isReceiver) AppState.role = 'receiver';
    else AppState.role = null;

    const senderBtn = document.getElementById('roleSenderBtn');
    const receiverBtn = document.getElementById('roleReceiverBtn');
    const senderBadge = document.getElementById('senderSlotBadge');
    const receiverBadge = document.getElementById('receiverSlotBadge');

    const selectedStyle = 'p-4 rounded-xl border-2 border-indigo-500 ring-2 ring-indigo-500/50 bg-indigo-600/25 text-white shadow-lg shadow-indigo-600/20 transition text-center flex flex-col items-center gap-1.5 relative cursor-pointer';
    const partnerStyle  = 'p-4 rounded-xl border border-slate-700 bg-surfaceBg/80 text-slate-300 opacity-90 transition text-center flex flex-col items-center gap-1.5 relative cursor-pointer';
    const unclaimedStyle= 'p-4 rounded-xl border border-slate-700 bg-surfaceBg/50 text-slate-400 hover:border-slate-500 transition text-center flex flex-col items-center gap-1.5 relative cursor-pointer';

    // Sender Slot
    if (senderId) {
        if (isSender) {
            senderBtn.className = selectedStyle;
            senderBadge.textContent = 'YOU (SENDER)';
            senderBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500 text-white';
        } else {
            senderBtn.className = partnerStyle;
            senderBadge.textContent = 'PARTNER';
            senderBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300';
        }
    } else {
        senderBtn.className = unclaimedStyle;
        senderBadge.textContent = 'UNCLAIMED';
        senderBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
    }

    // Receiver Slot
    if (receiverId) {
        if (isReceiver) {
            receiverBtn.className = selectedStyle;
            receiverBadge.textContent = 'YOU (RECEIVER)';
            receiverBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500 text-white';
        } else {
            receiverBtn.className = partnerStyle;
            receiverBadge.textContent = 'PARTNER';
            receiverBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300';
        }
    } else {
        receiverBtn.className = unclaimedStyle;
        receiverBadge.textContent = 'UNCLAIMED';
        receiverBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
    }

    // Enable Start button once partner is connected
    const startBtn = document.getElementById('startExperimentBtn');
    if (AppState.partnerConnected) {
        startBtn.disabled = false;
        startBtn.className = 'w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2';
    } else {
        startBtn.disabled = true;
        startBtn.className = 'w-full py-3.5 bg-slate-800 text-slate-500 font-bold rounded-xl transition cursor-not-allowed shadow text-sm flex items-center justify-center gap-2';
    }
}

// Partner Status in Lobby UI
function updatePartnerLobbyUI(connected) {
    AppState.partnerConnected = connected;
    const card = document.getElementById('partnerStatusCard');
    const icon = document.getElementById('partnerStatusIcon');
    const title = document.getElementById('partnerStatusTitle');
    const desc = document.getElementById('partnerStatusDesc');
    const badge = document.getElementById('partnerStatusBadge');

    if (connected) {
        card.className = 'bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between shadow';
        icon.className = 'w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg';
        icon.textContent = '👥';
        title.textContent = 'Partner Connected!';
        title.className = 'text-xs font-semibold text-emerald-300';
        desc.textContent = 'Select roles above and tap Start Experiment';
        badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        badge.textContent = '2/2 READY';
    } else {
        card.className = 'bg-cardBg p-4 rounded-2xl border border-slate-800 flex items-center justify-between shadow';
        icon.className = 'w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-lg animate-pulse';
        icon.textContent = '⏳';
        title.textContent = 'Waiting for partner...';
        title.className = 'text-xs font-semibold text-slate-200';
        desc.textContent = 'Open link on partner\'s phone or laptop';
        badge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
        badge.textContent = '1/2 CONNECTED';
    }
}

// ---- Socket Protocol Handlers ----
socket.on('error_message', (msg) => {
    showError('roomError', msg);
});

socket.on('room_full', () => {
    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('roomFullOverlay').classList.remove('hidden');
});

socket.on('room_joined', (data) => {
    AppState.targetTrials = data.targetTrials;
    AppState.feedbackMode = data.feedbackMode;
    AppState.partnerConnected = (data.participantCount >= 2);
    transitionToLobby();
});

socket.on('partner_joined', (data) => {
    SoundManager.playTone('cue');
    updatePartnerLobbyUI(true);
});

socket.on('roles_updated', (data) => {
    updateRoleCardsUI(data.senderId, data.receiverId);
});

socket.on('session_ready', (data) => {
    AppState.targetTrials = data.targetTrials;
    AppState.feedbackMode = data.feedbackMode;
    const myId = socket.id;
    AppState.role = (data.senderId === myId) ? 'sender' : 'receiver';

    startExperimentArena();
});

socket.on('partner_disconnected', (info) => {
    updatePartnerLobbyUI(false);
    updateRoleCardsUI(null, null);

    const msgEl = document.getElementById('disconnectMessage');
    if (msgEl && info && info.message) {
        msgEl.textContent = info.message;
    }
    // Only show disconnect modal if experiment arena is active
    if (!document.getElementById('experimentScreen').classList.contains('hidden')) {
        document.getElementById('disconnectOverlay').classList.remove('hidden');
    }
});

// ---- Progress & Arena State Rendering ----
function updateProgress() {
    const completed = AppState.total;
    const isUnlimited = (AppState.targetTrials === 'unlimited');
    const totalDisplay = document.getElementById('totalTrialsDisplay');
    const bar = document.getElementById('progressBar');

    if (isUnlimited) {
        totalDisplay.textContent = '∞';
        bar.style.width = '100%';
        bar.className = 'h-1.5 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-pulse';
    } else {
        totalDisplay.textContent = AppState.targetTrials;
        const pct = Math.min((completed / AppState.targetTrials) * 100, 100);
        bar.style.width = `${pct}%`;
        bar.className = 'bg-indigo-500 h-1.5 rounded-full transition-all duration-300 ease-out';
    }

    // In Blind Run mode, hit counts remain hidden from live arena to prevent counting bias
    const hitBadge = document.getElementById('hitCounterBadge');
    if (AppState.feedbackMode === 'immediate') {
        hitBadge.classList.remove('hidden');
        document.getElementById('liveHits').textContent = AppState.hits;
        document.getElementById('liveTotal').textContent = completed;
    } else {
        hitBadge.classList.add('hidden');
    }
}

function startExperimentArena() {
    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('lobbyScreen').classList.add('hidden');
    document.getElementById('experimentScreen').classList.remove('hidden');
    document.getElementById('disconnectOverlay').classList.add('hidden');

    document.getElementById('roleIndicator').textContent = AppState.role.toUpperCase();
    document.getElementById('modeIndicator').textContent =
        AppState.feedbackMode === 'end' ? 'BLIND RUN' : 'TRAINING';

    updateProgress();

    if (AppState.role === 'sender') {
        document.getElementById('senderView').classList.remove('hidden');
        document.getElementById('receiverView').classList.add('hidden');
        generateBlindedTarget();
    } else {
        document.getElementById('receiverView').classList.remove('hidden');
        document.getElementById('senderView').classList.add('hidden');
        renderReceiverChoices(false);
        document.getElementById('receiverStatusText').textContent = 'Waiting for sender to focus on first symbol...';
    }
}

// Sender Generates Target: Stored LOCALLY ONLY
function generateBlindedTarget() {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    AppState.secretTarget = arr[0] % 5;
    AppState.awaitingGuess = true;

    AppState.symbolStats[AppState.secretTarget].targetCount++;

    document.getElementById('trialCounter').textContent = AppState.trial;
    document.getElementById('senderTargetDisplay').innerHTML = getSymbolSvg(AppState.secretTarget, 'w-20 h-20');
    document.getElementById('senderTargetName').textContent = ZENER_SYMBOLS[AppState.secretTarget].name;
    document.getElementById('senderStatusText').textContent = `Trial ${AppState.trial} active. Focus your mind. Waiting for receiver's perception...`;

    updateProgress();
    SoundManager.playTone('cue');

    // Blinded cue: NO target ID sent over the wire!
    socket.emit('sync_action', {
        type: 'NEW_TARGET_CUE',
        roomCode: AppState.roomCode,
        trial: AppState.trial
    });
}

function renderReceiverChoices(enabled = true) {
    const grid = document.getElementById('receiverChoicesGrid');
    grid.innerHTML = '';

    const shuffled = cryptoShuffle(ZENER_SYMBOLS);

    shuffled.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        if (enabled) {
            btn.className = "h-20 bg-surfaceBg border border-slate-700 hover:border-indigo-500 hover:bg-indigo-600/15 rounded-2xl flex flex-col items-center justify-center gap-1 transition active:scale-95 shadow";
            btn.onclick = () => submitReceiverGuess(item.id);
        } else {
            btn.className = "h-20 bg-surfaceBg/40 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-1 opacity-30 cursor-not-allowed";
            btn.disabled = true;
        }
        btn.innerHTML = `${getSymbolSvg(item.id, 'w-10 h-10')}<span class="text-[10px] text-slate-400 font-medium">${item.name}</span>`;
        grid.appendChild(btn);
    });
}

// Receiver Submits Guess
function submitReceiverGuess(choiceIndex) {
    SoundManager.initAudio();
    if (AppState.role !== 'receiver') return;

    SoundManager.playTone('submit');
    document.getElementById('receiverStatusText').textContent =
        `Perception recorded (${ZENER_SYMBOLS[choiceIndex].name}). Processing trial...`;

    // Disable buttons immediately to prevent duplicate taps
    document.querySelectorAll('#receiverChoicesGrid button').forEach(b => b.disabled = true);

    socket.emit('sync_action', {
        type: 'SUBMIT_GUESS',
        roomCode: AppState.roomCode,
        trial: AppState.trial,
        guessIndex: choiceIndex
    });
}

function showFeedbackBanner(text, isHit) {
    const banner = document.getElementById('feedbackBanner');
    banner.textContent = text;
    banner.className = isHit
        ? 'text-xs py-2 px-3 rounded-xl border font-semibold transition-all bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
        : 'text-xs py-2 px-3 rounded-xl border font-semibold transition-all bg-slate-800/80 border-slate-700 text-slate-300';
    banner.classList.remove('hidden');
}

// ---- Real-Time Synchronization Listener ----
socket.on('receive_action', (data) => {
    if (!data || typeof data !== 'object') return;

    // Sender receives Guess from Receiver
    if (AppState.role === 'sender' && data.type === 'SUBMIT_GUESS') {
        if (!AppState.awaitingGuess) return;
        AppState.awaitingGuess = false;

        const guessIndex = data.guessIndex;
        const isHit = (guessIndex === AppState.secretTarget);

        AppState.total++;
        if (isHit) AppState.hits++;

        AppState.symbolStats[guessIndex].guesses++;
        if (isHit) AppState.symbolStats[guessIndex].hits++;

        // Record in trial history log
        AppState.trialLog.push({
            trial: AppState.trial,
            target: AppState.secretTarget,
            guess: guessIndex,
            isHit: isHit
        });

        const isImmediate = (AppState.feedbackMode === 'immediate');

        if (isImmediate) {
            const hitSym = ZENER_SYMBOLS[AppState.secretTarget].name;
            const guessSym = ZENER_SYMBOLS[guessIndex].name;
            const text = isHit
                ? `✨ HIT! Receiver correctly perceived ${hitSym}!`
                : `Receiver guessed ${guessSym} (Target was ${hitSym})`;
            showFeedbackBanner(text, isHit);
            SoundManager.playTone(isHit ? 'hit' : 'miss');
        } else {
            SoundManager.playTone('submit');
            document.getElementById('senderStatusText').textContent =
                `Guess received. Preparing next trial...`;
        }

        updateProgress();

        // Broadcast evaluation result to Receiver
        socket.emit('sync_action', {
            type: 'EVALUATE_RESULT',
            roomCode: AppState.roomCode,
            trial: AppState.trial,
            targetIndex: AppState.secretTarget,
            guessIndex: guessIndex,
            isHit: isHit,
            total: AppState.total,
            hits: AppState.hits,
            symbolStats: AppState.symbolStats,
            trialLog: AppState.trialLog
        });

        // Check trial limit
        const isUnlimited = (AppState.targetTrials === 'unlimited');
        if (!isUnlimited && AppState.total >= AppState.targetTrials) {
            setTimeout(() => finishSession(), 1000);
        } else {
            setTimeout(() => {
                AppState.trial++;
                generateBlindedTarget();
            }, isImmediate ? 1100 : 800);
        }
    }

    // Receiver receives Blinded Cue
    else if (AppState.role === 'receiver' && data.type === 'NEW_TARGET_CUE') {
        AppState.trial = data.trial;
        document.getElementById('trialCounter').textContent = AppState.trial;
        document.getElementById('receiverStatusText').textContent =
            `Trial ${AppState.trial}: Tune in & select the symbol you perceive`;
        updateProgress();
        SoundManager.playTone('cue');
        renderReceiverChoices(true);
    }

    // Receiver receives Evaluation result
    else if (AppState.role === 'receiver' && data.type === 'EVALUATE_RESULT') {
        AppState.total = data.total;
        AppState.hits = data.hits;
        AppState.symbolStats = data.symbolStats;
        AppState.trialLog = data.trialLog;

        const isImmediate = (AppState.feedbackMode === 'immediate');

        if (isImmediate) {
            const targetSym = ZENER_SYMBOLS[data.targetIndex].name;
            const guessSym = ZENER_SYMBOLS[data.guessIndex].name;
            const text = data.isHit
                ? `✨ HIT! You correctly perceived ${targetSym}!`
                : `You perceived ${guessSym} (Target was ${targetSym})`;
            showFeedbackBanner(text, data.isHit);
            SoundManager.playTone(data.isHit ? 'hit' : 'miss');
        } else {
            document.getElementById('receiverStatusText').textContent =
                `Perception logged. Waiting for next target...`;
        }

        updateProgress();

        // Check trial limit
        const isUnlimited = (AppState.targetTrials === 'unlimited');
        if (!isUnlimited && AppState.total >= AppState.targetTrials) {
            setTimeout(() => finishSession(), 1000);
        }
    }

    // Manual session termination requested by partner
    else if (data.type === 'END_SESSION_REQUEST') {
        AppState.total = data.total;
        AppState.hits = data.hits;
        AppState.symbolStats = data.symbolStats;
        AppState.trialLog = data.trialLog || AppState.trialLog;
        renderResultsDashboard();
    }
});

// Synchronized End Session
function requestEndSession() {
    SoundManager.initAudio();
    socket.emit('sync_action', {
        type: 'END_SESSION_REQUEST',
        roomCode: AppState.roomCode,
        total: AppState.total,
        hits: AppState.hits,
        symbolStats: AppState.symbolStats,
        trialLog: AppState.trialLog
    });
    renderResultsDashboard();
}

function finishSession() {
    SoundManager.playTone('finish');
    requestEndSession();
}

// ---- Results Dashboard & Trial Log Rendering ----
function renderResultsDashboard() {
    document.getElementById('experimentScreen').classList.add('hidden');
    document.getElementById('disconnectOverlay').classList.add('hidden');
    document.getElementById('resultsScreen').classList.remove('hidden');

    const total = AppState.total;
    const hits = AppState.hits;

    if (total === 0) {
        document.getElementById('resTotalTrials').textContent = '0';
        document.getElementById('resHits').textContent = '0';
        document.getElementById('resHitRate').textContent = '—';
        document.getElementById('resExpectedHits').textContent = '0.0';
        document.getElementById('resDeviation').textContent = '—';
        document.getElementById('resPValueOne').textContent = '—';
        document.getElementById('resPValueTwo').textContent = '—';
        document.getElementById('resSignificance').textContent = 'No trials completed';
        document.getElementById('symbolBreakdown').innerHTML = '<p class="text-xs text-slate-500 italic">No data recorded.</p>';
        document.getElementById('trialLogContainer').innerHTML = '<p class="text-xs text-slate-500 italic">No trials recorded.</p>';
        return;
    }

    const stats = StatsEngine.calculateStats(total, hits);

    document.getElementById('resTotalTrials').textContent = total;
    document.getElementById('resHits').textContent = hits;
    document.getElementById('resHitRate').textContent = `${stats.hitRatePct.toFixed(1)}%`;
    document.getElementById('resExpectedHits').textContent = stats.expectedHits.toFixed(1);
    document.getElementById('resDeviation').textContent =
        `${stats.deviationPct >= 0 ? '+' : ''}${stats.deviationPct.toFixed(1)}%`;

    document.getElementById('resPValueOne').textContent =
        stats.pOneSided < 0.001 ? '< 0.001' : stats.pOneSided.toFixed(4);
    document.getElementById('resPValueTwo').textContent =
        stats.pTwoSided < 0.001 ? '< 0.001' : stats.pTwoSided.toFixed(4);

    const sigBadge = document.getElementById('resSignificance');
    sigBadge.textContent = stats.classification;
    sigBadge.className = `font-bold text-right ${stats.badgeClass}`;

    // Render Per-Symbol Hit Breakdown for BOTH players
    const bd = document.getElementById('symbolBreakdown');
    bd.innerHTML = '';

    ZENER_SYMBOLS.forEach(sym => {
        const stat = AppState.symbolStats[sym.id] || { guesses: 0, hits: 0, targetCount: 0 };
        const pct = stat.guesses > 0 ? (stat.hits / stat.guesses) * 100 : 0;
        const label = stat.guesses > 0
            ? `${stat.hits}/${stat.guesses} hits (${pct.toFixed(0)}%)`
            : 'No guesses';

        const row = document.createElement('div');
        row.className = 'flex items-center gap-3 text-xs';
        row.innerHTML = `
            <div class="flex items-center justify-center w-8 h-8 bg-slate-800 rounded-lg flex-shrink-0">
                ${getSymbolSvg(sym.id, 'w-6 h-6')}
            </div>
            <div class="flex-1">
                <div class="flex justify-between mb-1">
                    <span class="text-slate-300 font-medium">${sym.name} <span class="text-[10px] text-slate-500 font-normal">(Target: ${stat.targetCount}×)</span></span>
                    <span class="font-mono text-slate-200">${label}</span>
                </div>
                <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div class="bg-indigo-500 h-1.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                </div>
            </div>
        `;
        bd.appendChild(row);
    });

    // Render Full Trial-by-Trial Breakdown Table
    const logContainer = document.getElementById('trialLogContainer');
    if (logContainer && AppState.trialLog && AppState.trialLog.length > 0) {
        logContainer.innerHTML = '';
        const table = document.createElement('div');
        table.className = 'flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1';

        AppState.trialLog.forEach(item => {
            const row = document.createElement('div');
            row.className = `flex items-center justify-between p-2 rounded-lg text-xs ${item.isHit ? 'bg-emerald-500/10 border border-emerald-500/25' : 'bg-slate-800/40 border border-slate-800'}`;
            row.innerHTML = `
                <span class="font-mono text-slate-400 font-medium">#${item.trial}</span>
                <div class="flex items-center gap-1.5">
                    <span class="text-[11px] text-slate-400">Target:</span>
                    <div class="w-5 h-5 flex items-center justify-center">${getSymbolSvg(item.target, 'w-4 h-4')}</div>
                    <span class="text-slate-200">${ZENER_SYMBOLS[item.target].name}</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="text-[11px] text-slate-400">Guess:</span>
                    <div class="w-5 h-5 flex items-center justify-center">${getSymbolSvg(item.guess, 'w-4 h-4')}</div>
                    <span class="text-slate-200">${ZENER_SYMBOLS[item.guess].name}</span>
                </div>
                <span class="font-bold ${item.isHit ? 'text-emerald-400' : 'text-slate-500'}">
                    ${item.isHit ? 'HIT ✨' : 'MISS'}
                </span>
            `;
            table.appendChild(row);
        });
        logContainer.appendChild(table);
    }
}

// ---- Data Export Engine (CSV & JSON) ----
function exportResults(format) {
    SoundManager.initAudio();
    if (AppState.total === 0) {
        alert('No trials completed to export.');
        return;
    }

    const stats = StatsEngine.calculateStats(AppState.total, AppState.hits);
    const dateStr = new Date().toISOString();
    const dateFileStr = dateStr.slice(0, 10);
    const code = AppState.roomCode || 'session';
    const filenamePrefix = `zener-results-${code}-${dateFileStr}`;

    if (format === 'json') {
        const payload = {
            metadata: {
                experiment: "Coincidence & Probability Lab",
                protocol: "Classic 5-Choice Zener Card Test",
                exportDate: dateStr,
                roomCode: AppState.roomCode,
                role: AppState.role,
                targetTrials: AppState.targetTrials,
                feedbackMode: AppState.feedbackMode === 'end' ? 'Blind Run (Scored at End)' : 'Immediate Feedback'
            },
            summary: {
                totalTrials: AppState.total,
                hits: AppState.hits,
                hitRatePct: parseFloat(stats.hitRatePct.toFixed(2)),
                expectedChanceHits: parseFloat(stats.expectedHits.toFixed(2)),
                chanceBaselinePct: 20.0,
                deviationPct: parseFloat(stats.deviationPct.toFixed(2)),
                pOneSided: stats.pOneSided,
                pTwoSided: stats.pTwoSided,
                classification: stats.classification
            },
            symbolBreakdown: ZENER_SYMBOLS.map(sym => {
                const s = AppState.symbolStats[sym.id] || { targetCount: 0, guesses: 0, hits: 0 };
                return {
                    id: sym.id,
                    name: sym.name,
                    targetCount: s.targetCount,
                    guessCount: s.guesses,
                    hits: s.hits,
                    hitRatePct: s.guesses > 0 ? parseFloat(((s.hits / s.guesses) * 100).toFixed(2)) : 0
                };
            }),
            trialLog: AppState.trialLog.map(t => ({
                trial: t.trial,
                targetId: t.target,
                targetSymbol: ZENER_SYMBOLS[t.target]?.name || 'Unknown',
                guessId: t.guess,
                guessSymbol: ZENER_SYMBOLS[t.guess]?.name || 'Unknown',
                isHit: t.isHit
            }))
        };

        const jsonStr = JSON.stringify(payload, null, 2);
        downloadBlob(jsonStr, `${filenamePrefix}.json`, 'application/json');
    } else if (format === 'csv') {
        let csv = `# Coincidence Lab - Zener ESP Experiment Report\n`;
        csv += `# Export Date: ${dateStr}\n`;
        csv += `# Room Code: ${AppState.roomCode || 'N/A'}\n`;
        csv += `# Role: ${AppState.role ? AppState.role.toUpperCase() : 'N/A'}\n`;
        csv += `# Feedback Protocol: ${AppState.feedbackMode === 'end' ? 'Blind Run' : 'Immediate'}\n`;
        csv += `# Total Trials: ${AppState.total}\n`;
        csv += `# Observed Hits: ${AppState.hits}\n`;
        csv += `# Hit Rate: ${stats.hitRatePct.toFixed(1)}%\n`;
        csv += `# Expected Chance Hits: ${stats.expectedHits.toFixed(1)}\n`;
        csv += `# Exact p-value (One-tailed): ${stats.pOneSided.toFixed(4)}\n`;
        csv += `# Exact p-value (Two-tailed): ${stats.pTwoSided.toFixed(4)}\n`;
        csv += `# Scientific Classification: ${stats.classification}\n\n`;

        // Trials Table
        csv += `Trial,Target_ID,Target_Symbol,Guess_ID,Guess_Symbol,Result\n`;
        AppState.trialLog.forEach(t => {
            const targetName = ZENER_SYMBOLS[t.target]?.name || '';
            const guessName = ZENER_SYMBOLS[t.guess]?.name || '';
            csv += `${t.trial},${t.target},"${targetName}",${t.guess},"${guessName}",${t.isHit ? 'HIT' : 'MISS'}\n`;
        });

        // Symbol Breakdown Table
        csv += `\n# Symbol Breakdown\n`;
        csv += `Symbol_ID,Symbol_Name,Target_Count,Guess_Count,Hits,Hit_Rate_Pct\n`;
        ZENER_SYMBOLS.forEach(sym => {
            const s = AppState.symbolStats[sym.id] || { targetCount: 0, guesses: 0, hits: 0 };
            const rate = s.guesses > 0 ? ((s.hits / s.guesses) * 100).toFixed(1) : '0.0';
            csv += `${sym.id},"${sym.name}",${s.targetCount},${s.guesses},${s.hits},${rate}%\n`;
        });

        downloadBlob(csv, `${filenamePrefix}.csv`, 'text/csv;charset=utf-8;');
    }
}

function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
