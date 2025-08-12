// Global variables
let socket;
let currentGameId = null;
let playerColor = null;
let chess = new Chess();
let selectedSquare = null;
let gameDuration = 300000; // 5 minutes in ms
let whiteTimeLeft = gameDuration;
let blackTimeLeft = gameDuration;
let gameStartTime = null;
let timerInterval = null;
let moveHistory = [];
let opponentAddress = null;
const defaultWallet = "0xDefaultWallet123...";

// DOM Elements
const lobbySection = document.getElementById('lobby');
const gameSection = document.getElementById('game-section');
const waitingRoom = document.getElementById('waiting-room');
const chessboard = document.getElementById('chessboard');
const createGameBtn = document.getElementById('create-game-btn');
const joinRandomBtn = document.getElementById('join-random-btn');
const viewGamesBtn = document.getElementById('view-games-btn');
const gameListContainer = document.getElementById('game-list-container');
const gameList = document.getElementById('game-list');
const gameCreationModal = document.getElementById('game-creation-modal');
const closeModalBtn = document.querySelector('.close-btn');
const gameCreationForm = document.getElementById('game-creation-form');
const waitingGameId = document.getElementById('waiting-game-id');
const waitingPlayerColor = document.getElementById('waiting-player-color');
const waitingTime = document.getElementById('waiting-time');
const cancelWaitingBtn = document.getElementById('cancel-waiting-btn');
const whitePlayerAddress = document.getElementById('white-player-address');
const blackPlayerAddress = document.getElementById('black-player-address');
const whiteTimeDisplay = document.getElementById('white-time');
const blackTimeDisplay = document.getElementById('black-time');
const resignBtn = document.getElementById('resign-btn');
const offerDrawBtn = document.getElementById('offer-draw-btn');
const claimCheckmateBtn = document.getElementById('claim-checkmate-btn');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const isBettingCheckbox = document.getElementById('is-betting');
const bettingOptions = document.getElementById('betting-options');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeChessboard();
    setupEventListeners();
    connectWebSocket();
});

function connectWebSocket() {
    // Connect to WebSocket server
    socket = new WebSocket('ws://localhost:3000/chesssol/backend/ws');
    
    socket.onopen = () => {
        showNotification('Connected to server', 'success');
    };
    
    socket.onclose = () => {
        showNotification('Disconnected from server', 'error');
    };
    
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        showNotification('Connection error', 'error');
    };
    
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleSocketMessage(message);
    };
}

function handleSocketMessage(message) {
    console.log('Received message:', message);
    
    switch(message.type) {
        case 'created':
            handleGameCreated(message);
            break;
        case 'joined':
            handleGameJoined(message);
            break;
        case 'move':
            handleMove(message);
            break;
        case 'gameList':
            updateGameList(message.games);
            break;
        case 'paired':
            handlePaired(message);
            break;
        case 'pairing':
            showNotification(message.message, 'info');
            break;
        case 'gameEnded':
            handleGameEnded(message);
            break;
        case 'chat':
            displayChatMessage(message);
            break;
        case 'error':
            showNotification(message.message, 'error');
            break;
        default:
            console.log('Unhandled message type:', message.type);
    }
}

function initializeChessboard() {
    // Clear any existing board
    chessboard.innerHTML = '';
    
    // Create 8x8 chessboard
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.row = row;
            square.dataset.col = col;
            square.addEventListener('click', () => handleSquareClick(row, col));
            chessboard.appendChild(square);
        }
    }
    
    updateBoard();
}

function updateBoard() {
    // Clear all pieces
    document.querySelectorAll('.piece').forEach(p => p.remove());
    
    // Update board state
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = chessboard.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
            square.classList.remove('selected', 'highlight', 'possible-move');
            
            const piece = chess.get([col, row]);
            if (piece) {
                const pieceElement = document.createElement('div');
                pieceElement.className = 'piece';
                pieceElement.dataset.type = piece.type;
                pieceElement.dataset.color = piece.color;
                
                // Use Unicode chess characters for pieces
                const pieceSymbol = getPieceSymbol(piece.type, piece.color);
                pieceElement.textContent = pieceSymbol;
                
                square.appendChild(pieceElement);
            }
        }
    }
}

function getPieceSymbol(type, color) {
    const symbols = {
        p: color === 'w' ? '♙' : '♟',
        n: color === 'w' ? '♘' : '♞',
        b: color === 'w' ? '♗' : '♝',
        r: color === 'w' ? '♖' : '♜',
        q: color === 'w' ? '♕' : '♛',
        k: color === 'w' ? '♔' : '♚'
    };
    return symbols[type];
}

