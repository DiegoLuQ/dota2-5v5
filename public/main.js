// app.js - Lógica principal

let data = null;
let currentUser = null;
let filterPlayer = null;
let editingMatchId = null;
let editingMatchHistory = null; // Guardar el historial de la partida editada

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/data');
        data = await response.json();
        
        checkSession(); // Check session first
        renderPlayersList();
        renderMatches(); // Render matches after we know if user is logged in
        renderFilter();
        updateStats();
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

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        
        if (result.success) {
            currentUser = { username: result.username };
            const expiration = new Date().getTime() + (4 * 24 * 60 * 60 * 1000); // 4 days
            localStorage.setItem('amigos5v5_session', JSON.stringify({ 
                user: currentUser, 
                expires: expiration 
            }));
            closeLogin();
            updateLoginUI();
            renderMatches();
        } else {
            document.getElementById('loginError').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error en login:', error);
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
    const sessionStr = localStorage.getItem('amigos5v5_session');
    if (sessionStr) {
        try {
            const session = JSON.parse(sessionStr);
            if (session.expires) {
                if (new Date().getTime() > session.expires) {
                    logout();
                    return;
                }
                currentUser = session.user;
            } else {
                // Support legacy format without expiration
                currentUser = session;
            }
            updateLoginUI();
        } catch(e) {
            console.error("Error parsing session", e);
        }
    }
}

function updateLoginUI() {
    const loginSection = document.getElementById('loginSection');
    const userSection = document.getElementById('userSection');
    const newMatchBtn = document.getElementById('btnNewMatch');
    const mantencionSection = document.getElementById('mantencionSection');
    
    if (currentUser) {
        loginSection.classList.add('hidden');
        userSection.classList.remove('hidden');
        document.getElementById('userName').textContent = currentUser.username;
        newMatchBtn.classList.remove('hidden');
        mantencionSection.classList.remove('hidden');
    } else {
        loginSection.classList.remove('hidden');
        userSection.classList.add('hidden');
        newMatchBtn.classList.add('hidden');
        mantencionSection.classList.add('hidden');
    }
}

// === RENDER PLAYERS LIST ===

