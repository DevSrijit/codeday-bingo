const express = require('express');
const EventEmitter = require('events');

const app = express();
const port = 3000;

class NumberEmitter extends EventEmitter {}
const numberEmitter = new NumberEmitter();
numberEmitter.setMaxListeners(100); // Increase the max listeners as needed

let gameStarted = false;
let intervalId = null;
let remainingNumbers = [];
let currentNumber = null;  // Store the current number
const bingoWinners = [];

// Function to shuffle an array
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Initialize the bingo numbers
function initializeNumbers() {
    remainingNumbers = shuffle(Array.from({ length: 90 }, (_, i) => i + 1));
}

app.get('/', (req, res) => {
    res.send('Welcome to CodeDay Kolkata 🚀');
});

// Endpoint to listen for numbers
app.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (gameStarted) {
        if (currentNumber !== null) {
            res.write(`data: ${currentNumber}\n\n`);
        }
    } else {
        res.write('data: Waiting for the game to start\n\n');
    }

    const sendNumber = (number) => {
        res.write(`data: ${number}\n\n`);
    };

    numberEmitter.on('number', sendNumber);

    req.on('close', () => {
        numberEmitter.removeListener('number', sendNumber);
    });
});

// Trigger to start the game
app.get('/start', (req, res) => {
    if (!gameStarted) {
        gameStarted = true;
        initializeNumbers();

        intervalId = setInterval(() => {
            if (remainingNumbers.length > 0) {
                currentNumber = remainingNumbers.pop();
                numberEmitter.emit('number', currentNumber);
            } else {
                clearInterval(intervalId);
                gameStarted = false;
                currentNumber = null;
            }
        }, 1000);

        res.send('Game started!');
    } else {
        res.send('Game has already started!');
    }
});

// Trigger to stop the game
app.get('/stop', (req, res) => {
    if (gameStarted) {
        clearInterval(intervalId);
        gameStarted = false;
        currentNumber = null;
        res.send('Game stopped!');
    } else {
        res.send('Game is not running!');
    }
});

// Endpoint for clients to call when they complete their bingo
app.post('/bingo', express.json(), (req, res) => {
    const { name, message } = req.body;

    if (!name || !message) {
        return res.status(400).send('Name and message are required');
    }

    const timestamp = new Date();
    const winner = { name, message, timestamp };
    bingoWinners.push(winner);
    numberEmitter.emit('bingo', winner);

    res.status(200).send('Bingo reported successfully');
});

// Endpoint to stream leaderboard
app.get('/leaderboard', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendWinner = (winner) => {
        const data = JSON.stringify(winner);
        res.write(`data: ${data}\n\n`);
    };

    bingoWinners.forEach(sendWinner);

    numberEmitter.on('bingo', sendWinner);

    req.on('close', () => {
        numberEmitter.removeListener('bingo', sendWinner);
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
