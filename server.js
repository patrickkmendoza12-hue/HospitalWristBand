/**
 * CareBand Pro - Direct Thermal Printer TCP Relay Server (Node.js)
 * Listens on HTTP Port 3000 and streams raw ZPL/TSPL commands to Thermal Printer IP on TCP Port 9100.
 */

const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/api/print-wristband' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', () => {
      try {
        const { printerIp, rawCode } = JSON.parse(body);

        if (!printerIp || !rawCode) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing printerIp or rawCode' }));
          return;
        }

        const [host, portStr] = printerIp.split(':');
        const port = parseInt(portStr) || 9100;

        console.log(`[PRINTER SOCKET] Connecting to Thermal Printer at ${host}:${port}...`);

        const client = new net.Socket();

        client.connect(port, host, () => {
          console.log(`[PRINTER SOCKET] Connected! Sending ZPL raw commands...`);
          client.write(rawCode, 'utf-8', () => {
            console.log(`[PRINTER SOCKET] Print payload transmitted successfully.`);
            client.end();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', message: `Transmitted to ${host}:${port}` }));
          });
        });

        client.on('error', (err) => {
          console.error(`[PRINTER SOCKET ERROR] ${err.message}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Thermal printer connection failed: ${err.message}` }));
        });

      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
  } else if (req.url === '/api/save-db' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const patients = JSON.parse(body);
        if (!Array.isArray(patients)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Expected an array of patients' }));
          return;
        }

        // Convert JSON array to CSV
        const headers = ['Admission ID', 'Patient Name', 'Age', 'Gender', 'Blood Group', 'Ward', 'Bed No', 'Attending Doctor', 'Alerts', 'Admitted At', 'Print Status'];
        let csvContent = headers.join(',') + '\n';

        patients.forEach(p => {
          const alertsStr = Array.isArray(p.alerts) ? p.alerts.join(', ') : (p.alerts || '');
          const row = [
            p.id,
            p.name,
            p.age,
            p.gender,
            p.bloodGroup,
            p.ward,
            p.bedNo,
            `"${p.doctor || ''}"`,
            `"${alertsStr}"`,
            p.admittedAt,
            p.printStatus
          ];
          csvContent += row.join(',') + '\n';
        });

        const dbPath = path.join(__dirname, 'patients_database.csv');
        fs.writeFile(dbPath, csvContent, 'utf8', (err) => {
          if (err) {
            console.error('[DB ERROR] Failed to save database:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to save database' }));
          } else {
            console.log('[DB] Auto-saved patients_database.csv successfully.');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success' }));
          }
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
  } else if (req.method === 'GET') {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not found' }));
        } else {
          res.writeHead(500);
          res.end(`Server Error: ${error.code}`);
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` DevSupreme Solutions Inc. Thermal Printer Relay Server`);
  console.log(` Listening on http://localhost:${PORT}`);
  console.log(` Web App: http://localhost:${PORT}/index.html`);
  console.log(` Print API: POST http://localhost:${PORT}/api/print-wristband`);
  console.log(` Connects to: TCP Port 9100 on Thermal Printer IP`);
  console.log(`=======================================================`);
});