function renderPlayersList() {
    const desktopContainer = document.getElementById('playersList');
    const mobileContainer = document.getElementById('playersListMobile');
    
    if (!data.jugadores) return;
    
    const sortedPlayers = [...data.jugadores].sort((a, b) => b.win - a.win);
    
    const getMedal = (pos) => {
        if (pos === 0) return '🥇';
        if (pos === 1) return '🥈';
        if (pos === 2) return '🥉';
        return '';
    };
    
    const html = sortedPlayers.map((j, idx) => {
        const isActive = filterPlayer === j.nombre;
        return `
            <div class="player-item bg-dotadark md:bg-transparent p-3 md:p-2 rounded-lg md:rounded cursor-pointer flex items-center justify-between border md:border-0 ${isActive ? 'border-dotagold bg-dotagray' : 'border-gray-800'} transition-all" 
                 onclick="selectPlayer('${j.nombre}')">
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <div class="w-10 h-10 md:w-8 md:h-8 rounded-full overflow-hidden border border-gray-700">
                            <img src="${j.imagen || 'https://via.placeholder.com/48x48/2a2a2a/c8aa6e?text=' + j.nombre.charAt(0)}" 
                                 alt="${j.nombre}" 
                                 class="w-full h-full object-cover"
                                 onerror="this.src='https://via.placeholder.com/48x48/2a2a2a/c8aa6e?text=${j.nombre.charAt(0)}'">
                        </div>
                        <span class="absolute -top-1 -right-1 text-sm md:text-xs">${getMedal(idx)}</span>
                    </div>
                    <span class="font-bold text-white text-sm md:text-xs uppercase tracking-wider">${j.nombre}</span>
                </div>
                <div class="flex gap-3 text-xs font-bold">
                    <span class="${j.win > j.loss ? 'text-green-400' : (j.loss > j.win ? 'text-gray-400' : 'text-gray-400')}">W: ${j.win}</span>
                    <span class="${j.loss > j.win ? 'text-red-500' : (j.win > j.loss ? 'text-gray-400' : 'text-gray-400')}">L: ${j.loss}</span>
                </div>
            </div>
        `;
    }).join('');

    if (desktopContainer) desktopContainer.innerHTML = html;
    if (mobileContainer) mobileContainer.innerHTML = html;
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
    
    let partidas = [...data.partidas].sort((a, b) => {
        const dateA = new Date(a.fecha.split('/').reverse().join('-'));
        const dateB = new Date(b.fecha.split('/').reverse().join('-'));
        return dateB - dateA;
    });
    
    if (filterPlayer) {
        partidas = partidas.filter(p => 
            p.equipos.Dire.includes(filterPlayer) || 
            p.equipos.Radiant.includes(filterPlayer)
        );
    }
    
    container.innerHTML = partidas.map(p => {
        const direWon = (p.winner || p.ganador) === 'Dire';
        const winnerClass = direWon ? 'dire-win' : 'radiant-win';
        
        return `
        <div class="match-card rounded-lg ${winnerClass} overflow-hidden">
            <div class="accordion-header flex justify-between items-center p-4 cursor-pointer" onclick="toggleAccordion('${p.id}')">
                <div class="flex items-center gap-2 sm:gap-4">
                    <span class="text-xl font-bold text-dotagold">${p.id}</span>
                    <span class="text-gray-500 text-xs sm:text-sm">${p.fecha}</span>
                    <span class="text-xs text-dotagold bg-dotagray px-2 py-1 rounded">${p.mapa || '-'}</span>
                    <span class="text-xs text-gray-600 bg-dotagray px-2 py-1 rounded hidden sm:inline">${p.duracion}</span>
                </div>
                <div class="flex items-center gap-2 sm:gap-4">
                    ${currentUser ? `<button onclick="openEditMatchModal('${p.id}')" class="text-xs bg-dotagray hover:bg-dotagold hover:text-dotablack border border-gray-700 px-2 py-1 rounded transition-all">EDITAR ✏️</button>` : ''}
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
                    <div class="team-radiant rounded p-3">
                        <h4 class="text-blue-400 font-bold text-sm mb-2">RADIANT (Azul)</h4>
                        <ul class="space-y-1">
                            ${p.equipos.Radiant.map(j => renderPlayerLine(j, p.id, 'Radiant', p.mvp, p.ganador, p.capitanes?.Radiant)).join('')}
                        </ul>
                    </div>
                    <div class="team-dire rounded p-3">
                        <h4 class="text-red-400 font-bold text-sm mb-2">DIRE (Rojo)</h4>
                        <ul class="space-y-1">
                            ${p.equipos.Dire.map(j => renderPlayerLine(j, p.id, 'Dire', p.mvp, p.ganador, p.capitanes?.Dire)).join('')}
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

function renderPlayerLine(jugador, partidaId, equipo, mvp, winner, captainName) {
    const playerObj = data.jugadores.find(j => j.nombre === jugador);
    const historial = playerObj?.historial;
    const heroe = (historial && (historial.get ? historial.get(partidaId) : historial[partidaId])) || '?';
    const isMVP = mvp === jugador;
    const isCaptain = jugador === captainName;
    const avatar = playerObj?.imagen || `https://via.placeholder.com/48x48/2a2a2a/c8aa6e?text=${jugador.charAt(0)}`;
    
    return `
        <li class="flex justify-between items-center text-sm py-1 ${isMVP ? 'bg-dotagold bg-opacity-20 rounded px-2' : ''}">
            <div class="flex items-center gap-2">
                <img src="${avatar}" 
                     alt="${jugador}" 
                     class="w-6 h-6 rounded-full object-cover border border-gray-700"
                     onerror="this.src='https://via.placeholder.com/48x48/2a2a2a/c8aa6e?text=${jugador.charAt(0)}'">
                <span class="text-white ${isMVP ? 'filter drop-shadow-lg font-bold' : ''} ${currentUser ? 'cursor-pointer hover:text-dotagold' : ''}" 
                      ${currentUser ? `onclick="setMVP('${partidaId}', '${jugador}')"` : ''}>
                    ${jugador}${isMVP ? ' 🥇' : ''}${isCaptain ? ' 👑' : ''}
                </span>
            </div>
            <span class="hero-badge bg-dotagray px-2 py-0.5 rounded text-xs text-gray-300 font-mono border border-gray-700 ${currentUser ? 'cursor-pointer hover:bg-dotagold hover:text-dotablack' : ''}"
                  ${currentUser ? `onclick="editHero('${partidaId}', '${jugador}')"` : ''}>
                ${heroe}
            </span>
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

// === MVP SYSTEM ===

async function setMVP(partidaId, jugador) {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/partidas/${partidaId}/mvp`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mvp: jugador })
        });
        const result = await response.json();
        
        if (result.success) {
            const partida = data.partidas.find(p => p.id === partidaId);
            if (partida) partida.mvp = jugador;
            renderMatches();
        }
    } catch (error) {
        console.error('Error estableciendo MVP:', error);
    }
}

