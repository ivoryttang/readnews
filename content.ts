export {}
import type { PlasmoCSConfig } from "plasmo"
 
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
  API_URL: "https://api.cartesia.ai/tts/bytes",
  VOICE_ID: "c45bc5ec-dc68-4feb-8829-6e6b2748095d",
  MODEL_ID: "sonic-english",
};

// StreamingAudioPlayer class
class StreamingAudioPlayer {
  audioContext: AudioContext;
  onProgress: (time: number) => void;
  bufferQueue: any[];
  isPlaying: boolean;
  sampleRate: number;
  channelCount: number;
  bufferSize: number;
  currentBuffer: Float32Array;
  bufferFillAmount: number;
  remainder: Uint8Array;
  nextStartTime: number;
  startTime: number | null;
  onPlaybackStart: () => void;
  onPlaybackPause: () => void;
  onPlaybackEnd: () => void;
  onTimeUpdate: (currentTime: number, duration: number) => void;

  constructor(audioContext: AudioContext, onProgress: (time: number) => void) {
    this.audioContext = audioContext;
    this.onProgress = onProgress;
    this.bufferQueue = [];
    this.startTime = null; 
    this.isPlaying = false;
    this.sampleRate = 44100;
    this.channelCount = 1;
    this.bufferSize = 2 * this.sampleRate; // 2 seconds buffer
    this.currentBuffer = new Float32Array(this.bufferSize);
    this.bufferFillAmount = 0;
    this.remainder = new Uint8Array(0);
    this.nextStartTime = 0;
    this.onPlaybackStart = () => {};
    this.onPlaybackPause = () => {};
    this.onPlaybackEnd = () => {};
    this.onTimeUpdate = () => {};
  }

  async addChunk(chunk: Uint8Array) {
    const combinedChunk = new Uint8Array(this.remainder.length + chunk.length);
    combinedChunk.set(this.remainder);
    combinedChunk.set(chunk, this.remainder.length);

    const alignedLength = Math.floor(combinedChunk.length / 4) * 4;
    const newSamples = new Float32Array(
      combinedChunk.buffer,
      0,
      alignedLength / 4
    );

    this.remainder = combinedChunk.slice(alignedLength);

    if (this.bufferFillAmount + newSamples.length > this.bufferSize) {
      if (this.bufferFillAmount > 0) {
        this.playBuffer();
      }
      this.bufferFillAmount = 0;
    }

    this.currentBuffer.set(newSamples, this.bufferFillAmount);
    this.bufferFillAmount += newSamples.length;

    if (this.bufferFillAmount >= this.bufferSize / 2) {
      this.playBuffer();
      this.bufferFillAmount = 0;
    }
  }

  playBuffer() {
    const audioBuffer = this.audioContext.createBuffer(
      this.channelCount,
      this.bufferFillAmount,
      this.sampleRate
    );
    audioBuffer.copyToChannel(
      this.currentBuffer.slice(0, this.bufferFillAmount),
      0
    );

    
    // Call the onProgress callback with the current playback position
    if (this.onProgress) {
      this.onProgress(this.nextStartTime);
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    if (this.isPlaying) {
      this.startTime = this.nextStartTime; // Store the start time
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
    } else {
      this.startTime = this.audioContext.currentTime; // Store the start time
      source.start(0);
      this.nextStartTime = this.startTime + audioBuffer.duration;
      this.isPlaying = true;
    }

    // Call onTimeUpdate every 100ms during playback
    const updateInterval = setInterval(() => {
      if (this.isPlaying && this.startTime !== null) {
        const currentTime = this.audioContext.currentTime - this.startTime;
        this.onTimeUpdate(currentTime, this.nextStartTime);
      } else {
        clearInterval(updateInterval);
      }
    }, 100);

  source.onended = () => {
    clearInterval(updateInterval);
    if (this.bufferQueue.length === 0 && this.bufferFillAmount === 0) {
      this.isPlaying = false;
      this.onPlaybackEnd();
    }
  };

    if (this.isPlaying) {
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
    } else {
      source.start(0);
      this.nextStartTime = this.audioContext.currentTime + audioBuffer.duration;
      this.isPlaying = true;
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.audioContext.suspend();
      this.isPlaying = false;
      this.onPlaybackPause();
    } else {
      this.audioContext.resume();
      this.isPlaying = true;
      this.onPlaybackStart();
    }
  }

  async finish() {
    if (this.bufferFillAmount > 0 || this.remainder.length > 0) {
      if (this.remainder.length > 0) {
        const paddedRemainder = new Uint8Array(
          Math.ceil(this.remainder.length / 4) * 4
        );
        paddedRemainder.set(this.remainder);
        const finalSamples = new Float32Array(paddedRemainder.buffer);
        this.currentBuffer.set(finalSamples, this.bufferFillAmount);
        this.bufferFillAmount += finalSamples.length;
      }
      this.playBuffer();
    }
    await new Promise((resolve) =>
      setTimeout(resolve, this.nextStartTime * 1000)
    );
  }
}

class AudioPlayer {
  streamingPlayer: StreamingAudioPlayer;
  player: HTMLElement;
  audio: HTMLAudioElement;
  progress: HTMLElement;
  currentTime: HTMLElement;
  totalTime: HTMLElement;
  playBtn: HTMLElement;
  volumeBtn: HTMLElement;
  volumeSlider: HTMLElement;
  volumePercentage: HTMLElement;

