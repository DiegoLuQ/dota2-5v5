// app.js - Lógica principal

let data = null;
let currentUser = null;
let filterPlayer = null;

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/data');
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
            localStorage.setItem('amigos5v5_session', JSON.stringify(currentUser));
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
    const session = localStorage.getItem('amigos5v5_session');
    if (session) {
        currentUser = JSON.parse(session);
        updateLoginUI();
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
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                    <img src="${j.imagen || 'https://via.placeholder.com/48x48/2a2a2a/c8aa6e?text=' + j.nombre.charAt(0)}" 
                         alt="${j.nombre}" 
                         class="player-avatar w-full h-full object-cover"
                         onerror="this.src='https://via.placeholder.com/48x48/2a2a2a/c8aa6e?text=${j.nombre.charAt(0)}'">
                </div>
                <div class="flex flex-col">
                    <span class="text-base">${getMedal(idx)}</span>
                </div>
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
        const direWon = p.ganador === 'Dire';
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
    const playerObj = data.jugadores.find(j => j.nombre === jugador);
    const historial = playerObj?.historial;
    const heroe = historial ? historial[partidaId] : '?';
    const isMVP = mvp === jugador;
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
                    ${jugador}${isMVP ? ' 🥇' : ''}
                </span>
            </div>
            <span class="hero-badge bg-dotagray px-2 py-0.5 rounded text-xs text-gray-300 font-mono border border-gray-700">${heroe}</span>
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
        }
    } catch (error) {
        console.error('Error reset MVP:', error);
    }
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

// === NEW MATCH MODAL ===

let newMatchData = {
    dire: [],
    radiant: []
};

function openNewMatchModal() {
    document.getElementById('newMatchModal').classList.remove('hidden');
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('matchDate').value = today;
    
    const captainSelects = ['captainDire', 'captainRadiant'];
    const options = '<option value="">Seleccionar Capitán</option>' + 
        data.jugadores.map(j => `<option value="${j.nombre}">${j.nombre}</option>`).join('');
    
    captainSelects.forEach(id => {
        document.getElementById(id).innerHTML = options;
    });
    
    newMatchData = { dire: [], radiant: [] };
    updateAvailablePlayers();
    updateMVPOptions();
    
    document.getElementById('heroesSection').classList.add('hidden');
    document.getElementById('btnSaveMatch').classList.add('hidden');
    document.getElementById('btnProceedHeroes').classList.remove('hidden');
    document.getElementById('btnProceedHeroes').disabled = true;
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
            <div class="flex justify-between items-center p-2 bg-dotadark rounded cursor-pointer hover:bg-dotagray ${isCaptain ? 'border border-dotagold' : ''}"
                onclick="addPlayerToTeam('${j.nombre}')">
                <span class="text-white text-sm ${isCaptain ? 'text-dotagold font-bold' : ''}">${j.nombre}${isCaptain ? ' (C)' : ''}</span>
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
    const renderTeam = (team, players, colorClass) => {
        const captain = team === 'dire' ? document.getElementById('captainDire').value : document.getElementById('captainRadiant').value;
        
        return players.map((p, idx) => {
            const isCaptain = p === captain;
            return `
                <div class="flex justify-between items-center p-2 bg-dotadark rounded ${isCaptain ? 'border border-dotagold' : ''}">
                    <span class="text-white text-sm ${isCaptain ? 'text-dotagold font-bold' : ''}">${p}${isCaptain ? ' (C)' : ''}</span>
                    <button onclick="removePlayerFromTeam('${team}', ${idx})" class="text-red-400 hover:text-red-600">✕</button>
                </div>
            `;
        }).join('');
    };
    
    document.getElementById('teamDire').innerHTML = renderTeam('dire', newMatchData.dire);
    document.getElementById('teamRadiant').innerHTML = renderTeam('radiant', newMatchData.radiant);
}

function checkTeamsReady() {
    const btn = document.getElementById('btnProceedHeroes');
    const captainDire = document.getElementById('captainDire').value;
    const captainRadiant = document.getElementById('captainRadiant').value;
    const teamsReady = newMatchData.dire.length === 5 && newMatchData.radiant.length === 5 && captainDire && captainRadiant && captainDire !== captainRadiant;
    btn.disabled = !teamsReady;
}

function updateMVPOptions() {
    const allPlayers = [...newMatchData.dire, ...newMatchData.radiant];
    const mvpSelect = document.getElementById('matchMVP');
    mvpSelect.innerHTML = '<option value="-">Sin MVP</option>' + 
        allPlayers.map(j => `<option value="${j}">${j}</option>`).join('');
}

function proceedToHeroes() {
    if (newMatchData.dire.length !== 5 || newMatchData.radiant.length !== 5) {
        alert('Cada equipo debe tener 5 jugadores');
        return;
    }
    
    document.getElementById('heroesSection').classList.remove('hidden');
    document.getElementById('btnProceedHeroes').classList.add('hidden');
    document.getElementById('btnSaveMatch').classList.remove('hidden');
    
    const renderHeroInputs = (team, players) => {
        return players.map(p => `
            <div class="flex items-center gap-2">
                <span class="text-white text-sm w-24">${p}:</span>
                <input type="text" name="hero_${team}_${p.replace(/\s/g, '_')}" placeholder="Héroe" 
                    class="flex-1 bg-dotagray border border-gray-600 rounded px-2 py-1 text-white text-sm">
            </div>
        `).join('');
    };
    
    document.getElementById('heroesDire').innerHTML = renderHeroInputs('dire', newMatchData.dire);
    document.getElementById('heroesRadiant').innerHTML = renderHeroInputs('radiant', newMatchData.radiant);
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
        const input = document.querySelector(`input[name="hero_dire_${p.replace(/\s/g, '_')}"]`);
        heroes[p] = input?.value || '-';
    });
    newMatchData.radiant.forEach(p => {
        const input = document.querySelector(`input[name="hero_radiant_${p.replace(/\s/g, '_')}"]`);
        heroes[p] = input?.value || '-';
    });
    
    const partidaId = 'P' + (data.partidas.length + 1);
    const fechaFormatted = fecha.split('-').reverse().join('/');
    
    const newMatch = {
        id: partidaId,
        fecha: fechaFormatted,
        mapa: map,
        winner: winner,
        mvp: mvp || '-',
        duracion: duracion,
        equipos: {
            Dire: newMatchData.dire,
            Radiant: newMatchData.radiant
        },
        historial: heroes
    };
    
    try {
        const response = await fetch('/api/partidas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partida: newMatch, actualizarStats: true })
        });
        const result = await response.json();
        
        if (result.success) {
            const responseData = await fetch('/api/data');
            data = await responseData.json();
            
            closeNewMatchModal();
            renderMatches();
            renderPlayersList();
            updateStats();
            alert(`¡Partida ${partidaId} guardada!`);
        } else {
            alert('Error al guardar: ' + result.error);
        }
    } catch (error) {
        console.error('Error guardando:', error);
        alert('Error al guardar la partida');
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
