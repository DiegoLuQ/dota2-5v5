const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Game = require('./models/Game');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let dataCache = null;

async function conectarMongoDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Conectado a MongoDB');
        
        let gameData = await Game.findOne();
        
        if (!gameData) {
            console.log('Cargando datos iniciales desde data.json...');
            const fs = require('fs');
            const dataJson = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
            
            gameData = new Game(dataJson);
            await gameData.save();
            console.log('✓ Datos cargados a MongoDB');
        } else {
            console.log('✓ Datos ya existen en MongoDB');
        }
        
        dataCache = gameData;
        return gameData;
    } catch (error) {
        console.error('Error conectando a MongoDB:', error.message);
        process.exit(1);
    }
}

app.get('/api/data', (req, res) => {
    if (dataCache) {
        res.json(dataCache);
    } else {
        res.status(500).json({ error: 'Datos no disponibles' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const gameData = await Game.findOne();
    const user = gameData?.usuarios.find(u => u.username === username && u.password === password);
    
    if (user) {
        res.json({ success: true, username: user.username });
    } else {
        res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }
});

app.post('/api/partidas', async (req, res) => {
    try {
        const { partida, actualizarStats } = req.body;
        
        const partidaMongo = {
            id: partida.id,
            fecha: partida.fecha,
            mapa: partida.mapa,
            winner: partida.ganador || partida.winner,
            mvp: partida.mvp,
            duracion: partida.duracion,
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

app.put('/api/jugadores/:nombre', async (req, res) => {
    try {
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

// Export for Vercel
module.exports = app;

// Start server locally
if (process.env.VERCEL === undefined) {
    const PORT = process.env.PORT || 3000;
    conectarMongoDB().then(() => {
        app.listen(PORT, () => {
            console.log(`✓ Servidor en http://localhost:${PORT}`);
        });
    });
}