  constructor(player: HTMLElement) {
    this.player = player;
    this.audio = new Audio();
    this.streamingPlayer = null;
    this.progress = player.querySelector('.progress') as HTMLElement;
    this.currentTime = player.querySelector('.current') as HTMLElement;
    this.totalTime = player.querySelector('.length') as HTMLElement;
    this.playBtn = player.querySelector('.toggle-play') as HTMLElement;
    this.volumeBtn = player.querySelector('.volume-button') as HTMLElement;
    this.volumeSlider = player.querySelector('.volume-slider') as HTMLElement;
    this.volumePercentage = player.querySelector('.volume-percentage') as HTMLElement;

    this.initEventListeners();
  }

  initEventListeners(): void {
    this.playBtn.addEventListener('click', () => this.togglePlay());
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('loadeddata', () => this.setTotalTime());
    this.volumeBtn.addEventListener('click', () => this.toggleMute());
    this.volumeSlider.addEventListener('click', (e) => this.changeVolume(e));
  }

  setStreamingPlayer(streamingPlayer: StreamingAudioPlayer) {
    this.streamingPlayer = streamingPlayer;
    this.streamingPlayer.onPlaybackStart = () => {
      this.playBtn.classList.remove('play');
      this.playBtn.classList.add('pause');
    };
    this.streamingPlayer.onPlaybackPause = () => {
      this.playBtn.classList.remove('pause');
      this.playBtn.classList.add('play');
    };
    this.streamingPlayer.onPlaybackEnd = () => {
      this.playBtn.classList.remove('pause');
      this.playBtn.classList.add('play');
    };
    this.streamingPlayer.onTimeUpdate = (currentTime, duration) => {
      const percent = (currentTime / duration) * 100;
      this.progress.style.width = `${percent}%`;
      this.currentTime.textContent = this.formatTime(currentTime);
      this.totalTime.textContent = this.formatTime(duration);
    };
  }

  togglePlay(): void {
    if (this.streamingPlayer) {
      this.streamingPlayer.togglePlay();
    }
  }
  
  // togglePlay(): void {
  //   if (this.audio.paused) {
  //     this.audio.play();
  //     this.playBtn.classList.remove('play');
  //     this.playBtn.classList.add('pause');
  //   } else {
  //     this.audio.pause();
  //     this.playBtn.classList.remove('pause');
  //     this.playBtn.classList.add('play');
  //   }
  // }

  updateProgress(): void {
    const percent = (this.audio.currentTime / this.audio.duration) * 100;
    this.progress.style.width = `${percent}%`;
    this.currentTime.textContent = this.formatTime(this.audio.currentTime);
  }

  setTotalTime(): void {
    this.totalTime.textContent = this.formatTime(this.audio.duration);
  }

  formatTime(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  toggleMute(): void {
    this.audio.muted = !this.audio.muted;
    this.volumeBtn.classList.toggle('mute');
  }

  changeVolume(e: MouseEvent): void {
    const sliderWidth = window.getComputedStyle(this.volumeSlider).width;
    const newVolume = e.offsetX / parseInt(sliderWidth);
    this.audio.volume = newVolume;
    this.volumePercentage.style.width = `${newVolume * 100}%`;
  }

  setAudioSource(url: string): void {
    this.audio.src = url;
  }
}

async function fetchTTSData(text: string) {
  const options = {
    method: "POST",
    headers: {
      "X-API-Key": CONFIG.API_KEY,
      "Cartesia-Version": CONFIG.API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      output_format: {
        container: "raw",
        sample_rate: 44100,
        encoding: "pcm_f32le",
      },
      language: "en",
      voice: {
        mode: "id",
        id: CONFIG.VOICE_ID,
      },
      model_id: CONFIG.MODEL_ID,
      transcript: text,
    })
  };

  const response = await fetch(CONFIG.API_URL, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response;
}

//parsing function
function getMainBodyText() {
  // List of tags to ignore
  const ignoreTags = ['script', 'style', 'noscript', 'header', 'footer', 'nav', 'aside'];
  
  // Function to check if an element is visible
  const isVisible = (element) => {
      return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  };

  // Function to get text from an element
  const getText = (element: Node): string => { // Edit: Added type annotation for 'element'
    if (ignoreTags.includes(element.nodeName.toLowerCase())) return '';
    
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
  
  const audioPlayer = new AudioPlayer(audioPlayerElement);

  const allText = getMainBodyText();
  console.log(allText);
    
  const response = await fetchTTSData(allText);
  const reader = response.body.getReader();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  const streamingAudioPlayer = new StreamingAudioPlayer(audioContext, (currentPosition) => {
    // Update the highlight based on the currentPosition
  });

  audioPlayer.setStreamingPlayer(streamingAudioPlayer);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    await streamingAudioPlayer.addChunk(value);
  }

  await streamingAudioPlayer.finish();
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
        <div class="length">3:45</div>
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
  
  .toggle-play {
    width: 24px;
    height: 24px;
    background: url('play-icon.png') no-repeat center;
    background-size: contain;
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