async function resetMVP(partidaId) {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`/api/partidas/${partidaId}/mvp`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mvp: '-' })
        });
        const result = await response.json();
        
        if (result.success) {
            const partida = data.partidas.find(p => p.id === partidaId);
            if (partida) partida.mvp = '-';
            renderMatches();
            updateStats(); // Add stats update to see MVP leader change
        }
    } catch (error) {
        console.error('Error reset MVP:', error);
    }
}

async function editHero(partidaId, jugador) {
    if (!currentUser) return;
    
    const nuevoHeroe = prompt(`Cambiar héroe para ${jugador} en la partida ${partidaId}:`);
    if (nuevoHeroe === null) return;
    
    try {
        const response = await fetch(`/api/partidas/${partidaId}/heroe`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jugador, heroe: nuevoHeroe || '-' })
        });
        const result = await response.json();
        
        if (result.success) {
            // Actualizar localmente
            const partida = data.partidas.find(p => p.id === partidaId);
            if (partida) {
                if (!partida.historial) partida.historial = {};
                partida.historial[jugador] = nuevoHeroe || '-';
            }
            
            const playerObj = data.jugadores.find(j => j.nombre === jugador);
            if (playerObj) {
                if (!playerObj.historial) playerObj.historial = {};
                playerObj.historial[partidaId] = nuevoHeroe || '-';
            }
            
            renderMatches();
            updateStats();
        }
    } catch (error) {
        console.error('Error editando héroe:', error);
    }
}

// === FILTER & STATS ===

function renderFilter() {
    const select = document.getElementById('filterPlayer');
    select.innerHTML = '<option value="">Todos los jugadores</option>' + 
        data.jugadores.map(j => `<option value="${j.nombre}">${j.nombre}</option>`).join('');
}

// === STATS & INITIALIZATION ===

