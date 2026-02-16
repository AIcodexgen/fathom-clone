// lib/recorder.js
class AudioRecorder {
  constructor() {
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.isRecording = false;
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // Also get user audio for mixed recording
      const userAudio = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Combine streams (simplified - in production use AudioContext)
      this.mediaRecorder = new MediaRecorder(this.stream);
      
      this.chunks = [];
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.mediaRecorder.start(1000);
      this.isRecording = true;
      
      return true;
    } catch (err) {
      console.error('Recording failed:', err);
      return false;
    }
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        this.isRecording = false;
        resolve(blob);
      };

      this.mediaRecorder.stop();
      this.stream?.getTracks().forEach(track => track.stop());
    });
  }
}

// Export for use in content script
window.AudioRecorder = AudioRecorder;
