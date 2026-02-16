// content.js
class MeetingRecorder {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioStream = null;
    this.transcriptBuffer = [];
    this.recognition = null;
    this.meetingData = this.detectMeetingPlatform();
    
    this.init();
  }

  init() {
    this.injectUI();
    this.setupSpeechRecognition();
    this.observeMeetingChanges();
  }

  detectMeetingPlatform() {
    const url = window.location.href;
    if (url.includes('meet.google.com')) {
      return { platform: 'google-meet', title: this.getGoogleMeetTitle() };
    } else if (url.includes('zoom.us')) {
      return { platform: 'zoom', title: this.getZoomTitle() };
    } else if (url.includes('teams.microsoft.com')) {
      return { platform: 'teams', title: this.getTeamsTitle() };
    }
    return { platform: 'unknown', title: 'Meeting' };
  }

  getGoogleMeetTitle() {
    return document.querySelector('[data-meeting-title]')?.textContent || 
           document.title.replace(' - Google Meet', '');
  }

  getZoomTitle() {
    return document.querySelector('.meeting-title')?.textContent || 'Zoom Meeting';
  }

  getTeamsTitle() {
    return document.querySelector('[data-tid="call-title"]')?.textContent || 'Teams Meeting';
  }

  injectUI() {
    // Create floating widget
    const widget = document.createElement('div');
    widget.id = 'fathom-clone-widget';
    widget.innerHTML = `
      <div class="fathom-widget-container">
        <div class="fathom-header">
          <span class="fathom-logo">⚡ Fathom</span>
          <button id="fathom-close" class="fathom-btn-icon">×</button>
        </div>
        <div class="fathom-body">
          <div id="fathom-status" class="fathom-status">Ready to record</div>
          <button id="fathom-record-btn" class="fathom-btn-record">
            <span class="fathom-record-icon">●</span>
            Start Recording
          </button>
          <div id="fathom-transcript-preview" class="fathom-transcript-preview"></div>
        </div>
      </div>
    `;
    
    // Add styles
    const styles = document.createElement('style');
    styles.textContent = `
      #fathom-clone-widget {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .fathom-widget-container {
        background: #1a1a2e;
        color: white;
        border-radius: 12px;
        width: 320px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        overflow: hidden;
      }
      .fathom-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        background: #16213e;
        border-bottom: 1px solid #0f3460;
      }
      .fathom-logo {
        font-weight: 700;
        font-size: 16px;
        color: #e94560;
      }
      .fathom-btn-icon {
        background: none;
        border: none;
        color: #fff;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
      }
      .fathom-body {
        padding: 20px;
      }
      .fathom-status {
        font-size: 13px;
        color: #a0a0a0;
        margin-bottom: 12px;
        text-align: center;
      }
      .fathom-btn-record {
        width: 100%;
        padding: 14px;
        background: #e94560;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.2s;
      }
      .fathom-btn-record:hover {
        background: #d63d56;
        transform: translateY(-1px);
      }
      .fathom-btn-record.recording {
        background: #dc3545;
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      .fathom-record-icon {
        font-size: 12px;
      }
      .fathom-transcript-preview {
        margin-top: 16px;
        max-height: 200px;
        overflow-y: auto;
        font-size: 13px;
        line-height: 1.5;
        color: #ccc;
      }
      .fathom-transcript-item {
        padding: 8px;
        margin-bottom: 8px;
        background: rgba(255,255,255,0.05);
        border-radius: 6px;
        border-left: 3px solid #e94560;
      }
      .fathom-speaker {
        font-weight: 600;
        color: #e94560;
        font-size: 12px;
        margin-bottom: 4px;
      }
      .fathom-time {
        font-size: 11px;
        color: #666;
        margin-top: 4px;
      }
    `;
    
    document.head.appendChild(styles);
    document.body.appendChild(widget);
    
    // Event listeners
    document.getElementById('fathom-record-btn').addEventListener('click', () => this.toggleRecording());
    document.getElementById('fathom-close').addEventListener('click', () => widget.remove());
  }

  setupSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          this.handleTranscript(result[0].transcript, true);
        } else {
          this.handleTranscript(result[0].transcript, false);
        }
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        this.restartRecognition();
      }
    };

    this.recognition.onend = () => {
      if (this.isRecording) {
        this.restartRecognition();
      }
    };
  }

  restartRecognition() {
    if (this.isRecording) {
      try {
        this.recognition.start();
      } catch (e) {
        setTimeout(() => this.restartRecognition(), 1000);
      }
    }
  }

  handleTranscript(text, isFinal) {
    const speaker = this.detectCurrentSpeaker();
    const entry = {
      text,
      speaker,
      timestamp: Date.now(),
      isFinal
    };

    if (isFinal) {
      this.transcriptBuffer.push(entry);
      this.updateTranscriptUI(entry);
      this.sendToBackground('TRANSCRIPT_CHUNK', entry);
    }
  }

  detectCurrentSpeaker() {
    // Platform-specific speaker detection
    if (this.meetingData.platform === 'google-meet') {
      const activeSpeaker = document.querySelector('[data-self-name]');
      return activeSpeaker?.textContent || 'Speaker';
    }
    return 'Speaker';
  }

  updateTranscriptUI(entry) {
    const preview = document.getElementById('fathom-transcript-preview');
    const div = document.createElement('div');
    div.className = 'fathom-transcript-item';
    div.innerHTML = `
      <div class="fathom-speaker">${entry.speaker}</div>
      <div>${entry.text}</div>
      <div class="fathom-time">${new Date(entry.timestamp).toLocaleTimeString()}</div>
    `;
    preview.appendChild(div);
    preview.scrollTop = preview.scrollHeight;
  }

  async toggleRecording() {
    if (!this.isRecording) {
      await this.startRecording();
    } else {
      await this.stopRecording();
    }
  }

  async startRecording() {
    try {
      // Request audio permission
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      // Start speech recognition
      this.recognition.start();
      
      // Start audio recording
      this.mediaRecorder = new MediaRecorder(this.audioStream);
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Collect data every second

      // Update UI
      this.isRecording = true;
      const btn = document.getElementById('fathom-record-btn');
      btn.classList.add('recording');
      btn.innerHTML = '<span class="fathom-record-icon">■</span> Stop Recording';
      document.getElementById('fathom-status').textContent = 'Recording in progress...';

      // Notify background
      await chrome.runtime.sendMessage({
        type: 'START_RECORDING',
        data: {
          title: this.meetingData.title,
          platform: this.meetingData.platform,
          url: window.location.href
        }
      });

    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  }

  async stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
    }
    
    if (this.recognition) {
      this.recognition.stop();
    }

    // Update UI
    this.isRecording = false;
    const btn = document.getElementById('fathom-record-btn');
    btn.classList.remove('recording');
    btn.innerHTML = '<span class="fathom-record-icon">●</span> Start Recording';
    document.getElementById('fathom-status').textContent = 'Processing...';

    // Notify background
    const result = await chrome.runtime.sendMessage({
      type: 'STOP_RECORDING',
      transcript: this.transcriptBuffer
    });

    // Show completion
    document.getElementById('fathom-status').innerHTML = 
      `✓ Recording saved! <a href="#" id="view-dashboard" style="color:#e94560">View Dashboard</a>`;
    
    document.getElementById('view-dashboard')?.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
    });
  }

  observeMeetingChanges() {
    // Watch for meeting end
    const observer = new MutationObserver(() => {
      if (this.isRecording && this.detectMeetingEnded()) {
        this.stopRecording();
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }

  detectMeetingEnded() {
    // Platform-specific end detection
    if (this.meetingData.platform === 'google-meet') {
      return document.querySelector('[data-meeting-ended]') !== null;
    }
    return false;
  }

  sendToBackground(type, data) {
    chrome.runtime.sendMessage({ type, data }).catch(console.error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new MeetingRecorder());
} else {
  new MeetingRecorder();
}
