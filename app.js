import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy, limit, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD7Rt59VPJpjqE_psCLubb96jtxX_mXGhQ",
    authDomain: "cp-tracker-782425.firebaseapp.com",
    projectId: "cp-tracker-782425",
    storageBucket: "cp-tracker-782425.firebasestorage.app",
    messagingSenderId: "926252990018",
    appId: "1:926252990018:web:1d8499a919c514453137db",
    measurementId: "G-5Y5M7KGXV2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

let currentLogs = [];
let charts = {};

// --- Auth State with Email Verification ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Check if email is verified (only for email/password users, Google users are auto-verified)
        if (!user.emailVerified && user.providerData[0].providerId === 'password') {
            // Show verification pending message
            document.getElementById('auth-view').classList.remove('hidden');
            document.getElementById('app-view').classList.add('hidden');
            
            // Show verification pending message if not already shown
            const authContainer = document.querySelector('#auth-view .glass-card');
            if (authContainer && !authContainer.querySelector('#verification-pending')) {
                const pendingDiv = document.createElement('div');
                pendingDiv.id = 'verification-pending';
                pendingDiv.className = 'mt-6 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20';
                pendingDiv.innerHTML = `
                    <p class="text-sm font-bold text-yellow-600 mb-2">Email Not Verified</p>
                    <p class="text-xs text-yellow-500 mb-3">Please verify your email to access the dashboard. Check your inbox (and spam folder) for the verification link.</p>
                    <button onclick="resendVerification()" 
                            class="w-full py-2 bg-yellow-500 hover:bg-yellow-400 text-white rounded-xl text-sm font-bold transition mb-2">
                        Resend Verification Email
                    </button>
                    <button onclick="logout()" 
                            class="w-full py-2 bg-slate-500/10 hover:bg-slate-500/20 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold transition">
                        Back to Login
                    </button>
                `;
                authContainer.appendChild(pendingDiv);
            }
            
            // Don't sign out, just show the message
            return;
        }
        
        // User is verified - proceed to app
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
        await loadUserData(user.uid);
        await syncProfile(user.uid);
        await initializeTargets(user.uid);
        await loadDailyTasks(user.uid);
    } else {
        document.getElementById('auth-view').classList.remove('hidden');
        document.getElementById('app-view').classList.add('hidden');
        
        // Remove verification pending message if it exists
        const pendingDiv = document.getElementById('verification-pending');
        if (pendingDiv) pendingDiv.remove();
    }
});

window.toggleMobileMenu = () => {
    const menu = document.getElementById('mobile-menu');
    const isHidden = menu.classList.toggle('hidden');
    
    // Sync theme icon in mobile menu
    const isDark = document.documentElement.classList.contains('dark');
    const mobileThemeIcon = document.getElementById('mobile-theme-icon');
    if (mobileThemeIcon) {
        mobileThemeIcon.innerText = isDark ? '🌙' : '☀️';
    }

    // Prevent body scroll when menu is open
    document.body.style.overflow = isHidden ? 'auto' : 'hidden';
};

// Existing toggleTheme function update (if needed)
const originalToggleTheme = window.toggleTheme;
window.toggleTheme = () => {
    originalToggleTheme();
    // Update mobile icon as well
    const mobileThemeIcon = document.getElementById('mobile-theme-icon');
    if (mobileThemeIcon) {
        mobileThemeIcon.innerText = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
    }
};

const formatDriveUrl = (url) => {
    if (url && url.includes('drive.google.com')) {
        const fileId = url.split('/d/')[1]?.split('/')[0];
        if (fileId) {
            return `https://lh3.googleusercontent.com/d/${fileId}`;
        }
    }
    return url;
};

async function syncProfile(uid) {
    try {
        const docSnap = await getDoc(doc(db, "users", uid, "profile", "data"));
        const navAvatar = document.getElementById('nav-avatar');

        if (docSnap.exists() && navAvatar) {
            const data = docSnap.data();
            if (data.photoURL) {
                navAvatar.src = formatDriveUrl(data.photoURL);
            } else {
                // Generate a clean default with the user's name
                const initials = data.name ? data.name.charAt(0) : 'U';
                navAvatar.src = `https://ui-avatars.com/api/?name=${initials}&background=0D1117&color=fff&bold=true`;
            }
        }
    } catch (e) {
        console.error("Profile sync error", e);
    }
}

// --- Data Loading & Dashboards ---
async function loadUserData(userId) {
    const q = query(collection(db, `users/${userId}/logs`), orderBy("date", "desc"), limit(50));
    const querySnapshot = await getDocs(q);
    currentLogs = [];
    querySnapshot.forEach(doc => currentLogs.push(doc.data()));

    updateDashboard(currentLogs);
    calculateWeeklyPerformance(currentLogs);
    generateSmartInsights(currentLogs);
}

