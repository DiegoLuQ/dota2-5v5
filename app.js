// app.js - Lógica principal

let data = null;
let currentUser = null;
let filterPlayer = null;

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('data.json');
        data = await response.json();
        
        renderPlayersList();
        renderMatches();
        renderFilter();
        updateStats();
        checkSession();
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
});

// === LOGIN SYSTEM ===

function openLogin() {
    document.getElementById('loginModal').classList.remove('hidden');
}

function closeLogin() {
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('loginError').classList.add('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const user = data.usuarios.find(u => u.username === username && u.password === password);
    
    if (user) {
        currentUser = user;
        localStorage.setItem('amigos5v5_session', JSON.stringify(user));
        closeLogin();
        updateLoginUI();
        renderMatches();
    } else {
        document.getElementById('loginError').classList.remove('hidden');
    }
});

function logout() {
    currentUser = null;
    localStorage.removeItem('amigos5v5_session');
    updateLoginUI();
    renderMatches();
}

function checkSession() {
    const session = localStorage.getItem('amigos5v5_session');
    if (session) {
        currentUser = JSON.parse(session);
        updateLoginUI();
    }
}

function updateLoginUI() {
    const loginSection = document.getElementById('loginSection');
    const userSection = document.getElementById('userSection');
    
    if (currentUser) {
        loginSection.classList.add('hidden');
        userSection.classList.remove('hidden');
        document.getElementById('userName').textContent = currentUser.username;
    } else {
        loginSection.classList.remove('hidden');
        userSection.classList.add('hidden');
    }
}

// === RENDER PLAYERS LIST ===

function renderPlayersList() {
    const container = document.getElementById('playersList');
    
    const sortedPlayers = [...data.jugadores].sort((a, b) => b.win - a.win);
    
    const getMedal = (pos) => {
        if (pos === 0) return '🥇';
        if (pos === 1) return '🥈';
        if (pos === 2) return '🥉';
        return '';
    };
    
    container.innerHTML = sortedPlayers
    .map((j, idx) => `
        <div class="player-item p-2 rounded cursor-pointer flex items-center justify-between text-sm" onclick="selectPlayer('${j.nombre}')">
            <div class="flex items-center gap-1">
                <span class="text-base">${getMedal(idx)}</span>
                <span class="font-bold text-white text-xs sm:text-sm">${j.nombre}</span>
            </div>
            <div class="flex gap-2">
                <span class="text-xs ${j.win >= j.loss ? 'text-green-400' : 'text-red-400'} font-bold">W: ${j.win}</span>
                <span class="text-xs text-gray-400 font-bold">L: ${j.loss}</span>
            </div>
        </div>
    `).join('');
}

function getVersatilidadColor(v) {
    const colors = { 'Grado S': 'text-yellow-400', 'Grado A': 'text-green-400', 'Grado B': 'text-blue-400', 'Grado C': 'text-gray-400' };
    return colors[v] || 'text-gray-400';
}

function selectPlayer(nombre) {
    filterPlayer = filterPlayer === nombre ? null : nombre;
    renderPlayersList();
    renderMatches();
    
    document.querySelectorAll('.player-item').forEach(item => {
        item.classList.toggle('active', item.textContent.includes(filterPlayer || ''));
    });
}

function filterByPlayer() {
    const select = document.getElementById('filterPlayer');
    filterPlayer = select.value || null;
    renderMatches();
}

// === RENDER MATCHES ===

