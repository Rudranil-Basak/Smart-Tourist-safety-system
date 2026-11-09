const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const turf = require('@turf/turf');

// 1. Serve static files (HTML, CSS, JS, images) from the 'public' folder
app.use(express.static('public'));

// 2. Serve the Tourist Portal directly when visiting the base URL
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/tourist.html');
});

// Define sample high-risk geofence zones using Turf.js polygons
// (You can adjust these coordinates to match your target monitoring area)
const dangerZone = turf.polygon([[
  [88.35, 22.57], 
  [88.37, 22.57], 
  [88.37, 22.59], 
  [88.35, 22.59], 
  [88.35, 22.57]
]]);

// 3. Real-Time Socket.io Telemetry & Geofencing Handler
io.on('connection', (socket) => {
  console.log(`[SOCKET CONNECTED]: ${socket.id}`);

  // Handle incoming tourist GPS location updates
  socket.on('tourist-location', (data) => {
    if (data && data.lat && data.lng) {
      // Create a Turf point from tourist coordinates [longitude, latitude]
      const touristPoint = turf.point([data.lng, data.lat]);
      
      // Automated geofence risk evaluation
      const isHighRisk = turf.booleanPointInPolygon(touristPoint, dangerZone);
      
      // Append risk flag to telemetry package
      data.isHighRisk = isHighRisk;

      // Broadcast the real-time update and risk status to the admin dashboard
      io.emit('update-admin-map', data);
    }
  });

  // Handle manual emergency SOS triggers
  socket.on('sos-alert', (data) => {
    console.log(`[SOS ALERT]: Emergency triggered by ${socket.id}`);
    io.emit('broadcast-sos', data);
  });

  socket.on('disconnect', () => {
    console.log(`[SOCKET DISCONNECTED]: ${socket.id}`);
  });
});

// 4. Bind to Render's dynamic environment port or default to 3000 locally
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[SYSTEM READY]: SafeTravel AI running on port ${PORT}`);
});
