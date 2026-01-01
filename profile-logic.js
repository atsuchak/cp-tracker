import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, updatePassword, deleteUser, 
    reauthenticateWithCredential, EmailAuthProvider, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, doc, getDoc, setDoc, deleteDoc, 
    collection, getDocs, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
        window.location.href = "index.html";
    }
});

const getInitials = (name) => {
    if (!name) return "CP";
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
};

async function verifyUser(password) {
    const user = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, password);
    return await reauthenticateWithCredential(user, credential);
}

window.logout = () => signOut(auth).then(() => window.location.href = "index.html");

const formatDriveUrl = (url) => {
    if (url && url.includes('drive.google.com')) {
        const fileId = url.split('/d/')[1]?.split('/')[0];
        if (fileId) {
            return `https://lh3.googleusercontent.com/u/0/d/${fileId}`;
        }
    }
    return url;
};

async function loadProfile(uid) {
    try {
        const docSnap = await getDoc(doc(db, "users", uid, "profile", "data"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Fill Inputs
            document.getElementById('profile-name').value = data.name || "";
            document.getElementById('profile-username').value = data.username || "";
            document.getElementById('profile-institution').value = data.institution || "";
            document.getElementById('profile-dob').value = data.dob || "";
            document.getElementById('profile-pic-url').value = data.photoURL || "";

            // Update UI Labels
            document.getElementById('display-name').innerText = data.name || "User";
            document.getElementById('display-username').innerText = `@${data.username || 'username'}`;

            // Image Preview
            const rawUrl = data.photoURL || "";
            const formattedUrl = formatDriveUrl(rawUrl);

            const previewImg = document.getElementById('profile-img-preview');
            previewImg.src = formattedUrl || `https://ui-avatars.com/api/?name=${getInitials(data.name || "User")}&background=020617&color=3b82f6&bold=true`;
        }
    } catch (err) { console.error(err); }
}

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
        alert("Success: Profile Updated.");
        loadProfile(user.uid);
    } catch (err) { alert(err.message); }
};

window.updatePasswordHandler = async () => {
    const newPass = document.getElementById('new-password').value;
    if (newPass.length < 6) return alert("Password too short.");

    try {
        await updatePassword(auth.currentUser, newPass);
        alert("Password updated!");
        document.getElementById('new-password').value = "";
    } catch (err) { alert(err.message); }
};

window.resetDataHandler = async () => {
    const pass = document.getElementById('confirm-password').value;
    if (!pass) return alert("Enter password to confirm reset.");
    if (!confirm("Delete ALL logs?")) return;

    try {
        await verifyUser(pass);
        const snapshot = await getDocs(collection(db, "users", auth.currentUser.uid, "logs"));
        const batch = writeBatch(db);
        snapshot.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        alert("All data wiped.");
    } catch (err) { alert(err.message); }
};

window.deleteAccountHandler = async () => {
    const pass = document.getElementById('confirm-password').value;
    if (!pass) return alert("Enter password.");
    if (!confirm("Delete account forever?")) return;

    try {
        await verifyUser(pass);
        await deleteDoc(doc(db, "users", auth.currentUser.uid, "profile", "data"));
        await deleteUser(auth.currentUser);
        window.location.href = "index.html";
    } catch (err) { alert(err.message); }
};