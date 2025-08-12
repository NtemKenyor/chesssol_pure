document.addEventListener('DOMContentLoaded', () => {
    // Initialize WebSocket connection
    const socket = connectWebSocket();
    
    // Get wallet address
    const walletAddress = getCookie('walletAddress');
    if (!walletAddress) {
        window.location.href = 'index.html';
        return;
    }
    
    // Get game ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('gameId');
    
    if (!gameId) {
        showNotification('No game ID provided', 'error');
        setTimeout(() => window.location.href = 'lobby.html', 2000);
        return;
    }
    
    // Initialize chess board
    const chess = new Chess();
    let selectedSquare = null;
    let playerColor = null;
    let gameDuration = 300000; // 5 minutes in ms
    let whiteTimeLeft = gameDuration;
    let blackTimeLeft = gameDuration;
    let gameStartTime = null;
    let timerInterval = null;
    let opponentAddress = null;
    
    // DOM elements
    const chessboard = document.getElementById('chessboard');
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
    const gameTitle = document.getElementById('game-title');
    
    // Set game title
    gameTitle.textContent = `Game ${gameId.substring(0, 8)}`;
    
    // Initialize board
    initializeChessboard();
    
    // Set up event listeners
    resignBtn.addEventListener('click', resignGame);
    offerDrawBtn.addEventListener('click', offerDraw);
    claimCheckmateBtn.addEventListener('click', claimCheckmate);
    sendChatBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    
    // Request game state from server
    const stateRequest = {
        type: 'stateGame',
        gameId: gameId
    };
    
    socket.send(JSON.stringify(stateRequest));
    
    // Handle WebSocket messages
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleSocketMessage(message);
    };
    
    function handleSocketMessage(message) {
        if (message.gameId && message.gameId !== gameId) return;
        
        switch(message.type) {
            case 'gameState':
                handleGameState(message.game);
                break;
            case 'joined':
                handleGameJoined(message);
                break;
            case 'move':
                handleMove(message);
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
    
    function handleGameState(gameState) {
        // Initialize game with state from server
        chess.load(gameState.fen);
        playerColor = gameState.color;
        gameDuration = gameState.duration;
        whiteTimeLeft = gameDuration;
        blackTimeLeft = gameDuration;
        
        // Set player addresses
        if (playerColor === 'w') {
            whitePlayerAddress.textContent = shortenAddress(walletAddress);
            blackPlayerAddress.textContent = gameState.opponent ? shortenAddress(gameState.opponent) : 'Waiting...';
            opponentAddress = gameState.opponent;
        } else {
            whitePlayerAddress.textContent = gameState.opponent ? shortenAddress(gameState.opponent) : 'Waiting...';
            blackPlayerAddress.textContent = shortenAddress(walletAddress);
            opponentAddress = gameState.opponent;
        }
        
        // Start game timer
        startGameTimer();
        updateBoard();
        
        // Notify whose turn it is
        const isMyTurn = chess.turn() === playerColor[0];
        showNotification(isMyTurn ? 'Your turn' : 'Opponent\'s turn', 'info');
    }
    
    function handleGameJoined(message) {
        // Similar to handleGameState but for when joining a game
        chess.load(message.fen);
        playerColor = message.color;
        gameDuration = message.duration;
        whiteTimeLeft = gameDuration;
        blackTimeLeft = gameDuration;
        
        // Set player addresses
        if (playerColor === 'w') {
            whitePlayerAddress.textContent = shortenAddress(walletAddress);
            blackPlayerAddress.textContent = message.opponent ? shortenAddress(message.opponent) : 'Waiting...';
            opponentAddress = message.opponent;
        } else {
            whitePlayerAddress.textContent = message.opponent ? shortenAddress(message.opponent) : 'Waiting...';
            blackPlayerAddress.textContent = shortenAddress(walletAddress);
            opponentAddress = message.opponent;
        }
        
        // Start game timer
        startGameTimer();
        updateBoard();
        
        // Notify whose turn it is
        const isMyTurn = chess.turn() === playerColor[0];
        showNotification(isMyTurn ? 'Your turn' : 'Opponent\'s turn', 'info');
    }
    
    function handleMove(message) {
        // Update local chess state
        chess.load(message.fen);
        updateBoard();
        
        // Update turn indicator
        if (playerColor) {
            const isMyTurn = chess.turn() === playerColor[0];
            showNotification(isMyTurn ? 'Your turn' : 'Opponent\'s turn', 'info');
        }
    }
    
    function handleGameEnded(message) {
        clearInterval(timerInterval);
        
        const gameEndModal = document.getElementById('game-end-modal');
        const gameEndTitle = document.getElementById('game-end-title');
        const gameEndMessage = document.getElementById('game-end-message');
        
        if (message.winner) {
            const winnerIsMe = (message.winner === walletAddress) || 
                             (message.winnerColor === playerColor && message.winner !== 'opponent');
            
            gameEndTitle.textContent = winnerIsMe ? 'You Won!' : 'You Lost!';
            gameEndMessage.textContent = `Game ended by ${message.reason}`;
        } else {
            gameEndTitle.textContent = 'Game Ended';
            gameEndMessage.textContent = `The game ended in a draw (${message.reason})`;
        }
        
        gameEndModal.classList.remove('hidden');
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
            gameId: gameId,
            walletAddress: walletAddress,
            move: `${move.from}${move.to}`,
            fen: chess.fen(),
            clientTime: Date.now(),
            initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        };
        
        socket.send(JSON.stringify(moveData));
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
    
    function resignGame() {
        const resignData = {
            type: 'resign',
            gameId: gameId,
            walletAddress: walletAddress
        };
        
        socket.send(JSON.stringify(resignData));
        showNotification('You resigned from the game', 'info');
    }
    
    function offerDraw() {
        const drawData = {
            type: 'draw',
            gameId: gameId,
            walletAddress: walletAddress
        };
        
        socket.send(JSON.stringify(drawData));
        showNotification('Draw offered to opponent', 'info');
    }
    
    function claimCheckmate() {
        const checkmateData = {
            type: 'checkmate',
            gameId: gameId,
            walletAddress: walletAddress
        };
        
        socket.send(JSON.stringify(checkmateData));
        showNotification('Checkmate claimed', 'info');
    }
    
    function sendChatMessage() {
        if (!chatInput.value.trim()) return;
        
        const chatData = {
            type: 'chat',
            gameId: gameId,
            message: chatInput.value.trim(),
            sender: walletAddress
        };
        
        socket.send(JSON.stringify(chatData));
        chatInput.value = '';
    }
    
    function displayChatMessage(message) {
        const chatMessage = document.createElement('div');
        chatMessage.className = `chat-message ${message.sender === 'Server' ? 'server' : ''}`;
        
        const sender = message.sender === walletAddress ? 'You' : 
                      message.sender === 'Server' ? 'Server' : 
                      opponentAddress ? shortenAddress(opponentAddress) : 'Opponent';
        
        chatMessage.innerHTML = `<strong>${sender}:</strong> ${message.message}`;
        chatMessages.appendChild(chatMessage);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});