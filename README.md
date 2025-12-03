# Riftbound: Dominion - Webcam Play Tracker

A premium web application for tracking Riftbound card games using dual webcams with zone overlays and zoom functionality.

![Riftbound: Dominion](uploaded_image_1764732555744.png)

## Features

✨ **Dual Webcam Support** - View both players' tables simultaneously  
🎯 **Zone Overlays** - Based on official Riftbound playmat zones  
🔍 **Hover Zoom** - Magnify zones to read cards clearly  
📊 **Score Tracking** - Track points up to 8 (first to 8 wins)  
🎨 **Premium Design** - Glassmorphism effects with smooth animations  
⌨️ **Keyboard Shortcuts** - Quick controls for faster gameplay  
💾 **Auto-Save** - Scores persist between sessions  

## Quick Start

### 1. Open the Application

Simply open `index.html` in a modern web browser:
- Google Chrome (recommended)
- Microsoft Edge
- Firefox
- Safari

**Or use a local server:**
```powershell
# Using Python
python -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000`

### 2. Grant Camera Permissions

Click **"Start Cameras"** and allow camera access when prompted.

- **Two cameras detected**: Both feeds will display automatically
- **One camera detected**: The camera will be assigned to Player 2

### 3. Enable Zone Overlays

Click **"Toggle Zones"** to show the playmat zone overlays on your camera feeds.

### 4. Start Playing!

- **Hover over zones** to zoom in and read cards
- **Use score buttons** to track points (first to 8 wins)
- **Reset scores** when starting a new game

## Zone Layout

The application uses the standard Riftbound playmat zones:

**For Each Player:**
- **Deck** (left top) - Blue overlay
- **Discard** (left bottom) - Purple overlay
- **Battlefield 1** (center-left) - Cyan overlay
- **Battlefield 2** (center) - Green overlay
- **Battlefield 3** (center-right) - Orange overlay
- **Hand Area** (bottom) - Red overlay

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Q` | Player 1 score +1 |
| `A` | Player 1 score -1 |
| `P` | Player 2 score +1 |
| `L` | Player 2 score -1 |
| `Z` | Toggle zone overlays |
| `R` | Reset scores (with confirmation) |

## Camera Setup Tips

### For Best Results:

1. **Position cameras above tables** - Point straight down for clearest view
2. **Good lighting** - Ensure adequate lighting to read cards
3. **Stable mount** - Use phone stands or tripods to keep cameras steady
4. **Distance** - Position cameras 1-2 feet above the table

### Using Phone Cameras:

You can use your smartphone as a webcam:

**Option 1: DroidCam / EpocCam**
- Install app on phone
- Connect via USB or WiFi
- Browser will detect as camera

**Option 2: Browser on Phone**
- Open the app directly on smartphone
- Use built-in camera
- Share screen if needed

### Two-Player Setup:

- **Player 1**: Camera pointing at their table
- **Player 2**: Camera pointing at their table
- Both cameras display on screen showing opponent's view
- Each player sees the other's table from their perspective

## Technical Details

### Requirements:
- Modern browser with WebRTC support
- Camera access permissions
- Recommended: 720p or higher camera resolution

### Browser Compatibility:
- ✅ Chrome 53+
- ✅ Edge 79+
- ✅ Firefox 36+
- ✅ Safari 11+

### Technologies:
- HTML5 Canvas for zone overlays
- getUserMedia API for webcam access
- CSS Glassmorphism for premium UI
- LocalStorage for score persistence

## Troubleshooting

**❌ "Camera access denied"**
- Check browser permissions (click lock icon in address bar)
- Ensure no other app is using the camera
- Try reloading the page

**❌ "No cameras found"**
- Connect a webcam or enable built-in camera
- Check device manager (Windows) or System Preferences (Mac)
- Try a different browser

**❌ Zones don't align with cards**
- Zones are designed for standard Riftbound playmat
- Toggle zones off if using custom mat
- Adjust camera angle for better alignment

**❌ Zoom not working**
- Ensure zones are enabled first
- Hover directly over zone areas
- Check that camera feed is active

## Customization

### Modifying Zones

Edit `script.js` to customize zone positions:

```javascript
const ZONES = {
    player1: [
        { name: 'Custom Zone', x: 10, y: 10, w: 20, h: 30, color: '#ff0000' }
        // x, y, w, h are percentages (0-100)
    ]
};
```

### Changing Colors

Edit CSS variables in `style.css`:

```css
:root {
    --accent-blue: #4a9eff;
    --accent-purple: #8b5cf6;
    /* Customize colors here */
}
```

## Known Limitations

- Maximum 2 cameras supported
- Requires HTTPS for webcam access (except localhost)
- Zone positions are static (not adjustable via UI)
- No mobile camera switching between front/rear

## Future Enhancements

- [ ] Adjustable zone positions via drag-and-drop
- [ ] Multiple zone presets
- [ ] Screenshot/recording functionality
- [ ] Network play (show cameras to remote opponent)
- [ ] Mobile-optimized layout

## Credits

Created for the **Riftbound: League of Legends Trading Card Game** community.

**Fonts:**
- Orbitron by Matt McInerney
- Exo 2 by Natanael Gama

---

**Enjoy your games!** 🎮✨

For issues or suggestions, feel free to modify the code to suit your needs.
