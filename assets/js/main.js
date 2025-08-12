// Shared functionality across all pages
document.addEventListener('DOMContentLoaded', () => {
    // Initialize wallet display if on pages that show it
    if (document.getElementById('wallet-address')) {
        displayWalletAddress();
    }
    
    // Set up navigation events
    setupNavigation();
});

// Display the connected wallet address
function displayWalletAddress() {
    const walletAddress = getCookie('walletAddress');
    const displayElement = document.getElementById('wallet-address');
    
    if (walletAddress && displayElement) {
        displayElement.textContent = shortenAddress(walletAddress);
    }
}

// Utility function to get cookie
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// Utility function to set cookie
function setCookie(name, value, days = 30) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/`;
}

// Utility function to shorten wallet address
function shortenAddress(address) {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Setup navigation events
function setupNavigation() {
    // Handle return to lobby button on game end modal
    const returnToLobbyBtn = document.getElementById('return-to-lobby-btn');
    if (returnToLobbyBtn) {
        returnToLobbyBtn.addEventListener('click', () => {
            window.location.href = 'lobby.html';
        });
    }
    
    // Handle profile button click
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            window.location.href = 'profile.html';
        });
    }
}

// Shared WebSocket connection
let socket;

function connectWebSocket() {
    if (socket && socket.readyState === WebSocket.OPEN) return socket;
    
    socket = new WebSocket('ws://localhost:3000/chesssol/backend/ws');
    
    socket.onopen = () => {
        console.log('WebSocket connected');
    };
    
    socket.onclose = () => {
        console.log('WebSocket disconnected');
    };
    
    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    return socket;
}

// Shared notification system
function showNotification(message, type = 'info') {
    const notificationArea = document.getElementById('notification-area') || createNotificationArea();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationArea.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function createNotificationArea() {
    const area = document.createElement('div');
    area.id = 'notification-area';
    area.style.position = 'fixed';
    area.style.bottom = '20px';
    area.style.right = '20px';
    area.style.display = 'flex';
    area.style.flexDirection = 'column';
    area.style.gap = '10px';
    area.style.zIndex = '1000';
    document.body.appendChild(area);
    return area;
}