// -------------------- Window control buttons --------------------
document.getElementById("min-btn").addEventListener("click", () => window.api.minimize());
document.getElementById("max-btn").addEventListener("click", () => window.api.maximize());
document.getElementById("close-btn").addEventListener("click", () => window.api.close());

// -------------------- Elements --------------------
const signInForm = document.getElementById('signInForm');
const errorMessage = document.getElementById('error-message');
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('togglePassword');

const titleElement = document.querySelector(".form-header h2");
const adminModal = document.getElementById("adminRegisterModal");
const closeAdminBtn = document.getElementById("closeAdminModal");
const registerAdminBtn = document.getElementById("registerAdminBtn");

const twoFAModal = document.getElementById("twoFAModal");
const twoFACodeInput = document.getElementById("twoFACodeInput");
const verify2FABtn = document.getElementById("verify2FABtn");
const cancel2FABtn = document.getElementById("cancel2FABtn");
const twoFAError = document.getElementById("twoFAError");
const twoFATimerDisplay = document.createElement("p");
twoFATimerDisplay.id = "twoFATimer";
twoFATimerDisplay.style.marginTop = "5px";
twoFAModal.querySelector(".modal-content").appendChild(twoFATimerDisplay);

// -------------------- State --------------------
let currentAdminData = null;
let twoFAFlowType = null; // "login" or "register"
let twoFATimerInterval;

// -------------------- Password toggle --------------------
togglePassword.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    togglePassword.textContent = type === 'password' ? '👁️' : '🙈';
});

// -------------------- 2FA Timer --------------------
function start2FATimer(durationMinutes = 10) {
    clearInterval(twoFATimerInterval);
    let timeLeft = durationMinutes * 60;

    twoFATimerDisplay.textContent = `Code expires in: ${durationMinutes}:00`;

    twoFATimerInterval = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        twoFATimerDisplay.textContent = `Code expires in: ${minutes}:${seconds.toString().padStart(2,'0')}`;
        timeLeft--;

        if (timeLeft < 0) {
            clearInterval(twoFATimerInterval);
            twoFATimerDisplay.textContent = "Code expired!";
            verify2FABtn.disabled = true;
        } else {
            verify2FABtn.disabled = false;
        }
    }, 1000);
}

// -------------------- Login Form --------------------
signInForm.addEventListener('submit', async e => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    errorMessage.textContent = '';
    if (!username || !password) return errorMessage.textContent = 'Please fill in both fields.';

    try {
        const result = await window.api.login(username, password);
        if (!result.success) return errorMessage.textContent = result.message || 'Login failed.';

        // ✅ Login successful → trigger 2FA
        await window.api.send2FACode(username);
        currentAdminData = { username };
        twoFAFlowType = "login";

        twoFACodeInput.value = '';
        twoFAError.textContent = '';
        twoFAModal.style.display = 'flex';
        start2FATimer(10); // 10-minute countdown
    } catch (err) {
        console.error(err);
        errorMessage.textContent = "Login failed. Try again.";
    }
});

// -------------------- Admin Registration --------------------
let clickCount = 0;
let clickTimer;
titleElement.addEventListener("pointerdown", e => {
    e.preventDefault();
    clickCount++;
    clearTimeout(clickTimer);
    if (clickCount === 3) {
        adminModal.style.display = "flex";
        adminModal.style.zIndex = "2000";
        clickCount = 0;
    } else {
        clickTimer = setTimeout(() => clickCount = 0, 1000);
    }
});

closeAdminBtn.addEventListener("click", () => adminModal.style.display = "none");
window.addEventListener("click", e => { if (e.target === adminModal) adminModal.style.display = "none"; });

registerAdminBtn.addEventListener("click", async () => {
    const username = document.getElementById("newAdminUsername").value.trim();
    const password = document.getElementById("newAdminPassword").value.trim();
    const email = document.getElementById("newAdminEmail").value.trim();
    if (!username || !password || !email) return alert("Enter username, password, and email");

    try {
        const res = await window.api.createAdmin({ username, password, email });
        if (!res.success) return alert("Failed to create admin: " + res.message);

        // ✅ Registration successful → trigger 2FA
        await window.api.send2FACode(username);
        currentAdminData = { username };
        twoFAFlowType = "register";

        adminModal.style.display = "none";
        twoFACodeInput.value = "";
        twoFAError.textContent = "";
        twoFAModal.style.display = "flex";
        start2FATimer(10); // 10-minute countdown
    } catch (err) {
        console.error(err);
        alert("Error registering admin: " + err.message);
    }
});

// -------------------- 2FA Verification --------------------
verify2FABtn.addEventListener("click", async () => {
    if (!currentAdminData) return;
    const code = twoFACodeInput.value.trim();
    if (!code) return twoFAError.textContent = "Please enter the 2FA code.";

    try {
        const verify = await window.api.verify2FACode(currentAdminData.username, code);
        if (!verify.ok) return twoFAError.textContent = "Invalid or expired 2FA code.";

        if (twoFAFlowType === "login") {
            window.location.href = 'dashboard.html';
        } else if (twoFAFlowType === "register") {
            alert("Admin registered successfully with 2FA!");
        }

        twoFAModal.style.display = "none";
        currentAdminData = null;
        twoFAFlowType = null;
        clearInterval(twoFATimerInterval);
    } catch (err) {
        console.error(err);
        twoFAError.textContent = "Verification failed. Try again.";
    }
});

// -------------------- Cancel 2FA --------------------
cancel2FABtn.addEventListener("click", () => {
    twoFAModal.style.display = "none";
    currentAdminData = null;
    twoFAFlowType = null;
    clearInterval(twoFATimerInterval);
});

window.addEventListener("click", e => { if (e.target === twoFAModal) twoFAModal.style.display = "none"; });
