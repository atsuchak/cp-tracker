import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// REPLACE WITH YOUR FIREBASE CONFIG
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
const analytics = getAnalytics(app);
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

window.handleGoogleAuth = () => signInWithPopup(auth, googleProvider);
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
    // 1. Update Summary Stats
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySolved = logs.filter(l => l.date === todayStr).reduce((a, b) => a + parseInt(b.problemsSolved), 0);
    document.getElementById('stat-today').innerText = todaySolved;

    // 2. Chart logic
    renderCharts(logs);
}

// Chart.js Implementations
let charts = {};
function renderCharts(logs) {
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    const ctxBar = document.getElementById('barChart').getContext('2d');
    const ctxDoughnut = document.getElementById('doughnutChart').getContext('2d');

    // Destroy old charts if they exist
    Object.values(charts).forEach(c => c.destroy());

    // Processing Logic
    const dates = logs.map(l => l.date).reverse();
    const counts = logs.map(l => l.problemsSolved).reverse();
    
    charts.line = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Solved',
                data: counts,
                borderColor: '#3b82f6',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.1)'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Bar & Doughnut charts logic follows similar pattern...
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