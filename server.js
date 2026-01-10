const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let users = { Alice: null, Bob: null, Eve: null };

// Helper to broadcast button states to everyone
function broadcastRoleUpdate() {
    io.emit('role_update', users);
}

io.on('connection', (socket) => {
    // 1. Send current button states immediately to the new person
    socket.emit('role_update', users);

    socket.on('join_as', (user) => {
        // RACE CONDITION CHECK:
        if (users[user] && users[user] !== socket.id) {
            socket.emit('error_msg', `Role ${user} is already occupied.`);
            return;
        }

        // Clear previous sessions for this socket if they are switching roles
        Object.keys(users).forEach(u => {
            if (users[u] === socket.id) users[u] = null;
        });

        users[user] = socket.id;
        
        socket.emit('user_assigned', user);
        io.emit("chat_msg", `SYSTEM: ${user} has joined.`);
        
        // Broadcast new locked buttons to everyone
        broadcastRoleUpdate();
    });

    // --- LOGOUT HANDLER ---
    socket.on('leave_role', () => {
        let roleName = "";
        Object.keys(users).forEach(u => {
            if (users[u] === socket.id) {
                users[u] = null;
                roleName = u;
            }
        });

        if (roleName) {
            io.emit("chat_msg", `SYSTEM: ${roleName} has left the station.`);
            broadcastRoleUpdate();
        }
    });

    // --- ALICE SEND WITH CALLBACK ---
    socket.on('alice_send', (data, callback) => {
        const recipientExists = users.Eve || users.Bob;

        if (recipientExists) {
            if (callback) callback({ status: 'ok' });

            if (users.Eve) {
                io.to(users.Eve).emit('eve_intercept', data);
                io.to(users.Alice).emit('status', 'Photon sent... (Interception risk unknown)');
            } else {
                io.to(users.Bob).emit('bob_receive', data);
                io.to(users.Alice).emit('status', 'Photon sent... (Interception risk unknown)');
            }
        } else {
            if (callback) callback({ status: 'error' });
            
            socket.emit('error_msg', 'Transmission Failed: Bob is not connected.');
            socket.emit('alice_enable_button');
        }
    });

    socket.on('eve_forward', (data) => {
        if (users.Bob) {
            io.to(users.Bob).emit('bob_receive', data);
        }
    });

    socket.on('bob_measured_confirmation', () => {
        if (users.Alice) {
            io.to(users.Alice).emit('status', 'Bob measured it! Ready for next.');
            io.to(users.Alice).emit('alice_enable_button');
        }
    });

    socket.on('public_chat', (msg) => {
        io.emit('chat_msg', msg);
    });

    socket.on('disconnect', () => {
        Object.keys(users).forEach(u => {
            if (users[u] === socket.id) {
                users[u] = null;
                io.emit("chat_msg", `SYSTEM: ${u} disconnected.`);
            }
        });
        // Unlock the button for everyone else
        broadcastRoleUpdate();
    });
});

http.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});