function handleSquareClick(row, col) {
    if (!playerColor || chess.turn() !== playerColor[0]) return;
    
    const square = `${String.fromCharCode(97 + col)}${8 - row}`;
    const piece = chess.get(square);
    
    // If a square is already selected
    if (selectedSquare) {
        // If clicking on the same square, deselect it
        if (selectedSquare === square) {
            selectedSquare = null;
            updateBoard();
            return;
        }
        
        // Try to make a move
        try {
            const move = {
                from: selectedSquare,
                to: square,
                promotion: 'q' // Always promote to queen for simplicity
            };
            
            // Validate move locally first
            if (chess.move(move)) {
                // Send move to server
                sendMoveToServer(move);
                selectedSquare = null;
            } else {
                // Invalid move
                selectedSquare = square;
                updateBoard();
            }
        } catch (e) {
            console.error('Move error:', e);
            selectedSquare = square;
            updateBoard();
        }
    } 
    // If no square is selected and the clicked square has a piece of the player's color
    else if (piece && piece.color === playerColor[0]) {
        selectedSquare = square;
        
        // Highlight possible moves
        const moves = chess.moves({
            square: square,
            verbose: true
        });
        
        moves.forEach(m => {
            const toRow = 8 - parseInt(m.to[1]);
            const toCol = m.to.charCodeAt(0) - 97;
            const squareElement = chessboard.querySelector(`.square[data-row="${toRow}"][data-col="${toCol}"]`);
            squareElement.classList.add('possible-move');
        });
        
        // Highlight selected square
        const fromRow = 8 - parseInt(selectedSquare[1]);
        const fromCol = selectedSquare.charCodeAt(0) - 97;
        const selectedElement = chessboard.querySelector(`.square[data-row="${fromRow}"][data-col="${fromCol}"]`);
        selectedElement.classList.add('selected');
    }
}

function sendMoveToServer(move) {
    const moveData = {
        type: 'move',
        gameId: currentGameId,
        walletAddress: defaultWallet,
        move: `${move.from}${move.to}`,
        fen: chess.fen(),
        clientTime: Date.now(),
        initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    };
    
    socket.send(JSON.stringify(moveData));
}

function handleMove(message) {
    if (message.gameId !== currentGameId) return;
    
    // Update local chess state
    chess.load(message.fen);
    updateBoard();
    
    // Update turn indicator
    if (playerColor) {
        const isMyTurn = chess.turn() === playerColor[0];
        showNotification(isMyTurn ? 'Your turn' : 'Opponent\'s turn', 'info');
    }
}

function setupEventListeners() {
    // Lobby buttons
    createGameBtn.addEventListener('click', () => {
        gameCreationModal.classList.remove('hidden');
    });
    
    joinRandomBtn.addEventListener('click', () => {
        joinRandomGame();
    });
    
    viewGamesBtn.addEventListener('click', () => {
        listAvailableGames();
    });
    
    // Modal buttons
    closeModalBtn.addEventListener('click', () => {
        gameCreationModal.classList.add('hidden');
    });
    
    gameCreationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        createNewGame();
    });
    
    isBettingCheckbox.addEventListener('change', () => {
        bettingOptions.classList.toggle('hidden', !isBettingCheckbox.checked);
    });
    
    // Waiting room
    cancelWaitingBtn.addEventListener('click', cancelWaiting);
    
    // Game controls
    resignBtn.addEventListener('click', resignGame);
    offerDrawBtn.addEventListener('click', offerDraw);
    claimCheckmateBtn.addEventListener('click', claimCheckmate);
    
    // Chat
    sendChatBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
}

function createNewGame() {
    const side = document.getElementById('game-side').value;
    const duration = parseInt(document.getElementById('game-duration').value);
    const category = document.getElementById('game-category').value;
    const isBetting = document.getElementById('is-betting').checked;
    const betAmount = isBetting ? parseFloat(document.getElementById('bet-amount').value) : null;
    
    const gameData = {
        type: 'create',
        walletAddress: defaultWallet,
        side: side,
        duration: duration,
        cat: category
    };
    
    if (isBetting) {
        gameData.isBetting = true;
        gameData.playerAmount = betAmount;
        // In a real app, you'd need a transactionId from blockchain
        gameData.transactionId = 'simulated_tx_' + Math.random().toString(36).substring(2);
    }
    
    socket.send(JSON.stringify(gameData));
    gameCreationModal.classList.add('hidden');
}

