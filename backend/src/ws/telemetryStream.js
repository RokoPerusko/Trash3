const { WebSocketServer } = require('ws');
const { step } = require('../data/telemetryState');

const TICK_MS = 1500;

function attachTelemetryWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws/telemetry' });

  const interval = setInterval(() => {
    const payload = JSON.stringify(step());
    wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    });
  }, TICK_MS);

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify(step()));
  });

  wss.on('close', () => clearInterval(interval));

  return wss;
}

module.exports = { attachTelemetryWebSocket };
