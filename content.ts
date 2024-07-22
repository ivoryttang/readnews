export {}
import type { PlasmoCSConfig } from "plasmo"
import { WebPlayer } from "@cartesia/cartesia-js";
import Cartesia from "@cartesia/cartesia-js";
 
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  world: "MAIN"
}

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
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
async function fetchTTSData(text: string) {
  const ttsWebSocket = cartesia.tts.websocket({container: "raw",
    encoding: "pcm_f32le",
    sampleRate: 44100
  });
  try {
    await ttsWebSocket.connect();
  } catch (error) {
    console.error(`Failed to connect to Cartesia: ${error}`);
  }
  
  console.log('Connected to TTS WebSocket');
  
  const response = await ttsWebSocket.send(
    {
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
      "language": "en"
    }
  );
     
  // Create a Player object.
  const player = new WebPlayer({bufferDuration:3});

  // Play the audio. (`response` includes a custom Source object that the Player can play.)
  // The call resolves when the audio finishes playing.
  await player.play(response.source);
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

const TTS_WEBSOCKET_URL = `wss://api.cartesia.ai/tts/websocket?api_key=${CONFIG.API_KEY}&cartesia_version=2024-06-10`;

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64); // Decode base64 to a binary string
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i); // Convert binary string to bytes
  }
  return bytes;
}

// Text to Speech function
async function speakText() {
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

  const allText = getMainBodyText();
  console.log(allText);
    
  const initAudio = async () => {
    await fetchTTSData(allText);
  };

  const playButton = audioPlayerElement.querySelector('.toggle-play') as HTMLElement;
  
  // Attach the initAudio function to the play button's click event
  playButton.addEventListener('click', initAudio);

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
  console.log("Injecting CSS");
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
  console.log("finish css injection")
}

speakText();

console.log("Content script loaded");


