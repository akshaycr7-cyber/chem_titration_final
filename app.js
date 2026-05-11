const connectBtn = document.querySelector("#connectBtn");
const disconnectBtn = document.querySelector("#disconnectBtn");
const startBtn = document.querySelector("#startBtn");
const stopBtn = document.querySelector("#stopBtn");
const simulateBtn = document.querySelector("#simulateBtn");
const clearBtn = document.querySelector("#clearBtn");
const downloadBtn = document.querySelector("#downloadBtn");
const connectionDot = document.querySelector("#connectionDot");
const connectionText = document.querySelector("#connectionText");
const phValue = document.querySelector("#phValue");
const volumeValue = document.querySelector("#volumeValue");
const endpointValue = document.querySelector("#endpointValue");
const gradeValue = document.querySelector("#gradeValue");
const sampleCount = document.querySelector("#sampleCount");
const analysisText = document.querySelector("#analysisText");
const logList = document.querySelector("#logList");
const expectedPh = document.querySelector("#expectedPh");
const expectedVolume = document.querySelector("#expectedVolume");
const gradeMode = document.querySelector("#gradeMode");
const canvas = document.querySelector("#graphCanvas");
const ctx = canvas.getContext("2d");

let port;
let reader;
let writer;
let keepReading = false;
let simulationTimer;
let data = [];

const graph = {
  left: 64,
  right: 24,
  top: 30,
  bottom: 58
};

function setConnected(isConnected) {
  connectionDot.classList.toggle("is-online", isConnected);
  connectionText.textContent = isConnected ? "Arduino connected" : "Not connected";
  connectBtn.disabled = isConnected;
  disconnectBtn.disabled = !isConnected;
  startBtn.disabled = !isConnected;
  stopBtn.disabled = !isConnected;
}

function addLog(message) {
  const item = document.createElement("div");
  item.className = "log-entry";
  item.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
  logList.prepend(item);
  while (logList.children.length > 8) {
    logList.lastElementChild.remove();
  }
}

function parseReading(line) {
  const cleaned = line.trim();
  if (!cleaned) return null;

  try {
    const parsed = JSON.parse(cleaned);
    const ph = Number(parsed.ph ?? parsed.pH);
    const volume = Number(parsed.volume ?? parsed.ml ?? parsed.mL);
    if (Number.isFinite(ph) && Number.isFinite(volume)) {
      return { ph, volume };
    }
  } catch {
    // Fall through to CSV parsing.
  }

  const parts = cleaned.split(/[,\t ]+/).map(Number);
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return { ph: parts[0], volume: parts[1] };
  }

  return null;
}