function updateDashboard(logs) {
    // Use local date string (YYYY-MM-DD) to match log-form format
    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA'); 

    // 1. Calculate Today's Solved Count
    const todaySolved = logs
        .filter(l => l.date === todayStr)
        .reduce((a, b) => a + (parseInt(b.problemsSolved) || 0), 0);
    
    if (document.getElementById('stat-today')) {
        document.getElementById('stat-today').innerText = todaySolved;
    }

    // 2. Calculate 7-Day Total
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const weekTotal = logs
        .filter(l => new Date(l.date) >= sevenDaysAgo)
        .reduce((a, b) => a + (parseInt(b.problemsSolved) || 0), 0);
    
    if (document.getElementById('stat-week')) {
        document.getElementById('stat-week').innerText = weekTotal;
    }

    // 3. Calculate Streak (The Fix)
    let streak = 0;
    const logDates = new Set(logs.map(l => l.date));
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');

    // Check if we should start counting from today or yesterday
    // This prevents the streak from showing 0 if you haven't logged yet today
    let checkDate = logDates.has(todayStr) ? today : (logDates.has(yesterdayStr) ? yesterday : null);

    if (checkDate) {
        // Create a new date instance for the loop to avoid mutating the original
        let loopDate = new Date(checkDate);
        while (logDates.has(loopDate.toLocaleDateString('en-CA'))) {
            streak++;
            loopDate.setDate(loopDate.getDate() - 1);
        }
    }

    if (document.getElementById('stat-streak')) {
        document.getElementById('stat-streak').innerText = streak;
    }

    // 4. Update Charts and Target UI
    renderCharts(logs);
    
    // Ensure Target UI updates whenever dashboard data changes
    const user = auth.currentUser;
    if (user) {
        const targetRef = doc(db, "users", user.uid, "targets", "current");
        getDoc(targetRef).then(tSnap => {
            if (tSnap.exists()) {
                updateTargetUI(tSnap.data().weeklyGoal);
            }
        });
    }
}

// --- TARGET SYSTEM ---
async function initializeTargets(userId) {
    const targetRef = doc(db, "users", userId, "targets", "current");
    const tSnap = await getDoc(targetRef);

    let weeklyGoal = 20;
    if (tSnap.exists()) {
        weeklyGoal = tSnap.data().weeklyGoal;
    }
    updateTargetUI(weeklyGoal);
}

function updateTargetUI(goal) {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - (startOfWeek.getDay() + 6) % 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const currentWeekLogs = currentLogs.filter(l => new Date(l.date) >= startOfWeek);
    const solved = currentWeekLogs.reduce((a, b) => a + (parseInt(b.problemsSolved) || 0), 0);

    const percent = Math.min(Math.round((solved / goal) * 100), 100);

    if (document.getElementById('target-percent')) document.getElementById('target-percent').innerText = `${percent}%`;
    if (document.getElementById('target-remaining')) document.getElementById('target-remaining').innerText = Math.max(goal - solved, 0);

    const circle = document.querySelector('.progress-ring');
    if (circle) {
        const offset = 440 - (percent / 100 * 440);
        circle.style.strokeDashoffset = offset;
    }
}

window.saveWeeklyTarget = async () => {
    const val = parseInt(document.getElementById('target-input').value);
    if (!val) return;
    const user = auth.currentUser;
    await setDoc(doc(db, "users", user.uid, "targets", "current"), {
        weeklyGoal: val,
        lastUpdated: new Date()
    });
    closeModals();
    initializeTargets(user.uid);
};

// --- DAILY FOCUS (TASKS) ---
window.saveDailyTask = async () => {
    const taskInput = document.getElementById('plan-task-input');
    const taskText = taskInput.value.trim();
    if (!taskText) return;

    const user = auth.currentUser;
    const todayStr = new Date().toISOString().split('T')[0];
    const planRef = doc(db, "users", user.uid, "planner", todayStr);

    try {
        const docSnap = await getDoc(planRef);
        let tasks = docSnap.exists() ? (docSnap.data().tasks || []) : [];

        tasks.push({
            id: Date.now(),
            text: taskText,
            completed: false
        });

        await setDoc(planRef, { tasks });
        renderDailyTasks(tasks);
        taskInput.value = '';
    } catch (err) { console.error("Error saving task", err); }
};

window.toggleTask = async (taskId) => {
    const user = auth.currentUser;
    const todayStr = new Date().toISOString().split('T')[0];
    const planRef = doc(db, "users", user.uid, "planner", todayStr);

    try {
        const docSnap = await getDoc(planRef);
        if (docSnap.exists()) {
            let tasks = docSnap.data().tasks;
            const taskIndex = tasks.findIndex(t => t.id === taskId);
            tasks[taskIndex].completed = !tasks[taskIndex].completed;
            await updateDoc(planRef, { tasks });
            renderDailyTasks(tasks);
        }
    } catch (err) { console.error("Toggle error", err); }
};

