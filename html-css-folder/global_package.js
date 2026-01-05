document.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.getElementById("addPackageBtn");
  const intlModal = document.getElementById("addPackageModal"); // International modal
  const locModal = document.getElementById("loc-addPackageModal"); // Local modal

  const intlSection = document.getElementById("international-section");
  const locSection = document.getElementById("domestic-section");

  addBtn.addEventListener("click", () => {
    // Only open the modal for the visible section
    if (intlSection.classList.contains("show-panel")) {
      intlModal.classList.add("show");
    } else if (locSection.classList.contains("show-panel")) {
      locModal.classList.add("show");
    }
  });
});