function updateStats() {
    if (!data.partidas) return;

    // Basic Wins
    const total = data.partidas.length;
    const direWins = data.partidas.filter(p => (p.winner || p.ganador) === 'Dire').length;
    const radiantWins = data.partidas.filter(p => (p.winner || p.ganador) === 'Radiant').length;

    document.getElementById('totalGames').textContent = total;
    document.getElementById('direWins').textContent = direWins;
    document.getElementById('radiantWins').textContent = radiantWins;

    // Advanced Stats: Hero Pick Rate
    const heroCounts = {};
    data.jugadores.forEach(j => {
        if (j.historial) {
            Object.values(j.historial).forEach(hero => {
                if (hero && hero !== '-' && hero !== '?') {
                    heroCounts[hero] = (heroCounts[hero] || 0) + 1;
                }
            });
        }
    });
    
    let topHero = { name: '-', count: 0 };
    for (const [name, count] of Object.entries(heroCounts)) {
        if (count > topHero.count) topHero = { name, count };
    }
    document.getElementById('topHero').textContent = topHero.name !== '-' ? `${topHero.name} (${topHero.count} picks)` : '-';

    // Advanced Stats: Longest Match
    const parseDuration = (str) => {
        if (!str) return 0;
        let total = 0;
        const hrMatch = str.match(/(\d+)hr/);
        const minMatch = str.match(/(\d+)min/);
        const mMatch = str.match(/(\d+)m/);
        const secMatch = str.match(/(\d+)seg/);
        
        if (hrMatch) total += parseInt(hrMatch[1]) * 3600;
        if (minMatch) total += parseInt(minMatch[1]) * 60;
        else if (mMatch) total += parseInt(mMatch[1]) * 60;
        if (secMatch) total += parseInt(secMatch[1]);
        return total;
    };

    let longestMatch = null;
    let maxSeconds = 0;
    data.partidas.forEach(p => {
        const secs = parseDuration(p.duracion);
        if (secs > maxSeconds) {
            maxSeconds = secs;
            longestMatch = p;
        }
    });

    if (longestMatch) {
        document.getElementById('longestMatch').textContent = `${longestMatch.fecha} (#${longestMatch.id})`;
        document.getElementById('longestMatchTime').textContent = longestMatch.duracion;
    }

    // Advanced Stats: MVP Hero and MVP Player
    const mvpHeroCounts = {};
    const mvpPlayerCounts = {};
    const playerNames = data.jugadores.map(j => j.nombre);

    data.partidas.forEach(p => {
        if (p.mvp && p.mvp !== '-' && p.mvp !== 'Sin MVP') {
            if (playerNames.includes(p.mvp)) {
                // p.mvp is a Player!
                mvpPlayerCounts[p.mvp] = (mvpPlayerCounts[p.mvp] || 0) + 1;
                // Determine which hero was playing this player in this match
                const heroName = p.historial && p.historial[p.mvp] ? p.historial[p.mvp] : null;
                if (heroName && heroName !== '-' && heroName !== '?') {
                    mvpHeroCounts[heroName] = (mvpHeroCounts[heroName] || 0) + 1;
                }
            } else {
                // p.mvp is historically a Hero
                mvpHeroCounts[p.mvp] = (mvpHeroCounts[p.mvp] || 0) + 1;
            }
        }
    });

    let topMVPHero = { name: '-', count: 0 };
    for (const [name, count] of Object.entries(mvpHeroCounts)) {
        if (count > topMVPHero.count) topMVPHero = { name, count };
    }
    
    let topMVPPlayer = { name: '-', count: 0 };
    for (const [name, count] of Object.entries(mvpPlayerCounts)) {
        if (count > topMVPPlayer.count) topMVPPlayer = { name, count };
    }

    document.getElementById('topMVPHero').textContent = topMVPHero.name !== '-' ? topMVPHero.name : '-';
    document.getElementById('topMVPHeroCount').textContent = topMVPHero.count > 0 ? `${topMVPHero.count} MVPs` : '';
    
    document.getElementById('topMVPPlayer').textContent = topMVPPlayer.name !== '-' ? topMVPPlayer.name : '-';
    document.getElementById('topMVPPlayerCount').textContent = topMVPPlayer.count > 0 ? `${topMVPPlayer.count} MVPs` : '';
}

// === NEW MATCH MODAL ===

let newMatchData = {
    dire: [],
    radiant: []
};

