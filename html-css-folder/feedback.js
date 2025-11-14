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
    // Use the preload API
    const feedbacks = await window.api.getFeedbacks();
    console.log('Fetched feedbacks:', feedbacks); // Check DevTools

    const feedbackList = document.querySelector('.feedback-list');
    feedbackList.innerHTML = '';

    if (!feedbacks || feedbacks.length === 0) {
      feedbackList.innerHTML = '<p>No feedback available yet.</p>';
      return;
    }

    // Sort newest first
    feedbacks.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Render each feedback
    feedbacks.forEach(fb => {
      const div = document.createElement('div');
      div.classList.add('feedback-item');
      div.innerHTML = `
        <h3>${fb.name}</h3>
        <p><strong>Email:</strong> ${fb.email}</p>
        <p><strong>Feedback:</strong> ${fb.message}</p>
      `;
      feedbackList.appendChild(div);
    });
  } catch (err) {
    console.error('Failed to load feedbacks:', err);
  }
}
