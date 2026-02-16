// dashboard.js
class DashboardApp {
  constructor() {
    this.meetings = [];
    this.currentView = 'dashboard';
    this.init();
  }

  async init() {
    await this.loadMeetings();
    this.setupEventListeners();
    this.renderCurrentView();
    this.updateStats();
    
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

  setupEventListeners() {
    // Navigation items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        this.switchView(view);
      });
    });

    document.getElementById('close-detail').addEventListener('click', () => {
      document.getElementById('detail-view').classList.remove('active');
      window.history.pushState({}, '', window.location.pathname);
    });

    document.getElementById('search-input').addEventListener('input', (e) => {
      if (this.currentView === 'dashboard') {
        this.searchMeetings(e.target.value);
      } else if (this.currentView === 'search') {
        this.performSearch(e.target.value);
      }
    });

    document.getElementById('new-recording').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://meet.google.com' });
    });
  }

  switchView(viewName) {
    this.currentView = viewName;
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.view === viewName) {
        item.classList.add('active');
      }
    });

    // Update header title
    const titles = {
      'dashboard': 'Dashboard',
      'meetings': 'All Recordings',
      'actions': 'Action Items',
      'search': 'Ask Fathom',
      'integrations': 'Integrations'
    };
    document.querySelector('.header h1').textContent = titles[viewName] || 'Dashboard';

    // Update search placeholder
    const placeholders = {
      'dashboard': 'Search meetings...',
      'meetings': 'Filter recordings...',
      'actions': 'Search action items...',
      'search': 'Ask anything about your meetings...',
      'integrations': 'Search integrations...'
    };
    document.getElementById('search-input').placeholder = placeholders[viewName] || 'Search...';

    this.renderCurrentView();
  }

  renderCurrentView() {
    switch(this.currentView) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'meetings':
        this.renderAllRecordings();
        break;
      case 'actions':
        this.renderActionItems();
        break;
      case 'search':
        this.renderSearchView();
        break;
      case 'integrations':
        this.renderIntegrations();
        break;
      default:
        this.renderDashboard();
    }
  }

  renderDashboard() {
    // Show stats grid
    document.querySelector('.stats-grid').style.display = 'grid';
    
    // Update section title
    document.querySelector('.section-title').textContent = 'Recent Meetings';
    
    // Render meetings list
    this.renderMeetingsList(this.meetings.slice(0, 10));
  }

  renderAllRecordings() {
    // Hide stats grid
    document.querySelector('.stats-grid').style.display = 'none';
    
    // Update section title
    document.querySelector('.section-title').textContent = 'All Recordings';
    
    // Show all meetings
    this.renderMeetingsList(this.meetings);
  }

  renderActionItems() {
    // Hide stats grid
    document.querySelector('.stats-grid').style.display = 'none';
    
    // Update section title
    document.querySelector('.section-title').textContent = 'All Action Items';
    
    // Collect all action items from all meetings
    const allActions = [];
    this.meetings.forEach(meeting => {
      (meeting.actionItems || []).forEach(action => {
        allActions.push({
          ...action,
          meetingTitle: meeting.title,
          meetingId: meeting.id,
          meetingDate: meeting.date
        });
      });
    });

    const container = document.getElementById('meetings-container');
    
    if (allActions.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px; color: var(--text-secondary);">
          <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
          <h3>No action items yet</h3>
          <p style="margin-top: 8px;">Record a meeting to extract action items automatically</p>
        </div>
      `;
      return;
    }

    container.innerHTML = allActions.map(action => `
      <div class="meeting-item" data-id="${action.meetingId}">
        <div class="meeting-icon" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">
          ✅
        </div>
        <div class="meeting-info">
          <div class="meeting-title">
            ${action.text}
          </div>
          <div class="meeting-meta">
            From: ${action.meetingTitle} • ${this.formatDate(action.meetingDate)}
          </div>
        </div>
        <div class="meeting-tags">
          <span class="tag" style="${action.completed ? 'background: rgba(16, 185, 129, 0.2); color: #10b981;' : ''}">
            ${action.completed ? 'Completed' : 'Pending'}
          </span>
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

  renderSearchView() {
    // Hide stats grid
    document.querySelector('.stats-grid').style.display = 'none';
    
    // Update section title
    document.querySelector('.section-title').textContent = 'Ask Fathom - AI Search';
    
    const container = document.getElementById('meetings-container');
    
    container.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <div style="font-size: 64px; margin-bottom: 20px;">🔍</div>
        <h3 style="margin-bottom: 16px; color: var(--text-primary);">Ask anything about your meetings</h3>
        <p style="color: var(--text-secondary); margin-bottom: 24px; max-width: 500px; margin-left: auto; margin-right: auto;">
          Try asking: "What did we decide about the budget?" or "Find all action items assigned to me"
        </p>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <button class="quick-question" style="background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-secondary); padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 13px;">
            "Summarize last week's meetings"
          </button>
          <button class="quick-question" style="background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-secondary); padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 13px;">
            "What are my pending action items?"
          </button>
          <button class="quick-question" style="background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-secondary); padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 13px;">
            "Find discussions about pricing"
          </button>
        </div>
        <div id="search-results" style="margin-top: 40px; text-align: left;"></div>
      </div>
    `;

    // Add quick question handlers
    document.querySelectorAll('.quick-question').forEach(btn => {
      btn.addEventListener('click', () => {
        const question = btn.textContent.replace(/"/g, '').trim();
        document.getElementById('search-input').value = question;
        this.performSearch(question);
      });
    });
  }

  performSearch(query) {
    const resultsDiv = document.getElementById('search-results');
    if (!resultsDiv) return;

    if (!query) {
      resultsDiv.innerHTML = '';
      return;
    }

    // Simple search across all transcripts
    const results = [];
    this.meetings.forEach(meeting => {
      const matchingSegments = (meeting.transcript || []).filter(t => 
        t.text.toLowerCase().includes(query.toLowerCase())
      );
      
      if (matchingSegments.length > 0 || 
          meeting.title?.toLowerCase().includes(query.toLowerCase()) ||
          meeting.summary?.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          meeting,
          segments: matchingSegments
        });
      }
    });

    if (results.length === 0) {
      resultsDiv.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
          No results found for "${query}"
        </div>
      `;
      return;
    }

    resultsDiv.innerHTML = `
      <div style="margin-bottom: 16px; color: var(--text-secondary);">
        Found ${results.length} meeting${results.length !== 1 ? 's' : ''} related to "${query}"
      </div>
      ${results.map(r => `
        <div class="meeting-item" data-id="${r.meeting.id}" style="margin-bottom: 16px;">
          <div class="meeting-icon ${r.meeting.platform?.split('-')[0] || 'google'}">
            ${this.getPlatformIcon(r.meeting.platform)}
          </div>
          <div class="meeting-info">
            <div class="meeting-title">${r.meeting.title}</div>
            <div class="meeting-meta">
              ${this.formatDate(r.meeting.date)} • ${r.segments.length} matching segments
            </div>
            ${r.segments.slice(0, 2).map(s => `
              <div style="margin-top: 8px; padding: 8px; background: rgba(102, 126, 234, 0.1); border-radius: 6px; font-size: 13px;">
                "${this.highlightTerm(s.text, query)}"
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    `;

    // Add click handlers
    document.querySelectorAll('.meeting-item').forEach(item => {
      item.addEventListener('click', () => {
        this.openMeetingDetail(item.dataset.id);
      });
    });
  }

  renderIntegrations() {
    // Hide stats grid
    document.querySelector('.stats-grid').style.display = 'none';
    
    // Update section title
    document.querySelector('.section-title').textContent = 'Integrations';
    
    const container = document.getElementById('meetings-container');
    
    const integrations = [
      { name: 'Slack', icon: '💬', desc: 'Send summaries to Slack channels', status: 'Not connected' },
      { name: 'Notion', icon: '📝', desc: 'Export meeting notes to Notion', status: 'Not connected' },
      { name: 'Google Drive', icon: '📁', desc: 'Auto-save recordings to Drive', status: 'Not connected' },
      { name: 'HubSpot', icon: '🎯', desc: 'Sync meeting data to CRM', status: 'Not connected' },
      { name: 'Asana', icon: '✅', desc: 'Create tasks from action items', status: 'Not connected' },
      { name: 'Salesforce', icon: '☁️', desc: 'Log calls to Salesforce', status: 'Not connected' }
    ];

    container.innerHTML = integrations.map(int => `
      <div class="meeting-item" style="cursor: default;">
        <div class="meeting-icon" style="background: var(--bg-tertiary); font-size: 24px;">
          ${int.icon}
        </div>
        <div class="meeting-info">
          <div class="meeting-title" style="display: flex; align-items: center; gap: 12px;">
            ${int.name}
            <span class="tag" style="font-size: 11px;">${int.status}</span>
          </div>
          <div class="meeting-meta">${int.desc}</div>
        </div>
        <button class="btn" style="background: var(--accent); color: white; padding: 8px 16px; font-size: 13px;">
          Connect
        </button>
      </div>
    `).join('');
  }

  renderMeetingsList(meetingsToRender) {
    const container = document.getElementById('meetings-container');
    
    if (meetingsToRender.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px; color: var(--text-secondary);">
          <div style="font-size: 48px; margin-bottom: 16px;">🎙️</div>
          <h3>No recordings yet</h3>
          <p style="margin-top: 8px;">Join a Google Meet, Zoom, or Teams call to start recording</p>
        </div>
      `;
      return;
    }

    container.innerHTML = meetingsToRender.map(meeting => `
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

    window.history.pushState({}, '', `?meeting=${meetingId}`);

    document.getElementById('detail-title').textContent = meeting.title || 'Untitled Meeting';
    document.getElementById('detail-meta').textContent = 
      `${this.formatDate(meeting.date)} • ${this.formatDuration(meeting.duration)}`;

    const content = document.getElementById('detail-content');
    
    if (!meeting.summary) {
      content.innerHTML = '<div style="text-align: center; padding: 40px;">Generating AI summary...</div>';
      await this.generateSummary(meetingId);
      await this.loadMeetings();
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
            <div class="transcript-text">${t.text}</div>
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

  searchMeetings(query) {
    if (!query) {
      this.renderMeetingsList(this.meetings.slice(0, 10));
      return;
    }
    
    const filtered = this.meetings.filter(m => 
      m.title?.toLowerCase().includes(query.toLowerCase()) ||
      m.transcript?.some(t => t.text.toLowerCase().includes(query.toLowerCase()))
    );
    
    this.renderMeetingsList(filtered);
  }

  highlightTerm(text, term) {
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<span style="background: rgba(102, 126, 234, 0.4); padding: 2px 4px; border-radius: 4px;">$1</span>');
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
}

// Initialize
const app = new DashboardApp();
