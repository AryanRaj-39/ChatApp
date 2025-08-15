const firebaseConfig = {
  apiKey: "AIzaSyAZFr1EwNQt5EEpzu1pFqkRWob85jeEVDQ",
  authDomain: "homework-web-9ee2b.firebaseapp.com",
  databaseURL: "https://homework-web-9ee2b-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "homework-web-9ee2b",
  storageBucket: "homework-web-9ee2b.firebasestorage.app",
  messagingSenderId: "395196161306",
  appId: "1:395196161306:web:91a5a740ca356437f0a0a3"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
let currentFriend = null;
let chatID = null;
let userName = null;
let isMobile = /Mobi|Android/i.test(navigator.userAgent);

// LOGIN WITH PASSWORD CHECK
function login() {
  showLoading();
  userName = document.getElementById("username").value.trim();
  const userPass = document.getElementById("userPassword").value;
  
  if(!userName){ 
    hideLoading();
    alert("Enter your name"); 
    return; 
  }

  const userRef = db.ref("users/" + userName);
  userRef.get().then(snapshot => {
    if(snapshot.exists()) {
      const storedPass = snapshot.val().password;
      if(storedPass) {
        if(userPass !== storedPass) {
          hideLoading();
          alert("Incorrect password!");
          return;
        }
      } else {
        db.ref("notifications/" + userName).push({
          message: "Please set a strong password to protect your account.",
          time: Date.now()
        });
      }
    } else {
      userRef.set({ password: userPass || null });
    }

    localStorage.setItem("chatName", userName);
    document.getElementById("loginBox").style.display = "none";
    document.getElementById("chatContainer").style.display = "flex";
    initChat();
    hideLoading();
  }).catch(error => {
    hideLoading();
    alert("Login error: " + error.message);
  });
}

function showLoading() {
  document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}

// Set/Change password
function setPassword() {
  const newPass = prompt("Enter new strong password:");
  if(newPass) {
    showLoading();
    db.ref("users/"+userName+"/password").set(newPass)
      .then(() => {
        hideLoading();
        alert("Password updated!");
      })
      .catch(error => {
        hideLoading();
        alert("Error updating password: " + error.message);
      });
  }
}

function initChat(){
  showLoading();
  const userRef = db.ref("onlineUsers/"+userName);
  userRef.set(true);
  userRef.onDisconnect().remove();
  
  // Check for notifications
  db.ref("notifications/"+userName).once('value').then(snap => {
    if(snap.exists()) {
      snap.forEach(notification => {
        alert(notification.val().message);
      });
      db.ref("notifications/"+userName).remove();
    }
  });
  
  loadFriends();
  loadRequests();
  setInterval(cleanOldMessages, 1000*60*60);
  hideLoading();
  
  // Auto-focus message input on mobile when friend is selected
  if(isMobile) {
    document.addEventListener('click', function(e) {
      if(e.target.closest('#friendList li') || e.target.closest('#requestsList li')) {
        setTimeout(() => {
          document.getElementById('msgInput').focus();
        }, 300);
      }
    });
  }
}

function loadFriends(){
  db.ref("friends/"+userName).on("value", snap=>{
    const friends = [];
    snap.forEach(c=>{
      friends.push({ name: c.key, chatID: c.val(), online:false });
    });
    db.ref("onlineUsers").once("value").then(s=>{
      s.forEach(u=>{ friends.forEach(f=>{ if(f.name===u.key) f.online = true; }); });
      updateFriendList(friends);
    });
  });
}

function updateFriendList(friends){
  friends.sort((a,b)=>{ 
    if(a.name===userName) return -1; 
    if(b.name===userName) return 1; 
    return a.name.localeCompare(b.name); 
  });
  
  const list = document.getElementById("friendList"); 
  list.innerHTML = "";
  
  friends.forEach(friend=>{
    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.classList.add("friendDot");
    dot.classList.add(friend.online ? "online" : "offline");
    li.appendChild(dot);
    
    const nameSpan = document.createElement("span"); 
    nameSpan.textContent = friend.name; 
    li.appendChild(nameSpan);
    
    if(friend.name!==userName) {
      const removeBtn = document.createElement("button"); 
      removeBtn.textContent = "✕"; 
      removeBtn.style.marginLeft="8px";
      removeBtn.style.padding = "2px 6px";
      removeBtn.style.borderRadius = "50%";
      removeBtn.style.fontSize = "12px";
      removeBtn.style.backgroundColor = "rgba(255,255,255,0.2)";
      removeBtn.onclick = (e)=>{ 
        e.stopPropagation(); 
        removeFriend(friend.name); 
      };
      li.appendChild(removeBtn);
      
      li.onclick = ()=>{ 
        selectFriend(friend.name, friend.chatID); 
      };
    }
    
    list.appendChild(li);
  });
}

function loadRequests(){
  db.ref("friendRequests/"+userName).on("value", snap=>{
    const list = document.getElementById("requestsList"); 
    list.innerHTML = "";
    
    snap.forEach(c=>{
      const li = document.createElement("li"); 
      li.textContent = c.key;
      
      const acceptBtn = document.createElement("button"); 
      acceptBtn.textContent = "Accept"; 
      acceptBtn.style.marginLeft = "8px";
      acceptBtn.style.padding = "4px 8px";
      acceptBtn.style.fontSize = "12px";
      acceptBtn.onclick = (e) => {
        e.stopPropagation();
        acceptRequest(c.key);
      };
      
      li.appendChild(acceptBtn); 
      list.appendChild(li);
    });
  });
}

function sendFriendRequest(){
  const friend = document.getElementById("addFriendInput").value.trim();
  if(!friend || friend===userName) {
    alert("Please enter a valid friend name");
    return;
  }
  
  showLoading();
  db.ref("users/"+friend).once('value').then(snap => {
    if(!snap.exists()) {
      hideLoading();
      alert("User doesn't exist");
      return;
    }
    
    db.ref("friendRequests/"+friend+"/"+userName).set(true)
      .then(() => {
        hideLoading();
        document.getElementById("addFriendInput").value="";
        alert("Friend request sent to "+friend);
      })
      .catch(error => {
        hideLoading();
        alert("Error sending request: " + error.message);
      });
  });
}

function acceptRequest(friend){
  showLoading();
  const newChatID = Math.random().toString(36).substring(2,12);
  
  Promise.all([
    db.ref("friends/"+userName+"/"+friend).set(newChatID),
    db.ref("friends/"+friend+"/"+userName).set(newChatID),
    db.ref("friendRequests/"+userName+"/"+friend).remove()
  ]).then(() => {
    hideLoading();
    selectFriend(friend, newChatID);
  }).catch(error => {
    hideLoading();
    alert("Error accepting request: " + error.message);
  });
}

function selectFriend(friend, cID){
  showLoading();
  currentFriend = friend; 
  chatID = cID;
  document.getElementById("messages").innerHTML="";
  
  // Update UI to show selected friend
  document.querySelectorAll('#friendList li').forEach(li => {
    if(li.textContent.includes(friend)) {
      li.style.backgroundColor = "rgba(255,255,255,0.3)";
    } else {
      li.style.backgroundColor = "";
    }
  });
  
  loadMessages();
}

document.getElementById("sendBtn").addEventListener("click", sendMessage);
document.getElementById("msgInput").addEventListener("keypress", e=>{ 
  if(e.key==="Enter"){ 
    e.preventDefault(); 
    sendMessage(); 
  } 
});

function sendMessage(){
  if(!currentFriend) { 
    alert("Select a friend first"); 
    return; 
  }
  
  const text = document.getElementById("msgInput").value.trim();
  if(!text) return;
  
  showLoading();
  const msgKey = Math.random().toString(36).substring(2,12);
  db.ref("privateMessages/"+chatID+"/"+msgKey).set({ 
    sender: userName, 
    text: text, 
    time: Date.now() 
  }).then(() => {
    document.getElementById("msgInput").value="";
    hideLoading();
    
    // On mobile, hide keyboard after sending
    if(isMobile) {
      document.getElementById("msgInput").blur();
    }
  }).catch(error => {
    hideLoading();
    alert("Error sending message: " + error.message);
  });
}

function loadMessages(){
  db.ref("privateMessages/"+chatID).off();
  db.ref("privateMessages/"+chatID).on("child_added", snap=>{
    const msg = snap.val(); 
    const div = document.createElement("div");
    div.classList.add("message"); 
    div.classList.add(msg.sender===userName ? "sent" : "received");
    
    const time = new Date(msg.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    div.textContent = `[${time}] ${msg.sender}: ${msg.text}`;
    
    document.getElementById("messages").appendChild(div);
    document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
    hideLoading();
  });
}

function removeFriend(friend){
  if(!confirm("Remove "+friend+" from friends?")) return;
  
  showLoading();
  Promise.all([
    db.ref("friends/"+userName+"/"+friend).remove(),
    db.ref("friends/"+friend+"/"+userName).remove()
  ]).then(() => {
    if(currentFriend===friend) {
      currentFriend = null;
      document.getElementById("messages").innerHTML="";
    }
    hideLoading();
  }).catch(error => {
    hideLoading();
    alert("Error removing friend: " + error.message);
  });
}

function viewOnlineUsers(){
  showLoading();
  db.ref("onlineUsers").once("value").then(s=>{
    let users = [];
    s.forEach(u=> users.push(u.key));
    hideLoading();
    alert("Online Users:\n" + users.join("\n"));
  }).catch(error => {
    hideLoading();
    alert("Error fetching online users: " + error.message);
  });
}

function logout(){
  showLoading();
  db.ref("onlineUsers/"+userName).remove()
    .then(() => {
      localStorage.removeItem("chatName");
      location.reload();
    })
    .catch(error => {
      hideLoading();
      alert("Error during logout: " + error.message);
    });
}

function toggleMode(){ 
  document.body.classList.toggle("dark"); 
  document.body.classList.toggle("light"); 
  localStorage.setItem('chatTheme', document.body.classList.contains('dark') ? 'dark' : 'light');
}

// Restore theme preference
if(localStorage.getItem('chatTheme') === 'light') {
  document.body.classList.remove('dark');
  document.body.classList.add('light');
}

function cleanOldMessages(){
  if(!chatID) return;
  const now = Date.now();
  const limit = 15*24*60*60*1000; // 15 days
  
  db.ref("privateMessages/"+chatID).once("value").then(snap=>{
    const updates = {};
    snap.forEach(m=>{
      if(now - m.val().time > limit){
        updates[m.key] = null;
      }
    });
    if(Object.keys(updates).length > 0) {
      return db.ref("privateMessages/"+chatID).update(updates);
    }
  }).catch(error => {
    console.error("Error cleaning messages:", error);
  });
}

function forgotPassword() {
  const name = document.getElementById("username").value.trim();
  if(!name){
    alert("Enter your name first!");
    return;
  }
  
  showLoading();
  db.ref("notifications/Aryan Raj").push({
    message: `User "${name}" forgot their password. Please remove old password in Firebase.`,
    time: Date.now()
  }).then(() => {
    hideLoading();
    alert("A request has been sent to Aryan Raj to reset your password.");
  }).catch(error => {
    hideLoading();
    alert("Error sending password reset request: " + error.message);
  });
}

// Auto-login if username exists in localStorage
window.addEventListener('DOMContentLoaded', () => {
  const savedName = localStorage.getItem("chatName");
  if(savedName) {
    document.getElementById("username").value = savedName;
    document.getElementById("userPassword").focus();
  } else {
    document.getElementById("username").focus();
  }
});
