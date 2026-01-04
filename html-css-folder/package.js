document.addEventListener("DOMContentLoaded", async () => {
  // -----------------------------
  // Elements
  // -----------------------------
  const packageGrid = document.getElementById("packageGrid");
  const searchBox = document.getElementById("searchBox");
  const addBtn = document.getElementById("addPackageBtn");

  // Add Package Modal  
  const addPackageModal = document.getElementById("addPackageModal");
  const closeAddModal = document.getElementById("closeAddModal");
  const addPackageForm = document.getElementById("addPackageForm");
  const pkgMainPhotoInput = document.getElementById("pkgMainPhoto");
  const pkgPhotoInput = document.getElementById("pkgPhoto");
  const mainPreviewContainer = document.getElementById("mainPreviewContainer");
  const previewContainer = document.getElementById("previewContainer");

  // Itinerary
  const itineraryBuilder = document.getElementById("itineraryBuilder");
  const addDayBtn = document.getElementById("addDayBtn");

  // Edit Package Modal
  const editPackageModal = document.getElementById("editPackageModal");
  const editPackageForm = document.getElementById("editPackageForm");
  const editPkgId = document.getElementById("editPkgId");
  const editPkgName = document.getElementById("editPkgName");
  const editPkgPrice = document.getElementById("editPkgPrice");
  const editPkgMainPhoto = document.getElementById("editPkgMainPhoto");
  const editMainPreviewContainer = document.getElementById("editMainPreviewContainer");
  const editPkgPhoto = document.getElementById("editPkgPhoto");
  const editPreviewContainer = document.getElementById("editPreviewContainer") || document.createElement("div");
  const editExistingPhotos = document.getElementById("editExistingPhotos");

  const editItineraryBuilder = document.getElementById("editItineraryBuilder");
  const editAddDayBtn = document.getElementById("editAddDayBtn");

  const editFields = {
    destination: document.getElementById("editPkgDestination"),
    available: document.getElementById("editPkgAvailable"),
    description: document.getElementById("editPkgDescription"),
    inclusions: document.getElementById("editPkgInclusions"),
    exclusions: document.getElementById("editPkgExclusions")
  };

  // Package Details Modal
  const packageDetailsModal = document.getElementById("packageDetailsModal");
  const detailsPhotoContainer = document.getElementById("detailsPhotoContainer");
  const detailsInfoContainer = document.getElementById("detailsInfoContainer");
  const closeDetailsModal = document.getElementById("closeDetailsModal");

  // Photo Viewer
  const photoViewerModal = document.getElementById("photoViewerModal");
  const photoViewerImg = document.getElementById("photoViewerImg");
  const closePhotoViewer = document.getElementById("closePhotoViewer");
  const prevPhoto = document.getElementById("prevPhoto");
  const nextPhoto = document.getElementById("nextPhoto");

  let currentPhotoIndex = 0;
  let currentPackagePhotos = [];

  // -----------------------------
  // Helpers
  // -----------------------------
  async function uploadFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async e => {
        const fileBase64 = e.target.result;
        const fileName = `package/${Date.now()}-${file.name}`;
        try {
          const res = await window.api.uploadPackagePhoto(fileBase64, fileName);
          if (res.success || res.publicUrl) resolve(res.publicUrl);
          else reject(new Error(res.message || "Upload failed"));
        } catch (err) { reject(err); }
      };
      reader.readAsDataURL(file);
    });
  }

  function previewImage(file, container, width = "70px", height = "70px") {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.style.width = width;
      img.style.height = height;
      img.style.objectFit = "cover";
      img.style.borderRadius = "6px";
      container.appendChild(img);
    };
    reader.readAsDataURL(file);
  }

  function createDayBlock(dayNum, activities = []) {
    const block = document.createElement("div");
    block.classList.add("day-block");
    block.innerHTML = `
      <h4>Day ${dayNum}</h4>
      <div class="activities"></div>
      <button type="button" class="itinerary-btn add addActivityBtn">+ Add Activity</button>
      <button type="button" class="itinerary-btn remove removeDayBtn">Remove Day</button>
    `;
    const activitiesContainer = block.querySelector(".activities");
    function addActivity(value = "") {
      const input = document.createElement("input");
      input.type = "text";
      input.value = value;
      input.classList.add("activity-input");
      input.placeholder = "Enter activity";
      activitiesContainer.appendChild(input);
    }
    activities.forEach(a => addActivity(a));
    block.querySelector(".addActivityBtn").addEventListener("click", () => addActivity());
    block.querySelector(".removeDayBtn").addEventListener("click", () => block.remove());
    return block;
  }

  function collectItinerary(builder) {
    const days = builder.querySelectorAll(".day-block");
    return Array.from(days).map((block, i) => {
      const activities = Array.from(block.querySelectorAll(".activity-input"))
        .map(input => input.value.trim())
        .filter(v => v !== "");
      return { day: i + 1, activities };
    });
  }

  function arrayToBullets(arr) {
    if (!arr || !arr.length) return "-";
    return `<ul style="margin:0; padding-left:20px; list-style-type: disc;">` + 
      arr.map(item => {
        if (typeof item === "object" && item.day && Array.isArray(item.activities)) {
          return `<li style="margin:2px 0;"><strong>Day ${item.day}:</strong> ${item.activities.join(", ") || "-"}</li>`;
        }
        return `<li style="margin:2px 0;">${item}</li>`; 
      }).join("") + "</ul>";
  }

  // -----------------------------
  // Fetch & Render packages
  // -----------------------------
  let packages = await window.api.getPackages();
  renderPackages(packages);

  function renderPackages(list) {
    packageGrid.innerHTML = "";
    if (!list.length) {
      packageGrid.innerHTML = "<p>No packages found.</p>";
      return;
    }
    list.forEach(pkg => {
      const card = document.createElement("div");
      card.classList.add("package-card");
      card.innerHTML = `
        <div class="card-image">
          <img src="${pkg.main_photo}" alt="${pkg.name}">
        </div>

        <div class="card-body">
          <h3>${pkg.name}</h3>

          <button class="btn viewDetails">View Details</button>
          <button class="btn edit">Edit</button>
          <button class="btn delete">Delete</button>
        </div>
      `;
      packageGrid.appendChild(card);

      card.querySelector(".viewDetails").addEventListener("click", () => openDetailsModal(pkg.id));
card.querySelector(".edit").addEventListener("click", () => {
  window.internationalPackages.openEditModal(pkg.id);
});

card.querySelector(".delete").addEventListener("click", () => {
  window.internationalPackages.deletePackage(pkg.id);
});
    });
  }

  // -----------------------------
  // Open Details Modal
  // -----------------------------
