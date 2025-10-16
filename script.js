  
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

// =========================
// VARIABILI GLOBALI
// =========================
let captain = "";
let teamName = "";
let isHost = false;
let allPlayers = [];
let timerInterval = null;

// =========================
// ELEMENTI DOM
// =========================
const login = document.getElementById("login");
const auction = document.getElementById("auction");
const hostControls = document.getElementById("hostControls");
const drawBtn = document.getElementById("drawBtn");

// =========================
// LOGIN
// =========================
document.getElementById("joinBtn").addEventListener("click", () => {
  const name = document.getElementById("captainName").value.trim();
  const team = document.getElementById("teamName").value.trim();

  if (!name) return alert("Inserisci il tuo nome!");

  if (name.toLowerCase() === "host") {
    const pwd = prompt("Inserisci la password host:");
    if (pwd !== "pred-italia-circus-host") return alert("Password errata!");
    captain = "HOST";
    isHost = true;
  } else {
    captain = name;
    isHost = false;
    if (!team) return alert("Inserisci il nome della squadra!");
    teamName = team;
  }

  login.classList.add("hidden");
  auction.classList.remove("hidden");
  document.getElementById("userDisplay").textContent = captain;
  document.getElementById("roleDisplay").textContent = isHost ? "Host" : `Capitano - ${teamName}`;

  if (isHost) {
    hostControls.classList.remove("hidden");
    document.getElementById("biddingBox").style.display = "none";
  }

  // Carica i giocatori dal JSON
  fetch("players.json")
    .then(res => res.json())
    .then(data => {
      allPlayers = data;
    });

  subscribeToAuction();
});

// =========================
// HOST: ESTRAZIONE GIOCATORE
// =========================
drawBtn.addEventListener("click", () => {
  if (!isHost) return;

  db.ref("currentPlayer").once("value").then(snap => {
    const current = snap.val();
    if (current && current.name) {
      alert("C'è già un giocatore in asta: " + current.name);
      return;
    }

    // Lista già estratti
    db.ref("drawnPlayers").once("value").then(snap => {
      const drawn = snap.val() || [];

      const remaining = allPlayers.filter(p => !drawn.includes(p));
      if (remaining.length === 0) {
        alert("Tutti i giocatori sono stati estratti!");
        return;
      }

      const randomIndex = Math.floor(Math.random() * remaining.length);
      const selectedPlayer = remaining[randomIndex];

      if (!selectedPlayer) {
        alert("Errore: giocatore non trovato!");
        return;
      }

      // Aggiorna Firebase
      db.ref("currentPlayer").set({
        name: selectedPlayer,
        currentBid: 0,
        currentLeader: "Nessuno",
        isActive: true
      });

      db.ref("drawnPlayers").set([...drawn, selectedPlayer]);
      db.ref("timer").set({ seconds: 30, isRunning: true });
    });
  });
});

// =========================
// RILANCI CAPITANI
// =========================
const bidBtn = document.getElementById("bidBtn");
if (!isHost) {
  bidBtn.addEventListener("click", () => {
    const val = parseInt(document.getElementById("bidAmount").value);
    if (!isNaN(val)) makeBid(val);
  });

  document.querySelectorAll(".bidInc").forEach(btn => {
    btn.addEventListener("click", () => {
      const inc = parseInt(btn.dataset.value);
      db.ref("currentPlayer").once("value").then(snap => {
        const data = snap.val();
        if (data && data.isActive) makeBid(data.currentBid + inc);
      });
    });
  });
}

function makeBid(amount) {
  db.ref("currentPlayer").once("value").then(snap => {
    const data = snap.val();
    if (!data || !data.isActive) return;
    if (amount > data.currentBid) {
      db.ref("currentPlayer").update({
        currentBid: amount,
        currentLeader: captain
      });
    } else alert("Offerta troppo bassa!");
  });
}

// =========================
// RESET ASTA
// =========================
document.getElementById("resetBtn").addEventListener("click", () => {
  if (!isHost) return;
  if (!confirm("Sei sicuro di resettare l'asta?")) return;

  db.ref("currentPlayer").remove();
  db.ref("timer").set({ seconds: 30, isRunning: false });
  db.ref("winners").remove();
  db.ref("drawnPlayers").remove();

  // Ripristina array giocatori da JSON
  fetch("players.json")
    .then(res => res.json())
    .then(data => { allPlayers = data; });

  document.getElementById("playerDisplay").textContent = "Attesa estrazione giocatore";
  document.getElementById("currentBid").textContent = 0;
  document.getElementById("currentLeader").textContent = "Nessuno";
  document.getElementById("timer").textContent = "--";
});

// =========================
// SINCRONIZZAZIONE REAL-TIME
// =========================
function subscribeToAuction() {
  const playerDisplay = document.getElementById("playerDisplay");
  const currentBidEl = document.getElementById("currentBid");
  const currentLeaderEl = document.getElementById("currentLeader");
  const timerEl = document.getElementById("timer");
  const winnerTables = document.getElementById("winnerTables");

  db.ref("currentPlayer").on("value", snap => {
    const data = snap.val();
    if (data && data.name) {
      playerDisplay.textContent = data.name;
      currentBidEl.textContent = data.currentBid;
      currentLeaderEl.textContent = data.currentLeader;
    } else {
      playerDisplay.textContent = "Attesa estrazione giocatore";
      currentBidEl.textContent = 0;
      currentLeaderEl.textContent = "Nessuno";
    }
  });

  db.ref("timer").on("value", snap => {
    const data = snap.val();
    if (data) timerEl.textContent = data.seconds;
  });

  db.ref("winners").on("value", snap => {
    const data = snap.val() || {};
    winnerTables.innerHTML = "";
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
      Object.values(data[team]).forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${p.playerName}</td><td>${p.leader}</td><td>${p.bid}</td>`;
        tbody.appendChild(tr);
      });

      teamDiv.appendChild(table);
      winnerTables.appendChild(teamDiv);
    }
  });
}