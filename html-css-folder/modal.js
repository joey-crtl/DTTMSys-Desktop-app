const logoutModal = document.getElementById('logoutModal');
const closeModalBtn = document.getElementById('closeModal');
const confirmBtn = document.getElementById('confirmBtn');
const cancelBtn = document.getElementById('cancelBtn');

// Show modal when logout link clicked
function logout() {
  logoutModal.style.display = 'flex';
}

// Close modal with fade-out
function closeLogoutModal() {
  const modalContent = logoutModal.querySelector('.modal-content');
  modalContent.style.animation = 'fadeOut 0.3s forwards';
  setTimeout(() => {
    logoutModal.style.display = 'none';
    modalContent.style.animation = 'fadeIn 0.3s ease-in-out';
  }, 300);
}

// Confirm logout
function confirmLogout() {
  localStorage.removeItem('user');
  sessionStorage.removeItem('user');
  document.cookie = 'userSession=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  window.location.href = 'admin.html';
}

// Event listeners
closeModalBtn.addEventListener('click', closeLogoutModal);
cancelBtn.addEventListener('click', closeLogoutModal);
confirmBtn.addEventListener('click', confirmLogout);

// Close if clicking outside modal
window.addEventListener('click', (e) => {
  if (e.target === logoutModal) closeLogoutModal();
});

// Close modal with Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLogoutModal();
});
