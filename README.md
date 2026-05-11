# Smart Digital Titration System using Arduino and AI

Static GitHub Pages website for an Arduino-based titration project. It shows live pH readings, plots the pH-volume curve, detects the equivalence point using maximum slope, and auto-grades the result.

## Files

- `index.html` - website dashboard and project sections
- `styles.css` - responsive attractive UI
- `app.js` - Web Serial connection, graph, AI endpoint detection, CSV export
- `arduino/smart_titration_system.ino` - Arduino UNO sketch
- `assets/hero-smart-titration.png` - generated hero image for the website

## Arduino Connections

- pH sensor output: `A0`
- Servo signal: `D9`
- LED: `D6` with resistor
- Buzzer: `D7`
- I2C LCD: `SDA/SCL`
- USB cable: power and serial data

## Arduino Setup

1. Open `arduino/smart_titration_system.ino` in Arduino IDE.
2. Install these libraries if needed:
   - `Servo`
   - `Wire`
   - `LiquidCrystal_I2C`
3. Check the LCD address. The sketch uses `0x27`.
4. Calibrate the pH sensor by changing:
   - `voltageAtPh7`
   - `phSlope`
   - `mlPerServoPulse`
5. Upload to Arduino UNO.

## Run Locally

Because Web Serial needs a secure context, use a local server:

```powershell
python -m http.server 5500
```

Open:

```text
http://localhost:5500
```

Use Chrome or Microsoft Edge, then click **Connect Arduino**.

## Serial Format

The dashboard accepts either JSON:

```json
{"ph":7.12,"volume":12.4}
```

or CSV:

```text
7.12,12.4
```

## Publish On GitHub Pages

1. Create a new GitHub repository.
2. Push this folder to the repository.
3. Go to **Settings > Pages**.
4. Under **Build and deployment**, select:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Open the Pages URL in Chrome or Edge.

GitHub Pages uses HTTPS, so Web Serial can work there after the user clicks the connect button.

## Project Features Covered

- Automated titration concept
- Arduino UNO hardware control
- pH sensor live input
- Servo-based burette control
- LCD, LED and buzzer output
- pH vs volume graph
- AI-style maximum slope endpoint detection
- Auto-grading against expected pH and volume
- Applications, limitations and future scope sections
