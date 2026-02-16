// dashboard.js
class DashboardApp {
  constructor() {
    this.meetings = [];
    this.currentView = 'dashboard';
    this.init();
  }

  async init() {
    await this.loadMeetings();
    this.renderMeetings();
    this.updateStats();
    this.setupEventListeners();
    
    // Check for URL params to open specific meeting
    const params = new URLSearchParams(window.location.search);
    const meetingId = params.get('meeting');
    if (meetingId) {
      this.openMeetingDetail(meetingId);
    }
  }

  async loadMeetings() {
    const data = await chrome.storage.local.get(null);
    this.meetings = Object.entries(data)
      .filter(([key]) => key.startsWith('meeting_'))
      .map(([_, value]) => value)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  renderMeetings() {
    const container = document.getElementById('meetings-container');
    
    if (this.meetings.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px; color: var(--text-secondary);">
          <div style="font-size: 48px; margin-bottom: 16px;">🎙️</div>
          <h3>No recordings yet</h3>
          <p style="margin-top: 8px;">Join a Google Meet, Zoom, or Teams call to start recording</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.meetings.map(meeting => `
      <div class="meeting-item" data-id="${meeting.id}">
        <div class="meeting-icon ${meeting.platform?.split('-')[0] || 'google'}">
          ${this.getPlatformIcon(meeting.platform)}
        </div>
        <div class="meeting-info">
          <div class="meeting-title">
            ${meeting.title || 'Untitled Meeting'}
            ${meeting.summary ? '<span class="tag summary">AI Summary</span>' : ''}
          </div>
          <div class="meeting-meta">
            ${this.formatDate(meeting.date)} • ${this.formatDuration(meeting.duration)} • ${meeting.transcript?.length || 0} segments
          </div>
        </div>
        <div class="meeting-tags">
          ${(meeting.actionItems || []).length > 0 ? `<span class="tag">${meeting.actionItems.length} actions</span>` : ''}
        </div>
      </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.meeting-item').forEach(item => {
      item.addEventListener('click', () => {
        this.openMeetingDetail(item.dataset.id);
      });
    });
  }

  async openMeetingDetail(meetingId) {
    const meeting = this.meetings.find(m => m.id === meetingId);
    if (!meeting) return;

    // Update URL without reloading
    window.history.pushState({}, '', `?meeting=${meetingId}`);

    document.getElementById('detail-title').textContent = meeting.title || 'Untitled Meeting';
    document.getElementById('detail-meta').textContent = 
      `${this.formatDate(meeting.date)} • ${this.formatDuration(meeting.duration)}`;

    const content = document.getElementById('detail-content');
    
    // Generate summary if not exists
    if (!meeting.summary) {
      content.innerHTML = '<div style="text-align: center; padding: 40px;">Generating AI summary...</div>';
      await this.generateSummary(meetingId);
      await this.loadMeetings(); // Reload to get updated data
    }

    const updatedMeeting = this.meetings.find(m => m.id === meetingId);
    
    content.innerHTML = `
      ${updatedMeeting.summary ? `
        <div class="detail-section">
          <h3>📝 AI Summary</h3>
          <div class="summary-box">
            ${updatedMeeting.summary}
          </div>
        </div>
      ` : ''}

      ${updatedMeeting.keyTopics ? `
        <div class="detail-section">
          <h3>🏷️ Key Topics</h3>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${updatedMeeting.keyTopics.map(topic => `<span class="tag">${topic}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      <div class="detail-section">
        <h3>✅ Action Items (${updatedMeeting.actionItems?.length || 0})</h3>
        ${(updatedMeeting.actionItems || []).length > 0 ? 
          updatedMeeting.actionItems.map(action => `
            <div class="action-item">
              <div class="action-checkbox" data-id="${action.id}"></div>
              <div class="action-text">${action.text}</div>
            </div>
          `).join('') : 
          '<p style="color: var(--text-secondary);">No action items detected</p>'
        }
      </div>

      <div class="detail-section">
        <h3>💬 Transcript</h3>
        ${(updatedMeeting.transcript || []).map((t, i) => `
          <div class="transcript-entry">
            <div class="transcript-speaker">
              ${t.speaker}
              <span class="transcript-time">${this.formatTimeOffset(t.timeOffset)}</span>
            </div>
            <div class="transcript-text">${this.highlightSearchTerms(t.text)}</div>
          </div>
        `).join('')}
      </div>

      <div class="detail-section">
        <h3>📤 Export</h3>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-primary" onclick="app.exportToPDF('${meetingId}')">Export PDF</button>
          <button class="btn" style="background: var(--bg-tertiary); color: white;" onclick="app.copyToClipboard('${meetingId}')">Copy Summary</button>
        </div>
      </div>
    `;

    document.getElementById('detail-view').classList.add('active');
  }

  async generateSummary(meetingId) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_SUMMARY',
        meetingId
      });
      return response.summary;
    } catch (err) {
      console.error('Failed to generate summary:', err);
    }
  }

  updateStats() {
    const total = this.meetings.length;
    const hours = Math.floor(this.meetings.reduce((acc, m) => acc + (m.duration || 0), 0) / 3600000);
    const actions = this.meetings.reduce((acc, m) => acc + (m.actionItems?.length || 0), 0);
    const summaries = this.meetings.filter(m => m.summary).length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-hours').textContent = hours;
    document.getElementById('stat-actions').textContent = actions;
    document.getElementById('stat-summaries').textContent = summaries;
  }

  setupEventListeners() {
    document.getElementById('close-detail').addEventListener('click', () => {
      document.getElementById('detail-view').classList.remove('active');
      window.history.pushState({}, '', window.location.pathname);
    });

    document.getElementById('search-input').addEventListener('input', (e) => {
      this.searchMeetings(e.target.value);
    });

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.currentView = item.dataset.view;
      });
    });

    document.getElementById('new-recording').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://meet.google.com' });
    });
  }

  searchMeetings(query) {
    if (!query) {
      this.renderMeetings();
      return;
    }
    
    const filtered = this.meetings.filter(m => 
      m.title?.toLowerCase().includes(query.toLowerCase()) ||
      m.transcript?.some(t => t.text.toLowerCase().includes(query.toLowerCase()))
    );
    
    // Temporarily replace meetings and render
    const original = this.meetings;
    this.meetings = filtered;
    this.renderMeetings();
    this.meetings = original;
  }

  exportToPDF(meetingId) {
    const meeting = this.meetings.find(m => m.id === meetingId);
    if (!meeting) return;

    const content = `
Meeting: ${meeting.title}
Date: ${this.formatDate(meeting.date)}
Duration: ${this.formatDuration(meeting.duration)}

SUMMARY:
${meeting.summary || 'No summary available'}

ACTION ITEMS:
${(meeting.actionItems || []).map(a => `- ${a.text}`).join('\n')}

TRANSCRIPT:
${(meeting.transcript || []).map(t => `[${this.formatTimeOffset(t.timeOffset)}] ${t.speaker}: ${t.text}`).join('\n')}
    `;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title || 'meeting'}_transcript.txt`;
    a.click();
  }

  copyToClipboard(meetingId) {
    const meeting = this.meetings.find(m => m.id === meetingId);
    if (meeting?.summary) {
      navigator.clipboard.writeText(meeting.summary);
      alert('Summary copied to clipboard!');
    }
  }

  getPlatformIcon(platform) {
    const icons = { 'google-meet': 'G', 'zoom': 'Z', 'teams': 'T' };
    return icons[platform] || 'M';
  }

  formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric' 
    });
  }

  formatDuration(ms) {
    if (!ms) return '0m';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return `${hours}h ${remaining}m`;
  }

  formatTimeOffset(ms) {
    if (!ms) return '0:00';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  highlightSearchTerms(text) {
    const searchInput = document.getElementById('search-input');
    if (!searchInput.value) return text;
    
    const terms = searchInput.value.split(' ').filter(t => t.length > 2);
    let highlighted = text;
    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlighted = highlighted.replace(regex, '<span class="highlight">$1</span>');
    });
    return highlighted;
  }
}

// Initialize
const app = new DashboardApp();
