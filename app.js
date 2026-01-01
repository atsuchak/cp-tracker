import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const getInitials = (name) => {
    if (!name) return "CP";
    return name.split(' ')
               .map(word => word[0])
               .join('')
               .toUpperCase()
               .slice(0, 2);
};

// --- Auth State ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
        loadUserData(user.uid);
        
        const docSnap = await getDoc(doc(db, "users", user.uid, "profile", "data"));
        const navAvatar = document.getElementById('nav-avatar');

        if (docSnap.exists()) {
            const data = docSnap.data();
            // Priority 1: Custom Image URL | Priority 2: Initials from Name | Priority 3: Default US
            if (data.photoURL) {
                navAvatar.src = data.photoURL;
            } else {
                const initials = getInitials(data.name);
                navAvatar.src = `https://ui-avatars.com/api/?name=${initials}&background=random&color=fff`;
            }
        }
    } else {
        document.getElementById('auth-view').classList.remove('hidden');
        document.getElementById('app-view').classList.add('hidden');
    }
});

// --- Navigation ---
window.toggleAuthMode = () => {
    const btn = document.getElementById('primary-auth-btn');
    const toggleBtn = document.getElementById('auth-toggle-btn');
    const toggleText = document.getElementById('auth-toggle-text');
    const isLogin = btn.innerText === 'Login';
    
    btn.innerText = isLogin ? 'Sign Up' : 'Login';
    toggleText.innerText = isLogin ? 'Already have an account?' : "Don't have an account?";
    toggleBtn.innerText = isLogin ? 'Login' : 'Sign Up';
};

window.showSection = (section) => {
    if (section === 'profile') {
        window.location.href = 'profile.html'; // Redirect to the new page
        return;
    }
    
    const modal = document.getElementById('add-log-view');
    if (section === 'add-log') {
        modal.classList.remove('hidden');
        document.getElementById('log-date').value = new Date().toISOString().split('T')[0];
    } else {
        modal.classList.add('hidden');
    }
};

// --- Theme Management ---
window.toggleTheme = () => {
    const html = document.documentElement;
    const icon = document.getElementById('theme-icon');
    const isDark = html.classList.toggle('dark');
    
    icon.innerText = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (currentLogs.length > 0) renderCharts(currentLogs); 
};

// --- Auth Operations ---
window.handleEmailAuth = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const isLogin = document.getElementById('primary-auth-btn').innerText === 'Login';
    try {
        if (isLogin) await signInWithEmailAndPassword(auth, email, pass);
        else await createUserWithEmailAndPassword(auth, email, pass);
    } catch (e) { alert(e.message); }
};

window.handleGoogleAuth = async () => {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (e) { alert(e.message); }
};

window.logout = () => signOut(auth);

// --- Data & Charts ---
async function loadUserData(userId) {
    const q = query(collection(db, `users/${userId}/logs`), orderBy("date", "desc"), limit(30));
    const querySnapshot = await getDocs(q);
    currentLogs = [];
    querySnapshot.forEach(doc => currentLogs.push(doc.data()));
    updateDashboard(currentLogs);
}

function updateDashboard(logs) {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Today Stat
    const todaySolved = logs.filter(l => l.date === todayStr).reduce((a, b) => a + parseInt(b.problemsSolved), 0);
    document.getElementById('stat-today').innerText = todaySolved;

    // Week Stat
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekTotal = logs.filter(l => new Date(l.date) >= sevenDaysAgo).reduce((a, b) => a + parseInt(b.problemsSolved), 0);
    document.getElementById('stat-week').innerText = weekTotal;

    // Streak Stat
    let streak = 0;
    let checkDate = new Date();
    const logDates = new Set(logs.map(l => l.date));
    while (logDates.has(checkDate.toISOString().split('T')[0])) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
    }
    document.getElementById('stat-streak').innerText = streak;

    renderCharts(logs);
}

function renderCharts(logs) {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;

    if (charts.line) charts.line.destroy();
    if (charts.bar) charts.bar.destroy();
    if (charts.doughnut) charts.doughnut.destroy();

    const activityData = [...logs].reverse();

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false, // This is crucial to stop the growing glitch
        animation: {
            duration: 0 // Speeds up rendering and prevents animation-frame loops
        },
        plugins: {
            legend: {
                display: (logs.length > 0) // Hide legend if no data
            }
        }
    };

    // Line Chart
    charts.line = new Chart(document.getElementById('lineChart'), {
        type: 'line',
        data: {
            labels: activityData.map(l => l.date),
            datasets: [{
                label: 'Problems',
                data: activityData.map(l => l.problemsSolved),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true, tension: 0.4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Bar Chart
    const topicMap = {};
    logs.forEach(l => l.topics.forEach(t => { if(t) topicMap[t] = (topicMap[t] || 0) + 1 }));
    charts.bar = new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(topicMap),
            datasets: [{ data: Object.values(topicMap), backgroundColor: '#8b5cf6', borderRadius: 8 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // Doughnut Chart
    const diffMap = { Easy: 0, Medium: 0, Hard: 0 };
    logs.forEach(l => diffMap[l.difficulty]++);
    charts.doughnut = new Chart(document.getElementById('doughnutChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(diffMap),
            datasets: [{ data: Object.values(diffMap), backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%' }
    });
}

// --- Log Submission ---
document.getElementById('log-form').onsubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    const logData = {
        date: document.getElementById('log-date').value,
        platform: document.getElementById('log-platform').value,
        problemsSolved: parseInt(document.getElementById('log-count').value),
        difficulty: document.getElementById('log-diff').value,
        topics: document.getElementById('log-topics').value.split(',').map(s => s.trim()),
        createdAt: new Date()
    };

    try {
        await addDoc(collection(db, `users/${user.uid}/logs`), logData);
        showSection('dashboard');
        loadUserData(user.uid);
        e.target.reset();
    } catch (err) { alert(err.message); }
};