window.deleteTask = async (taskId) => {
    const user = auth.currentUser;
    const todayStr = new Date().toISOString().split('T')[0];
    const planRef = doc(db, "users", user.uid, "planner", todayStr);

    try {
        const docSnap = await getDoc(planRef);
        if (docSnap.exists()) {
            const tasks = docSnap.data().tasks;
            const updatedTasks = tasks.filter(t => t.id !== taskId);
            await updateDoc(planRef, { tasks: updatedTasks });
            renderDailyTasks(updatedTasks);
        }
    } catch (err) { console.error("Delete error", err); }
};

function renderDailyTasks(tasks) {
    const container = document.getElementById('planner-today-box');
    if (!container) return;
    if (!tasks || tasks.length === 0) {
        container.innerHTML = `<p class="text-sm opacity-40 italic py-4 text-center" style="color: var(--text)">No tasks for today.</p>`;
        return;
    }

    container.innerHTML = tasks.map(task => `
        <div class="group flex items-center justify-between p-4 mb-3 rounded-2xl transition-all duration-300 task-item">
            <div class="flex items-center gap-4 flex-grow cursor-pointer" onclick="toggleTask(${task.id})">
                <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-blue-600 border-blue-600' : 'border-slate-400'}">
                    ${task.completed ? '<span class="text-white text-xs">✓</span>' : ''}
                </div>
                <p class="text-sm font-medium transition-all ${task.completed ? 'line-through opacity-40' : ''}" style="color: var(--text)">
                    ${task.text}
                </p>
            </div>
            <button onclick="deleteTask(${task.id})" 
                    class="opacity-0 group-hover:opacity-100 p-2 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-all" 
                    style="color: var(--text); opacity: 0.6">
                ×
            </button>
        </div>
    `).join('');
}

async function loadDailyTasks(userId) {
    const todayStr = new Date().toISOString().split('T')[0];
    const planRef = doc(db, "users", userId, "planner", todayStr);
    const docSnap = await getDoc(planRef);
    if (docSnap.exists()) renderDailyTasks(docSnap.data().tasks);
    else renderDailyTasks([]);
}

