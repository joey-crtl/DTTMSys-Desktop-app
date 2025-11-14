// dashboard.js

// -------------------- Helper: Stars --------------------
function getStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

// -------------------- Load Dashboard --------------------
async function loadDashboard() {
  try {
    const stats = await window.api.getDashboardStats();
    const firebaseStats = await window.api.getFirebaseActiveUsers();

    document.getElementById("totalBookings").textContent = stats.totalBookings;

    // Firebase-based active users
    document.getElementById("activeCustomers").textContent =
      firebaseStats.success ? firebaseStats.count : 0;

    const topContainer = document.getElementById("topPackages");
    topContainer.innerHTML = "";

    stats.mostBookedPackages.forEach(pkg => {
      const div = document.createElement("div");
      div.classList.add("product");
      div.innerHTML = `
        <img src="${pkg.main_photo || pkg.add_photo?.[0] || 'placeholder.jpg'}" alt="${pkg.name}">
        <div class="product-info">
          <h3>${pkg.name}</h3>
          <div class="stars">${getStars(pkg.rating || 0)}</div>
          <p class="price">₱${pkg.price?.toLocaleString() || '0'}</p>
          <p class="bookings">Bookings: ${pkg.bookings || 0}</p>
        </div>
      `;
      topContainer.appendChild(div);
    });

  } catch (err) {
    console.error("Error loading dashboard:", err);
  }
}

// -------------------- Auto-refresh --------------------
loadDashboard(); // initial load
setInterval(loadDashboard, 10000); // refresh every 10 seconds
