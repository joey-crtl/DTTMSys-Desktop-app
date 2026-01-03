document.addEventListener("DOMContentLoaded", async () => {
  const scheduleBody = document.getElementById("scheduleBody");
  const searchBox = document.getElementById("searchBox");
  const dateInput = document.getElementById("dateFilter");
  const dateIcon = document.getElementById("dateIcon");

  let schedules = [];

    dateIcon.addEventListener("click", () => {
    dateInput.showPicker?.(); // modern method
    dateInput.focus();        // fallback for some browsers
  });

  // Fetch schedules from the backend
  async function loadSchedules() {
    try {
      // This should return an array of objects with:
      // { passenger_name, package_name, reference_id, travel_date }
      schedules = await window.api.getSchedules(); 
      renderTable(schedules);
    } catch (err) {
      console.error("Failed to load schedules:", err);
    }
  }

function renderTable(data) {
  scheduleBody.innerHTML = "";

  if (!data.length) {
    scheduleBody.innerHTML = `
      <tr>
        <td colspan="6">No schedules found</td>
      </tr>`;
    return;
  }

  data.forEach((s, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${s.passenger_name || "—"}</td>
      <td>${s.passenger_count || 0}</td>
      <td>${s.destination || "—"}</td>
      <td>${s.package_name || "—"}</td>
      <td>${formatDate(s.travel_date)}</td>
    `;
    scheduleBody.appendChild(row);
  });
}

  function formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // Search functionality
  if (searchBox) {
    searchBox.addEventListener("input", function () {
      const filtered = schedules.filter(
        s =>
          (s.passenger_name && s.passenger_name.toLowerCase().includes(this.value.toLowerCase())) ||
          (s.package_name && s.package_name.toLowerCase().includes(this.value.toLowerCase()))
      );
      renderTable(filtered);
    });
  }

  await loadSchedules();
  setInterval(loadSchedules, 10000); // Refresh every 10 seconds
});
