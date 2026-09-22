const express = require('express');
const cors = require('cors');
const http = require('http');

const routeRouter = require('./routes/route');
const simDensityRouter = require('./routes/simDensity');
const telemetryRouter = require('./routes/telemetry');
const { attachTelemetryWebSocket } = require('./ws/telemetryStream');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/route', routeRouter);
app.use('/api/sim-density', simDensityRouter);
app.use('/api/telemetry', telemetryRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
attachTelemetryWebSocket(server);

server.listen(PORT, () => {
  console.log(`FakeGIS backend listening on http://localhost:${PORT}`);
  console.log(`WebSocket telemetry at ws://localhost:${PORT}/ws/telemetry`);
});