function openNewMatchModal() {
    editingMatchId = null;
    editingMatchHistory = null;
    document.getElementById('newMatchModal').classList.remove('hidden');
    document.getElementById('modalTitle').textContent = 'NUEVA PARTIDA';
    
    // Reset form
    document.getElementById('matchDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('matchMap').value = 'Lobby';
    document.getElementById('matchHours').value = '0';
    document.getElementById('matchMinutes').value = '0';
    document.getElementById('matchSeconds').value = '0';
    
    // Limpiar radios de ganador
    document.querySelectorAll('input[name="winner"]').forEach(i => i.checked = false);
    
    const captainSelects = ['captainDire', 'captainRadiant'];
    const options = '<option value="">Seleccionar Capitán</option>' + 
        data.jugadores.map(j => `<option value="${j.nombre}">${j.nombre}</option>`).join('');
    
    captainSelects.forEach(id => {
        document.getElementById(id).innerHTML = options;
        document.getElementById(id).value = '';
    });
    
    newMatchData = { dire: [], radiant: [] };
    updateAvailablePlayers();
    updateMVPOptions();
    
    document.getElementById('btnSaveMatch').classList.remove('hidden');
    document.getElementById('btnSaveMatch').disabled = true;
}

function openEditMatchModal(partidaId) {
    const p = data.partidas.find(match => match.id === partidaId);
    if (!p) return;

    editingMatchId = partidaId;
    
    // Reconstruir el historial desde los jugadores (no desde la partida)
    editingMatchHistory = {};
    data.jugadores.forEach(j => {
        const hist = j.historial || {};
        const hero = (hist.get ? hist.get(partidaId) : hist[partidaId]);
        if (hero && hero !== '-') {
            editingMatchHistory[j.nombre] = hero;
        }
    });
    
    document.getElementById('newMatchModal').classList.remove('hidden');
    document.getElementById('modalTitle').textContent = `EDITAR PARTIDA ${partidaId}`;

    const [dia, mes, anio] = p.fecha.split('/');
    document.getElementById('matchDate').value = `${anio}-${mes}-${dia}`;
    document.getElementById('matchMap').value = p.mapa || 'Lobby';
    
    const hrValue = p.duracion.match(/(\d+)hr/);
    const minValue = p.duracion.match(/(\d+)min/) || p.duracion.match(/(\d+)m/);
    const segValue = p.duracion.match(/(\d+)seg/);
    document.getElementById('matchHours').value = hrValue ? hrValue[1] : '0';
    document.getElementById('matchMinutes').value = minValue ? minValue[1] : '0';
    document.getElementById('matchSeconds').value = segValue ? segValue[1] : '0';

    // Poblar ganadores
    const winnerDisplay = p.winner || p.ganador;
    const winnerRadio = document.querySelector(`input[name="winner"][value="${winnerDisplay}"]`);
    if (winnerRadio) winnerRadio.checked = true;

    newMatchData = { 
        dire: [...p.equipos.Dire], 
        radiant: [...p.equipos.Radiant] 
    };

    const captainSelects = ['captainDire', 'captainRadiant'];
    const options = '<option value="">Seleccionar Capitán</option>' + 
        data.jugadores.map(j => `<option value="${j.nombre}">${j.nombre}</option>`).join('');
    
    captainSelects.forEach(id => {
        document.getElementById(id).innerHTML = options;
    });

    // Cargar capitanes guardados
    if (p.capitanes) {
        document.getElementById('captainDire').value = p.capitanes.Dire || '';
        document.getElementById('captainRadiant').value = p.capitanes.Radiant || '';
    }

    updateAvailablePlayers();
    updateMVPOptions();
    
    // Asegurar que el MVP se seleccione (aunque sea un nombre de héroe antiguo)
    const mvpSelect = document.getElementById('matchMVP');
    const existingVal = p.mvp || '-';
    
    // Si el valor no está en las opciones (ej: es un héroe), lo añadimos temporalmente
    if (![...mvpSelect.options].some(o => o.value === existingVal)) {
        const opt = document.createElement('option');
        opt.value = existingVal;
        opt.textContent = existingVal;
        mvpSelect.appendChild(opt);
    }
    mvpSelect.value = existingVal;

    document.getElementById('btnSaveMatch').classList.remove('hidden');
    document.getElementById('btnSaveMatch').disabled = false;
}

function closeNewMatchModal() {
    document.getElementById('newMatchModal').classList.add('hidden');
    newMatchData = { dire: [], radiant: [] };
}

function updateAvailablePlayers() {
    const captainDire = document.getElementById('captainDire').value;
    const captainRadiant = document.getElementById('captainRadiant').value;
    
    const selectedPlayers = [...newMatchData.dire, ...newMatchData.radiant];
    const captains = [captainDire, captainRadiant].filter(c => c);
    
    const available = data.jugadores.filter(j => 
        !selectedPlayers.includes(j.nombre) || captains.includes(j.nombre)
    );
    
    const container = document.getElementById('availablePlayers');
    container.innerHTML = available.map(j => {
        const isCaptain = j.nombre === captainDire || j.nombre === captainRadiant;
        return `
            <div class="px-2 py-1 bg-dotagray hover:bg-dotagold hover:text-dotablack rounded text-xs font-bold cursor-pointer transition-all border border-gray-700 ${isCaptain ? 'ring-1 ring-dotagold' : ''}"
                onclick="addPlayerToTeam('${j.nombre}')">
                ${j.nombre}${isCaptain ? ' ★' : ''}
            </div>
        `;
    }).join('');
    
    updateTeamsDisplay();
    checkTeamsReady();
}

function addPlayerToTeam(playerName) {
    const captainDire = document.getElementById('captainDire').value;
    const captainRadiant = document.getElementById('captainRadiant').value;
    
    if (newMatchData.dire.length < 5 && playerName !== captainRadiant) {
        newMatchData.dire.push(playerName);
    } else if (newMatchData.radiant.length < 5 && playerName !== captainDire) {
        newMatchData.radiant.push(playerName);
    }
    
    updateAvailablePlayers();
}

function removePlayerFromTeam(team, index) {
    newMatchData[team].splice(index, 1);
    updateAvailablePlayers();
}

function updateTeamsDisplay() {
    const renderTeam = (team, players) => {
        const captain = team === 'dire' ? document.getElementById('captainDire').value : document.getElementById('captainRadiant').value;
        
        return players.map((p, idx) => {
            const isCaptain = p === captain;
            // Buscar héroe en el historial si estamos editando
            const savedHero = (editingMatchHistory && (editingMatchHistory.get ? editingMatchHistory.get(p) : editingMatchHistory[p])) || '';
            
            return `
                <div class="flex items-center gap-1.5 p-1 bg-dotablack bg-opacity-40 rounded border border-gray-800">
                    <span class="text-white text-[11px] font-bold truncate flex-1 ${isCaptain ? 'text-dotagold' : ''}">
                        ${isCaptain ? '★ ' : ''}${p}
                    </span>
                    <input type="text" 
                        id="hero_input_${team}_${p.replace(/\s/g, '_')}" 
                        placeholder="Héroe" 
                        value="${savedHero}"
                        class="w-20 bg-dotagray border border-gray-700 rounded px-1.5 py-0.5 text-[10px] text-white focus:border-dotagold focus:outline-none">
                    <button onclick="removePlayerFromTeam('${team}', ${idx})" class="text-red-500 hover:text-red-400 p-0.5">
                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
            `;
        }).join('');
    };
    
    document.getElementById('teamDire').innerHTML = renderTeam('dire', newMatchData.dire);
    document.getElementById('teamRadiant').innerHTML = renderTeam('radiant', newMatchData.radiant);
}

function checkTeamsReady() {
    const btn = document.getElementById('btnSaveMatch');
    const captainDire = document.getElementById('captainDire').value;
    const captainRadiant = document.getElementById('captainRadiant').value;
    const teamsReady = newMatchData.dire.length === 5 && newMatchData.radiant.length === 5 && captainDire && captainRadiant && captainDire !== captainRadiant;
    btn.disabled = !teamsReady;
}

function updateMVPOptions() {
    const allPlayers = [...newMatchData.dire, ...newMatchData.radiant];
    const mvpSelect = document.getElementById('matchMVP');
    const currentVal = mvpSelect.value;
    mvpSelect.innerHTML = '<option value="-">Sin MVP</option>' + 
        allPlayers.map(j => `<option value="${j}" ${currentVal === j ? 'selected' : ''}>${j}</option>`).join('');
}

async function saveNewMatch() {
    const fecha = document.getElementById('matchDate').value;
    const map = document.getElementById('matchMap').value;
    const hours = parseInt(document.getElementById('matchHours').value) || 0;
    const minutes = parseInt(document.getElementById('matchMinutes').value) || 0;
    const seconds = parseInt(document.getElementById('matchSeconds').value) || 0;
    const winner = document.querySelector('input[name="winner"]:checked')?.value;
    const mvp = document.getElementById('matchMVP').value;
    
    if (!fecha || !winner) {
        alert('Por favor completa la fecha y selecciona un ganador');
        return;
    }
    
    if (newMatchData.dire.length !== 5 || newMatchData.radiant.length !== 5) {
        alert('Cada equipo debe tener 5 jugadores');
        return;
    }
    
    const duracion = `${hours > 0 ? hours + 'hr ' : ''}${minutes > 0 ? minutes + 'min ' : ''}${seconds}seg`.trim();
    
    const heroes = {};
    newMatchData.dire.forEach(p => {
        const input = document.getElementById(`hero_input_dire_${p.replace(/\s/g, '_')}`);
        heroes[p] = input?.value || '-';
    });
    newMatchData.radiant.forEach(p => {
        const input = document.getElementById(`hero_input_radiant_${p.replace(/\s/g, '_')}`);
        heroes[p] = input?.value || '-';
    });
    
    const partidaId = editingMatchId || ('P' + (data.partidas.length + 1));
    const fechaFormatted = fecha.split('-').reverse().join('/');
    
    const captainDire = document.getElementById('captainDire').value;
    const captainRadiant = document.getElementById('captainRadiant').value;
    
    const matchPayload = {
        id: partidaId,
        fecha: fechaFormatted,
        mapa: map,
        winner: winner,
        mvp: mvp || '-',
        duracion: duracion,
        capitanes: {
            Dire: captainDire,
            Radiant: captainRadiant
        },
        equipos: {
            Dire: newMatchData.dire,
            Radiant: newMatchData.radiant
        },
        historial: heroes
    };
    
    try {
        const url = editingMatchId ? `/api/partidas/${editingMatchId}` : '/api/partidas';
        const method = editingMatchId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partida: matchPayload, actualizarStats: true })
        });
        const result = await response.json();
        
        if (result.success) {
            const responseData = await fetch('/api/data');
            data = await responseData.json();
            
            closeNewMatchModal();
            renderMatches();
            renderPlayersList();
            updateStats();
            alert(`¡Partida ${partidaId} ${editingMatchId ? 'actualizada' : 'guardada'}!`);
        } else {
            alert('Error al guardar: ' + result.error);
        }
    } catch (error) {
        console.error('Error guardando:', error);
        alert('Error al procesar la partida');
    }
}

