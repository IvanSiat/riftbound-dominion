// ========== PEER-TO-PEER CONNECTION ==========
let peer = null;
let connection = null;
let myStream = null;
let remoteStream = null;
let roomCode = null;
let isHost = false;

// New variables for Battlefield management
let currentBattlefieldSlot = null; // 'player1' or 'player2'
let battlefieldUrls = {
    player1: null,
    player2: null
};

// ========== FLOATING PANEL DRAGGING ==========
function makeDraggable(panel, header) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        panel.style.top = (panel.offsetTop - pos2) + "px";
        panel.style.left = (panel.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    panel.classList.toggle('minimized');
}

function openRemoteModal() {
    document.getElementById('remote-modal').classList.add('show');
}

function closeRemoteModal() {
    document.getElementById('remote-modal').classList.remove('show');
}

// ========== STATE MANAGEMENT ==========
let scores = {
    player1: 0,  // You
    player2: 0   // Opponent
};
let winningScore = 8;

// Track flip states for each video
const flipStates = {
    'opponent-video': { horizontal: false, vertical: false },
    'your-video': { horizontal: false, vertical: false }
};

// ========== GAME OPTIONS ==========
function toggleAspirantsClimb(broadcast = true) {
    const checkbox = document.getElementById('aspirants-climb');
    winningScore = checkbox.checked ? 9 : 8;

    const winText = document.getElementById('win-condition-text');
    winText.textContent = `First to ${winningScore} Wins`;

    // Re-check winner with new condition
    checkWinner();

    if (broadcast && connection && connection.open) {
        connection.send({
            type: 'winCondition',
            value: checkbox.checked
        });
    }
}

function toggleFlip(videoId, direction) {
    const video = document.getElementById(videoId);

    // Toggle the state for this direction
    flipStates[videoId][direction] = !flipStates[videoId][direction];

    // Apply both transforms together
    const scaleX = flipStates[videoId].horizontal ? -1 : 1;
    const scaleY = flipStates[videoId].vertical ? -1 : 1;

    video.style.transform = `scaleX(${scaleX}) scaleY(${scaleY})`;
}

// ========== PANEL & MODAL INITIALIZATION ==========
window.addEventListener('DOMContentLoaded', function () {
    // Make panels draggable
    makeDraggable(document.getElementById('score-panel'), document.getElementById('score-header'));
    makeDraggable(document.getElementById('notes-panel'), document.getElementById('notes-header'));
    makeDraggable(document.getElementById('search-panel'), document.getElementById('search-header'));

    // Load saved notes
    loadNotes();
});

// ========== NOTEPAD MANAGEMENT ==========
function toggleNotepad() {
    const content = document.getElementById('notepad-content');
    const icon = document.getElementById('notepad-icon');

    content.classList.toggle('collapsed');
    icon.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
}

function saveNotes() {
    const notes = document.getElementById('game-notes').value;
    localStorage.setItem('riftbound-notes', notes);
}

function loadNotes() {
    const savedNotes = localStorage.getItem('riftbound-notes');
    if (savedNotes) {
        const textarea = document.getElementById('game-notes');
        if (textarea) {
            textarea.value = savedNotes;
        }
    }
}

function clearNotes() {
    document.getElementById('game-notes').value = '';
    localStorage.removeItem('riftbound-notes');
}


