  
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
const bidBtn = document.getElementById("bidBtn");

let captain = "";
let timer = 0;
let timerInterval = null;
let allPlayers = [];

// Carica giocatori
fetch("players.json")
  .then(res => res.json())
  .then(data => { allPlayers = data; });

joinBtn.addEventListener("click", () => {
  captain = document.getElementById("captainName").value.trim();
  if (captain === "") return alert("Inserisci un nome!");

  login.classList.add("hidden");
  auction.classList.remove("hidden");
  document.getElementById("userDisplay").textContent = captain;
});

// 🔹 Estrai giocatore random
drawBtn.addEventListener("click", () => {
  if (allPlayers.length === 0) return alert("Lista vuota!");
  const randomIndex = Math.floor(Math.random() * allPlayers.length);
  const player = allPlayers.splice(randomIndex, 1)[0];

  db.ref("currentPlayer").set({
    name: player,
    currentBid: 0,
    leader: "Nessuno"
  });

  startTimer(30);
});

// 🔹 Ascolta aggiornamenti in tempo reale
db.ref("currentPlayer").on("value", snapshot => {
  const data = snapshot.val();
  if (!data) return;
  document.getElementById("playerName").textContent = data.name;
  document.getElementById("currentBid").textContent = data.currentBid;
  document.getElementById("currentLeader").textContent = data.leader;
});

// 🔹 Rilancio
bidBtn.addEventListener("click", () => {
  const bid = parseInt(document.getElementById("bidAmount").value);
  if (isNaN(bid)) return alert("Inserisci un importo valido");

  db.ref("currentPlayer").once("value").then(snapshot => {
    const data = snapshot.val();
    if (!data) return;
    if (bid > data.currentBid) {
      db.ref("currentPlayer").update({
        currentBid: bid,
        leader: captain
      });
    } else {
      alert("Offerta troppo bassa!");
    }
  });
});

// 🔹 Timer asta
function startTimer(seconds) {
  clearInterval(timerInterval);
  timer = seconds;
  updateTimer();
  timerInterval = setInterval(() => {
    timer--;
    updateTimer();
    if (timer <= 0) {
      clearInterval(timerInterval);
      endAuction();
    }
  }, 1000);
}

function updateTimer() {
  document.getElementById("timer").textContent = timer;
}

// 🔹 Fine asta
function endAuction() {
  db.ref("currentPlayer").once("value").then(snapshot => {
    const data = snapshot.val();
    if (!data) return;

    const winnerList = document.getElementById("winnerList");
    const li = document.createElement("li");
    li.textContent = `${data.name} → ${data.leader} (${data.currentBid}💰)`;
    winnerList.appendChild(li);

    db.ref("currentPlayer").remove();
  });
}