function renderMatches() {
    const container = document.getElementById('matchesList');
    
    // Ordenar por fecha más reciente
    let partidas = [...data.partidas].sort((a, b) => {
        const dateA = new Date(a.fecha.split('/').reverse().join('-'));
        const dateB = new Date(b.fecha.split('/').reverse().join('-'));
        return dateB - dateA;
    });
    
    // Filtrar por jugador
    if (filterPlayer) {
        partidas = partidas.filter(p => 
            p.equipos.Dire.includes(filterPlayer) || 
            p.equipos.Radiant.includes(filterPlayer)
        );
    }
    
    container.innerHTML = partidas.map(p => {
        const direWon = p.ganador === 'Dire';
        const winnerClass = direWon ? 'dire-win' : 'radiant-win';
        
        return `
        <div class="match-card rounded-lg ${winnerClass} overflow-hidden">
            <div class="accordion-header flex justify-between items-center p-4 cursor-pointer" onclick="toggleAccordion('${p.id}')">
                <div class="flex items-center gap-2 sm:gap-4">
                    <span class="text-xl font-bold text-dotagold">${p.id}</span>
                    <span class="text-gray-500 text-xs sm:text-sm">${p.fecha}</span>
                    <span class="text-xs text-gray-600 bg-dotagray px-2 py-1 rounded hidden sm:inline">${p.duracion}</span>
                </div>
                <div class="flex items-center gap-2 sm:gap-4">
                    <span class="text-xs sm:text-sm font-bold">
                        <span class="text-green-400">GANADOR:</span> ${direWon ? 'DIRE' : 'RADIANT'}
                    </span>
                    <svg id="arrow-${p.id}" class="w-5 h-5 text-dotagold transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                </div>
            </div>
            <div id="content-${p.id}" class="accordion-content hidden px-4 pb-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    <div class="team-dire rounded p-3">
                        <h4 class="text-red-400 font-bold text-sm mb-2">DIRE (Rojo)</h4>
                        <ul class="space-y-1">
                            ${p.equipos.Dire.map(j => renderPlayerLine(j, p.id, 'Dire', p.mvp, p.ganador)).join('')}
                        </ul>
                    </div>
                    <div class="team-radiant rounded p-3">
                        <h4 class="text-blue-400 font-bold text-sm mb-2">RADIANT (Azul)</h4>
                        <ul class="space-y-1">
                            ${p.equipos.Radiant.map(j => renderPlayerLine(j, p.id, 'Radiant', p.mvp, p.ganador)).join('')}
                        </ul>
                    </div>
                </div>
                <div class="mt-3 pt-3 border-t border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-2">
                    <div class="mvp-display px-3 py-1 rounded flex items-center gap-2">
                        <span class="text-gray-400 text-sm">MVP:</span>
                        <span class="text-dotagold font-bold text-lg filter drop-shadow-lg">${p.mvp}</span>
                        <span class="text-xl">🥇</span>
                    </div>
                    ${currentUser ? renderVoteButtons(p) : ''}
                </div>
            </div>
        </div>
    `}).join('');
}

function toggleAccordion(id) {
    const content = document.getElementById(`content-${id}`);
    const arrow = document.getElementById(`arrow-${id}`);
    content.classList.toggle('hidden');
    arrow.classList.toggle('rotate-180');
}

function renderPlayerLine(jugador, partidaId, equipo, mvp, ganador) {
    const historial = data.jugadores.find(j => j.nombre === jugador)?.historial;
    const heroe = historial ? historial[partidaId] : '?';
    const isMVP = mvp === jugador;
    
    return `
        <li class="flex justify-between items-center text-sm ${isMVP ? 'bg-dotagold bg-opacity-20 rounded px-2' : ''}">
            <span class="text-white ${isMVP ? 'filter drop-shadow-lg text-lg' : ''} ${currentUser ? 'cursor-pointer hover:text-dotagold' : ''}" 
                  ${currentUser ? `onclick="setMVP('${partidaId}', '${jugador}')"` : ''}>
                ${jugador}${isMVP ? ' 🥇' : ''}
            </span>
            <span class="hero-badge">${heroe}</span>
        </li>
    `;
}

function renderVoteButtons(partida) {
    const mvpActual = partida.mvp && partida.mvp !== '-';
    
    return `
        <div class="flex gap-2 flex-wrap">
            ${mvpActual ? `<button onclick="resetMVP('${partida.id}')" class="vote-btn bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm font-bold">🔄 Reset MVP</button>` : ''}
            <span class="text-xs text-gray-500 self-center">Click en jugador para elegir MVP</span>
        </div>
    `;
}

// === VOTING SYSTEM ===

function setMVP(partidaId, jugador) {
    if (!currentUser) return;
    
    const partida = data.partidas.find(p => p.id === partidaId);
    partida.mvp = jugador;
    
    renderMatches();
}

function resetMVP(partidaId) {
    if (!currentUser) return;
    
    const partida = data.partidas.find(p => p.id === partidaId);
    partida.mvp = '-';
    
    renderMatches();
}

// === FILTER & STATS ===

function renderFilter() {
    const select = document.getElementById('filterPlayer');
    select.innerHTML = '<option value="">Todos los jugadores</option>' + 
        data.jugadores.map(j => `<option value="${j.nombre}">${j.nombre}</option>`).join('');
}

function updateStats() {
    document.getElementById('totalGames').textContent = data.partidas.length;
    
    const direWins = data.partidas.filter(p => p.ganador === 'Dire').length;
    const radiantWins = data.partidas.filter(p => p.ganador === 'Radiant').length;
    
    document.getElementById('direWins').textContent = direWins;
    document.getElementById('radiantWins').textContent = radiantWins;
}