function openDetailsModal(pkgId) {
  const pkg = packages.find(p => p.id === pkgId);
  if (!pkg) return;

  // Reset containers
  detailsPhotoContainer.innerHTML = "";
  detailsInfoContainer.innerHTML = "";

  // Prepare scrollable photos
  const photoScroll = document.createElement("div");
  photoScroll.style.display = "flex";
  photoScroll.style.flexDirection = "column";
  photoScroll.style.gap = "8px";
  photoScroll.style.maxHeight = "70vh";
  photoScroll.style.overflowY = "auto";
  photoScroll.style.paddingRight = "6px";
  photoScroll.style.scrollbarWidth = "thin";
  photoScroll.style.scrollbarColor = "#c1c1c1 transparent";

  const allPhotos = [pkg.main_photo, ...(pkg.add_photo || [])].filter(Boolean);
  currentPackagePhotos = allPhotos;
  currentPhotoIndex = 0;

  allPhotos.forEach((photo, index) => {
    const img = document.createElement("img");
    img.src = photo;
    img.style.width = "240px";
    img.style.height = "160px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "8px";
    img.style.cursor = "pointer";
    img.style.transition = "transform 0.2s ease";
    img.addEventListener("mouseenter", () => (img.style.transform = "scale(1.04)"));
    img.addEventListener("mouseleave", () => (img.style.transform = "scale(1)"));
    img.addEventListener("click", () => {
      currentPhotoIndex = index;
      photoViewerImg.src = currentPackagePhotos[currentPhotoIndex];
      photoViewerModal.classList.add("show");
    });
    photoScroll.appendChild(img);
  });

  detailsPhotoContainer.appendChild(photoScroll);

  // Build the right info section
  detailsInfoContainer.innerHTML = `
    <h2>${pkg.name}</h2>
    <p><strong>Price:</strong> ₱${pkg.price}</p>
    <p><strong>Available:</strong> ${pkg.available}</p>
    <p><strong>Destination:</strong> ${pkg.destination}</p>

    <h3>Description</h3>
    <p>${pkg.description || "-"}</p>

    <h3>Inclusions</h3>
    <ul>
      ${(pkg.inclusions || "")
        .split(",")
        .map(i => `<li>${i.trim()}</li>`)
        .join("")}
    </ul>

    <h3>Itinerary</h3>
    ${arrayToBullets(pkg.itinerary)}

    <h3>Exclusions</h3>
    <ul>
      ${(pkg.exclusions || "")
        .split(",")
        .map(i => `<li>${i.trim()}</li>`)
        .join("")}
    </ul>
  `;

  // Show modal
  packageDetailsModal.classList.add("show");
}


  // Close modals
  closeDetailsModal.addEventListener("click", () => packageDetailsModal.classList.remove("show"));
  window.addEventListener("click", e => { if (e.target === packageDetailsModal) packageDetailsModal.classList.remove("show"); });

  // -----------------------------
  // Search
  // -----------------------------
  searchBox.addEventListener("input", () => {
    const term = searchBox.value.toLowerCase();
    renderPackages(packages.filter(pkg => pkg.name.toLowerCase().includes(term)));
  });

  // -----------------------------
  // Add/Edit modals
  // -----------------------------
  addBtn.addEventListener("click", () => addPackageModal.classList.add("show"));
  closeAddModal.addEventListener("click", () => addPackageModal.classList.remove("show"));
  window.addEventListener("click", e => { if (e.target === addPackageModal) addPackageModal.classList.remove("show"); });

  const closeEditModalBtn = editPackageModal.querySelector(".modal-close");
  closeEditModalBtn.addEventListener("click", () => editPackageModal.classList.remove("show"));
  window.addEventListener("click", e => { if (e.target === editPackageModal) editPackageModal.classList.remove("show"); });

  // -----------------------------
  // Itinerary buttons
  // -----------------------------
  addDayBtn.addEventListener("click", () => {
    const count = itineraryBuilder.querySelectorAll(".day-block").length + 1;
    itineraryBuilder.appendChild(createDayBlock(count));
  });
  editAddDayBtn.addEventListener("click", () => {
    const count = editItineraryBuilder.querySelectorAll(".day-block").length + 1;
    editItineraryBuilder.appendChild(createDayBlock(count));
  });

  // -----------------------------
  // Photo previews
  // -----------------------------
  pkgMainPhotoInput.addEventListener("change", () => {
    mainPreviewContainer.innerHTML = "";
    const file = pkgMainPhotoInput.files[0];
    if (file) previewImage(file, mainPreviewContainer, "100px", "100px");
  });
  pkgPhotoInput.addEventListener("change", () => {
    previewContainer.innerHTML = "";
    Array.from(pkgPhotoInput.files).forEach(file => previewImage(file, previewContainer, "70px", "70px"));
  });
  editPkgMainPhoto.addEventListener("change", () => {
    editMainPreviewContainer.innerHTML = "";
    const file = editPkgMainPhoto.files[0];
    if (file) previewImage(file, editMainPreviewContainer, "100px", "100px");
  });
  editPkgPhoto.addEventListener("change", () => {
    editPreviewContainer.innerHTML = "";
    Array.from(editPkgPhoto.files).forEach(file => previewImage(file, editPreviewContainer, "70px", "70px"));
  });

  // -----------------------------
  // Add Package
  // -----------------------------
  addPackageForm.addEventListener("submit", async e => {
    e.preventDefault();
    const name = document.getElementById("pkgName").value;
    const price = parseFloat(document.getElementById("pkgPrice").value);
    const destination = document.getElementById("pkgDestination").value;
    const available = parseInt(document.getElementById("pkgAvailable").value);
    const description = document.getElementById("pkgDescription").value;
    const inclusions = document.getElementById("pkgInclusions").value;
    const exclusions = document.getElementById("pkgExclusions").value;

    if (isNaN(price) || price < 0) return alert("Invalid price.");
    if (isNaN(available) || available < 0) return alert("Invalid available number.");
    if (!pkgMainPhotoInput.files.length) return alert("Upload a main photo.");

    try {
      const mainPhotoUrl = await uploadFile(pkgMainPhotoInput.files[0]);
      const addPhotoUrls = [];
      for (const file of Array.from(pkgPhotoInput.files)) addPhotoUrls.push(await uploadFile(file));

      const itinerary = collectItinerary(itineraryBuilder);

      const result = await window.api.addPackage({
        name, price, main_photo: mainPhotoUrl, add_photo: addPhotoUrls,
        destination, available, description, itinerary,
        inclusions, exclusions
      });

      if (result.success) {
        packages = await window.api.getPackages();
        renderPackages(packages);
        addPackageForm.reset();
        mainPreviewContainer.innerHTML = "";
        previewContainer.innerHTML = "";
        itineraryBuilder.innerHTML = "";
        addPackageModal.classList.remove("show");
      } else alert("Failed to add package: " + result.message);
    } catch (err) { alert("Upload error: " + err.message); }
  });

  // -----------------------------
  // Edit Package
  // -----------------------------
