const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const Game = require('./models/Game');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let dataCache = null;

async function conectarMongoDB() {
    try {
        if (mongoose.connection.readyState === 1) return dataCache;

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Conectado a MongoDB');
        
        let gameData = await Game.findOne();
        
        if (!gameData) {
            console.log('Cargando datos iniciales desde data.json...');
            const fs = require('fs');
            const dataJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
            
            gameData = new Game(dataJson);
            await gameData.save();
            console.log('✓ Datos cargados a MongoDB');
        }
        
        dataCache = gameData;
        return gameData;
    } catch (error) {
        console.error('Error conectando a MongoDB:', error.message);
        if (process.env.VERCEL === undefined) {
            process.exit(1);
        }
    }
}

app.get('/api/data', async (req, res) => {
    try {
        const gameData = await conectarMongoDB();
        if (gameData) {
            res.json(gameData);
        } else {
            res.status(500).json({ error: 'Datos no disponibles' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        await conectarMongoDB();
        const { username, password } = req.body;
        console.log(`Intento de login: ${username}`);
        const gameData = await Game.findOne();
        
        // Buscar en la DB
        let user = gameData?.usuarios?.find(u => u.username === username && u.password === password);
        
        if (user) console.log("✓ Usuario encontrado en DB");

        // Si no se encuentra el usuario en la DB, pero está en el archivo local (fallback de emergencia)
        if (!user) {
            console.log("...Buscando en data.json local");
            const fs = require('fs');
            try {
                const dataJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
                user = dataJson.usuarios?.find(u => u.username === username && u.password === password);
                
                if (user) {
                    console.log("✓ Usuario encontrado en data.json");
                    if (gameData) {
                        if (!gameData.usuarios) gameData.usuarios = [];
                        gameData.usuarios.push(user);
                        await gameData.save();
                        console.log("✓ Usuario sincronizado a MongoDB");
                        dataCache = gameData;
                    }
                } else {
                    console.log("✗ Usuario no encontrado en data.json");
                }
            } catch (e) {
                console.error("Error leyendo data.json para login:", e);
            }
        }

        if (user) {
            res.json({ success: true, username: user.username });
        } else {
            console.log("✗ Credenciales incorrectas");
            res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/partidas', async (req, res) => {
    try {
        await conectarMongoDB();
        const { partida, actualizarStats } = req.body;
        
        const partidaMongo = {
            id: partida.id,
            fecha: partida.fecha,
            mapa: partida.mapa,
            winner: partida.ganador || partida.winner,
            mvp: partida.mvp,
            duracion: partida.duracion,
            capitanes: partida.capitanes || { Dire: '', Radiant: '' },
            equipos: partida.equipos,
            historial: partida.historial
        };
        
        const gameData = await Game.findOne();
        
        gameData.partidas.unshift(partidaMongo);
        
        if (actualizarStats) {
            partida.equipos.Dire.forEach(nombre => {
                const jugador = gameData.jugadores.find(j => j.nombre === nombre);
                if (jugador) {
                    if (partida.winner === 'Dire') {
                        jugador.win++;
                    } else {
                        jugador.loss++;
                    }
                    if (partida.historial && partida.historial[nombre]) {
                        jugador.historial[partida.id] = partida.historial[nombre];
                    }
                }
            });
            
            partida.equipos.Radiant.forEach(nombre => {
                const jugador = gameData.jugadores.find(j => j.nombre === nombre);
                if (jugador) {
                    if (partida.winner === 'Radiant') {
                        jugador.win++;
                    } else {
                        jugador.loss++;
                    }
                    if (partida.historial && partida.historial[nombre]) {
                        jugador.historial[partida.id] = partida.historial[nombre];
                    }
                }
            });
        }
        
        await gameData.save();
        dataCache = gameData;
        
        res.json({ success: true, message: 'Partida guardada' });
    } catch (error) {
        console.error('Error guardando partida:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/partidas/:id/mvp', async (req, res) => {
    try {
        await conectarMongoDB();
        const { id } = req.params;
        const { mvp } = req.body;
        
        const gameData = await Game.findOne();
        const partida = gameData.partidas.find(p => p.id === id);
        
        if (partida) {
            partida.mvp = mvp;
            await gameData.save();
            dataCache = gameData;
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'Partida no encontrada' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/partidas/:id', async (req, res) => {
    try {
        await conectarMongoDB();
        const { id } = req.params;
        const { partida, actualizarStats } = req.body;
        
        const gameData = await Game.findOne();
        const oldPartidaIndex = gameData.partidas.findIndex(p => p.id === id);
        
        if (oldPartidaIndex === -1) {
            return res.status(404).json({ success: false, error: 'Partida no encontrada' });
        }
        
        const oldPartida = gameData.partidas[oldPartidaIndex];
        
        // 1. Revertir stats de la partida antigua
        if (actualizarStats) {
            const revertirStats = (equipo, ganador) => {
                equipo.forEach(nombre => {
                    const jugador = gameData.jugadores.find(j => j.nombre === nombre);
                    if (jugador) {
                        if (ganador === (equipo === oldPartida.equip.Dire ? 'Dire' : 'Dire')) { // Bug fix logic below
                             // Logic: if they were on the winning team, decrement win. Else decrement loss.
                        }
                    }
                });
            };
            
            // Revertir Dire
            oldPartida.equipos.Dire.forEach(nombre => {
                const jugador = gameData.jugadores.find(j => j.nombre === nombre);
                if (jugador) {
                    if (oldPartida.winner === 'Dire') jugador.win--; else jugador.loss--;
                    if (jugador.historial) {
                        if (jugador.historial instanceof Map) jugador.historial.delete(id);
                        else delete jugador.historial[id];
                    }
                }
            });
            // Revertir Radiant
            oldPartida.equipos.Radiant.forEach(nombre => {
                const jugador = gameData.jugadores.find(j => j.nombre === nombre);
                if (jugador) {
                    if (oldPartida.winner === 'Radiant') jugador.win--; else jugador.loss--;
                    if (jugador.historial) {
                        if (jugador.historial instanceof Map) jugador.historial.delete(id);
                        else delete jugador.historial[id];
                    }
                }
            });
        }
        
        // 2. Actualizar datos de la partida
        gameData.partidas[oldPartidaIndex] = {
            id: id,
            fecha: partida.fecha,
            mapa: partida.mapa,
            winner: partida.winner,
            mvp: partida.mvp,
            duracion: partida.duracion,
            capitanes: partida.capitanes || { Dire: '', Radiant: '' },
            equipos: partida.equipos,
            historial: partida.historial
        };
        
        // 3. Aplicar nuevas stats
        if (actualizarStats) {
            partida.equipos.Dire.forEach(nombre => {
                const jugador = gameData.jugadores.find(j => j.nombre === nombre);
                if (jugador) {
                    if (partida.winner === 'Dire') jugador.win++; else jugador.loss++;
                    if (!jugador.historial) jugador.historial = new Map();
                    if (jugador.historial instanceof Map) jugador.historial.set(id, partida.historial[nombre]);
                    else jugador.historial[id] = partida.historial[nombre];
                }
            });
            partida.equipos.Radiant.forEach(nombre => {
                const jugador = gameData.jugadores.find(j => j.nombre === nombre);
                if (jugador) {
                    if (partida.winner === 'Radiant') jugador.win++; else jugador.loss++;
                    if (!jugador.historial) jugador.historial = new Map();
                    if (jugador.historial instanceof Map) jugador.historial.set(id, partida.historial[nombre]);
                    else jugador.historial[id] = partida.historial[nombre];
                }
            });
        }
        
        gameData.markModified('partidas');
        gameData.markModified('jugadores');
        await gameData.save();
        dataCache = gameData;
        res.json({ success: true, message: 'Partida actualizada y stats recalculadas' });
        
    } catch (error) {
        console.error('Error actualizando partida:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/jugadores/:nombre', async (req, res) => {
    try {
        await conectarMongoDB();
        const { nombre } = req.params;
        const { nuevoNombre, imagen } = req.body;
        
        const gameData = await Game.findOne();
        const jugador = gameData.jugadores.find(j => j.nombre === nombre);
        
        if (jugador) {
            if (nuevoNombre && nuevoNombre !== nombre) {
                jugador.nombre = nuevoNombre;
                
                gameData.partidas.forEach(p => {
                    if (p.equipos.Dire.includes(nombre)) {
                        p.equipos.Dire = p.equipos.Dire.map(j => j === nombre ? nuevoNombre : j);
                    }
                    if (p.equipos.Radiant.includes(nombre)) {
                        p.equipos.Radiant = p.equipos.Radiant.map(j => j === nombre ? nuevoNombre : j);
                    }
                    if (p.mvp === nombre) {
                        p.mvp = nuevoNombre;
                    }
                });
            }
            
            if (imagen !== undefined) {
                jugador.imagen = imagen;
            }
            
            await gameData.save();
            dataCache = gameData;
            res.json({ success: true, message: 'Jugador actualizado' });
        } else {
            res.status(404).json({ success: false, error: 'Jugador no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Servir el frontend para cualquier otra ruta
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Conectar a MongoDB inmediatamente
conectarMongoDB();

// Export for Vercel
module.exports = app;

// Start server locally
if (process.env.VERCEL === undefined) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`✓ Servidor en http://localhost:${PORT}`);
    });
}
