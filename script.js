  
  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyBrav82c2J5SdjCTmM4GcbdYynO9xE1FCs",
    authDomain: "draft-asta.firebaseapp.com",
    projectId: "draft-asta",
    storageBucket: "draft-asta.firebasestorage.app",
    messagingSenderId: "266437545631",
    appId: "1:266437545631:web:504925f43ea94e2d475caa"
  };

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const login = document.getElementById("login");
const auction = document.getElementById("auction");
const joinBtn = document.getElementById("joinBtn");
const drawBtn = document.getElementById("drawBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const resetBtn = document.getElementById("resetBtn");
const bidBtn = document.getElementById("bidBtn");
const hostControls = document.getElementById("hostControls");

let captain = "";
let isHost = false;
let allPlayers = [];
let timerInterval = null;

// Carica giocatori
fetch("players.json")
  .then(res => res.json())
  .then(data => { allPlayers = data; });

// 🔹 Login
joinBtn.addEventListener("click", () => {
  captain = document.getElementById("captainName").value.trim();
  isHost = document.getElementById("isHost").checked;

  if (captain === "") return alert("Inserisci un nome!");

  login.classList.add("hidden");
  auction.classList.remove("hidden");
  document.getElementById("userDisplay").textContent = captain;
  document.getElementById("roleDisplay").textContent = isHost ? "Host" : "Capitano";

  if (isHost) hostControls.classList.remove("hidden");
});

// 🔹 Estrai giocatore
drawBtn.addEventListener("click", () => {
  if (allPlayers.length === 0) return alert("Lista vuota!");
  const randomIndex = Math.floor(Math.random() * allPlayers.length);
  const player = allPlayers.splice(randomIndex, 1)[0];

  db.ref("currentPlayer").set({
    name: player,
    currentBid: 0,
    leader: "Nessuno",
    isActive: true
  });

  db.ref("timer").set({
    seconds: 30,
    isRunning: true
  });
});

// 🔹 Timer sincronizzato
db.ref("timer").on("value", snapshot => {
  const data = snapshot.val();
  if (!data) return;
  document.getElementById("timer").textContent = data.seconds;

  clearInterval(timerInterval);
  if (data.isRunning) startTimer(data.seconds);
});

function startTimer(seconds) {
  let t = seconds;
  timerInterval = setInterval(() => {
    t--;
    db.ref("timer").update({ seconds: t });
    if (t <= 0) {
      clearInterval(timerInterval);
      endAuction();
      db.ref("timer").update({ isRunning: false });
    }
  }, 1000);
}

// 🔹 Pause / Resume (host)
pauseBtn.addEventListener("click", () => {
  db.ref("timer").update({ isRunning: false });
  clearInterval(timerInterval);
});

resumeBtn.addEventListener("click", () => {
  db.ref("timer").once("value").then(snapshot => {
    const data = snapshot.val();
    if (!data) return;
    if (data.seconds > 0) {
      db.ref("timer").update({ isRunning: true });
    }
  });
});

// 🔹 Rilanci
bidBtn.addEventListener("click", () => makeBid(parseInt(document.getElementById("bidAmount").value)));

document.querySelectorAll(".bidInc").forEach(btn => {
  btn.addEventListener("click", () => {
    const increment = parseInt(btn.dataset.value);
    db.ref("currentPlayer").once("value").then(snapshot => {
      const data = snapshot.val();
      if (!data || !data.isActive) return;
      makeBid(data.currentBid + increment);
    });
  });
});

function makeBid(bid) {
  if (isNaN(bid)) return alert("Offerta non valida");
  db.ref("currentPlayer").once("value").then(snapshot => {
    const data = snapshot.val();
    if (!data || !data.isActive) return;
    if (bid > data.currentBid) {
      db.ref("currentPlayer").update({ currentBid: bid, leader: captain });
    } else {
      alert("Offerta troppo bassa!");
    }
  });
}

// 🔹 Fine asta per il giocatore
function endAuction() {
  db.ref("currentPlayer").once("value").then(snapshot => {
    const data = snapshot.val();
    if (!data) return;

    const winnerList = document.getElementById("winnerList");
    const li = document.createElement("li");
    li.textContent = `${data.name} → ${data.leader} (${data.currentBid}💰)`;
    winnerList.appendChild(li);

    db.ref("winners").push({
      playerName: data.name,
      leader: data.leader,
      bid: data.currentBid
    });

    db.ref("currentPlayer").remove();
  });
}

// 🔹 Reset asta (host)
resetBtn.addEventListener("click", () => {
  if (!confirm("Sei sicuro di resettare l'asta?")) return;
  db.ref("currentPlayer").remove();
  db.ref("timer").set({ seconds: 30, isRunning: false });
  db.ref("winners").remove();
  fetch("players.json")
    .then(res => res.json())
    .then(data => { allPlayers = data; });
  document.getElementById("winnerList").innerHTML = "";
  document.getElementById("playerName").textContent = 'Premi "Estrai Giocatore"';
  document.getElementById("currentBid").textContent = 0;
  document.getElementById("currentLeader").textContent = "Nessuno";
  document.getElementById("timer").textContent = "--";
});