// === MANTENCION ===

function openMantencionModal() {
    document.getElementById('mantencionModal').classList.remove('hidden');
    renderMantencionList();
}

function closeMantencionModal() {
    document.getElementById('mantencionModal').classList.add('hidden');
}

function renderMantencionList() {
    const container = document.getElementById('mantencionList');
    
    container.innerHTML = data.jugadores.map(j => `
        <div class="flex items-center gap-4 p-3 bg-dotagray rounded">
            <div class="w-12 h-12 rounded-full overflow-hidden bg-dotadark flex-shrink-0">
                <img src="${j.imagen || 'https://via.placeholder.com/48x48/2a2a2a/c8aa6e?text=' + j.nombre.charAt(0)}" 
                     alt="${j.nombre}" 
                     class="player-avatar w-full h-full object-cover"
                     onerror="this.src='https://via.placeholder.com/48x48/2a2a2a/c8aa6e?text=${j.nombre.charAt(0)}'">
            </div>
            <div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                    <label class="block text-xs text-gray-500 mb-1">Nombre</label>
                    <input type="text" data-nombre="${j.nombre}" value="${j.nombre}" 
                        class="w-full bg-dotadark border border-gray-600 rounded px-2 py-1 text-white text-sm nombre-input">
                </div>
                <div>
                    <label class="block text-xs text-gray-500 mb-1">URL Imagen</label>
                    <input type="text" data-nombre="${j.nombre}" value="${j.imagen || ''}" 
                        placeholder="https://..." 
                        class="w-full bg-dotadark border border-gray-600 rounded px-2 py-1 text-white text-sm imagen-input">
                </div>
            </div>
        </div>
    `).join('');
}

async function saveMantencion() {
    const nombreInputs = document.querySelectorAll('.nombre-input');
    const imagenInputs = document.querySelectorAll('.imagen-input');
    
    let savedCount = 0;
    
    for (let i = 0; i < nombreInputs.length; i++) {
        const oldNombre = nombreInputs[i].dataset.nombre;
        const nuevoNombre = nombreInputs[i].value.trim();
        const imagen = imagenInputs[i].value.trim();
        
        if (nuevoNombre !== oldNombre || imagen !== '') {
            try {
                const response = await fetch(`/api/jugadores/${encodeURIComponent(oldNombre)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nuevoNombre, imagen })
                });
                const result = await response.json();
                
                if (result.success) {
                    savedCount++;
                }
            } catch (error) {
                console.error('Error guardando jugador:', oldNombre, error);
            }
        }
    }
    
    const responseData = await fetch('/api/data');
    data = await responseData.json();
    
    closeMantencionModal();
    renderPlayersList();
    renderMatches();
    renderFilter();
    alert(`¡${savedCount} cambios guardados!`);
}
