  
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
const hostControls = document.getElementById("hostControls");
const bidBtn = document.getElementById("bidBtn");

let captain = "";
let isHost = false;
let teamName = "";
let allPlayers = [];
let timerInterval = null;

// Carica giocatori
fetch("players.json").then(res => res.json()).then(data => { allPlayers = data; });

// 🔹 Login
joinBtn.addEventListener("click", () => {
  let name = document.getElementById("captainName").value.trim();
  let team = document.getElementById("teamName").value.trim();

  if (name === "") return alert("Inserisci il tuo nome!");

  if (name.toLowerCase() === "host") {
    let pwd = prompt("Inserisci la password dell’host:");
    if (pwd !== "pred-italia-circus-host") return alert("Password errata!");
    captain = "HOST";
    isHost = true;
  } else {
    captain = name;
    isHost = false;
  }

  if (!isHost && team === "") return alert("Inserisci il nome della squadra!");
  teamName = team;

  login.classList.add("hidden");
  auction.classList.remove("hidden");
  document.getElementById("userDisplay").textContent = captain;
  document.getElementById("roleDisplay").textContent = isHost ? "Host" : `Capitano - ${teamName}`;

  if (isHost) {
    hostControls.classList.remove("hidden");
    document.getElementById("biddingBox").style.display = "none"; // ❌ nasconde sezione rilanci
  } else {
    hostControls.classList.add("hidden");
  }
});

// 🔹 Estrai giocatore
drawBtn.addEventListener("click", () => {
  if (allPlayers.length === 0) return alert("Lista vuota!");
  const idx = Math.floor(Math.random() * allPlayers.length);
  const player = allPlayers.splice(idx, 1)[0];

  db.ref("currentPlayer").set({
    name: player,
    currentBid: 0,
    leader: "Nessuno",
    isActive: true
  });

  db.ref("timer").set({ seconds: 30, isRunning: true });
});

// 🔹 Timer
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

// 🔹 Pause / Resume
pauseBtn.addEventListener("click", () => db.ref("timer").update({ isRunning: false }));
resumeBtn.addEventListener("click", () => {
  db.ref("timer").once("value").then(s => {
    const d = s.val();
    if (d && d.seconds > 0) db.ref("timer").update({ isRunning: true });
  });
});

// 🔹 Rilanci solo per capitani
if (!isHost) {
  bidBtn.addEventListener("click", () => makeBid(parseInt(document.getElementById("bidAmount").value)));
  document.querySelectorAll(".bidInc").forEach(btn => {
    btn.addEventListener("click", () => {
      const increment = parseInt(btn.dataset.value);
      db.ref("currentPlayer").once("value").then(s => {
        const data = s.val();
        if (!data || !data.isActive) return;
        makeBid(data.currentBid + increment);
      });
    });
  });
}

function makeBid(bid) {
  if (isNaN(bid)) return alert("Offerta non valida");
  db.ref("currentPlayer").once("value").then(s => {
    const data = s.val();
    if (!data || !data.isActive) return;
    if (bid > data.currentBid) db.ref("currentPlayer").update({ currentBid: bid, leader: captain });
  });
}

// 🔹 Fine asta
function endAuction() {
  db.ref("currentPlayer").once("value").then(s => {
    const data = s.val();
    if (!data) return;

    const path = `winners/${data.leader}`;
    db.ref(path).push({
      playerName: data.name,
      leader: data.leader,
      bid: data.currentBid
    });

    db.ref("currentPlayer").remove();
  });
}

// 🔹 Reset
resetBtn.addEventListener("click", () => {
  if (!confirm("Sei sicuro di resettare l'asta?")) return;
  db.ref("currentPlayer").remove();
  db.ref("timer").set({ seconds: 30, isRunning: false });
  db.ref("winners").remove();
  fetch("players.json").then(r => r.json()).then(data => { allPlayers = data; });
});

// 🔹 Aggiornamento tabella per squadra
db.ref("winners").on("value", snapshot => {
  const data = snapshot.val();
  const container = document.getElementById("winnerTables");
  container.innerHTML = "";

  if (!data) return;

  for (let team in data) {
    const teamDiv = document.createElement("div");
    teamDiv.className = "team-table";
    const title = document.createElement("h4");
    title.textContent = team;
    teamDiv.appendChild(title);

    const table = document.createElement("table");
    table.innerHTML = `
      <thead><tr><th>Giocatore</th><th>Capitano</th><th>Offerta 💰</th></tr></thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    Object.values(data[team]).forEach(player => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${player.playerName}</td><td>${player.leader}</td><td>${player.bid}</td>`;
      tbody.appendChild(tr);
    });

    teamDiv.appendChild(table);
    container.appendChild(teamDiv);
  }
});