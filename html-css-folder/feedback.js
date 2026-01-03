// Highlight sidebar & load feedbacks
document.addEventListener('DOMContentLoaded', () => {
  highlightSidebar();
  loadFeedbacks();
});

// Highlight active sidebar link
function highlightSidebar() {
  const sidebarLinks = document.querySelectorAll('.aside .sidebar a');
  const currentPage = window.location.pathname.split("/").pop();
  sidebarLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === currentPage);
  });
}

// Load feedbacks from MongoDB via preload.js
async function loadFeedbacks() {
  try {
    const feedbacks = await window.api.getFeedbacks();
    const feedbackList = document.getElementById('feedbackList');
    feedbackList.innerHTML = '';

    if (!feedbacks || feedbacks.length === 0) {
      feedbackList.innerHTML = '<div class="card"><p>No feedback available yet.</p></div>';
      return;
    }

    feedbacks.sort((a, b) => new Date(b.date) - new Date(a.date));

    feedbacks.forEach(fb => {
      // Create Initials for the circle icon
      const initials = fb.name ? fb.name.split(' ').map(n => n[0]).join('').substring(0, 2) : '?';
      
      // Format the date
      const dateStr = fb.date ? new Date(fb.date).toLocaleDateString() : 'Recent';

      const card = document.createElement('div');
      card.classList.add('feedback-card');
      card.innerHTML = `
        <div class="fb-user-icon">${initials}</div>
        <div class="fb-details">
            <h3>${fb.name} <span class="fb-email">${fb.email}</span></h3>
            <p class="fb-message">"${fb.message}"</p>
        </div>
        <div class="fb-date">${dateStr}</div>
      `;
      feedbackList.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load feedbacks:', err);
    document.getElementById('feedbackList').innerHTML = '<p>Error loading feedback.</p>';
  }
}
