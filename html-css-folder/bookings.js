document.addEventListener("DOMContentLoaded", async () => {
  const tableBody = document.querySelector(".booking-table tbody");
  const datePicker = document.getElementById("datePicker");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const pageIndicator = document.getElementById("pageIndicator");

  const scheduleModal = document.getElementById("scheduleModal");
  const closeScheduleModal = document.getElementById("closeScheduleModal");
  const cancelScheduleBtn = document.getElementById("cancelScheduleBtn");
  const confirmScheduleBtn = document.getElementById("confirmScheduleBtn");
  const scheduleDateInput = document.getElementById("scheduleDate");
  const scheduleName = document.getElementById("scheduleName");
  const scheduleTimeInput = document.getElementById("scheduleTime");

  let selectedBooking = null;
  let currentPage = 1;
  const rowsPerPage = 10;
  let bookings = [];
  let filteredBookings = [];

  async function sendSMS(recipient, message) {
    try {
        const res = await fetch("https://app.philsms.com/api/v3/sms/send", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${PH_SMS_API_KEY}` // use the env key
        },
        body: JSON.stringify({
            recipient: recipient,
            message: message,
            sender: "PhilSMS"
        })
        });
        const data = await res.json();
        console.log("✅ SMS sent:", data);
    } catch (err) {
        console.error("❌ SMS failed:", err);
    }
    }

  function formatDate(date) {
    if (!date) return "";
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  async function loadBookings() {
    try {
      bookings = await window.api.getBookings();
      bookings = bookings.map(b => ({ ...b, destination: b.destination || "Unknown" }));
      filteredBookings = [...bookings];
      renderBookings();
    } catch (err) {
      console.error("Failed to load bookings:", err);
    }
  }

  function paginate(data, page) {
    return data.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  }

  function updatePagination() {
    const totalPages = Math.ceil(filteredBookings.length / rowsPerPage);
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage >= totalPages;
  }

  function getStatusClass(status) {
    switch (status) {
      case "FullyPaid":
        return "payment-btn full";
      case "HalfPaid":
        return "payment-btn half";
      case "Cancelled":
        return "payment-btn cancelled";
      default:
        return "payment-btn";
    }
  }

function openScheduleModal(booking) {
  console.log("🟢 openScheduleModal fired", booking);
  selectedBooking = booking;

  scheduleName.textContent = `Passenger: ${booking.full_name}, Package: ${booking.package_name || "Unknown"}, Ref ID: ${booking.reference_id || "N/A"}`;

  scheduleDateInput.value = "";
  scheduleTimeInput.value = "";

  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split("T")[0];
  scheduleDateInput.min = localDate;

  if (booking.travel_date) {
    const d = new Date(booking.travel_date);
    const adjusted = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    scheduleDateInput.value = adjusted.toISOString().split("T")[0];
    scheduleTimeInput.value = adjusted.toTimeString().slice(0, 5);
  }

  scheduleModal.classList.add("show");
}

  scheduleDateInput.addEventListener("change", () => {
    const selected = new Date(scheduleDateInput.value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selected < today) {
      alert("Cannot select a past date.");
      scheduleDateInput.value = "";
    }
  });

confirmScheduleBtn.onclick = async () => {
  if (!scheduleDateInput.value) return alert("Please select a travel date");
  if (!scheduleTimeInput.value) return alert("Please select a travel time");

  confirmScheduleBtn.disabled = true;
  confirmScheduleBtn.textContent = "Processing...";

  try {
    const booking = selectedBooking;

    const dateTimeLocal = new Date(`${scheduleDateInput.value}T${scheduleTimeInput.value}`);
    const formattedDateTime = new Date(dateTimeLocal.getTime() - dateTimeLocal.getTimezoneOffset() * 60000).toISOString();

    // Update travel date and create schedule
    await window.api.updateBookingDate({ id: booking.id, travel_date: formattedDateTime });
    await window.api.createSchedule({
      booking_id: booking.id,
      reference_id: booking.package_id || null,
      local_reference_id: booking.local_package_id || null,
      travel_date: formattedDateTime
    });

    // Mark booking as FullyPaid
    const res = await window.api.updateBookingStatus({ id: booking.id, status: "FullyPaid" });
    if (!res.success) {
      alert(res.message || "Failed to update booking");
      return;
    }

    await window.api.updateAvailableSeats({
      packageId: booking.package_id || booking.local_package_id,
      passengers: booking.passengers,
      table: booking.package_id ? "package_info" : "local_package_info"
    });

    // ---- SEND EMAILJS ----
    const emailParams = {
      to_email: booking.email,
      passenger_name: booking.full_name,
      package_name: booking.package_name || "Unknown",
      travel_date: formatDate(booking.travel_date),
      reference_id: booking.reference_id || "N/A",
      passengers: booking.passengers,
      adults: booking.adults || booking.passengers,
      children: booking.children || 0,
    };

    emailjs.send("YOUR_SERVICE_ID", "YOUR_TEMPLATE_ID", emailParams)
      .then(() => console.log("✅ FullyPaid email sent successfully!"))
      .catch(err => console.error("❌ EmailJS error:", err));
    
    const smsMessage = `Hello ${booking.full_name}, your booking for ${booking.package_name || "Unknown"} is now Fully Paid.
    Travel Date: ${scheduleDateInput.value}.
    Ref ID: ${booking.reference_id || "N/A"}.
    Please wait for the official schedule that will be sent to your email.
    Thank you for choosing Doctor Travel and Tours!`;

    sendSMS(booking.phone_number, smsMessage);

    scheduleModal.style.display = "none";
    loadBookings();
    document.dispatchEvent(new Event("bookingUpdated"));
    alert("✅ Schedule confirmed and FullyPaid status set!");
  } catch (err) {
    console.error("❌ Confirm schedule failed:", err);
    alert("Error confirming schedule");
  } finally {
    confirmScheduleBtn.disabled = false;
    confirmScheduleBtn.textContent = "Confirm";
  }
};

closeScheduleModal.addEventListener("click", () => {
  scheduleModal.classList.remove("show");
});

cancelScheduleBtn.addEventListener("click", () => {
  scheduleModal.classList.remove("show");
});



  function renderBookings() {
    tableBody.innerHTML = "";
    const pageData = paginate(filteredBookings, currentPage);

    if (!pageData.length) {
      tableBody.innerHTML = `<tr><td colspan="8">No bookings found</td></tr>`;
      pageIndicator.textContent = "";
      return;
    }

    pageData.forEach((b, i) => {
      const row = document.createElement("tr");
      const rowIndex = i + 1 + (currentPage - 1) * rowsPerPage;

      let paymentButtonsHTML = "";

      if (b.status === "FullyPaid" || b.status === "Cancelled") {
        paymentButtonsHTML = `
          <button class="payment-btn full" disabled>Fully Paid</button>
          <button class="payment-btn half" disabled>Half Paid</button>
          <button class="payment-btn cancelled" disabled>Cancelled</button>
        `;
      } else {
        paymentButtonsHTML = `
          <button class="payment-btn full">Fully Paid</button>
          <button class="payment-btn half" onclick="setPayment('${b.id}', 'HalfPaid')">Half Paid</button>
          <button class="payment-btn cancelled" onclick="setPayment('${b.id}', 'Cancelled')">Cancelled</button>
        `;
      }

      row.innerHTML = `
        <td>${rowIndex}</td>
        <td>${b.full_name || "Unknown"}</td>
        <td>${b.email || "Unknown"}</td>
        <td>${b.destination || "Unknown"}</td>
        <td>${b.passengers ?? "Unknown"}</td>
        <td><span class="${getStatusClass(b.status)}">${b.status || "Pending"}</span></td>
        <td>${formatDate(b.travel_date)}</td>
        <td>${paymentButtonsHTML}</td>
      `;

      if (b.status !== "FullyPaid" && b.status !== "Cancelled") {
        const fullyPaidBtn = row.querySelector(".payment-btn.full");
        fullyPaidBtn.addEventListener("click", () => openScheduleModal(b));
      }

      tableBody.appendChild(row);
    });

    updatePagination();
  }

window.setPayment = async function (id, status) {
  try {
    const booking = filteredBookings.find(b => b.id === id);

    if (status === "Cancelled" && !confirm("Are you sure you want to cancel this booking?")) {
      return;
    }

    const res = await window.api.updateBookingStatus({ id, status });
    if (res.success) {
      if (status === "FullyPaid" && booking) {
        await window.api.updateAvailableSeats({
          packageId: booking.package_id || booking.local_package_id,
          passengers: booking.passengers,
          table: booking.package_id ? "package_info" : "local_package_info"
        });

        const emailParams = {
          to_email: booking.email,
          passenger_name: booking.full_name,
          package_name: booking.package_name || "Unknown",
          travel_date: formatDate(booking.travel_date),
          reference_id: booking.reference_id || "N/A",
          passengers: booking.passengers,
          adults: booking.adults || booking.passengers,
          children: booking.children || 0,
        };

        emailjs.send("service_26qqg9m", "template_477ij3u", emailParams)
          .then(() => console.log("✅ FullyPaid email sent successfully!"))
          .catch(err => console.error("❌ EmailJS error:", err));

        const smsMessage = `Hello ${booking.full_name}, your booking for ${booking.package_name || "Unknown"} is now Fully Paid. Travel Date: ${formatDate(booking.travel_date)}. Ref ID: ${booking.reference_id || "N/A"}.`;
            sendSMS(booking.phone_number, smsMessage);
      }



      if (booking) booking.status = status;
      renderBookings();
      document.dispatchEvent(new Event("bookingUpdated"));
    } else {
      alert(res.message || "Failed to update status");
    }

  } catch (err) {
    console.error(err);
    alert("Failed to update status");
  } 
}; 

  datePicker.addEventListener("change", () => {
    currentPage = 1;
    filteredBookings = datePicker.value
      ? bookings.filter(b => formatDate(b.travel_date) === datePicker.value)
      : [...bookings];
    renderBookings();
  });

  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderBookings();
    }
  });

  nextBtn.addEventListener("click", () => {
    const totalPages = Math.ceil(filteredBookings.length / rowsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderBookings();
    }
  });

  setInterval(loadBookings, 10000);
  await loadBookings();
});