function addReading(reading) {
  const sample = {
    ph: clamp(reading.ph, 0, 14),
    volume: Math.max(0, reading.volume),
    time: new Date()
  };
  data.push(sample);
  data.sort((a, b) => a.volume - b.volume);
  updateDashboard();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function detectEndpoint(samples) {
  if (samples.length < 3) return null;

  let best = null;
  for (let i = 1; i < samples.length; i += 1) {
    const previous = samples[i - 1];
    const current = samples[i];
    const deltaVolume = current.volume - previous.volume;
    if (deltaVolume <= 0) continue;

    const slope = Math.abs((current.ph - previous.ph) / deltaVolume);
    if (!best || slope > best.slope) {
      best = {
        slope,
        ph: (current.ph + previous.ph) / 2,
        volume: (current.volume + previous.volume) / 2
      };
    }
  }

  return best;
}

function calculateGrade(endpoint) {
  if (!endpoint) return null;

  const targetPh = Number(expectedPh.value);
  const targetVolume = Number(expectedVolume.value);
  const mode = gradeMode.value;
  const tolerance = mode === "strict" ? 0.65 : mode === "lenient" ? 1.5 : 1;

  const phError = Math.abs(endpoint.ph - targetPh);
  const volumeError = Math.abs(endpoint.volume - targetVolume);
  const normalizedError = phError / tolerance + volumeError / (2.5 * tolerance);

  return clamp(Math.round((10 - normalizedError * 2) * 10) / 10, 0, 10);
}

function updateDashboard() {
  const latest = data.at(-1);
  const endpoint = detectEndpoint(data);
  const grade = calculateGrade(endpoint);

  phValue.textContent = latest ? latest.ph.toFixed(2) : "--";
  volumeValue.textContent = latest ? `${latest.volume.toFixed(2)} mL` : "-- mL";
  sampleCount.textContent = `${data.length} sample${data.length === 1 ? "" : "s"}`;

  if (endpoint) {
    endpointValue.textContent = `${endpoint.volume.toFixed(2)} mL`;
    gradeValue.textContent = `${grade}/10`;
    analysisText.textContent =
      `Maximum slope detected near ${endpoint.volume.toFixed(2)} mL at pH ${endpoint.ph.toFixed(2)}. ` +
      `This is treated as the equivalence point for auto-grading.`;
  } else {
    endpointValue.textContent = "Waiting";
    gradeValue.textContent = "--/10";
    analysisText.textContent = "Add readings to let the AI-style slope detector identify the equivalence point.";
  }

  drawGraph(endpoint);
}

function drawGraph(endpoint) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fbfdfc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const plotWidth = canvas.width - graph.left - graph.right;
  const plotHeight = canvas.height - graph.top - graph.bottom;
  const maxVolume = Math.max(30, ...data.map((point) => point.volume)) * 1.05;
  const minPh = 0;
  const maxPh = 14;

  const xFor = (volume) => graph.left + (volume / maxVolume) * plotWidth;
  const yFor = (ph) => graph.top + (1 - (ph - minPh) / (maxPh - minPh)) * plotHeight;

  ctx.strokeStyle = "#dce6e2";
  ctx.lineWidth = 1;
  ctx.font = "14px system-ui";
  ctx.fillStyle = "#5e6c73";

  for (let ph = 0; ph <= 14; ph += 2) {
    const y = yFor(ph);
    ctx.beginPath();
    ctx.moveTo(graph.left, y);
    ctx.lineTo(canvas.width - graph.right, y);
    ctx.stroke();
    ctx.fillText(String(ph), 24, y + 5);
  }

  for (let volume = 0; volume <= maxVolume; volume += Math.max(5, Math.round(maxVolume / 6))) {
    const x = xFor(volume);
    ctx.beginPath();
    ctx.moveTo(x, graph.top);
    ctx.lineTo(x, canvas.height - graph.bottom);
    ctx.stroke();
    ctx.fillText(String(Math.round(volume)), x - 8, canvas.height - 24);
  }

  ctx.strokeStyle = "#17242b";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(graph.left, graph.top);
  ctx.lineTo(graph.left, canvas.height - graph.bottom);
  ctx.lineTo(canvas.width - graph.right, canvas.height - graph.bottom);
  ctx.stroke();

  ctx.fillStyle = "#102026";
  ctx.font = "700 15px system-ui";
  ctx.fillText("pH", 22, graph.top - 8);
  ctx.fillText("Volume (mL)", canvas.width / 2 - 42, canvas.height - 8);

  if (data.length > 1) {
    ctx.strokeStyle = "#0f8f8c";
    ctx.lineWidth = 4;
    ctx.beginPath();
    data.forEach((point, index) => {
      const x = xFor(point.volume);
      const y = yFor(point.ph);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  data.forEach((point) => {
    ctx.fillStyle = "#ed6a4a";
    ctx.beginPath();
    ctx.arc(xFor(point.volume), yFor(point.ph), 4, 0, Math.PI * 2);
    ctx.fill();
  });

  if (endpoint) {
    const x = xFor(endpoint.volume);
    ctx.strokeStyle = "#d99a24";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(x, graph.top);
    ctx.lineTo(x, canvas.height - graph.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#d99a24";
    ctx.font = "800 14px system-ui";
    ctx.fillText("Endpoint", x + 10, graph.top + 20);
  }
}

async function connectArduino() {
  if (!("serial" in navigator)) {
    addLog("Web Serial is not supported. Use Chrome or Edge.");
    return;
  }

  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    writer = port.writable.getWriter();
    setConnected(true);
    addLog("Serial port opened at 9600 baud.");
    readSerialLoop();
  } catch (error) {
    addLog(`Connection failed: ${error.message}`);
  }
}

async function readSerialLoop() {
  const textDecoder = new TextDecoderStream();
  const readableClosed = port.readable.pipeTo(textDecoder.writable);
  reader = textDecoder.readable.getReader();
  keepReading = true;
  let buffer = "";

  try {
    while (keepReading) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      lines.forEach((line) => {
        const reading = parseReading(line);
        if (reading) addReading(reading);
      });
    }
  } catch (error) {
    addLog(`Serial read stopped: ${error.message}`);
  } finally {
    reader.releaseLock();
    await readableClosed.catch(() => {});
  }
}

async function sendCommand(command) {
  if (!writer) return;
  const encoded = new TextEncoder().encode(`${command}\n`);
  await writer.write(encoded);
  addLog(`Sent command: ${command}`);
}

async function disconnectArduino() {
  try {
    keepReading = false;
    if (reader) await reader.cancel();
    if (writer) {
      writer.releaseLock();
      writer = null;
    }
    if (port) {
      await port.close();
      port = null;
    }
    setConnected(false);
    addLog("Arduino disconnected.");
  } catch (error) {
    addLog(`Disconnect failed: ${error.message}`);
  }
}

function startSimulation() {
  stopSimulation();
  clearData();
  let volume = 0;
  simulationTimer = window.setInterval(() => {
    volume += 0.65;
    const curve = 3.2 + 7.4 / (1 + Math.exp(-(volume - 24.8) * 1.15));
    const noise = (Math.random() - 0.5) * 0.16;
    addReading({ ph: curve + noise, volume });
    if (volume >= 34) stopSimulation();
  }, 300);
  addLog("Demo data started.");
}

function stopSimulation() {
  if (simulationTimer) {
    window.clearInterval(simulationTimer);
    simulationTimer = null;
  }
}

function clearData() {
  data = [];
  updateDashboard();
  logList.innerHTML = "";
}

function downloadCsv() {
  const header = "time,ph,volume_ml\n";
  const rows = data.map((point) => `${point.time.toISOString()},${point.ph},${point.volume}`).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "titration-readings.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

connectBtn.addEventListener("click", connectArduino);
disconnectBtn.addEventListener("click", disconnectArduino);
startBtn.addEventListener("click", () => sendCommand("START"));
stopBtn.addEventListener("click", () => sendCommand("STOP"));
simulateBtn.addEventListener("click", startSimulation);
clearBtn.addEventListener("click", () => {
  stopSimulation();
  clearData();
});
downloadBtn.addEventListener("click", downloadCsv);
expectedPh.addEventListener("input", updateDashboard);
expectedVolume.addEventListener("input", updateDashboard);
gradeMode.addEventListener("change", updateDashboard);

drawGraph(null);
