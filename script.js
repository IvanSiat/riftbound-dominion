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

// MIGHT STATE - 4 separate counters
// your_you: Your might on Your Battlefield
// your_them: Opponent might on Your Battlefield
// opp_you: Your might on Opponent Battlefield
// opp_them: Opponent might on Opponent Battlefield
let mightScores = {
    your_you: 0,
    your_them: 0,
    opp_you: 0,
    opp_them: 0
};

let winningScore = 8;

// Track flip states for each video
const flipStates = {
    'opponent-video': { horizontal: false, vertical: false }
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

        // Sync initial might states for our counters
        sendMightUpdate('your_you');
        sendMightUpdate('opp_you');

        // Send initial battlefield state after connection opens
        if (battlefieldUrls.player1) {
            setBattlefield('player1', battlefieldUrls.player1, true);
        }
    });

    connection.on('data', (data) => {
        console.log('Received data:', data);
        if (data.type === 'score') {
            const opponentScore = parseInt(data.score);
            if (!isNaN(opponentScore) && opponentScore >= 0 && opponentScore <= 99) {
                scores.player2 = opponentScore;
                updateScoreDisplay(2, false);
                checkWinner();
            }
        } else if (data.type === 'might') {
            // MIGHT SYNC LOGIC
            // When Opponent sends 'your_you' (Their might on their field), it maps to our 'opp_them' (Opponent might on Opponent field)
            // When Opponent sends 'opp_you' (Their might on our field), it maps to our 'your_them' (Opponent might on Your field)

            const val = parseInt(data.value);
            if (!isNaN(val)) {
                if (data.key === 'your_you') {
                    // They updated their home might -> Update our "opp_them"
                    mightScores.opp_them = val;
                    updateMightDisplay('opp_them', false);
                } else if (data.key === 'opp_you') {
                    // They updated their away might -> Update our "your_them"
                    mightScores.your_them = val;
                    updateMightDisplay('your_them', false);
                }
            }
        } else if (data.type === 'winCondition') {
            const checkbox = document.getElementById('aspirants-climb');
            if (checkbox) {
                checkbox.checked = !!data.value;
                toggleAspirantsClimb(false);
            }
        } else if (data.type === 'reset') {
            resetScores(false);
        } else if (data.type === 'battlefield') {
            setBattlefield('player2', data.url, false);
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
            score: scores.player1
        });
    }
}

function sendMightUpdate(key) {
    if (connection && connection.open) {
        // We only broadcast 'your_you' and 'opp_you' (our moves)
        // The receiver does the mapping
        if (key === 'your_you' || key === 'opp_you') {
            connection.send({
                type: 'might',
                key: key,
                value: mightScores[key]
            });
        }
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

// ========== MIGHT MANAGEMENT (UPDATED) ==========
// Keys: 'your_you', 'your_them', 'opp_you', 'opp_them'

/**
 * Adjusts a might counter value or sets it directly.
 * @param {string} key - The might key ('your_you', 'your_them', etc.)
 * @param {number} delta - The amount to change the value by (ignored if newValue is set).
 * @param {number|null} newValue - Specific value to set (optional).
 */
function adjustMight(key, delta, newValue = null) {
    let newMight;

    if (newValue !== null) {
        newMight = newValue;
    } else {
        newMight = mightScores[key] + delta;
    }

    // Clamp to 0-999 range
    mightScores[key] = Math.max(0, Math.min(999, newMight));

    // Broadcast if it's one of our counters ('your_you', 'opp_you')
    const shouldBroadcast = (key === 'your_you' || key === 'opp_you');

    // Update the DOM and potentially broadcast
    updateMightDisplay(key, shouldBroadcast);
}

/**
 * Replaces the might span with a number input field for manual entry.
 * @param {HTMLElement} spanElement - The span containing the current might value.
 * @param {string} key - The might key ('your_you' or 'opp_you').
 */
function activateMightInput(spanElement, key) {
    // Restriction check (though already restricted in HTML)
    if (key !== 'your_you' && key !== 'opp_you') {
        return;
    }

    const currentValue = mightScores[key];
    const parent = spanElement.parentNode;

    // Check if an input is already active to prevent re-activation
    if (parent.querySelector('.might-input-active')) {
        return;
    }

    // Create the input element
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'might-input-active'; // New class for styling
    input.value = currentValue;
    input.min = 0;
    input.max = 999;

    // Set a data attribute to store the original key
    input.setAttribute('data-might-key', key);

    // Replace the span with the input
    parent.replaceChild(input, spanElement);
    input.focus();
    input.select(); // Select the number for easy overtyping

    // Define the function to save and revert
    const saveAndRevert = () => {
        const key = input.getAttribute('data-might-key');
        let newValue = parseInt(input.value);

        // Input validation
        if (isNaN(newValue) || newValue < 0) {
            newValue = 0;
        } else if (newValue > 999) {
            newValue = 999;
        }

        // Use adjustMight with a specific newValue to set the score directly
        adjustMight(key, 0, newValue);
    };

    // Handle blur (focus lost)
    input.onblur = saveAndRevert;

    // Handle Enter key press
    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur(); // Trigger the onblur event to save and revert
        }
    };
}

