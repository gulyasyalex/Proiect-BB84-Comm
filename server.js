const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let users = { Alice: null, Bob: null, Eve: null };

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join Logic
    socket.on('join_as', (user) => {
        if (users[user]) {
            socket.emit('error_msg', `User ${user} already taken`);
            return;
        }
        // Clear old sessions
        Object.keys(users).forEach(u => {
            if (users[u] === socket.id) users[u] = null;
        });

        users[user] = socket.id;
        io.emit("chat_msg", `SYSTEM: ${user} has joined.`);
        socket.emit('user_assigned', user);
    });

    // Alice Sends
    socket.on('alice_send', (data) => {
        if (users.Eve) {
            io.to(users.Eve).emit('eve_intercept', data);
            io.to(users.Alice).emit('status', 'Photon sent... (Waiting for receiver)');
        } else if (users.Bob) {
            io.to(users.Bob).emit('bob_receive', data);
            io.to(users.Alice).emit('status', 'Photon sent to Bob! (Waiting for measurement...)');
        } else {
            socket.emit('error_msg', 'Bob is not connected yet.');
            // Re-enable button if send failed
            socket.emit('alice_enable_button'); 
        }
    });

    // Eve Forwards
    socket.on('eve_forward', (data) => {
        if (users.Bob) {
            io.to(users.Bob).emit('bob_receive', data);
        }
    });

    // Bob Confirms Measurement (Unlocks Alice)
    socket.on('bob_measured_confirmation', () => {
        if (users.Alice) {
            io.to(users.Alice).emit('status', 'Bob measured it! Ready for next.');
            io.to(users.Alice).emit('alice_enable_button');
        }
    });

    // Chat
    socket.on('public_chat', (msg) => {
        io.emit('chat_msg', msg);
    });

    // Disconnect
    socket.on('disconnect', () => {
        Object.keys(users).forEach(u => {
            if (users[u] === socket.id) {
                users[u] = null;
                io.emit("chat_msg", `SYSTEM: ${u} disconnected.`);
            }
        });
    });
});

http.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});