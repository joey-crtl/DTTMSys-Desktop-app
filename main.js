const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const dotenv = require("dotenv");
if (process.env.NODE_ENV === "development") {
  dotenv.config(); // load from project root
} else {
  dotenv.config({ path: path.join(process.resourcesPath, ".env") }); // load from dist/resources
}
const { createClient } = require("@supabase/supabase-js");
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const BLOGS_BUCKET = "blogs";

const PHILSMS_API_TOKEN = process.env.PHILSMS_API_TOKEN || "YOUR_PHILSMS_KEY"; 

const sendSMS = async (recipient, message) => {
  const axios = require("axios");
  try {
    const response = await axios.post(
      "https://app.philsms.com/api/v3/sms/send",
      {
        recipient,
        sender_id: "YourBrand", // max 11 chars
        type: "plain",
        message,
      },
      {
        headers: {
          Authorization: `Bearer ${PHILSMS_API_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );
    return { success: true, data: response.data };
  } catch (err) {
    console.error("PhilSMS error:", err.response?.data || err.message);
    return { success: false, error: err.response?.data || err.message };
  }
};


// -------------------- Supabase --------------------
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

let mainWindow;

// -------------------- Nodemailer --------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // true if 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Generate 6-digit numeric code
function generate2FACode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hash code with HMAC-SHA256
function hash2FACode(code) {
  const hmac = crypto.createHmac('sha256', process.env.TWOFA_HMAC_SECRET || 'secret');
  hmac.update(code);
  return hmac.digest('hex');
}

// Send email code
async function sendEmail2FACode(email, code) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || '"Admin" <no-reply@example.com>',
    to: email,
    subject: 'Your sign-in code',
    text: `Your 2FA code is: ${code}\nExpires in 10 minutes.`,
  };
  return transporter.sendMail(mailOptions);
}

// -------------------- Create Window --------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "html-css-folder", "admin.html"));
}

// -------------------- Firebase --------------------
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}


// -------------------- Window Controls --------------------
ipcMain.on("window-minimize", () => mainWindow?.minimize());
ipcMain.on("window-maximize", () =>
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
);
ipcMain.on("window-close", () => mainWindow?.close());

// -------------------- Login --------------------
ipcMain.handle("login", async (event, { username, password }) => {
  try {
    const { data, error } = await supabase
      .from("admin_credentials")
      .select("*")
      .eq("username", username)
      .eq("password", password);

    if (!data || data.length === 0)
      return { success: false, message: "Invalid username or password" };
    return { success: true };
  } catch (err) {
    console.error("Login error:", err);
    return { success: false, message: "Login failed" };
  }
});

// -------------------- Admin Registration --------------------
ipcMain.handle("createAdmin", async (event, { username, password, email }) => {
  try {
    const { data, error } = await supabase
      .from("admin_credentials")
      .insert([{ username, password, email, twofa_method: 'email' }])
      .select()
      .single();

    if (error) return { success: false, message: error.message };
    return { success: true, data };
  } catch (err) {
    console.error("createAdmin error:", err);
    return { success: false, message: err.message };
  }
});


// -------------------- 2FA --------------------

  // Request/send 2FA code
  ipcMain.handle('twofa:send-code', async (event, { username }) => {
    if (!username) throw new Error('Username missing');

    const code = generate2FACode();
    const hashed = hash2FACode(code);
    const expiresAt = new Date(Date.now() + 10*60*1000); // 10 minutes

    // Update only 2FA fields
    const { error, data } = await supabase
      .from('admin_credentials')
      .update({
        twofa_code_hash: hashed,
        twofa_code_expires: expiresAt.toISOString(),
      })
      .eq('username', username.trim())
      .select()
      .single();

    if (error || !data) throw new Error("Failed to save 2FA code: " + (error?.message || "User not found"));

    // Send email to existing email
    await sendEmail2FACode(data.email, code);
    return { ok: true };
  });

  // Verify 2FA code
  ipcMain.handle('twofa:verify-code', async (event, { username, codeAttempt }) => {
    const { data, error } = await supabase
      .from('admin_credentials')
      .select('twofa_code_hash, twofa_code_expires')
      .eq('username', username.trim())
      .single();

    if (error || !data) return { ok: false, error: 'user-not-found' };

    const { twofa_code_hash, twofa_code_expires } = data;
    if (!twofa_code_hash || !twofa_code_expires) return { ok: false, error: 'no-code' };
    if (new Date(twofa_code_expires) < new Date()) return { ok: false, error: 'expired' };

    const attemptHash = hash2FACode(codeAttempt);
    // Ensure lengths match
    if (attemptHash.length !== twofa_code_hash.length) return { ok: false, error: 'invalid' };

    const valid = crypto.timingSafeEqual(Buffer.from(attemptHash, 'hex'), Buffer.from(twofa_code_hash, 'hex'));
    if (valid) {
      await supabase
        .from('admin_credentials')
        .update({ twofa_code_hash: null, twofa_code_expires: null })
        .eq('username', username.trim());
      return { ok: true };
    }
    return { ok: false, error: 'invalid' };
  });

// -------------------- Packages --------------------
ipcMain.handle("getPackages", async () => {
  try {
    const { data, error } = await supabase.from("package_info").select("*");
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("getPackages error:", err);
    return [];
  }
});

ipcMain.handle("addPackage", async (event, pkg) => {
  try {
    const { data, error } = await supabase
      .from("package_info")
      .insert([pkg])
      .select("id")
      .single();

    if (error) return { success: false, message: error.message };
    return { success: true, id: data.id };
  } catch (err) {
    console.error("addPackage error:", err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle("editPackage", async (event, pkg) => {
  try {
    const { _id, ...updateFields } = pkg;
    const { error } = await supabase
      .from("package_info")
      .update(updateFields)
      .eq("id", _id);

    if (error) return { success: false, message: error.message };
    return { success: true };
  } catch (err) {
    console.error("editPackage error:", err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle("deletePackage", async (event, id) => {
  try {
    const { error } = await supabase.from("package_info").delete().eq("id", id);
    if (error) return { success: false, message: error.message };
    return { success: true };
  } catch (err) {
    console.error("deletePackage error:", err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle("uploadPackagePhoto", async (event, { fileBase64, fileName }) => {
  try {
    const base64Data = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
    const fileBuffer = Buffer.from(base64Data, "base64");

    const { data, error } = await supabase.storage
      .from("package-photos")
      .upload(fileName, fileBuffer, { upsert: true });

    if (error) throw error;

    const publicUrl = supabase.storage.from("package-photos").getPublicUrl(fileName).data.publicUrl;
    return { success: true, publicUrl };
  } catch (err) {
    console.error("uploadPackagePhoto error:", err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle("updatePackage", async (event, pkg) => {
  const { _id, ...updateFields } = pkg;
  const { error } = await supabase.from("package_info").update(updateFields).eq("id", _id);
  if (error) return { success: false, message: error.message };
  return { success: true };
});

// -------------------- Local Packages --------------------
ipcMain.handle("getLocalPackages", async () => {
  try {
    const { data, error } = await supabase.from("local_package_info").select("*");
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("getLocalPackages error:", err);
    return [];
  }
});

ipcMain.handle("addLocalPackage", async (event, pkg) => {
  try {
    const { data, error } = await supabase
      .from("local_package_info")
      .insert([pkg])
      .select("id")
      .single();

    if (error) return { success: false, message: error.message };
    return { success: true, id: data.id };
  } catch (err) {
    console.error("addLocalPackage error:", err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle("editLocalPackage", async (event, pkg) => {
  try {
    const { _id, ...updateFields } = pkg;
    const { error } = await supabase
      .from("local_package_info")
      .update(updateFields)
      .eq("id", _id);

    if (error) return { success: false, message: error.message };
    return { success: true };
  } catch (err) {
    console.error("editLocalPackage error:", err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle("deleteLocalPackage", async (event, id) => {
  try {
    const { error } = await supabase.from("local_package_info").delete().eq("id", id);
    if (error) return { success: false, message: error.message };
    return { success: true };
  } catch (err) {
    console.error("deleteLocalPackage error:", err);
    return { success: false, message: err.message };
  }
});


ipcMain.handle("updateLocalPackage", async (event, pkg) => {
  const { _id, ...updateFields } = pkg;
  const { error } = await supabase.from("local_package_info").update(updateFields).eq("id", _id);
  if (error) return { success: false, message: error.message };
  return { success: true };
});

//--------------------Blogs--------------------------

ipcMain.handle("getBlogs", async () => {
  try {
    const { data, error } = await supabase
      .from("travel_blogs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error("getBlogs error:", err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle("create-blog", async (event, { fileBase64, fileName, title, description, media_type }) => {
  try {
    if (!fileBase64 || !fileName) return { success: false, message: "Missing file" };

    const base64Data = fileBase64.includes(",") ? fileBase64.split(",")[1] : fileBase64;
    const fileBuffer = Buffer.from(base64Data, "base64");

    // ensure folder by media type (image/video)
    const folder = (media_type && media_type.startsWith("video")) ? "video" : "image";
    const storagePath = `${folder}/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from(BLOGS_BUCKET)
      .upload(storagePath, fileBuffer, { upsert: false });

    if (uploadErr) {
      console.error("uploadBlog -> storage error:", uploadErr);
      return { success: false, message: uploadErr.message || "Storage upload failed" };
    }

    // get public url
    const publicUrl = supabase.storage.from(BLOGS_BUCKET).getPublicUrl(storagePath).data.publicUrl;

    // insert into DB
    const { error: insertErr } = await supabase
      .from("travel_blogs")
      .insert([{
        title: title || null,
        description: description || null,
        media_url: publicUrl,
        media_type: media_type && media_type.startsWith("video") ? "video" : "image"
      }]);

    if (insertErr) {
      console.error("uploadBlog -> insert error:", insertErr);
      // attempt cleanup of uploaded file (best-effort)
      try { await supabase.storage.from(BLOGS_BUCKET).remove([storagePath]); } catch (e) {}
      return { success: false, message: insertErr.message || "DB insert failed" };
    }

    return { success: true, publicUrl };
  } catch (err) {
    console.error("uploadBlog error:", err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle("deleteBlog", async (event, { id, media_url, media_type }) => {
  try {
    // delete storage object if media_url provided
    if (media_url) {
      try {
        const parts = media_url.split("/");
        let fileName = parts[parts.length - 1].split("?")[0]; // last segment w/o query
        // If you upload as folder/filename, ensure path includes folder:
        const folder = (media_type && media_type.startsWith("video")) ? "video" : "image";
        const storagePath = `${folder}/${fileName}`;
        await supabase.storage.from(BLOGS_BUCKET).remove([storagePath]);
      } catch (e) {
        // log and continue to DB delete
        console.warn("deleteBlog: storage removal warning:", e?.message || e);
      }
    }

    // delete db row
    const { error } = await supabase.from("travel_blogs").delete().eq("id", id);
    if (error) throw error;

    return { success: true };
  } catch (err) {
    console.error("deleteBlog error:", err);
    return { success: false, message: err.message };
  }
});

// -------------------- Bookings --------------------
ipcMain.handle("getBookings", async () => {
  try {
    const { data: bookings, error: bookingErr } = await supabase.from("booking_info").select("*");
    const { data: intlPackages, error: intlErr } = await supabase.from("package_info").select("*");
    const { data: localPackages, error: localErr } = await supabase.from("local_package_info").select("*");

    if (bookingErr || intlErr || localErr) throw bookingErr || intlErr || localErr;

    const packageMap = {};
    intlPackages.forEach(p => packageMap[p.id] = p.destination || "Unknown");
    localPackages.forEach(p => packageMap[p.id] = p.destination || "Unknown (Local)");

    return bookings.map(b => {
      const pkgId = b.package_id || b.local_package_id;
      return {
        ...b,
        passengers: b.passengers,
        destination: packageMap[pkgId] || "Unknown",
        status: b.status || "Pending",
      };
    });
  } catch (err) {
    console.error("getBookings error:", err);
    return [];
  }
});

ipcMain.handle("updateBookingStatus", async (event, { id, status }) => {
  try {
    const { error } = await supabase.from("booking_info").update({ status }).eq("id", id);
    if (error) return { success: false, message: error.message };
    return { success: true };
  } catch (err) {
    console.error("updateBookingStatus error:", err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle("updateAvailableSeats", async (event, { packageId, passengers, table = "package_info" }) => {
  try {
    if (!packageId || !passengers) return { success: false, message: "Missing parameters" };

    // Get current available seats
    const { data: pkgData, error: fetchErr } = await supabase
      .from(table)
      .select("available")
      .eq("id", packageId)
      .single();

    if (fetchErr) throw fetchErr;
    if (!pkgData) return { success: false, message: "Package not found" };

    const newAvailable = Math.max((pkgData.available || 0) - passengers, 0);

    const { error: updateErr } = await supabase
      .from(table)
      .update({ available: newAvailable })
      .eq("id", packageId);

    if (updateErr) throw updateErr;

    return { success: true, newAvailable };
  } catch (err) {
    console.error("updateAvailableSeats error:", err);
    return { success: false, message: err.message };
  }
});

// -------------------- Dashboard Stats --------------------
ipcMain.handle("getDashboardStats", async () => {
  try {
    const { data: bookings } = await supabase.from("booking_info").select("*");
    const { data: intlPackages } = await supabase.from("package_info").select("*");
    const { data: localPackages } = await supabase.from("local_package_info").select("*");

    const allPackages = [...(intlPackages || []), ...(localPackages || [])];
    const totalBookings = bookings.filter(b => b.status !== "Cancelled").length;
    const activeCustomers = new Set(bookings.filter(b => b.status !== "Cancelled").map(b => b.email)).size;

    let totalSales = 0;
    bookings.forEach(b => {
      if (b.status === "FullyPaid" || b.status === "Completed") {
        const pkg = allPackages.find(p => p.id === (b.package_id || b.local_package_id));
        if (pkg && pkg.price) totalSales += pkg.price * (b.passengers || 1);
      }
    });

    const packageCount = {};
    bookings.forEach(b => {
      const pkgId = b.package_id || b.local_package_id;
      if (b.status !== "Cancelled" && pkgId)
        packageCount[pkgId] = (packageCount[pkgId] || 0) + 1;
    });

    const mostBookedPackages = Object.entries(packageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => {
        const pkg = allPackages.find(p => p.id === id);
        return pkg ? { ...pkg, bookings: count } : null;
      })
      .filter(Boolean);

    return { totalBookings, activeCustomers, totalSales, mostBookedPackages };
  } catch (err) {
    console.error("getDashboardStats error:", err);
    return { totalBookings: 0, activeCustomers: 0, totalSales: 0, mostBookedPackages: [] };
  }
});

ipcMain.handle("getFirebaseActiveUsers", async () => {
  try {
    const users = [];
    let nextPageToken;

    do {
      const list = await admin.auth().listUsers(1000, nextPageToken);
      list.users.forEach(user => {
        users.push({
          uid: user.uid,
          email: user.email,
          lastLogin: user.metadata?.lastSignInTime
        });
      });
      nextPageToken = list.pageToken;
    } while (nextPageToken);

    return { success: true, count: users.length };
  } catch (err) {
    console.error("Firebase active users error:", err);
    return { success: false, count: 0, message: err.message };
  }
});

// -------------------- Schedules --------------------

ipcMain.handle("createSchedule", async (event, { booking_id, reference_id = null, local_reference_id = null, travel_date }) => {
  try {
    // Insert both possible references
    const { data, error } = await supabase
      .from("schedule_info")
      .insert([{ booking_id, reference_id, local_reference_id, travel_date }])
      .select()
      .single();

    if (error) return { success: false, message: error.message };
    return { success: true, data };
  } catch (err) {
    console.error("createSchedule error:", err);
    return { success: false, message: err.message };
  }
});

ipcMain.handle("getSchedules", async () => {
  try {
    // 1️⃣ Get schedules along with booking info
    const { data: schedules, error: scheduleErr } = await supabase
      .from("schedule_info")
      .select(`
        *,
        booking_info (
          full_name,
          package_id,
          local_package_id
        )
      `);
    if (scheduleErr) throw scheduleErr;

    // 2️⃣ Fetch all packages
    const { data: intlPackages } = await supabase.from("package_info").select("id, name");
    const { data: localPackages } = await supabase.from("local_package_info").select("id, name");

    // 3️⃣ Create lookup maps
    const intlMap = {};
    intlPackages.forEach(p => { intlMap[p.id] = p.name; });
    const localMap = {};
    localPackages.forEach(p => { localMap[p.id] = p.name; });

    // 4️⃣ Map schedules to include actual package name
    return schedules.map(s => {
      const booking = s.booking_info;
      let packageName = "Unknown";

      if (booking) {
        if (booking.package_id) packageName = intlMap[booking.package_id] || "Unknown International Package";
        else if (booking.local_package_id) packageName = localMap[booking.local_package_id] || "Unknown Local Package";
      }

      return {
        id: s.id,
        passenger_name: booking?.full_name || "Unknown",
        package_name: packageName,
        reference_id: s.reference_id || s.local_reference_id,
        travel_date: s.travel_date
      };
    });
  } catch (err) {
    console.error("getSchedules error:", err);
    return [];
  }
});

ipcMain.handle("updateBookingDate", async (event, { id, travel_date }) => {
  try {
    const { error } = await supabase
      .from("booking_info")
      .update({ travel_date })
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("updateBookingDate error:", err);
    return { success: false, message: err.message };
  }
});

// -------------------- Feedback --------------------
ipcMain.handle("getFeedbacks", async () => {
  try {
    const { data, error } = await supabase.from("feedback_info").select("*");
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("getFeedbacks error:", err);
    return [];
  }
});

ipcMain.handle("sendSMS", async (event, { recipient, message }) => {
  if (!recipient || !message) return { success: false, error: "Recipient and message required" };
  return await sendSMS(recipient, message);
});

// -------------------- App Lifecycle --------------------
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
