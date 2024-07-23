export {}
import type { PlasmoCSConfig } from "plasmo"
import { WebPlayer } from "@cartesia/cartesia-js";
import Cartesia from "@cartesia/cartesia-js";
 
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  world: "MAIN"
}

// Configuration
const CONFIG = {
  API_KEY: "", // Get an API key from https://cartesia.ai/
  API_VERSION: "2024-06-10",
  API_URL: "https://api.cartesia.ai/tts/websocket",
  VOICE_ID: "79a125e8-cd45-4c13-8a67-188112f4dd22",
  MODEL_ID: "sonic-english",
};

const cartesia = new Cartesia({
	apiKey: CONFIG.API_KEY,
});
// Create a Player object.
const player = new WebPlayer({bufferDuration:3});
var total_duration = 0;
var isPlaying = false;
var isPaused = false;
const ttsWebSocket = cartesia.tts.websocket({container: "raw",
    encoding: "pcm_f32le",
    sampleRate: 44100
  });
  

var audioSource = null
let wordTimestamps: { words: any; start: number[]; end: number[] } | null = null;

async function fetchTTSData(text: string) {
  if (!audioSource) {
    try {
      await ttsWebSocket.connect();
    } catch (error) {
      console.error(`Failed to connect to Cartesia: ${error}`);
      return;
    }
    console.log('Connected to TTS WebSocket');
    
    const response = await ttsWebSocket.send({
      'context_id':'happy',
      'model_id': CONFIG.MODEL_ID,
      'duration': 180,
      'transcript': text,
      'voice': {
        'mode': "id",
        'id': CONFIG.VOICE_ID, 
        "__experimental_controls": {
          "speed": "normal",
          "emotion": ["positivity:highest", "curiosity"]
        }
      },
      'output_format': {
        'container': 'raw',
        'encoding': 'pcm_f32le',
        'sample_rate': 44100
      },
      "language": "en",
      "add_timestamps":true
    });

    audioSource = response.source;

    response.on("timestamps", (timestamps) => {
      wordTimestamps = {
        words: timestamps.words,
        start: timestamps.start, // Now correctly typed as number[]
        end: timestamps.end
      };
    });
  }

}

function getWordTimestamps() {
  return wordTimestamps;
}