async function openEditModal(id){
    const pkg = packages.find(p => p.id === id);
    if (!pkg) return;

    editPkgId.value = pkg.id;
    editPkgName.value = pkg.name;
    editPkgPrice.value = pkg.price;
    editFields.destination.value = pkg.destination || "";
    editFields.available.value = pkg.available || 0;
    editFields.description.value = pkg.description || "";
    editFields.inclusions.value = pkg.inclusions || "";
    editFields.exclusions.value = pkg.exclusions || "";

    editItineraryBuilder.innerHTML = "";
    if (pkg.itinerary && Array.isArray(pkg.itinerary)) {
      pkg.itinerary.forEach(d => editItineraryBuilder.appendChild(createDayBlock(d.day, d.activities)));
    }

    editPackageModal.main_photo = pkg.main_photo || null;
    editPackageModal.currentPhotos = [...(pkg.add_photo || [])];

    editMainPreviewContainer.innerHTML = "";
    if (pkg.main_photo) {
      const img = document.createElement("img");
      img.src = pkg.main_photo;
      img.style.width = "100px";
      img.style.height = "100px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "6px";
      editMainPreviewContainer.appendChild(img);
    }

    editExistingPhotos.innerHTML = "";
    editPackageModal.currentPhotos.forEach(photo => {
      const wrapper = document.createElement("div");
      wrapper.style.position = "relative";
      wrapper.style.display = "inline-block";
      wrapper.style.marginRight = "5px";

      const img = document.createElement("img");
      img.src = photo;
      img.style.width = "70px";
      img.style.height = "70px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "6px";

      const removeBtn = document.createElement("span");
      removeBtn.innerHTML = "&times;";
      removeBtn.style.position = "absolute";
      removeBtn.style.top = "0";
      removeBtn.style.right = "0";
      removeBtn.style.background = "rgba(0,0,0,0.5)";
      removeBtn.style.color = "white";
      removeBtn.style.cursor = "pointer";
      removeBtn.style.fontSize = "14px";
      removeBtn.style.borderRadius = "50%";
      removeBtn.style.padding = "0 4px";
      removeBtn.addEventListener("click", () => {
        editPackageModal.currentPhotos = editPackageModal.currentPhotos.filter(p => p !== photo);
        wrapper.remove();
      });

      wrapper.appendChild(img);
      wrapper.appendChild(removeBtn);
      editExistingPhotos.appendChild(wrapper);
    });

    editPreviewContainer.innerHTML = "";
    editPackageModal.classList.add("show");
  };

  editPackageForm.addEventListener("submit", async e => {
    e.preventDefault();
    const _id = editPkgId.value;
    const name = editPkgName.value;
    const price = parseFloat(editPkgPrice.value);
    const destination = editFields.destination.value;
    const available = parseInt(editFields.available.value);
    const description = editFields.description.value;
    const inclusions = editFields.inclusions.value;
    const exclusions = editFields.exclusions.value;

    if (isNaN(price) || price < 0) return alert("Invalid price.");
    if (isNaN(available) || available < 0) return alert("Invalid available number.");

    try {
      let mainPhotoUrl = editPackageModal.main_photo;
      if (editPkgMainPhoto.files[0]) mainPhotoUrl = await uploadFile(editPkgMainPhoto.files[0]);

      const addPhotoUrls = [...editPackageModal.currentPhotos];
      for (const file of Array.from(editPkgPhoto.files)) addPhotoUrls.push(await uploadFile(file));

      const itinerary = collectItinerary(editItineraryBuilder);

      const result = await window.api.updatePackage({
        _id,            // <- include _id here
        name,
        price,
        main_photo: mainPhotoUrl,
        add_photo: addPhotoUrls,
        destination,
        available,
        description,
        itinerary,
        inclusions,
        exclusions
      });


      if (result.success) {
        packages = await window.api.getPackages();
        renderPackages(packages);
        editPackageForm.reset();
        editMainPreviewContainer.innerHTML = "";
        editPreviewContainer.innerHTML = "";
        editExistingPhotos.innerHTML = "";
        editItineraryBuilder.innerHTML = "";
        editPackageModal.classList.remove("show");
      } else alert("Failed to update package: " + result.message);
    } catch (err) { alert("Upload error: " + err.message); }
  });

  // -----------------------------
  // Delete Package
  // -----------------------------
  async function deletePackage(id) {
    if (!confirm("Are you sure you want to delete this package?")) return;
    const result = await window.api.deletePackage(id);
    if (result.success) {
      packages = packages.filter(p => p.id !== id);
      renderPackages(packages);
    } else alert("Failed to delete package: " + result.message);
  }

window.internationalPackages = {openEditModal,deletePackage};

  // -----------------------------
  // Photo Viewer navigation
  // -----------------------------
  closePhotoViewer.addEventListener("click", () => photoViewerModal.classList.remove("show"));
  prevPhoto.addEventListener("click", () => {
    if (!currentPackagePhotos.length) return;
    currentPhotoIndex = (currentPhotoIndex - 1 + currentPackagePhotos.length) % currentPackagePhotos.length;
    photoViewerImg.src = currentPackagePhotos[currentPhotoIndex];
  });
  nextPhoto.addEventListener("click", () => {
    if (!currentPackagePhotos.length) return;
    currentPhotoIndex = (currentPhotoIndex + 1) % currentPackagePhotos.length;
    photoViewerImg.src = currentPackagePhotos[currentPhotoIndex];
  });

  closePhotoViewer.addEventListener("click", () => photoViewerModal.classList.remove("show"));
  window.addEventListener("click", e => { if (e.target === photoViewerModal) photoViewerModal.classList.remove("show"); });
});
