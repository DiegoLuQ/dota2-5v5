const mongoose = require('mongoose');
require('dotenv').config();
const Game = require('./models/Game');

async function checkAndFixStats() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Conectado a MongoDB...');

        const gameData = await Game.findOne();
        if (!gameData) {
            console.log('No data found');
            process.exit(1);
        }

        console.log('Recalculando estadísticas de cero basado en el historial exacto...');

        // Reset all player stats
        gameData.jugadores.forEach(j => {
            j.win = 0;
            j.loss = 0;
        });

        // Iterar sobre cada partida en orden
        gameData.partidas.forEach(p => {
            const winner = p.winner || p.ganador; // Handle legacy prop

            if (!winner || winner === '-') return;

            // Procesar equipo Dire
            p.equipos.Dire.forEach(nombre => {
                const jugador = gameData.jugadores.find(j => j.nombre === nombre);
                if (jugador) {
                    if (winner === 'Dire') {
                        jugador.win++;
                    } else if (winner === 'Radiant') {
                        jugador.loss++;
                    }
                }
            });

            // Procesar equipo Radiant
            p.equipos.Radiant.forEach(nombre => {
                const jugador = gameData.jugadores.find(j => j.nombre === nombre);
                if (jugador) {
                    if (winner === 'Radiant') {
                        jugador.win++;
                    } else if (winner === 'Dire') {
                        jugador.loss++;
                    }
                }
            });
        });

        // Debug prints
        gameData.jugadores.forEach(j => {
            console.log(`${j.nombre} -> Win: ${j.win}, Loss: ${j.loss}`);
        });

        // Mark array modified
        gameData.markModified('jugadores');
        await gameData.save();

        console.log('¡Estadísticas recalculadas y guardadas correctamente!');
        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkAndFixStats();