// --- PERFORMANCE & INSIGHTS ---
function calculateWeeklyPerformance(logs) {
    if (logs.length === 0) return;
    const sevenDays = logs.filter(l => new Date(l.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const avg = (sevenDays.reduce((a, b) => a + b.problemsSolved, 0) / 7).toFixed(1);
    if (document.getElementById('perf-avg')) document.getElementById('perf-avg').innerText = avg;

    const dayMap = {};
    logs.forEach(l => { dayMap[l.date] = (dayMap[l.date] || 0) + l.problemsSolved; });
    const bestDate = Object.keys(dayMap).reduce((a, b) => dayMap[a] > dayMap[b] ? a : b, logs[0].date);
    if (document.getElementById('perf-best')) document.getElementById('perf-best').innerText = bestDate.split('-').slice(1).join('/');

    const topics = logs.flatMap(l => l.topics || []);
    const counts = topics.reduce((a, b) => { a[b] = (a[b] || 0) + 1; return a; }, {});
    const topTopic = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || "-";
    if (document.getElementById('perf-topic')) document.getElementById('perf-topic').innerText = topTopic;
}

function generateSmartInsights(logs) {
    const container = document.getElementById('insights-container');
    if (!container) return;
    container.innerHTML = '';
    const insights = [
        { text: "Consistency Alert: Aim for at least 1 problem today to keep your streak!", color: "bg-blue-500/10 text-blue-500", icon: "📈" }
    ];

    const weekendLogs = logs.filter(l => [0, 6].includes(new Date(l.date).getDay()));
    if (weekendLogs.length < logs.length * 0.2 && logs.length > 5) {
        insights.push({ text: "Weekend Slump detected. Try to solve light problems on Saturdays.", color: "bg-orange-500/10 text-orange-500", icon: "⚠️" });
    }

    insights.forEach(ins => {
        const div = document.createElement('div');
        div.className = `${ins.color} p-4 rounded-2xl flex items-start gap-3 border border-current/10`;
        div.innerHTML = `<span>${ins.icon}</span><p class="text-xs font-bold leading-tight">${ins.text}</p>`;
        container.appendChild(div);
    });
}

// --- Charts & Global Handlers ---
function renderCharts(logs) {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    Chart.defaults.color = textColor;
    if (charts.line) charts.line.destroy();
    if (charts.doughnut) charts.doughnut.destroy();

    const activityData = [...logs].reverse();
    charts.line = new Chart(document.getElementById('lineChart'), {
        type: 'line',
        data: {
            labels: activityData.map(l => l.date.split('-').slice(1).join('/')),
            datasets: [{ label: 'Solved', data: activityData.map(l => l.problemsSolved), borderColor: '#3b82f6', tension: 0.4, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.05)' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const diffMap = { Easy: 0, Medium: 0, Hard: 0 };
    logs.forEach(l => diffMap[l.difficulty] = (diffMap[l.difficulty] || 0) + 1);
    charts.doughnut = new Chart(document.getElementById('doughnutChart'), {
        type: 'doughnut',
        data: { labels: Object.keys(diffMap), datasets: [{ data: Object.values(diffMap), backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '80%' }
    });
}

// --- Authentication with Email Verification ---
window.handleEmailAuth = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const isLogin = document.getElementById('primary-auth-btn').innerText === 'Login';
    
    try {
        let userCredential;
        
        if (isLogin) {
            // Login flow
            userCredential = await signInWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;
            
            // Check if email is verified
            if (!user.emailVerified) {
                alert("⚠️ Please verify your email first. Check your inbox (and spam folder) for the verification link.");
                
                // Send verification email if not already sent recently
                await sendEmailVerification(user);
                alert("✅ A new verification email has been sent to " + user.email);
                
                // Log them out so they can't access the app
                await signOut(auth);
                return;
            }
            
            // Email verified - proceed
            alert("✅ Login successful!");
            
        } else {
            // Signup flow
            userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;
            
            // Send verification email
            await sendEmailVerification(user);
            
            alert("✅ Account created! Please check your email for verification link. You must verify your email before logging in.");
            
            // Log them out and switch back to login mode
            await signOut(auth);
            document.getElementById('auth-toggle-btn').click(); // Switch back to login
            return;
        }
    } catch (e) { 
        alert("❌ Error: " + e.message); 
    }
};

document.getElementById('resource-search-nav')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) {
            // Redirects to resources page with the search query as a URL parameter
            window.location.href = `resources.html?search=${encodeURIComponent(query)}`;
        }
    }
});

// Resend verification email
window.resendVerification = async () => {
    const user = auth.currentUser;
    if (user) {
        try {
            await sendEmailVerification(user);
            alert("✅ Verification email sent! Please check your inbox (and spam folder).");
        } catch (error) {
            alert("❌ Error sending verification email: " + error.message);
        }
    }
};

// Password reset
window.handlePasswordReset = async () => {
    const email = document.getElementById('email').value;
    if (!email) {
        alert("Please enter your email address first.");
        return;
    }
    
    try {
        await sendPasswordResetEmail(auth, email);
        alert("✅ Password reset email sent! Check your inbox.");
    } catch (error) {
        alert("❌ Error: " + error.message);
    }
};

window.handleGoogleAuth = async () => { 
    try { 
        await signInWithPopup(auth, googleProvider);
        alert("✅ Google login successful!");
    } catch (e) { 
        alert("❌ Error: " + e.message); 
    } 
};

window.logout = () => signOut(auth);

document.getElementById('log-form').onsubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;

    // The date is pulled directly from the read-only input
    const liveDate = document.getElementById('log-date').value;

    const logData = {
        date: liveDate,
        platform: document.getElementById('log-platform').value,
        problemsSolved: parseInt(document.getElementById('log-count').value),
        difficulty: document.getElementById('log-diff').value,
        topics: document.getElementById('log-topics').value.split(',').map(s => s.trim()),
        createdAt: new Date()
    };

    try {
        await addDoc(collection(db, `users/${user.uid}/logs`), logData);
        closeModals();
        await loadUserData(user.uid);
        initializeTargets(user.uid);
        e.target.reset();
    } catch (err) {
        alert("Error committing progress: " + err.message);
    }
};

window.toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    document.getElementById('theme-icon').innerText = isDark ? '☀️' : '🌙';
    if (currentLogs.length) renderCharts(currentLogs);
};

window.toggleAuthMode = () => {
    const btn = document.getElementById('primary-auth-btn');
    const toggleBtn = document.getElementById('auth-toggle-btn');
    const isLogin = btn.innerText === 'Login';
    btn.innerText = isLogin ? 'Sign Up' : 'Login';
    toggleBtn.innerText = isLogin ? 'Login' : 'Sign Up';
};

window.showSection = (section) => {
    closeModals();
    if (section === 'profile') { window.location.href = 'profile.html'; return; }
    document.getElementById('modal-overlay').classList.remove('hidden');

    if (section === 'add-log') {
        document.getElementById('add-log-view').classList.remove('hidden');
        // Set the live date automatically when opening
        const now = new Date();
        const dateString = now.toLocaleDateString('en-CA'); // Formats to YYYY-MM-DD
        document.getElementById('log-date').value = dateString;
    }

    if (section === 'set-target') document.getElementById('target-modal').classList.remove('hidden');
};