//parsing function
function getMainBodyText() {
  // List of tags to ignore
  const ignoreTags = ['script', 'style', 'noscript', 'header', 'footer', 'nav', 'aside'];

  const shouldIgnoreElement = (element: Element): boolean => {
    const ignoreClasses = ['audio-player', 'button', 'control', 'input', 'main-menu','footer-wrap','comments-section','single-post-section','share-dialog']; // Add more classes as needed
    return ignoreClasses.some(className => hasClassInTree(element, className));
  };
  
  // Function to check if an element is visible
  const isVisible = (element) => {
      return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  };

  const hasClassInTree = (element: Element, className: string): boolean => {
    while (element) {
      if (element.classList && element.classList.contains(className)) {
        return true;
      }
      element = element.parentElement;
    }
    return false;
  };
  // Function to get text from an element
  const getText = (element: Node): string => { // Edit: Added type annotation for 'element'
    if (ignoreTags.includes(element.nodeName.toLowerCase())) return '';
    if (element.nodeType === Node.ELEMENT_NODE && shouldIgnoreElement(element as Element)) {
      return ''; // Ignore text within elements with specific classes
    }
    
    if (element.childNodes.length === 0) return element.textContent?.trim() || ''; // Edit: Added optional chaining
    
    return Array.from(element.childNodes)
        .map((child: Node) => { // Edit: Added type annotation for 'child'
            if (child.nodeType === Node.TEXT_NODE) return child.textContent?.trim() || ''; // Edit: Added optional chaining
            if (child.nodeType === Node.ELEMENT_NODE) return getText(child as Element); // Edit: Type cast 'child' to 'Element'
            return '';
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
};

  // Main content selectors to try
  const mainSelectors = ['main', 'article', '#content', '.content', '#main', '.main'];
  
  let mainContent = null;
  for (let selector of mainSelectors) {
      mainContent = document.querySelector(selector);
      if (mainContent && isVisible(mainContent)) break;
  }

  // If no main content found, fall back to body
  if (!mainContent) mainContent = document.body;

  // Get text from main content
  return getText(mainContent);
}

// Text to Speech function
async function speakText() {
  // audio UI
  const audioPlayerElement = createAudioPlayer() as HTMLElement;
  if (document.body.firstChild) {
    document.body.insertBefore(audioPlayerElement, document.body.firstChild);
  } else {
    document.body.appendChild(audioPlayerElement);
  }
  
  if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', injectCSS);
  } else {
    injectCSS();
  }

  const playButton = audioPlayerElement.querySelector('.toggle-play') as HTMLElement;
  playButton.addEventListener('click', togglePlayPause);

  const selectVoiceButton = audioPlayerElement.querySelector('.audio-options') as HTMLElement;
  selectVoiceButton.addEventListener('click', toggleVoice);
}

// Function to format time in minutes:seconds
function formatTime(seconds) {
  const pad = (num, size) => ('000' + num).slice(size * -1);
  let time = parseFloat(seconds.toFixed(3));
  let hours = Math.floor(time / 60 / 60);
  let minutes = Math.floor(time / 60) % 60;
  let secs = Math.floor(time - minutes * 60);
  return pad(minutes, 2) + ':' + pad(secs, 2);
}

// Function to update the timeline and time display
function updatePlayerUI() {
  const timestamps = getWordTimestamps();
  const currentTime = timestamps ? timestamps.start[0] : 0;

  // Update the current time display
  const currentTimeDisplay = document.querySelector('.audio-player .current');
  if (currentTimeDisplay) {
    currentTimeDisplay.textContent = formatTime(currentTime);
  }

  // Update the duration display
  const durationDisplay = document.querySelector('.audio-player .length');
  if (durationDisplay) {
    durationDisplay.textContent = formatTime(total_duration);
  }

  // Update the progress bar
  const progress = document.querySelector('.audio-player .progress') as HTMLElement;
  if (progress && total_duration > 0) {
    const percentage = (currentTime / total_duration) * 100;
    progress.style.width = `${percentage}%`;
  }
}

let updateUIIntervalId;
// Call this function to start updating the UI
function startUpdatingPlayerUI() {
  const updateInterval = 1000; // Update every second
  // Clear any existing intervals to avoid multiple intervals running
  clearInterval(updateUIIntervalId);
  // Set the interval and store the interval ID
  updateUIIntervalId = setInterval(updatePlayerUI, updateInterval);
}

function stopUpdatingPlayerUI() {
  // Clear the interval using the stored interval ID
  clearInterval(updateUIIntervalId);
}

async function toggleVoice() {
  const selectVoiceButton = document.querySelector('.audio-options') as HTMLSelectElement;
  selectVoiceButton.addEventListener('change', (event) => {
    const selectedVoiceId = (event.target as HTMLSelectElement).value;
    const randomIndex = Math.floor(Math.random() * 5);
    const voiceIds = ["b7d50908-b17c-442d-ad8d-810c63997ed9", "2ee87190-8f84-4925-97da-e52547f9462c", "fb26447f-308b-471e-8b00-8e9f04284eb5","e00d0e4c-a5c8-443f-a8a3-473eb9a62355","638efaaa-4d0c-442e-b701-3fae16aad012"]
    switch (selectedVoiceId) {
      case "woman":
        CONFIG.VOICE_ID = "79a125e8-cd45-4c13-8a67-188112f4dd22";
        break;
      case "man":
        CONFIG.VOICE_ID = "41534e16-2966-4c6b-9670-111411def906";
        break;
      case "other":
        CONFIG.VOICE_ID = voiceIds[randomIndex];;
        break;
      default:
        CONFIG.VOICE_ID = "default-voice-id";
    }
  });
}

async function togglePlayPause() {
  const playButton = document.querySelector('.toggle-play');

  if (!audioSource) {
    // First time play is clicked, generate audio
    playButton.classList.remove('play');
    playButton.classList.add('pause');
    const allText = getMainBodyText();
    startUpdatingPlayerUI();
    total_duration = allText.length/10;
    await fetchTTSData(allText);
    if (!audioSource) {
      console.error('Failed to generate audio source');
      return;
    }
    await player.play(audioSource);
  }
  else {
    if (isPlaying) { // pause if already playing
      await player.pause();
      isPaused = true
      isPlaying = false;
      playButton.classList.remove('pause');
      playButton.classList.add('play');
      stopUpdatingPlayerUI();
    } else {
        // Call startUpdatingPlayerUI when you want to start updating the UI, e.g., when audio starts playing
      startUpdatingPlayerUI();
      if (isPaused) { // resume if paused
        await player.resume();
        isPaused = false
      } else { // play from start
        await player.play(audioSource);
      }
      isPlaying = true;
      playButton.classList.remove('play');
      playButton.classList.add('pause');
    }
  }
}


function createAudioPlayer() {
  const playerHTML = `
  <div class="audio-player">
    <div class="track-info">
      <div class="track-details">
        <div class="track-name">Let's Talk News</div>
        <div class="artist-name">Listen to your favorite articles!</div>
      </div>
    </div>
    <div class="controls">
      <div class="play-container">
        <div class="toggle-play play"></div>
      </div>
      <div class="timeline">
        <div class="progress"></div>
      </div>
      <div class="time">
        <div class="current">0:00</div>
        <div class="divider">/</div>
        <div class="length">0:00</div>
      </div>
    </div>
    <div class="audio-controls">
    <div class="volume-container">
      <div class="volume-button">
        <div class="volume icono-volumeMedium"></div>
      </div>
      <div class="volume-slider">
        <div class="volume-percentage"></div>
      </div>
    </div>
    <select class="audio-options">
      <option value="woman">British Woman</option>
      <option value="man">American Man</option>
      <option value="other">Surprise me!</option>
    </select>
  </div>
  </div>
  `

  const playerDiv = document.createElement('div');
  playerDiv.innerHTML = playerHTML;
  return playerDiv.firstElementChild;
}

function injectCSS() {
  const style = document.createElement('style');
  style.textContent = `

  .audio-player {
    width: 300px;
    background-color: #282828;
    color: #fff;
    border-radius: 8px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    padding: 20px;
    position: fixed;
    left: 75%;
    top: 50%;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  /* Track Info */
  .track-info {
    display: flex;
    align-items: center;
    margin-bottom: 15px;
  }
  
  .album-art {
    width: 50px;
    height: 50px;
    border-radius: 4px;
    margin-right: 15px;
  }
  
  .track-details {
    display: flex;
    flex-direction: column;
  }
  
  .track-name {
    font-size: 16px;
    font-weight: bold;
  }
  
  .artist-name {
    font-size: 14px;
    color: #b3b3b3;
  }
  
  /* Controls */
  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 15px;
  }
  
  .play-container {
    cursor: pointer;
  }
  
  
  .toggle-play:before {
    content: '\\25B6'; // Unicode character for a right-pointing triangle (play symbol)
    font-size: 24px; // Set the size of the icon
    color: white; // Set the color of the icon
    line-height: 24px; // Align the icon vertically
    text-align: center; // Align the icon horizontally
    display: block;
  }

  .toggle-play.pause:before {
    content: '\\23F8'; // Unicode character for a pause symbol
    font-size: 24px; // Set the size of the icon
    color: white; // Set the color of the icon
    line-height: 24px; // Align the icon vertically
    text-align: center; // Align the icon horizontally
    display: block;
  }
  
  .timeline {
    flex: 1;
    height: 4px;
    background: #404040;
    border-radius: 2px;
    margin: 0 10px;
    cursor: pointer;
    position: relative;
  }
  
  .progress {
    height: 100%;
    background: #1db954;
    width: 0;
    border-radius: 2px;
  }
  
  .time {
    display: flex;
    align-items: center;
    font-size: 12px;
  }
  
  .current, .length {
    font-size: 12px;
  }
  
  .divider {
    margin: 0 5px;
  }
  
  

  // Custom arrow for the dropdown
  .audio-options::-ms-expand {
    display: none; // Hide the default arrow in IE/Edge
  }

  .audio-options::after {
    content: '\\25BC'; // Unicode character for a downward arrow
    color: #fff; 
    position: absolute; // Position it absolutely within the parent
    right: 10px; // Position from the right
    top: 50%; // Center vertically
    transform: translateY(-50%); // Adjust vertical position
    pointer-events: none; // Prevent the arrow from being clickable
  }

  .audio-controls {
    display: flex;
    align-items: center;
    justify-content: flex-end; /* Aligns items to the right, adjust as needed */
  }
  
  .volume-container {
    display: flex;
    align-items: center;
    margin-right: 10px; /* Space between volume controls and dropdown */
  }

  // Style to apply when the dropdown is focused
  .audio-options:focus {
    outline: none; // Remove the default focus outline
    border-color: #1db954; // Highlight color when focused
    color: #fff;
  }
  
  .volume-button {
    cursor: pointer;
    margin-right: 5px;
  }

  .audio-options {
    background-color: #FFFFFF;
    color: #000000 !important; /* Changed to black for visibility on white background */
    border: 1px solid #606060;
    border-radius: 4px;
    padding: 5px 10px;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    cursor: pointer;
  }

  .volume.icono-volumeMedium:before {
    content: '\\1F509'; // Unicode character for a speaker with one sound wave
    font-size: 24px; // Set the size of the icon
    color: white; // Set the color of the icon
    line-height: 24px; // Align the icon vertically
    text-align: center; // Align the icon horizontally
    display: block;
  }
  
  .volume-slider {
    position: relative;
    width: 100px;
    height: 6px;
    background: #404040;
    border-radius: 2px;
    margin-left: 10px;
    margin-right: 10px;
    cursor: pointer;
  }
  
  .volume-percentage {
    position: absolute;
    height: 100%;
    background: #1db954;
    width: 50%;
    border-radius: 2px;
  }
  
  `
  document.head.appendChild(style);
}

speakText();

console.log("Content script loaded");


