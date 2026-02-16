// background.js
class MeetingManager {
  constructor() {
    this.activeRecordings = new Map();
    this.initListeners();
  }

  initListeners() {
    // Listen for recording start/stop from content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep channel open for async
    });

    // Handle tab updates to detect meeting platforms
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && this.isMeetingUrl(tab.url)) {
        this.injectMeetingControls(tabId);
      }
    });
  }

  isMeetingUrl(url) {
    return url && (
      url.includes('meet.google.com') ||
      url.includes('zoom.us') ||
      url.includes('teams.microsoft.com')
    );
  }

  async injectMeetingControls(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['lib/recorder.js', 'content.js']
      });
    } catch (err) {
      console.error('Failed to inject:', err);
    }
  }

  async handleMessage(request, sender, sendResponse) {
    switch (request.type) {
      case 'START_RECORDING':
        await this.startRecording(sender.tab.id, request.data);
        sendResponse({ success: true });
        break;
      
      case 'STOP_RECORDING':
        const result = await this.stopRecording(sender.tab.id);
        sendResponse({ success: true, data: result });
        break;
      
      case 'GET_TRANSCRIPT':
        const transcript = await this.getTranscript(request.meetingId);
        sendResponse({ transcript });
        break;
      
      case 'GENERATE_SUMMARY':
        const summary = await this.generateSummary(request.meetingId);
        sendResponse({ summary });
        break;
    }
  }

  async startRecording(tabId, meetingData) {
    const recordingId = `rec_${Date.now()}`;
    const recording = {
      id: recordingId,
      tabId,
      startTime: Date.now(),
      meetingTitle: meetingData.title,
      platform: meetingData.platform,
      transcript: [],
      audioChunks: []
    };
    
    this.activeRecordings.set(tabId, recording);
    
    // Store in chrome.storage for persistence
    await chrome.storage.local.set({ [`recording_${recordingId}`]: recording });
    
    // Create offscreen document for audio processing if needed
    await this.setupAudioProcessing();
    
    return recordingId;
  }

  async stopRecording(tabId) {
    const recording = this.activeRecordings.get(tabId);
    if (!recording) return null;

    recording.endTime = Date.now();
    recording.duration = recording.endTime - recording.startTime;
    
    // Process final transcript
    const finalTranscript = await this.processTranscript(recording);
    recording.processedTranscript = finalTranscript;
    
    // Save to storage
    await chrome.storage.local.set({ 
      [`recording_${recording.id}`]: recording,
      [`meeting_${recording.id}`]: {
        id: recording.id,
        title: recording.meetingTitle,
        date: new Date(recording.startTime).toISOString(),
        duration: recording.duration,
        transcript: finalTranscript,
        summary: null,
        actionItems: []
      }
    });

    this.activeRecordings.delete(tabId);
    return recording;
  }

  async processTranscript(recording) {
    // Combine all transcript segments
    return recording.transcript.map(t => ({
      speaker: t.speaker || 'Unknown',
      text: t.text,
      timestamp: t.timestamp,
      timeOffset: t.timestamp - recording.startTime
    }));
  }

  async generateSummary(meetingId) {
    const data = await chrome.storage.local.get(`meeting_${meetingId}`);
    const meeting = data[`meeting_${meetingId}`];
    
    if (!meeting) return null;

    // Mock AI summarization - replace with actual AI API
    const summary = await this.mockAISummarization(meeting.transcript);
    
    meeting.summary = summary.summary;
    meeting.actionItems = summary.actionItems;
    meeting.keyTopics = summary.keyTopics;
    
    await chrome.storage.local.set({ [`meeting_${meetingId}`]: meeting });
    return summary;
  }

  async mockAISummarization(transcript) {
    // Simulate AI processing delay
    await new Promise(r => setTimeout(r, 2000));
    
    const fullText = transcript.map(t => t.text).join(' ');
    
    // Simple keyword extraction for demo
    const actionKeywords = ['action', 'todo', 'task', 'follow up', 'deadline', 'assign'];
    const sentences = fullText.split(/[.!?]+/).filter(s => s.length > 10);
    
    const actionItems = sentences
      .filter(s => actionKeywords.some(k => s.toLowerCase().includes(k)))
      .map((s, i) => ({
        id: `action_${i}`,
        text: s.trim(),
        assignee: null,
        dueDate: null,
        completed: false
      }));

    return {
      summary: sentences.slice(0, 3).join('. ') + '.',
      keyTopics: ['Project Updates', 'Action Items', 'Next Steps'],
      actionItems: actionItems.slice(0, 5),
      decisions: []
    };
  }

  async setupAudioProcessing() {
    // Check if offscreen document exists, create if not
    if (await this.hasOffscreenDocument()) return;
    
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
      justification: 'Recording meeting audio'
    });
  }

  async hasOffscreenDocument() {
    const existing = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    return existing.length > 0;
  }
}

// Initialize
const manager = new MeetingManager();

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Fathom Clone installed');
});
