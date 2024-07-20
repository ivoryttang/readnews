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

// Utility functions
function parseMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, "<br>");
}

function findFirstTextNode(element) {
  if (
    element.nodeType === Node.TEXT_NODE &&
    element.textContent.trim() !== ""
  ) {
    return element;
  }
  for (let child of element.childNodes) {
    const textNode = findFirstTextNode(child);
    if (textNode) return textNode;
  }
  return null;
}

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

  constructor(audioContext: AudioContext, onProgress: (time: number) => void) {
    this.audioContext = audioContext;
    this.onProgress = onProgress;
    this.bufferQueue = [];
    this.isPlaying = false;
    this.sampleRate = 44100;
    this.channelCount = 1;
    this.bufferSize = 2 * this.sampleRate; // 2 seconds buffer
    this.currentBuffer = new Float32Array(this.bufferSize);
    this.bufferFillAmount = 0;
    this.remainder = new Uint8Array(0);
    this.nextStartTime = 0;
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
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
    } else {
      source.start(0);
      this.nextStartTime = this.audioContext.currentTime + audioBuffer.duration;
      this.isPlaying = true;
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

  togglePlay(): void {
    if (this.audio.paused) {
      this.audio.play();
      this.playBtn.classList.remove('play');
      this.playBtn.classList.add('pause');
    } else {
      this.audio.pause();
      this.playBtn.classList.remove('pause');
      this.playBtn.classList.add('play');
    }
  }

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

// Text to Speech function
async function speakText(firstTextNode) {
  const audioPlayerElement = createAudioPlayer() as HTMLElement;
  document.body.appendChild(audioPlayerElement);
  
  const audioPlayer = new AudioPlayer(audioPlayerElement);
  
  injectCSS();

  audioPlayer.setAudioSource('https://example.com/audio.mp3')

  // const startTime = Date.now();
  // let firstChunkReceived = false;

  // const options = {
  //   method: "POST",
  //   headers: {
  //     "X-API-Key": CONFIG.API_KEY,
  //     "Cartesia-Version": CONFIG.API_VERSION,
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({
  //     output_format: {
  //       container: "raw",
  //       sample_rate: 44100,
  //       encoding: "pcm_f32le",
  //     },
  //     language: "en",
  //     voice: {
  //       mode: "id",
  //       id: CONFIG.VOICE_ID,
  //     },
  //     model_id: CONFIG.MODEL_ID,
  //     transcript: firstTextNode, //start reading whole script from start
  //   }),
  // };

  // try {
  //   const response = await fetch(CONFIG.API_URL, options);
  //   if (!response.ok) {
  //     throw new Error(`HTTP error! status: ${response.status}`);
  //   }

  //   const reader = response.body.getReader();
  //   const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  //   const streamingAudioPlayer = new StreamingAudioPlayer(audioContext, (currentPosition) => {
  //     // Update the highlight based on the currentPosition
  //     // This is a placeholder; you will need to implement logic to determine which part of the text corresponds to the current position
  //   });

  //   while (true) {
  //     const { done, value } = await reader.read();
  //     if (done) break;

  //     if (!firstChunkReceived) {
  //       firstChunkReceived = true;
  //       const timeToFirstChunk = Date.now() - startTime;
  //       console.log(`Time to first chunk: ${timeToFirstChunk}ms`);
  //     }

  //     await streamingAudioPlayer.addChunk(value);
  //   }

  //   await streamingAudioPlayer.finish();
  // } catch (error) {
  //   console.error("Error fetching or playing audio:", error);
  //   alert("Failed to generate or play audio. Please try again.");
  // } 
}

//controls play and pause of speaker
function speaker(){
  let firstTextNode = document.body.innerText.trim().split(/\s+/).slice(0, 30).join(" ");
  speakText(firstTextNode);
}

function createAudioPlayer() {
  const playerHTML = `
    <div class="audio-player">
      <div class="timeline">
        <div class="progress"></div>
      </div>
      <div class="controls">
        <div class="play-container">
          <div class="toggle-play play">
          </div>
        </div>
        <div class="time">
          <div class="current">0:00</div>
          <div class="divider">/</div>
          <div class="length"></div>
        </div>
        <div class="name">Music Song</div>
        <div class="volume-container">
          <div class="volume-button">
            <div class="volume icono-volumeMedium"></div>
          </div>
          
          <div class="volume-slider">
            <div class="volume-percentage"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const playerDiv = document.createElement('div');
  playerDiv.innerHTML = playerHTML;
  return playerDiv.firstElementChild;
}

function injectCSS() {
  const style = document.createElement('style');
  style.textContent = `
    .audio-player {
            *,
      ::before,
      ::after {
        box-sizing: border-box;
      
        border-width: 0;

        border-style: solid;

        border-color: #e5e7eb;

      }

      ::before,
      ::after {
        --tw-content: '';
      }
          }

          html {
            line-height: 1.5;
            
            -webkit-text-size-adjust: 100%;
            
            -moz-tab-size: 4;
            
            -o-tab-size: 4;
               tab-size: 4;
            
            font-family: Inter var, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
            
          }

          body {
            margin: 0;
           
            line-height: inherit;
            
          } 

          hr {
            height: 0;
          
            color: inherit;
           
            border-top-width: 1px;
           
          }

          abbr:where([title]) {
            -webkit-text-decoration: underline dotted;
                    text-decoration: underline dotted;
          }
          h1,
          h2,
          h3,
          h4,
          h5,
          h6 {
            font-size: inherit;
            font-weight: inherit;
          }

          a {
            color: inherit;
            text-decoration: inherit;
          }

          b,
          strong {
            font-weight: bolder;
          }

          code,
          kbd,
          samp,
          pre {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            /* 1 */
            font-size: 1em;
            /* 2 */
          }

          small {
            font-size: 80%;
          }

          sub,
          sup {
            font-size: 75%;
            line-height: 0;
            position: relative;
            vertical-align: baseline;
          }

          sub {
            bottom: -0.25em;
          }

          sup {
            top: -0.5em;
          }

          table {
            text-indent: 0;
           
            border-color: inherit;
           
            border-collapse: collapse;
           
          }
      
          button,
          input,
          optgroup,
          select,
          textarea {
            font-family: inherit;
          
            font-size: 100%;
           
            line-height: inherit;
            
            color: inherit;
         
            margin: 0;
            
            padding: 0;
          
          }

          button,
          select {
            text-transform: none;
          }

          button,
          [type='button'],
          [type='reset'],
          [type='submit'] {
            -webkit-appearance: button;
           
            background-color: transparent;
           
            background-image: none;
          
          }

          :-moz-focusring {
            outline: auto;
          }

          :-moz-ui-invalid {
            box-shadow: none;
          }

          progress {
            vertical-align: baseline;
          }

          ::-webkit-inner-spin-button,
          ::-webkit-outer-spin-button {
            height: auto;
          }

          [type='search'] {
            -webkit-appearance: textfield;
           
            outline-offset: -2px;
            
          }

          ::-webkit-search-decoration {
            -webkit-appearance: none;
          }

          ::-webkit-file-upload-button {
            -webkit-appearance: button;
           
            font: inherit;
            
          }

          summary {
            display: list-item;
          }

          blockquote,
          dl,
          dd,
          h1,
          h2,
          h3,
          h4,
          h5,
          h6,
          hr,
          figure,
          p,
          pre {
            margin: 0;
          }

          fieldset {
            margin: 0;
            padding: 0;
          }

          legend {
            padding: 0;
          }

          ol,
          ul,
          menu {
            list-style: none;
            margin: 0;
            padding: 0;
          }

          textarea {
            resize: vertical;
          }

          button,
          [role="button"] {
            cursor: pointer;
          }

          :disabled {
            cursor: default;
          }

          img,
          svg,
          video,
          canvas,
          audio,
          iframe,
          embed,
          object {
            display: block;
            
            vertical-align: middle;
       
          }

  `;
  document.head.appendChild(style);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("listener triggered")
  if (request.action === "play") {
    speaker(); // Call the speaker function
    sendResponse({ status: "processed" }); // Send a response back to the message sender
  }
});


console.log("Content script loaded");
chrome.runtime.sendMessage({ action: "contentScriptReady" });


