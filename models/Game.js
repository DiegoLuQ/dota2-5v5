const mongoose = require('mongoose');

const JugadorSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    versatilidad: String,
    estado: String,
    win: { type: Number, default: 0 },
    loss: { type: Number, default: 0 },
    ranking: Number,
    imagen: { type: String, default: '' },
    historial: { type: Map, of: String, default: {} }
}, { _id: false });

const UsuarioSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true }
}, { _id: false });

const PartidaSchema = new mongoose.Schema({
    id: { type: String, required: true },
    fecha: String,
    mapa: String,
    winner: String,
    mvp: String,
    duracion: String,
    equipos: {
        Dire: [String],
        Radiant: [String]
    },
    historial: { type: Map, of: String, default: {} }
}, { _id: false });

const GameSchema = new mongoose.Schema({
    partidas: [PartidaSchema],
    usuarios: [UsuarioSchema],
    jugadores: [JugadorSchema]
});

module.exports = mongoose.model('Game', GameSchema, 'amigos5v5');