function joinRandomGame() {
    const pairRequest = {
        type: 'pairRequest',
        walletAddress: defaultWallet,
        side: 'random',
        isBetting: false
    };
    
    socket.send(JSON.stringify(pairRequest));
}

function listAvailableGames() {
    const request = {
        type: 'listGames'
    };
    
    socket.send(JSON.stringify(request));
    gameListContainer.classList.remove('hidden');
}

function updateGameList(games) {
    gameList.innerHTML = '';
    
    if (games.length === 0) {
        gameList.innerHTML = '<p>No games available</p>';
        return;
    }
    
    games.forEach(game => {
        const gameItem = document.createElement('div');
        gameItem.className = 'game-list-item';
        
        const gameInfo = document.createElement('div');
        gameInfo.innerHTML = `
            <p><strong>Game ID:</strong> ${game.gameId}</p>
            <p><strong>Status:</strong> ${game.status}</p>
            <p><strong>Players:</strong> ${game.players}/2</p>
        `;
        
        const joinBtn = document.createElement('button');
        joinBtn.textContent = 'Join';
        joinBtn.addEventListener('click', () => joinGame(game.gameId));
        
        gameItem.appendChild(gameInfo);
        gameItem.appendChild(joinBtn);
        gameList.appendChild(gameItem);
    });
}

function joinGame(gameId) {
    const joinData = {
        type: 'join',
        gameId: gameId,
        walletAddress: defaultWallet
    };
    
    socket.send(JSON.stringify(joinData));
}

function handleGameCreated(message) {
    currentGameId = message.gameId;
    playerColor = message.color;
    gameDuration = message.duration;
    
    // Initialize timers
    whiteTimeLeft = gameDuration;
    blackTimeLeft = gameDuration;
    
    // Show waiting room
    lobbySection.classList.add('hidden');
    gameSection.classList.add('hidden');
    waitingRoom.classList.remove('hidden');
    
    waitingGameId.textContent = message.gameId;
    waitingPlayerColor.textContent = message.color === 'w' ? 'White' : 'Black';
    
    // Start waiting timer
    startWaitingTimer();
    
    // Initialize chess with starting position
    chess.load(message.fen);
    updateBoard();
}

function handleGameJoined(message) {
    currentGameId = message.gameId;
    playerColor = message.color;
    gameDuration = message.duration;
    
    // Initialize timers
    whiteTimeLeft = gameDuration;
    blackTimeLeft = gameDuration;
    
    // Hide lobby and waiting room, show game
    lobbySection.classList.add('hidden');
    waitingRoom.classList.add('hidden');
    gameSection.classList.remove('hidden');
    
    // Initialize chess with starting position
    chess.load(message.fen);
    updateBoard();
    
    // Set player addresses
    if (playerColor === 'w') {
        whitePlayerAddress.textContent = defaultWallet;
        blackPlayerAddress.textContent = 'Opponent';
        opponentAddress = message.opponent || 'Opponent';
    } else {
        whitePlayerAddress.textContent = 'Opponent';
        blackPlayerAddress.textContent = defaultWallet;
        opponentAddress = message.opponent || 'Opponent';
    }
    
    // Start game timer
    startGameTimer();
    
    // Notify whose turn it is
    const isMyTurn = chess.turn() === playerColor[0];
    showNotification(isMyTurn ? 'Your turn' : 'Opponent\'s turn', 'info');
}

function handlePaired(message) {
    // Similar to handleGameJoined but for paired games
    currentGameId = message.gameId;
    playerColor = message.color;
    gameDuration = message.duration;
    
    // Initialize timers
    whiteTimeLeft = gameDuration;
    blackTimeLeft = gameDuration;
    
    // Hide lobby and waiting room, show game
    lobbySection.classList.add('hidden');
    waitingRoom.classList.add('hidden');
    gameSection.classList.remove('hidden');
    
    // Initialize chess with starting position
    chess.load(message.fen);
    updateBoard();
    
    // Set player addresses
    if (playerColor === 'w') {
        whitePlayerAddress.textContent = defaultWallet;
        blackPlayerAddress.textContent = message.opponent || 'Opponent';
        opponentAddress = message.opponent || 'Opponent';
    } else {
        whitePlayerAddress.textContent = message.opponent || 'Opponent';
        blackPlayerAddress.textContent = defaultWallet;
        opponentAddress = message.opponent || 'Opponent';
    }
    
    // Start game timer
    startGameTimer();
    
    // Notify whose turn it is
    const isMyTurn = chess.turn() === playerColor[0];
    showNotification(isMyTurn ? 'Your turn' : 'Opponent\'s turn', 'info');
}