// ========== ROOM MANAGEMENT ==========
function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function createRoom() {
    try {
        updateConnectionStatus('Creating room...');

        roomCode = generateRoomCode();
        peer = new Peer(roomCode, {
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        isHost = true;

        peer.on('open', async (id) => {
            console.log('Room created:', id);
            document.getElementById('room-code-text').textContent = roomCode;
            document.getElementById('room-display').style.display = 'block';
            updateConnectionStatus('Waiting for opponent...');

            await startCamera();
        });

        peer.on('call', (call) => {
            console.log('Incoming call');
            call.answer(myStream);

            call.on('stream', (stream) => {
                console.log('Received opponent stream');
                remoteStream = stream;
                document.getElementById('opponent-video').srcObject = stream;
                document.getElementById('opponent-placeholder').style.display = 'none';
                document.getElementById('opponent-indicator').classList.add('active');
                updateConnectionStatus('Connected!');
            });
        });

        peer.on('connection', (conn) => {
            connection = conn;
            setupDataConnection();
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);
            updateConnectionStatus('Connection error');
        });

    } catch (error) {
        console.error('Error creating room:', error);
        updateConnectionStatus('Failed to create room');
    }
}

async function joinRoom() {
    const code = document.getElementById('room-code-input').value.trim();
    if (!code || code.length !== 6) {
        alert('Please enter a valid 6-digit room code');
        return;
    }

    try {
        updateConnectionStatus('Joining room...');

        peer = new Peer({
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        isHost = false;

        peer.on('open', async (id) => {
            console.log('Connected to server:', id);
            await startCamera();

            const call = peer.call(code, myStream);

            call.on('stream', (stream) => {
                console.log('Received host stream');
                remoteStream = stream;
                document.getElementById('opponent-video').srcObject = stream;
                document.getElementById('opponent-placeholder').style.display = 'none';
                document.getElementById('opponent-indicator').classList.add('active');
                updateConnectionStatus('Connected!');
            });

            connection = peer.connect(code);
            setupDataConnection();
        });

        peer.on('error', (err) => {
            console.error('Join error:', err);
            updateConnectionStatus('Failed to join room');
            alert('Could not join room. Check the code and try again.');
        });

    } catch (error) {
        console.error('Error joining room:', error);
        updateConnectionStatus('Failed to join');
    }
}

function setupDataConnection() {
    connection.on('open', () => {
        console.log('Data connection established');
        sendScoreUpdate();
        // Send initial battlefield state after connection opens
        if (battlefieldUrls.player1) {
            setBattlefield('player1', battlefieldUrls.player1, true);
        }
    });

    connection.on('data', (data) => {
        console.log('Received data:', data);
        if (data.type === 'score') {
            // Security: Only accept opponent's score, validate it's a number in valid range
            const opponentScore = parseInt(data.score);
            if (!isNaN(opponentScore) && opponentScore >= 0 && opponentScore <= 99) {
                scores.player2 = opponentScore;
                updateScoreDisplay(2, false);
                checkWinner();
            } else {
                console.warn('Invalid score data received:', data);
            }
        } else if (data.type === 'winCondition') {
            const checkbox = document.getElementById('aspirants-climb');
            if (checkbox) {
                checkbox.checked = !!data.value;
                toggleAspirantsClimb(false); // Update local state without broadcasting back
            }
        } else if (data.type === 'reset') {
            resetScores(false); // Reset local state without broadcasting back
        } else if (data.type === 'battlefield') { // Handle incoming battlefield update
            // Opponent sets their battlefield (which is player1 for them), displayed as player2 on our side.
            setBattlefield('player2', data.url, false); // Do not broadcast back
        }
    });

    connection.on('close', () => {
        console.log('Connection closed');
        updateConnectionStatus('Disconnected');
    });
}

function sendScoreUpdate() {
    if (connection && connection.open) {
        connection.send({
            type: 'score',
            score: scores.player1  // Only send YOUR score, opponent will display it as their player2
        });
    }
}

async function startCamera() {
    try {
        myStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        document.getElementById('your-video').srcObject = myStream;
        document.getElementById('your-placeholder').style.display = 'none';
        document.getElementById('your-indicator').classList.add('active');
        document.getElementById('camera-status').innerHTML = '<span class="status-dot active"></span> Camera: On';

    } catch (error) {
        console.error('Camera error:', error);
        alert('Failed to access camera. Please grant permissions.');
    }
}

function updateConnectionStatus(status) {
    const statusEl = document.getElementById('status-text');
    const statusDot = document.querySelector('#connection-status .status-dot');
    statusEl.textContent = status;

    if (status === 'Connected!') {
        statusDot.classList.add('active');
    } else {
        statusDot.classList.remove('active');
    }
}

function copyRoomCode() {
    navigator.clipboard.writeText(roomCode);
    const btn = event.target;
    btn.textContent = '✓ Copied!';
    setTimeout(() => {
        btn.textContent = '📋 Copy Code';
    }, 2000);
}

// ========== SCORE MANAGEMENT ==========
function adjustScore(player, delta) {
    const scoreKey = `player${player}`;
    scores[scoreKey] = Math.max(0, Math.min(99, scores[scoreKey] + delta));
    updateScoreDisplay(player, true);
    checkWinner();
}

function updateScoreDisplay(player, broadcast = true) {
    const scoreEl = document.getElementById(`score${player}`);

    if (scoreEl) {
        scoreEl.textContent = scores[`player${player}`];

        if (scores[`player${player}`] >= winningScore) {
            scoreEl.classList.add('winner-text-highlight');
        } else {
            scoreEl.classList.remove('winner-text-highlight');
        }
    }

    if (broadcast) {
        sendScoreUpdate();
    }
}

function checkWinner() {
    if (scores.player1 >= winningScore) {
        showWinner('You');
    } else if (scores.player2 >= winningScore) {
        showWinner('Opponent');
    }
}

function showWinner(playerName) {
    const modal = document.getElementById('winner-modal');
    const winnerNameEl = document.getElementById('winner-name');
    winnerNameEl.textContent = playerName;
    modal.classList.add('show');
}

function closeModal() {
    document.getElementById('winner-modal').classList.remove('show');
}

function resetScores(broadcast = true) {
    scores.player1 = 0;
    scores.player2 = 0;
    updateScoreDisplay(1, true);
    updateScoreDisplay(2, false);
    document.getElementById('score1').classList.remove('winner-text-highlight');
    document.getElementById('score2').classList.remove('winner-text-highlight');

    resetBattlefields(); // Reset battlefield visuals locally

    if (broadcast && connection && connection.open) {
        connection.send({
            type: 'reset'
        });
    }
}

// ========== INITIALIZATION ==========
// Load notes when page loads
window.addEventListener('DOMContentLoaded', function () {
    loadNotes();
});

console.log('Riftbound: Dominion - Remote Play initialized!');

// ========== CARD SEARCH & BATTLEFIELD SEARCH ==========

function handleSearchKey(event) {
    if (event.key === 'Enter') {
        // If currentBattlefieldSlot is set, run battlefield search, otherwise run card search
        if (currentBattlefieldSlot) {
            searchBattlefields();
        } else {
            searchCards();
        }
    }
}

async function searchCards() {
    const query = document.getElementById('card-search-input').value.trim();
    if (!query) return;

    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div style="color: #888; padding: 10px; text-align: center;">Searching...</div>';

    const API_BASE_URL = "https://api.riftcodex.com/cards/name";

    try {
        const targetUrl = `${API_BASE_URL}?fuzzy=${encodeURIComponent(query)}`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        const cards = Array.isArray(data.items) ? data.items : [];

        if (cards.length === 0) {
            resultsContainer.innerHTML = '<div style="color: #888; padding: 10px; text-align: center;">No cards found.</div>';
            return;
        }

        displaySearchResults(cards, 'card');

    } catch (error) {
        console.error('Search error:', error);

        const errorMessage = error.message.includes('404')
            ? 'API endpoint not found (404). Check the URL.'
            : error.message;

        resultsContainer.innerHTML = `<div style="color: #f87171; padding: 10px; text-align: center;">Error: ${errorMessage}</div>`;
    }
}

// ========== BATTLEFIELD MANAGEMENT (NEW FUNCTIONS) ==========

/**
 * Sets the context for the search panel and opens it for battlefield selection.
 * @param {string} slotKey 'player1' (You) or 'player2' (Opponent).
 */
function openBattlefieldSearch(slotKey) {
    currentBattlefieldSlot = slotKey;

    const searchPanel = document.getElementById('search-panel');
    searchPanel.classList.remove('minimized');

    const headerTitle = document.getElementById('search-header').querySelector('.panel-title');
    headerTitle.textContent = slotKey === 'player1' ? '🛡️ SET YOUR BATTLEFIELD' : '⚔️ SET OPPONENT\'S BATTLEFIELD';

    // Pre-fill input with 'Battlefield' to encourage the correct search.
    document.getElementById('card-search-input').value = 'Battlefield';
    document.getElementById('search-results').innerHTML =
        '<div style="color: #888; padding: 10px; text-align: center;">Press "Go" or Enter to search. Results will be filtered for Battlefields if search term is generic.</div>';
}

/**
 * Searches the API, and conditionally filters results for 'Battlefield' type.
 */
async function searchBattlefields() {
    const query = document.getElementById('card-search-input').value.trim();
    if (!query) return;

    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<div style="color: #888; padding: 10px; text-align: center;">Searching for cards...</div>';

    const API_BASE_URL = "https://api.riftcodex.com/cards/name";

    try {
        const targetUrl = `${API_BASE_URL}?fuzzy=${encodeURIComponent(query)}`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        const allCards = Array.isArray(data.items) ? data.items : [];

        let cardsToDisplay = allCards;

        // **********************************************
        // FIX: Conditional Filter - Only filter if the query is the generic hint 'Battlefield'.
        // If the user types a specific card name, display all results to ensure the card is found.
        // **********************************************
        if (query.toLowerCase() === 'battlefield') {
            cardsToDisplay = allCards.filter(card => {
                const nameLower = (card.name || '').toLowerCase();
                const typeLower = (card.type || '').toLowerCase();

                // Keep cards if type includes 'battlefield' OR if the card's name includes 'battlefield'
                return typeLower.includes('battlefield') || nameLower.includes('battlefield');
            });
        }


        if (cardsToDisplay.length === 0) {
            resultsContainer.innerHTML = '<div style="color: #888; padding: 10px; text-align: center;">No results found. Try a more generic term or check spelling.</div>';
            return;
        }

        // Display results, setting the type to 'battlefield' for selection logic
        displaySearchResults(cardsToDisplay, 'battlefield');

    } catch (error) {
        console.error('Battlefield search error:', error);
        resultsContainer.innerHTML = `<div style="color: #f87171; padding: 10px; text-align: center;">Error: ${error.message}</div>`;
    }
}

/**
 * Sets the battlefield image for a given player slot.
 * @param {string} playerKey 'player1' or 'player2'.
 * @param {string} url The image URL.
 * @param {boolean} broadcast Whether to send the update to the opponent.
 */
function setBattlefield(playerKey, url, broadcast = true) {
    const imgEl = document.getElementById(`battlefield-img-${playerKey}`);
    const placeholderEl = document.getElementById(`battlefield-placeholder-${playerKey}`);

    if (imgEl && placeholderEl) {
        imgEl.src = url;
        imgEl.style.display = 'block';
        placeholderEl.style.display = 'none';
        battlefieldUrls[playerKey] = url;

        // If it's YOUR battlefield, and connection is open, broadcast the update
        if (broadcast && playerKey === 'player1' && connection && connection.open) {
            connection.send({
                type: 'battlefield',
                url: url
            });
        }
    }
}

/**
 * Resets the battlefield image slots.
 */
function resetBattlefields() {
    // Reset player 1 (You)
    document.getElementById('battlefield-img-player1').style.display = 'none';
    document.getElementById('battlefield-placeholder-player1').style.display = 'block';
    battlefieldUrls.player1 = null;

    // Reset player 2 (Opponent)
    document.getElementById('battlefield-img-player2').style.display = 'none';
    document.getElementById('battlefield-placeholder-player2').style.display = 'block';
    battlefieldUrls.player2 = null;

    // Reset search context
    currentBattlefieldSlot = null;
    document.getElementById('search-panel').querySelector('.panel-title').textContent = '🔍 Card Search';
}

// ========== DISPLAY & PREVIEW (UPDATED) ==========

/**
 * Displays search results and attaches the appropriate click handler.
 * @param {Array} cards - Array of card objects.
 * @param {string} [type='card'] - 'card' for preview, 'battlefield' for selection.
 */
function displaySearchResults(cards, type = 'card') {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    if (!Array.isArray(cards) || cards.length === 0) {
        resultsContainer.innerHTML = '<div style="color: #888; padding: 10px; text-align: center;">No items found.</div>';
        return;
    }

    cards.forEach(card => {
        const el = document.createElement('div');
        el.className = 'search-result-item';

        const imageUrl = card.media?.image_url ||
            card.image ||
            card.image_url ||
            card.imageUrl ||
            'https://via.placeholder.com/40x56?text=?';

        el.innerHTML = `
            <img src="${imageUrl}" class="result-thumb" alt="${card.name}">
            <div class="result-info">
                <div class="result-name">${card.name}</div>
                <div class="result-type">${card.type || ''}</div>
            </div>
        `;

        // Conditional click handler
        if (type === 'battlefield' && currentBattlefieldSlot) {
            el.onclick = () => {
                // Set the image in the selected slot
                setBattlefield(currentBattlefieldSlot, imageUrl, true);

                // Close/minimize the search panel and reset context
                togglePanel('search-panel');
                currentBattlefieldSlot = null;
                document.getElementById('search-header').querySelector('.panel-title').textContent = '🔍 Card Search';
            };
        } else {
            // Default to card preview
            el.onclick = () => showCardPreview(imageUrl);
        }

        resultsContainer.appendChild(el);
    });
}

function showCardPreview(imageUrl) {
    const overlay = document.getElementById('card-preview-overlay');
    const img = document.getElementById('preview-image');
    img.src = imageUrl;
    img.classList.remove('zoomed'); // Reset zoom
    overlay.classList.add('show');
}

function closeCardPreview() {
    document.getElementById('card-preview-overlay').classList.remove('show');
}

function toggleCardZoom() {
    const img = document.getElementById('preview-image');
    img.classList.toggle('zoomed');
}