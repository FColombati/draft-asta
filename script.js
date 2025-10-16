  
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
const playerDisplay = document.getElementById("playerDisplay");
const currentBidEl = document.getElementById("currentBid");
const currentLeaderEl = document.getElementById("currentLeader");
const timerEl = document.getElementById("timer");
const winnerTables = document.getElementById("winnerTables");

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

  // 🔹 Carica giocatori da JSON
  fetch("players.json")
    .then(res => res.json())
    .then(data => {
      allPlayers = data; // array di oggetti {name, role}
      drawBtn.disabled = false; // ora il bottone è abilitato
    })
    .catch(err => alert("Errore nel caricamento dei giocatori: " + err));

  subscribeToAuction();
});

// =========================
// HOST: ESTRAZIONE GIOCATORE
// =========================
drawBtn.addEventListener("click", () => {
  if (!isHost) return;

  if (!allPlayers.length) {
    alert("Lista giocatori non ancora caricata!");
    return;
  }

  db.ref("currentPlayer").once("value").then(snap => {
    const current = snap.val();
    if (current && current.name) {
      alert("C'è già un giocatore in asta: " + current.name);
      return;
    }

    db.ref("drawnPlayers").once("value").then(snap => {
      const drawn = snap.val() || [];
      const remaining = allPlayers.filter(p => !drawn.map(dp => dp.name).includes(p.name));

      if (remaining.length === 0) {
        alert("Tutti i giocatori sono stati estratti!");
        return;
      }

      const randomIndex = Math.floor(Math.random() * remaining.length);
      const selectedPlayer = remaining[randomIndex];

      if (!selectedPlayer || !selectedPlayer.name) {
        alert("Errore: giocatore non valido!");
        return;
      }

      // Aggiorna Firebase
      db.ref("currentPlayer").set({
        name: selectedPlayer.name,
        role: selectedPlayer.role,
        currentBid: 0,
        currentLeader: "Nessuno",
        isActive: true
      });

      db.ref("drawnPlayers").set([...drawn, selectedPlayer]);
      db.ref("timer").set(30); // timer iniziale
    });
  });
});

// =========================
// TIMER CLIENT
// =========================
db.ref("timer").on("value", snap => {
  const t = snap.val();
  if (t === null) return;
  timerEl.textContent = t;

  clearInterval(timerInterval);
  if (t > 0) {
    timerInterval = setInterval(() => {
      db.ref("timer").once("value").then(snap => {
        let time = snap.val();
        if (time > 0) {
          db.ref("timer").set(time - 1);
        } else {
          clearInterval(timerInterval);
          endAuction();
        }
      });
    }, 1000);
  }
});

// =========================
// RILANCI CAPITANI
// =========================
if (!isHost) {
  document.getElementById("bidBtn").addEventListener("click", () => {
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
  db.ref("timer").set(30);
  db.ref("winners").remove();
  db.ref("drawnPlayers").remove();

  fetch("players.json")
    .then(res => res.json())
    .then(data => { allPlayers = data; });

  playerDisplay.textContent = "Attesa estrazione giocatore";
  currentBidEl.textContent = 0;
  currentLeaderEl.textContent = "Nessuno";
  timerEl.textContent = "--";
});

// =========================
// FINE ASTA PER GIOCATORE
// =========================
function endAuction() {
  db.ref("currentPlayer").once("value").then(snap => {
    const data = snap.val();
    if (!data) return;
    const team = teamName || data.currentLeader;
    db.ref(`winners/${team}`).push({
      playerName: data.name,
      role: data.role,
      leader: data.currentLeader,
      bid: data.currentBid
    });
    db.ref("currentPlayer").remove();
  });
}

// =========================
// SINCRONIZZAZIONE REAL-TIME
// =========================
function subscribeToAuction() {
  db.ref("currentPlayer").on("value", snap => {
    const player = snap.val();
    if (player && player.name) {
      playerDisplay.textContent = `${player.name} (${player.role})`;
      currentBidEl.textContent = player.currentBid;
      currentLeaderEl.textContent = player.currentLeader;
    } else {
      playerDisplay.textContent = "Attesa estrazione giocatore";
      currentBidEl.textContent = 0;
      currentLeaderEl.textContent = "Nessuno";
    }
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
        <thead><tr><th>Giocatore</th><th>Ruolo</th><th>Capitano</th><th>Offerta 💰</th></tr></thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector("tbody");
      Object.values(data[team]).forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${p.playerName}</td><td>${p.role}</td><td>${p.leader}</td><td>${p.bid}</td>`;
        tbody.appendChild(tr);
      });
      teamDiv.appendChild(table);
      winnerTables.appendChild(teamDiv);
    }
  });
}