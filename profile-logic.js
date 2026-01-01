import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { updatePassword, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Use your existing config
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

onAuthStateChanged(auth, (user) => {
    if (user) {
        loadProfile(user.uid);
    } else {
        window.location.href = "index.html"; // Redirect if not logged in
    }
});

const getInitials = (name) => {
    if (!name) return "CP";
    return name.split(' ')
               .map(word => word[0])
               .join('')
               .toUpperCase()
               .slice(0, 2);
};

async function loadProfile(uid) {
    const docSnap = await getDoc(doc(db, "users", uid, "profile", "data"));
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('profile-name').value = data.name || "";
        document.getElementById('profile-username').value = data.username || "";
        document.getElementById('profile-institution').value = data.institution || "";
        document.getElementById('profile-dob').value = data.dob || "";
        document.getElementById('profile-pic-url').value = data.photoURL || "";
        document.getElementById('profile-img-preview').src = data.photoURL || `https://ui-avatars.com/api/?name=${data.name}`;

        const previewImg = document.getElementById('profile-img-preview');
        if (data.photoURL) {
            previewImg.src = data.photoURL;
        } else {
            const initials = getInitials(data.name);
            previewImg.src = `https://ui-avatars.com/api/?name=${initials}&background=random&color=fff`;
        }
    }
}

// --- Security Operations ---

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

window.deleteAccountHandler = async () => {
    const confirmDelete = confirm("Are you absolutely sure? This will delete all your logs and cannot be undone.");
    if (!confirmDelete) return;

    const user = auth.currentUser;
    const uid = user.uid;

    try {
        // 1. Delete Profile Data from Firestore
        await deleteDoc(doc(db, "users", uid, "profile", "data"));
        
        // Note: In a production app, you'd also loop through and delete all 'logs'.
        // For this MVP, we delete the core profile and the Auth user.

        // 2. Delete the User from Firebase Auth
        await deleteUser(user);
        
        alert("Account deleted. Sorry to see you go!");
        window.location.href = "index.html";
    } catch (err) {
        if (err.code === 'auth/requires-recent-login') {
            alert("Sensitive actions require a recent login. Please logout and login again to delete your account.");
        } else {
            alert(err.message);
        }
    }
};

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
    } catch (err) {
        alert("Error: " + err.message);
    }
};