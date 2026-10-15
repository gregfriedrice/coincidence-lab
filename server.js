const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

// Map: roomCode -> {
//   participants: Map<socketId, { socketId: string, isCreator: boolean, role: 'sender' | 'receiver' | null }>,
//   targetTrials: number | 'unlimited',
//   feedbackMode: 'end' | 'immediate',
//   disconnectTimer: NodeJS.Timeout | null
// }
const rooms = new Map();

// Serve static assets from public/ directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Discovery endpoint
app.get('/api/info', (req, res) => {
    const addresses = [];
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                addresses.push(net.address);
            }
        }
    }
    res.json({ port: PORT, addresses });
});

function emitRolesUpdated(roomCode, room) {
    let senderId = null;
    let receiverId = null;
    for (const [id, p] of room.participants.entries()) {
        if (p.role === 'sender') senderId = id;
        if (p.role === 'receiver') receiverId = id;
    }
    io.to(roomCode).emit('roles_updated', {
        senderId,
        receiverId,
        isFullyAssigned: Boolean(senderId && receiverId && room.participants.size === 2)
    });
}

io.on('connection', (socket) => {
    console.log(`[Connect] Device connected: ${socket.id}`);

    // Join or create room
    socket.on('join_room', (payload) => {
        if (!payload || typeof payload !== 'object') return;
        const rawCode = payload.roomCode;
        if (typeof rawCode !== 'string') return;

        const roomCode = rawCode.toUpperCase().slice(0, 8).replace(/[^A-Z0-9]/g, '');
        if (roomCode.length < 4) {
            socket.emit('error_message', 'Room code must be at least 4 characters.');
            return;
        }

        const isCreating = Boolean(payload.isCreating);
        const feedbackMode = payload.feedbackMode === 'immediate' ? 'immediate' : 'end';

        let targetTrials = payload.targetTrials;
        if (targetTrials !== 'unlimited') {
            targetTrials = parseInt(targetTrials, 10);
            if (isNaN(targetTrials) || targetTrials < 1) targetTrials = 25;
        }

        let room = rooms.get(roomCode);

        // Check non-existent room when joining
        if (!room && !isCreating) {
            socket.emit('error_message', `Room "${roomCode}" was not found. Please check the code or create a new room.`);
            return;
        }

        // Check full room when creating
        if (isCreating && room && room.participants.size >= 2) {
            socket.emit('error_message', `Room "${roomCode}" already exists and is full.`);
            return;
        }

        if (!room) {
            room = {
                participants: new Map(),
                targetTrials: targetTrials,
                feedbackMode: feedbackMode,
                disconnectTimer: null
            };
            rooms.set(roomCode, room);
        }

        // Room capacity check (max 2 participants)
        if (room.participants.size >= 2 && !room.participants.has(socket.id)) {
            socket.emit('room_full');
            return;
        }

        // Cancel disconnect timer if partner returns
        if (room.disconnectTimer) {
            clearTimeout(room.disconnectTimer);
            room.disconnectTimer = null;
        }

        const isCreator = (room.participants.size === 0);
        let assignedRole = null;

        // If a partner is already in room and has selected a role, auto-assign the complementary role
        if (room.participants.size === 1) {
            const [otherId, otherP] = Array.from(room.participants.entries())[0];
            if (otherP.role === 'sender') assignedRole = 'receiver';
            else if (otherP.role === 'receiver') assignedRole = 'sender';
        }

        room.participants.set(socket.id, {
            socketId: socket.id,
            isCreator,
            role: assignedRole
        });

        socket.join(roomCode);
        socket.data.roomCode = roomCode;

        console.log(`[Room ${roomCode}] Socket ${socket.id} joined (Total in room: ${room.participants.size}/2, Creator: ${isCreator})`);

        // Acknowledge join to current socket
        socket.emit('room_joined', {
            roomCode,
            isCreator,
            targetTrials: room.targetTrials,
            feedbackMode: room.feedbackMode,
            participantCount: room.participants.size
        });

        // Notify other participant that partner has arrived
        socket.to(roomCode).emit('partner_joined', {
            participantCount: room.participants.size
        });

        // Broadcast current role state
        emitRolesUpdated(roomCode, room);
    });

    // Claim a role in the lobby (Sender or Receiver)
    socket.on('claim_role', (payload) => {
        const roomCode = socket.data.roomCode;
        if (!roomCode || !rooms.has(roomCode)) return;
        const room = rooms.get(roomCode);

        const chosenRole = payload && payload.role === 'sender' ? 'sender' : 'receiver';
        const complementaryRole = (chosenRole === 'sender') ? 'receiver' : 'sender';

        // Assign to claiming socket
        const p = room.participants.get(socket.id);
        if (p) p.role = chosenRole;

        // Auto-assign complementary role to partner if present
        for (const [id, otherP] of room.participants.entries()) {
            if (id !== socket.id) {
                otherP.role = complementaryRole;
            }
        }

        console.log(`[Room ${roomCode}] Socket ${socket.id} claimed ${chosenRole}. Partner auto-assigned ${complementaryRole}.`);
        emitRolesUpdated(roomCode, room);
    });

    // Swap roles in the lobby
    socket.on('swap_roles', () => {
        const roomCode = socket.data.roomCode;
        if (!roomCode || !rooms.has(roomCode)) return;
        const room = rooms.get(roomCode);

        for (const [id, p] of room.participants.entries()) {
            if (p.role === 'sender') p.role = 'receiver';
            else if (p.role === 'receiver') p.role = 'sender';
        }

        console.log(`[Room ${roomCode}] Roles swapped.`);
        emitRolesUpdated(roomCode, room);
    });

    // Start experiment from the lobby
    socket.on('start_experiment', () => {
        const roomCode = socket.data.roomCode;
        if (!roomCode || !rooms.has(roomCode)) return;
        const room = rooms.get(roomCode);

        if (room.participants.size < 2) {
            socket.emit('error_message', 'Cannot start experiment: waiting for partner to join.');
            return;
        }

        let senderId = null;
        let receiverId = null;
        for (const [id, p] of room.participants.entries()) {
            if (p.role === 'sender') senderId = id;
            if (p.role === 'receiver') receiverId = id;
        }

        // If roles were not picked yet, default creator to Sender and partner to Receiver
        if (!senderId || !receiverId) {
            const ids = Array.from(room.participants.keys());
            room.participants.get(ids[0]).role = 'sender';
            room.participants.get(ids[1]).role = 'receiver';
            senderId = ids[0];
            receiverId = ids[1];
        }

        io.to(roomCode).emit('session_ready', {
            roomCode,
            targetTrials: room.targetTrials,
            feedbackMode: room.feedbackMode,
            senderId,
            receiverId
        });
        console.log(`[Room ${roomCode}] Experiment started! Sender: ${senderId}, Receiver: ${receiverId}`);
    });

    // Relay experiment actions (blinded cues, guesses, evaluations, end-session signals)
    socket.on('sync_action', (data) => {
        if (!data || typeof data !== 'object') return;
        const roomCode = socket.data.roomCode || data.roomCode;
        if (!roomCode || typeof roomCode !== 'string') return;

        const cleanCode = roomCode.toUpperCase().slice(0, 8);
        socket.to(cleanCode).emit('receive_action', data);
    });

    // Disconnect handling with 10s grace period for mobile lock
    socket.on('disconnect', () => {
        const roomCode = socket.data.roomCode;
        console.log(`[Disconnect] Socket ${socket.id} left room: ${roomCode || 'None'}`);

        if (roomCode && rooms.has(roomCode)) {
            const room = rooms.get(roomCode);
            room.participants.delete(socket.id);

            if (room.participants.size === 0) {
                room.disconnectTimer = setTimeout(() => {
                    rooms.delete(roomCode);
                    console.log(`[Room ${roomCode}] Closed (empty after grace period).`);
                }, 15000);
            } else {
                socket.to(roomCode).emit('partner_disconnected', {
                    temporary: true,
                    message: 'Partner connection lost. Waiting for them to reconnect...'
                });

                // Clear role of remaining participant so lobby resets gracefully if waiting
                emitRolesUpdated(roomCode, room);

                room.disconnectTimer = setTimeout(() => {
                    if (room.participants.size < 2) {
                        socket.to(roomCode).emit('partner_disconnected', {
                            temporary: false,
                            message: 'Partner did not return. You can view your current results or start a fresh session.'
                        });
                        console.log(`[Room ${roomCode}] Partner timeout expired.`);
                    }
                }, 10000);
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n----------------------------------------`);
    console.log(`🔬 Coincidence Lab Server Running!`);
    console.log(`----------------------------------------`);
    console.log(`On your laptop browser, open:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`\nOn your phone (same Wi-Fi), open one of these:`);

    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`👉 http://${net.address}:${PORT}`);
            }
        }
    }
    console.log(`----------------------------------------\n`);
});
