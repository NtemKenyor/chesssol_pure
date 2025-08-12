document.addEventListener('DOMContentLoaded', () => {
    // Only initialize wallet logic on the index page
    if (document.querySelector('.connect-wallet-page')) {
        initializeWallet();
    }
    
    // Handle wallet disconnection on profile page
    const disconnectBtn = document.getElementById('disconnect-wallet');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectWallet);
    }
    
    // Handle wallet switching on profile page
    const switchBtn = document.getElementById('switch-wallet');
    if (switchBtn) {
        switchBtn.addEventListener('click', () => {
            setCookie('walletAddress', '');
            window.location.href = 'index.html';
        });
    }
});

function initializeWallet() {
    const connectBtn = document.getElementById('connect-wallet-btn');
    const demoBtn = document.getElementById('demo-wallet-btn');
    const proceedBtn = document.getElementById('proceed-btn');
    const connectedSection = document.getElementById('wallet-connected');
    const addressDisplay = document.getElementById('connected-address');
    
    // Check if we have a wallet in cookies
    const savedWallet = getCookie('walletAddress');
    if (savedWallet) {
        // Redirect to the appropriate page
        const redirectTo = getCookie('redirectTo') || 'lobby.html';
        window.location.href = redirectTo;
        return;
    }
    
    // Connect with real wallet (simulated in this demo)
    connectBtn.addEventListener('click', () => {
        const walletAddress = generateWalletAddress();
        setCookie('walletAddress', walletAddress);
        
        addressDisplay.textContent = shortenAddress(walletAddress);
        connectedSection.classList.remove('hidden');
        showNotification('Wallet connected successfully', 'success');
    });
    
    // Use demo wallet
    demoBtn.addEventListener('click', () => {
        const walletAddress = '0xDemoWallet' + Math.random().toString(36).substring(2, 10);
        setCookie('walletAddress', walletAddress);
        
        addressDisplay.textContent = shortenAddress(walletAddress);
        connectedSection.classList.remove('hidden');
        showNotification('Demo wallet created', 'info');
    });
    
    // Proceed to app
    proceedBtn.addEventListener('click', () => {
        const redirectTo = getCookie('redirectTo') || 'lobby.html';
        window.location.href = redirectTo;
    });
}

function generateWalletAddress() {
    const chars = '0123456789abcdef';
    let address = '0x';
    for (let i = 0; i < 40; i++) {
        address += chars[Math.floor(Math.random() * chars.length)];
    }
    return address;
}

function disconnectWallet() {
    setCookie('walletAddress', '');
    window.location.href = 'index.html';
}

// Utility functions from main.js
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function setCookie(name, value, days = 30) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/`;
}

function shortenAddress(address) {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}