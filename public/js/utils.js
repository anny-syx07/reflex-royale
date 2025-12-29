// Shared Utilities for Reflex Royale
// Common functions used across host and player clients

/**
 * Render leaderboard to a container
 * @param {Array} leaderboard - Array of player objects with {nickname, score}
 * @param {HTMLElement} container - Container element to render into
 */
function renderLeaderboard(leaderboard, container) {
    const fragment = document.createDocumentFragment();

    leaderboard.forEach((player, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        if (index < 3) item.classList.add(`rank-${index + 1}`);

        item.innerHTML = `
      <div class="rank rank-${index + 1}">#${index + 1}</div>
      <div class="player-name">${player.nickname}</div>
      <div class="player-score">${player.score}</div>
    `;

        fragment.appendChild(item);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
}

/**
 * Clean up socket listeners and page state before navigation
 * @param {Socket} socket - Socket.io instance
 */
function cleanupBeforeRedirect(socket) {
    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
    }
    document.body.className = ''; // Clear all body classes
}

/**
 * Show error message to user
 * @param {string} message - Error message to display
 * @param {HTMLElement} errorElement - Error message element
 * @param {number} duration - How long to show (ms), default 3000
 */
function showError(message, errorElement, duration = 3000) {
    if (!errorElement) return;

    errorElement.textContent = message;
    errorElement.classList.remove('hidden');

    setTimeout(() => {
        errorElement.classList.add('hidden');
    }, duration);
}

/**
 * Cache commonly accessed DOM elements
 * @param {Object} selectors - Object mapping names to CSS selectors
 * @returns {Object} Object with cached DOM elements
 */
function cacheElements(selectors) {
    const cached = {};
    for (const [name, selector] of Object.entries(selectors)) {
        cached[name] = document.getElementById(selector) || document.querySelector(selector);
    }
    return cached;
}

/**
 * Safely redirect to a URL with cleanup
 * @param {string} url - URL to redirect to
 * @param {Socket} socket - Socket to cleanup
 */
function safeRedirect(url, socket) {
    cleanupBeforeRedirect(socket);
    window.location.href = url;
}
