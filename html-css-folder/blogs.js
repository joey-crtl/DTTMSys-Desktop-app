// Modal Controls
function openBlogModal() {
  document.getElementById("blogModal").classList.add("show");
}
function closeBlogModal() {
  document.getElementById("blogModal").classList.remove("show");
}

// Convert file to Base64
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Save Blog
async function saveBlog() {
  const title = document.getElementById("blogTitle").value.trim();
  const desc = document.getElementById("blogDesc").value.trim();
  const file = document.getElementById("blogFile").files[0];

  if (!title || !desc || !file) {
    alert("Please fill all fields and select a file!");
    return;
  }

  const base64 = await fileToBase64(file);

  const result = await window.api.createBlog({
    fileBase64: base64,
    fileName: file.name,
    title,
    description: desc,
    media_type: file.type
  });

  if (!result.success) {
    alert("Error uploading blog: " + result.message);
    return;
  }

  alert("Blog posted!");
  closeBlogModal();
  loadBlogs(); // reload table
}

// Load Blogs
async function loadBlogs() {
  const res = await window.api.getBlogs();
  if (!res.success) {
    console.error(res.message);
    return;
  }
  const blogs = res.data;

  const tbody = document.getElementById("blogsList");
  tbody.innerHTML = "";

  blogs.forEach((b, i) => {
    const mediaLabel = b.media_type.startsWith("video") ? "Video" : "Image";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${i + 1}</td>
      <td>${b.title}</td>
      <td>${b.description}</td>
      <td>${mediaLabel}</td>
      <td>${new Date(b.created_at).toLocaleString()}</td>
      <td>
        <button onclick='deleteBlog(${b.id}, "${b.media_url || ''}", "${b.media_type}")'>Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  console.log("Blogs loaded:", blogs);
}

// Delete Blog
async function deleteBlog(id, media_url, media_type) {
  if (!confirm("Delete this blog?")) return;
  await window.api.deleteBlog({ id, media_url, media_type });
  loadBlogs();
}

// Load blogs on page load
window.addEventListener("DOMContentLoaded", loadBlogs);
