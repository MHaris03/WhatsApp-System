/**
 * Express application: middleware, static media, and API routes.
 * (HTTP server creation, Socket.IO, DB and WhatsApp startup live in server.js.)
 */
const express = require('express');
const cors = require('cors');
const { MEDIA_DIR } = require('./config');
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());

// Serve received/sent chat media so the browser can preview/download it.
app.use('/files', express.static(MEDIA_DIR));

app.use('/api', routes);

module.exports = app;