function startWaitingTimer() {
    let secondsLeft = 300; // 5 minutes
    
    const timer = setInterval(() => {
        secondsLeft--;
        const minutes = Math.floor(secondsLeft / 60);
        const seconds = secondsLeft % 60;
        waitingTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (secondsLeft <= 0) {
            clearInterval(timer);
            showNotification('Waiting time expired', 'error');
            cancelWaiting();
        }
    }, 1000);
}

function startGameTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    gameStartTime = Date.now();
    
    timerInterval = setInterval(() => {
        const timeElapsed = Date.now() - gameStartTime;
        
        if (chess.turn() === 'w') {
            whiteTimeLeft = Math.max(0, gameDuration - timeElapsed);
        } else {
            blackTimeLeft = Math.max(0, gameDuration - timeElapsed);
        }
        
        // Update displays
        whiteTimeDisplay.textContent = formatTime(whiteTimeLeft);
        blackTimeDisplay.textContent = formatTime(blackTimeLeft);
        
        // Check for timeout
        if (whiteTimeLeft <= 0 || blackTimeLeft <= 0) {
            clearInterval(timerInterval);
            const winner = whiteTimeLeft <= 0 ? 'b' : 'w';
            showNotification(`Time out! ${winner === 'w' ? 'White' : 'Black'} wins`, 'info');
        }
    }, 1000);
}

function formatTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function cancelWaiting() {
    if (!currentGameId) return;
    
    // In a real app, you might want to send a cancel message to the server
    waitingRoom.classList.add('hidden');
    lobbySection.classList.remove('hidden');
    currentGameId = null;
    playerColor = null;
}

function resignGame() {
    if (!currentGameId) return;
    
    const resignData = {
        type: 'resign',
        gameId: currentGameId,
        walletAddress: defaultWallet
    };
    
    socket.send(JSON.stringify(resignData));
}

function offerDraw() {
    if (!currentGameId) return;
    
    const drawData = {
        type: 'draw',
        gameId: currentGameId,
        walletAddress: defaultWallet
    };
    
    socket.send(JSON.stringify(drawData));
    showNotification('Draw offered', 'info');
}

function claimCheckmate() {
    if (!currentGameId) return;
    
    const checkmateData = {
        type: 'checkmate',
        gameId: currentGameId,
        walletAddress: defaultWallet
    };
    
    socket.send(JSON.stringify(checkmateData));
}

function sendChatMessage() {
    if (!currentGameId || !chatInput.value.trim()) return;
    
    const chatData = {
        type: 'chat',
        gameId: currentGameId,
        message: chatInput.value.trim(),
        sender: defaultWallet
    };
    
    socket.send(JSON.stringify(chatData));
    chatInput.value = '';
}

function displayChatMessage(message) {
    if (message.gameId !== currentGameId) return;
    
    const chatMessage = document.createElement('div');
    chatMessage.className = `chat-message ${message.sender === 'Server' ? 'server' : ''}`;
    
    const sender = message.sender === defaultWallet ? 'You' : 
                  message.sender === 'Server' ? 'Server' : opponentAddress;
    
    chatMessage.innerHTML = `<strong>${sender}:</strong> ${message.message}`;
    chatMessages.appendChild(chatMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function handleGameEnded(message) {
    clearInterval(timerInterval);
    
    let resultMessage = '';
    if (message.winner) {
        const winnerIsMe = (message.winner === defaultWallet) || 
                         (message.winnerColor === playerColor && message.winner !== 'opponent');
        resultMessage = winnerIsMe ? 'You won!' : 'You lost!';
    } else {
        resultMessage = 'Game ended in a draw';
    }
    
    showNotification(`${resultMessage} (Reason: ${message.reason})`, 'info');
    
    // Return to lobby after 5 seconds
    setTimeout(() => {
        gameSection.classList.add('hidden');
        lobbySection.classList.remove('hidden');
        currentGameId = null;
        playerColor = null;
    }, 5000);
}

function showNotification(message, type) {
    const notificationArea = document.getElementById('notification-area');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationArea.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}