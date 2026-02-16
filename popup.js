// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  await loadRecentMeetings();
  setupEventListeners();
  checkActiveRecording();
});

async function loadRecentMeetings() {
  const data = await chrome.storage.local.get(null);
  const meetings = Object.entries(data)
    .filter(([key]) => key.startsWith('meeting_'))
    .map(([_, value]) => value)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const container = document.getElementById('meetings-list');
  
  if (meetings.length === 0) return;

  container.innerHTML = meetings.map(meeting => `
    <div class="meeting-card" data-id="${meeting.id}">
      <div class="meeting-title">
        <span class="platform-icon platform-${meeting.platform?.split('-')[0] || 'google'}">
          ${getPlatformIcon(meeting.platform)}
        </span>
        ${meeting.title || 'Untitled Meeting'}
      </div>
      <div class="meeting-meta">
        <span>${formatDate(meeting.date)}</span>
        <span>•</span>
        <span>${formatDuration(meeting.duration)}</span>
      </div>
    </div>
  `).join('');

  // Add click handlers
  document.querySelectorAll('.meeting-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      openDashboard(`?meeting=${id}`);
    });
  });
}

function getPlatformIcon(platform) {
  const icons = {
    'google-meet': 'G',
    'zoom': 'Z',
    'teams': 'T'
  };
  return icons[platform] || 'M';
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const diff = today - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString();
}

function formatDuration(ms) {
  if (!ms) return '0m';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remaining = mins % 60;
  return `${hours}h ${remaining}m`;
}

function setupEventListeners() {
  document.getElementById('btn-dashboard').addEventListener('click', () => openDashboard());
  document.getElementById('btn-open-dashboard').addEventListener('click', () => openDashboard());
  document.getElementById('btn-settings').addEventListener('click', () => chrome.runtime.openOptionsPage?.());
}

function openDashboard(query = '') {
  chrome.tabs.create({
    url: chrome.runtime.getURL(`dashboard.html${query}`)
  });
}

async function checkActiveRecording() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url;
  
  if (url && (url.includes('meet.google.com') || url.includes('zoom.us'))) {
    document.getElementById('status-text').innerHTML = 
      '<span class="recording-indicator"><span class="recording-dot"></span>Meeting detected - ready to record</span>';
  }
}
