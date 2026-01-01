import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    updatePassword, 
    deleteUser, 
    reauthenticateWithCredential, 
    EmailAuthProvider, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    deleteDoc, 
    collection, 
    getDocs, 
    writeBatch 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = { 
    apiKey: "AIzaSyD7Rt59VPJpjqE_psCLubb96jtxX_mXGhQ",
    authDomain: "cp-tracker-782425.firebaseapp.com",
    projectId: "cp-tracker-782425",
    storageBucket: "cp-tracker-782425.firebasestorage.app",
    messagingSenderId: "926252990018",
    appId: "1:926252990018:web:1d8499a919c514453137db",
    measurementId: "G-5Y5M7KGXV2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- State Management ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadProfile(user.uid);
    } else {
        window.location.href = "index.html"; // Redirect if not logged in
    }
});

// --- Helpers ---
const getInitials = (name) => {
    if (!name) return "CP";
    return name.split(' ')
               .map(word => word[0])
               .filter(char => char)
               .join('')
               .toUpperCase()
               .slice(0, 2);
};

// Verify password for sensitive operations
async function verifyUser(password) {
    const user = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, password);
    return await reauthenticateWithCredential(user, credential);
}

// Global Logout function
window.logout = () => signOut(auth).then(() => window.location.href = "index.html");

// --- Core Functions ---

async function loadProfile(uid) {
    try {
        const docSnap = await getDoc(doc(db, "users", uid, "profile", "data"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Fill Form
            document.getElementById('profile-name').value = data.name || "";
            document.getElementById('profile-username').value = data.username || "";
            document.getElementById('profile-institution').value = data.institution || "";
            document.getElementById('profile-dob').value = data.dob || "";
            document.getElementById('profile-pic-url').value = data.photoURL || "";

            // Update Preview Image
            const previewImg = document.getElementById('profile-img-preview');
            if (data.photoURL) {
                previewImg.src = data.photoURL;
            } else {
                const initials = getInitials(data.name || "User");
                previewImg.src = `https://ui-avatars.com/api/?name=${initials}&background=random&color=fff`;
            }
        }
    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

// Update basic profile info
document.getElementById('profile-form').onsubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    const data = {
        name: document.getElementById('profile-name').value,
        username: document.getElementById('profile-username').value,
        institution: document.getElementById('profile-institution').value,
        dob: document.getElementById('profile-dob').value,
        photoURL: document.getElementById('profile-pic-url').value,
        updatedAt: new Date()
    };

    try {
        await setDoc(doc(db, "users", user.uid, "profile", "data"), data);
        alert("Success: Profile Synchronized.");
        loadProfile(user.uid); // Refresh preview
    } catch (err) {
        alert("Error updating profile: " + err.message);
    }
};

// --- Security & Data Management ---

window.updatePasswordHandler = async () => {
    const newPass = document.getElementById('new-password').value;
    if (newPass.length < 6) {
        alert("Password must be at least 6 characters.");
        return;
    }

    try {
        await updatePassword(auth.currentUser, newPass);
        alert("Password updated successfully!");
        document.getElementById('new-password').value = "";
    } catch (err) {
        if (err.code === 'auth/requires-recent-login') {
            alert("For security, please logout and login again before changing your password.");
        } else {
            alert(err.message);
        }
    }
};

window.resetDataHandler = async () => {
    const pass = document.getElementById('confirm-password').value;
    if (!pass) return alert("Please enter your current password to confirm reset.");
    
    if (!confirm("This will permanently delete ALL your progress logs. Are you sure?")) return;

    try {
        await verifyUser(pass);
        const user = auth.currentUser;
        const logsRef = collection(db, "users", user.uid, "logs");
        const snapshot = await getDocs(logsRef);

        if (snapshot.empty) {
            alert("No logs found to delete.");
            return;
        }

        const batch = writeBatch(db);
        snapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        alert("Success: All progress data has been wiped.");
        document.getElementById('confirm-password').value = "";
    } catch (err) {
        alert("Verification failed: " + err.message);
    }
};

window.deleteAccountHandler = async () => {
    const pass = document.getElementById('confirm-password').value;
    if (!pass) return alert("Please enter your password to delete account.");

    if (!confirm("FINAL WARNING: This will delete your account and all data forever.")) return;

    try {
        await verifyUser(pass);
        const user = auth.currentUser;
        const uid = user.uid;

        // Cleanup Firestore profile
        await deleteDoc(doc(db, "users", uid, "profile", "data"));
        
        // Delete Auth User
        await deleteUser(user);
        alert("Account deleted successfully.");
        window.location.href = "index.html";
    } catch (err) {
        alert("Error: " + err.message);
    }
};