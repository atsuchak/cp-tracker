import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. Firebase Config (Keep your credentials)
const firebaseConfig = {
    apiKey: "AIzaSyD7Rt59VPJpjqE_psCLubb96jtxX_mXGhQ",
    authDomain: "cp-tracker-782425.firebaseapp.com",
    projectId: "cp-tracker-782425",
    storageBucket: "cp-tracker-782425.firebasestorage.app",
    messagingSenderId: "926252990018",
    appId: "1:926252990018:web:1d8499a919c514453137db",
    measurementId: "G-5Y5M7KGXV2"
};

// 3. Initialize Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// --- Auth State Logic ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-view').classList.add('hidden');
        document.getElementById('app-view').classList.remove('hidden');
        loadUserData(user.uid);
    } else {
        document.getElementById('auth-view').classList.remove('hidden');
        document.getElementById('app-view').classList.add('hidden');
    }
});

// --- UI Logic ---
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
    if (section === 'add-log') document.getElementById('add-log-view').classList.remove('hidden');
    else document.getElementById('add-log-view').classList.add('hidden');
};

// --- Firebase Operations ---
window.handleEmailAuth = async () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const isLogin = document.getElementById('primary-auth-btn').innerText === 'Login';
    
    try {
        if (isLogin) await signInWithEmailAndPassword(auth, email, pass);
        else await createUserWithEmailAndPassword(auth, email, pass);
    } catch (e) { alert(e.message); }
};

// window.handleGoogleAuth = () => signInWithPopup(auth, googleProvider);
window.handleGoogleAuth = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        // The helper onAuthStateChanged will handle the redirect automatically
        console.log("User signed in:", result.user);
    } catch (error) {
        console.error("Google Auth Error:", error.code, error.message);
        
        // Handle specific common errors
        if (error.code === 'auth/popup-blocked') {
            alert("Please allow popups for this website to sign in with Google.");
        } else if (error.code === 'auth/cancelled-popup-request') {
            console.log("Popup closed before finishing.");
        } else {
            alert("Google Sign-in failed: " + error.message);
        }
    }
};
window.logout = () => signOut(auth);

// --- Data Visualization ---
async function loadUserData(userId) {
    const q = query(collection(db, `users/${userId}/logs`), orderBy("date", "desc"), limit(30));
    const querySnapshot = await getDocs(q);
    const logs = [];
    querySnapshot.forEach(doc => logs.push(doc.data()));

    updateDashboard(logs);
}

function updateDashboard(logs) {
    // 1. Today's Solved
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySolved = logs.filter(l => l.date === todayStr).reduce((a, b) => a + parseInt(b.problemsSolved), 0);
    document.getElementById('stat-today').innerText = todaySolved;

    // 2. Last 7 Days Total
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekTotal = logs
        .filter(l => new Date(l.date) >= sevenDaysAgo)
        .reduce((a, b) => a + parseInt(b.problemsSolved), 0);
    document.getElementById('stat-week').innerText = weekTotal;

    // 3. Current Streak
    let streak = 0;
    let checkDate = new Date();
    const logDates = new Set(logs.map(l => l.date));

    while (logDates.has(checkDate.toISOString().split('T')[0])) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
    }
    document.getElementById('stat-streak').innerText = `${streak}🔥`;

    renderCharts(logs);
}

// Chart.js Implementations
let charts = {};
function renderCharts(logs) {
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    const ctxBar = document.getElementById('barChart').getContext('2d');
    const ctxDoughnut = document.getElementById('doughnutChart').getContext('2d');

    if (charts.line) charts.line.destroy();
    if (charts.bar) charts.bar.destroy();
    if (charts.doughnut) charts.doughnut.destroy();

    // --- Line Chart (Activity) ---
    const activityData = logs.slice().reverse();
    charts.line = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: activityData.map(l => l.date),
            datasets: [{
                label: 'Solved',
                data: activityData.map(l => l.problemsSolved),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- Bar Chart (Topics) ---
    const topicMap = {};
    logs.forEach(l => l.topics.forEach(t => topicMap[t] = (topicMap[t] || 0) + 1));
    
    charts.bar = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: Object.keys(topicMap),
            datasets: [{
                label: 'Frequency',
                data: Object.values(topicMap),
                backgroundColor: '#8b5cf6'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // --- Doughnut Chart (Difficulty) ---
    const diffMap = { Easy: 0, Medium: 0, Hard: 0 };
    logs.forEach(l => diffMap[l.difficulty] = (diffMap[l.difficulty] || 0) + 1);

    charts.doughnut = new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: {
            labels: Object.keys(diffMap),
            datasets: [{
                data: Object.values(diffMap),
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
    });
}

// --- Form Submission ---
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
    } catch (err) { alert("Error saving log: " + err.message); }
};