const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let users = { Alice: null, Bob: null, Eve: null };

io.on('connection', (socket) => {
    console.log('A user connected! Socket ID:', socket.id)

    socket.on('join_as', (user) => {
        if (users[user]) {
            socket.emit('error_msg', `User ${user} already taken`);
            return;
        }

        Object.keys(users).forEach(user => {
            if (users[user] === socket.id) {
                users[user] = null;
            }
        });

        users[user] = socket.id;
        io.emit("chat_msg", `SYSTEM:${user} has joined the chat.`);
        socket.emit('user_assigned', user);
    });

    socket.on('alice_send', (data) => {

        if (users.Eve) {
            io.to(users.Eve).emit('eve_intercept', data);
            io.to(users.Alice).emit('status', 'Photon sent... (Intercepted on line!)');
        } else if (users.Bob) {
            io.to(users.Bob).emit('bob_receive', data);
            io.to(users.Alice).emit('status', 'Photon sent to Bob!');
        } else {
            socket.emit('error_msg', 'Bob is not connected yet.');
        }
    });

    socket.on('eve_forward', (data) => {
        if (users.Bob) {
            io.to(users.Bob).emit('bob_receive', data);
        }
    });

    socket.on('public_chat', (msg) => {
        io.emit('chat_msg', msg);
    });

    socket.on('disconnect', () => {
        Object.keys(users).forEach(user => {
            if (users[user] === socket.id) {
                users[user] = null;
                io.emit("chat_msg", `SYSTEM:${user} has left the chat.`);
            }
        });
    });
});

http.listen(3000, () => {
    console.log('Server is listening on port 3000');
});