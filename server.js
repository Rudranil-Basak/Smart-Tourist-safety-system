const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const turf = require('@turf/turf');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Data Stores
let activeTourists = {};
let activeIncidents = [];

// Geofence Definition (Polygon for High-Risk Zone around Kolkata Central)
const restrictedGeofence = turf.polygon([[
    [88.3500, 22.5800],
    [88.3700, 22.5800],
    [88.3700, 22.5650],
    [88.3500, 22.5650],
    [88.3500, 22.5800]
]]);

// API Route: Register Tourist & Generate Digital Pass
app.post('/api/register', async (req, res) => {
    try {
        const { name, passportId, emergencyContact } = req.body;
        const touristId = 'TID-' + Math.floor(100000 + Math.random() * 900000);
        
        const payload = JSON.stringify({ touristId, name, passportId, emergencyContact });
        const qrCodeUrl = await QRCode.toDataURL(payload);

        res.json({
            success: true,
            touristId,
            qrCodeUrl,
            message: 'Digital ID successfully generated and registered.'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Real-Time Socket Connections
io.on('connection', (socket) => {
    console.log(`[SOCKET CONNECTED]: ${socket.id}`);

    // Update Location Handler
    socket.on('update-location', (data) => {
        const { touristId, name, emergencyContact, lat, lng } = data;
        const point = turf.point([lng, lat]);
        const isInsideRestricted = turf.booleanPointInPolygon(point, restrictedGeofence);
        
        // Risk Intelligence Scoring
        let riskScore = 15; // Base safe score
        let status = 'Safe Corridor';

        if (isInsideRestricted) {
            riskScore = 85;
            status = 'RESTRICTED ZONE BREACH';
        }

        activeTourists[touristId] = {
            socketId: socket.id,
            touristId,
            name,
            emergencyContact,
            lat,
            lng,
            riskScore,
            status,
            isInsideRestricted,
            lastUpdated: new Date().toLocaleTimeString()
        };

        // Notify client if breach occurs
        socket.emit('geofence-status', {
            isInsideRestricted,
            riskScore,
            status
        });

        // Broadcast active system state to Admin Command Center
        io.emit('admin-feed-update', Object.values(activeTourists));
    });

    // Emergency SOS Trigger
    socket.on('trigger-sos', (data) => {
        const { touristId, name, emergencyContact, lat, lng } = data;
        const incident = {
            id: 'INC-' + Date.now(),
            touristId,
            name,
            emergencyContact,
            lat,
            lng,
            timestamp: new Date().toLocaleTimeString()
        };
        activeIncidents.unshift(incident);

        // Instant Broadcast Emergency Incident to all admins
        io.emit('emergency-alert', incident);
    });

    socket.on('disconnect', () => {
        // Clean up tracking on disconnect
        for (let id in activeTourists) {
            if (activeTourists[id].socketId === socket.id) {
                delete activeTourists[id];
                break;
            }
        }
        io.emit('admin-feed-update', Object.values(activeTourists));
        console.log(`[SOCKET DISCONNECTED]: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[SYSTEM READY]: SafeTravel AI running on http://localhost:${PORT}`);
});
