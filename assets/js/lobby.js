document.addEventListener('DOMContentLoaded', () => {
    // Initialize WebSocket connection
    const socket = connectWebSocket();
    
    // Get wallet address
    const walletAddress = getCookie('walletAddress');
    if (!walletAddress) {
        window.location.href = 'index.html';
        return;
    }
    
    // Set up UI elements
    const createGameBtn = document.getElementById('create-game-btn');
    const joinRandomBtn = document.getElementById('join-random-btn');
    const refreshGamesBtn = document.getElementById('refresh-games-btn');
    const gameList = document.getElementById('game-list');
    const activeGameList = document.getElementById('active-game-list');
    const gameCreationModal = document.getElementById('game-creation-modal');
    const closeModalBtn = document.querySelector('.close-btn');
    const gameCreationForm = document.getElementById('game-creation-form');
    const isBettingCheckbox = document.getElementById('is-betting');
    const bettingOptions = document.getElementById('betting-options');
    
    // Set up event listeners
    createGameBtn.addEventListener('click', () => {
        gameCreationModal.classList.remove('hidden');
    });
    
    joinRandomBtn.addEventListener('click', joinRandomGame);
    refreshGamesBtn.addEventListener('click', listAvailableGames);
    closeModalBtn.addEventListener('click', () => {
        gameCreationModal.classList.add('hidden');
    });
    
    isBettingCheckbox.addEventListener('change', () => {
        bettingOptions.classList.toggle('hidden', !isBettingCheckbox.checked);
    });
    
    gameCreationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        createNewGame();
    });
    
    // Load initial data
    listAvailableGames();
    // In a real app, you'd also load active games for this player
    
    // Handle WebSocket messages
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleSocketMessage(message);
    };
    
    function handleSocketMessage(message) {
        console.log('Received message:', message);
        
        switch(message.type) {
            case 'gameList':
                updateGameList(message.games);
                break;
            case 'created':
                handleGameCreated(message);
                break;
            case 'paired':
                handlePaired(message);
                break;
            case 'error':
                showNotification(message.message, 'error');
                break;
            default:
                console.log('Unhandled message type:', message.type);
        }
    }
    
    function listAvailableGames() {
        const request = {
            type: 'listGames'
        };
        
        socket.send(JSON.stringify(request));
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
            joinBtn.className = 'btn-primary btn-small';
            joinBtn.textContent = 'Join';
            joinBtn.addEventListener('click', () => joinGame(game.gameId));
            
            gameItem.appendChild(gameInfo);
            gameItem.appendChild(joinBtn);
            gameList.appendChild(gameItem);
        });
    }
    
    function joinRandomGame() {
        const pairRequest = {
            type: 'pairRequest',
            walletAddress: walletAddress,
            side: 'random',
            isBetting: false
        };
        
        socket.send(JSON.stringify(pairRequest));
        showNotification('Searching for an opponent...', 'info');
    }
    
    function joinGame(gameId) {
        const joinData = {
            type: 'join',
            gameId: gameId,
            walletAddress: walletAddress
        };
        
        socket.send(JSON.stringify(joinData));
    }
    
    function createNewGame() {
        const side = document.getElementById('game-side').value;
        const duration = parseInt(document.getElementById('game-duration').value) * 60000; // Convert to ms
        const category = document.getElementById('game-category').value;
        const isBetting = document.getElementById('is-betting').checked;
        const betAmount = isBetting ? parseFloat(document.getElementById('bet-amount').value) : null;
        
        const gameData = {
            type: 'create',
            walletAddress: walletAddress,
            side: side,
            duration: duration,
            cat: category
        };
        
        if (isBetting) {
            gameData.isBetting = true;
            gameData.playerAmount = betAmount;
            gameData.transactionId = 'simulated_tx_' + Math.random().toString(36).substring(2);
        }
        
        socket.send(JSON.stringify(gameData));
        gameCreationModal.classList.add('hidden');
    }
    
    function handleGameCreated(message) {
        // Redirect to game page
        window.location.href = `game.html?gameId=${message.gameId}`;
    }
    
    function handlePaired(message) {
        // Redirect to game page
        window.location.href = `game.html?gameId=${message.gameId}`;
    }
});