/**
 * Resets a single Might counter to 0.
 * @param {string} key - The might key ('your_you', 'your_them', etc.)
 */
function resetMight(key) {
    // Only reset if not already 0
    if (mightScores[key] !== 0) {
        // Use adjustMight to set the score to 0 directly
        adjustMight(key, 0, 0);
    }
}

/**
 * Updates the display for a single might counter, recreating the span if an input was active.
 * **FIXED LOGIC**: Finds the correct parent element by checking for either the original span or the active input.
 * @param {string} key - The might key.
 * @param {boolean} broadcast - Whether to send the update to the opponent.
 */
function updateMightDisplay(key, broadcast = true) {
    // Map internal keys to DOM IDs
    const domId = `might-${key.replace('_', '-')}`;

    // 1. Try to find the original span element (if not replaced by input)
    const el = document.getElementById(domId);

    // 2. Try to find the active input element (if it has replaced the span)
    // We use the data-might-key attribute to ensure we find the correct active input.
    const activeInput = document.querySelector(`.might-input-active[data-might-key="${key}"]`);

    // 3. Determine the element being tracked and its parent
    let targetEl = el || activeInput;

    if (!targetEl) {
        console.warn(`Could not find DOM element for key: ${key}. Update aborted.`);
        if (broadcast) {
            sendMightUpdate(key);
        }
        return;
    }

    // The parent element is the .might-pill wrapper (this is now safe because targetEl is not null)
    const parentEl = targetEl.parentNode;

    // Logic to handle replacement of active input with a new span
    if (activeInput) {
        // If an input is currently active (targetEl === activeInput), replace it with the updated span
        const newSpan = document.createElement('span');
        newSpan.id = domId;
        newSpan.className = 'might-val';
        newSpan.textContent = mightScores[key];

        // Re-add the click handler, but only for the user's modifiable counters
        if (key === 'your_you' || key === 'opp_you') {
            newSpan.setAttribute('onclick', `activateMightInput(this, '${key}')`);
        }

        parentEl.replaceChild(newSpan, activeInput);

    } else if (el) {
        // Normal update if it's already a span (targetEl === el)
        el.textContent = mightScores[key];
    }

    if (broadcast) {
        sendMightUpdate(key);
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

    // Reset all might
    mightScores = { your_you: 0, your_them: 0, opp_you: 0, opp_them: 0 };

    updateScoreDisplay(1, true);
    updateScoreDisplay(2, false);

    // Update visuals for all 4 might counters
    ['your_you', 'your_them', 'opp_you', 'opp_them'].forEach(k => {
        // Use adjustMight with newValue=0 to ensure the active input is reverted if needed
        adjustMight(k, 0, 0);
    });

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
 * Handles the click event for a battlefield slot.
 * Opens search for selection OR shows preview if already set.
 * @param {string} slotKey 'player1' (You) or 'player2' (Opponent).
 */
function handleBattlefieldSlotClick(slotKey) {
    const currentUrl = battlefieldUrls[slotKey];

    if (currentUrl) {
        // If a battlefield is set, show a large preview
        showCardPreview(currentUrl);
        return;
    }

    // If no battlefield is set, proceed to open the search panel (only for player1)
    if (slotKey === 'player1') {
        openBattlefieldSearch(slotKey);
    } else {
        alert("The opponent has not yet set their Battlefield.");
    }
}

/**
 * Sets the context for the search panel and opens it for battlefield selection.
 * @param {string} slotKey 'player1' (You) or 'player2' (Opponent).
 */
function openBattlefieldSearch(slotKey) {
    // 1. Slot check: Only allow setting your own battlefield
    if (slotKey !== 'player1') {
        alert("You can only set your own Battlefield. The opponent's Battlefield is set remotely.");
        return;
    }

    // 2. Block if NOT connected
    if (!connection || !connection.open) {
        alert("You must be connected to an opponent to set your Battlefield. Please use the '🌐 Remote Play' button to connect first.");
        return;
    }

    // 3. Block if already set
    if (battlefieldUrls.player1) {
        alert("Your Battlefield is already set. Hit 'Reset Game' to change it.");
        return;
    }

    currentBattlefieldSlot = slotKey;

    const searchPanel = document.getElementById('search-panel');
    searchPanel.classList.remove('minimized');

    const headerTitle = document.getElementById('search-header').querySelector('.panel-title');
    headerTitle.textContent = '🛡️ SET YOUR BATTLEFIELD'; // Simplified, since only player1 can set

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

        // Conditional Filter - Only filter if the query is the generic hint 'Battlefield'.
        if (query.toLowerCase() === 'battlefield') {
            cardsToDisplay = allCards.filter(card => {
                const nameLower = (card.name || '').toLowerCase();
                const typeLower = (card.type || '').toLowerCase();

                // Keep cards if type includes 'battlefield' OR if the card's name includes 'battlefield'
                return typeLower.includes('battlefield') || nameLower.includes('battlefield') || card.classification?.type === "Battlefield";
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

        // NEW CHECK: Check for the specific Battlefield classification
        const isBattlefieldCard = card.classification?.type === "Battlefield";

        el.innerHTML = `
            <img src="${imageUrl}" class="result-thumb" alt="${card.name}">
            <div class="result-info">
                <div class="result-name">${card.name}</div>
                <div class="result-type">
                    ${card.classification?.type || ''}
                    ${type === 'battlefield' && !isBattlefieldCard ? '<span style="color:var(--accent-red);">(Not a Battlefield)</span>' : ''}
                </div>
            </div>
        `;

        // Default click handler is always to show a preview
        el.onclick = () => showCardPreview(imageUrl);

        // Conditional logic for selection - only if type is battlefield and it is a VALID card
        if (type === 'battlefield' && currentBattlefieldSlot && isBattlefieldCard) {

            // OVERRIDE default preview handler with selection handler
            el.onclick = () => {
                // Set the image in the selected slot
                setBattlefield(currentBattlefieldSlot, imageUrl, true);

                // Close/minimize the search panel and reset context
                togglePanel('search-panel');
                currentBattlefieldSlot = null;
                document.getElementById('search-header').querySelector('.panel-title').textContent = '🔍 Card Search';
            };

            // Add a visual cue for selectable item
            el.style.borderColor = 'var(--accent-green)';
            el.style.cursor = 'pointer';

        } else if (type === 'battlefield' && currentBattlefieldSlot && !isBattlefieldCard) {
            // If it's the battlefield search context but the card is invalid, dim it visually.
            el.style.opacity = '0.7';
            el.style.cursor = 'help'; // Indicate to the user that this item is not primarily selectable
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