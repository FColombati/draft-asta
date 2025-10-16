  
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

// =======================
// 🔹 VARIABILI GLOBALI
// =======================
let captain = "";
let teamName = "";
let isHost = false;
let allPlayers = [];
let timerInterval;

// =======================
// 🔹 ELEMENTI DOM
// =======================
const login = document.getElementById("login");
const auction = document.getElementById("auction");
const joinBtn = document.getElementById("joinBtn");
const hostControls = document.getElementById("hostControls");
const drawBtn = document.getElementById("drawBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resumeBtn = document.getElementById("resumeBtn");
const resetBtn = document.getElementById("resetBtn");
const bidBtn = document.getElementById("bidBtn");

// =======================
// 🔹 LOGIN
// =======================
joinBtn.addEventListener("click", () => {
  const name = document.getElementById("captainName").value.trim();
  const team = document.getElementById("teamName").value.trim();

  if (name === "") return alert("Inserisci il tuo nome!");

  // Host login
  if (name.toLowerCase() === "host") {
    const pwd = prompt("Inserisci la password dell’host:");
    if (pwd !== "pred-italia-circus-host") return alert("Password errata!");
    captain = "HOST";
    isHost = true;
  } else {
    captain = name;
    isHost = false;
    if (team === "") return alert("Inserisci il nome della tua squadra!");
    teamName = team;
  }

  login.classList.add("hidden");
  auction.classList.remove("hidden");

  document.getElementById("userDisplay").textContent = captain;
  document.getElementById("roleDisplay").textContent = isHost ? "Host" : `Capitano - ${teamName}`;

  if (isHost) hostControls.classList.remove("hidden");
  else hostControls.classList.add("hidden");

  // L’host non deve vedere i controlli di rilancio
  if (isHost) document.getElementById("biddingBox").style.display = "none";
});

// =======================
// 🔹 CARICA LISTA GIOCATORI
// =======================
fetch("players.json")
  .then(res => res.json())
  .then(data => { allPlayers = data; });

// =======================
// 🔹 HOST: ESTRAZIONE GIOCATORE
// =======================
drawBtn.addEventListener("click", () => {
  if (!isHost) return;

  if (allPlayers.length === 0) return alert("Tutti i giocatori sono stati estratti!");
  const randomIndex = Math.floor(Math.random() * allPlayers.length);
  const selected = allPlayers.splice(randomIndex, 1)[0];

  db.ref("currentPlayer").set({
    name: selected.name,
    currentBid: 0,
    currentLeader: "Nessuno",
    isActive: true
  });

  // Reset timer
  db.ref("timer").set({ seconds: 30, isRunning: true });
});

// =======================
// 🔹 TIMER SINCRONIZZATO
// =======================
db.ref("timer").on("value", snapshot => {
  const timer = snapshot.val();
  if (!timer) return;

  document.getElementById("timer").textContent = timer.seconds;

  clearInterval(timerInterval);

  if (timer.isRunning) {
    timerInterval = setInterval(() => {
      db.ref("timer").once("value").then(snap => {
        let t = snap.val();
        if (t && t.isRunning && t.seconds > 0) {
          t.seconds--;
          db.ref("timer").set(t);
        } else if (t && t.seconds <= 0) {
          clearInterval(timerInterval);
          endAuction();
        }
      });
    }, 1000);
  }
});

pauseBtn.addEventListener("click", () => {
  if (isHost) db.ref("timer/isRunning").set(false);
});
resumeBtn.addEventListener("click", () => {
  if (isHost) db.ref("timer/isRunning").set(true);
});

// =======================
// 🔹 VISUALIZZAZIONE GIOCATORE ATTUALE
// =======================
db.ref("currentPlayer").on("value", snapshot => {
  const data = snapshot.val();
  const playerDisplay = document.getElementById("playerDisplay");
  const currentBid = document.getElementById("currentBid");
  const currentLeader = document.getElementById("currentLeader");

  if (data && data.name) {
    playerDisplay.textContent = data.name;
    currentBid.textContent = data.currentBid;
    currentLeader.textContent = data.currentLeader;
  } else {
    playerDisplay.textContent = "Nessun giocatore in asta";
    currentBid.textContent = 0;
    currentLeader.textContent = "Nessuno";
  }
});

// =======================
// 🔹 RILANCI (solo capitani)
// =======================
function makeBid(amount) {
  db.ref("currentPlayer").once("value").then(snapshot => {
    const data = snapshot.val();
    if (!data || !data.isActive) return;
    if (amount > data.currentBid) {
      db.ref("currentPlayer").update({
        currentBid: amount,
        currentLeader: captain
      });
    } else alert("Offerta troppo bassa!");
  });
}

if (!isHost) {
  bidBtn.addEventListener("click", () => {
    const val = parseInt(document.getElementById("bidAmount").value);
    if (!isNaN(val)) makeBid(val);
  });

  document.querySelectorAll(".bidInc").forEach(btn => {
    btn.addEventListener("click", () => {
      const inc = parseInt(btn.dataset.value);
      db.ref("currentPlayer").once("value").then(snapshot => {
        const data = snapshot.val();
        if (data && data.isActive) makeBid(data.currentBid + inc);
      });
    });
  });
}

// =======================
// 🔹 FINE ASTA PER GIOCATORE
// =======================
function endAuction() {
  db.ref("currentPlayer").once("value").then(snapshot => {
    const data = snapshot.val();
    if (!data) return;

    const winnerTeam = teamName || data.currentLeader; // fallback se host chiude
    const path = `winners/${winnerTeam}`;
    db.ref(path).push({
      playerName: data.name,
      leader: data.currentLeader,
      bid: data.currentBid
    });

    db.ref("currentPlayer").remove();
  });
}

// =======================
// 🔹 RESET ASTA (solo host)
// =======================
resetBtn.addEventListener("click", () => {
  if (!isHost) return;
  if (!confirm("Sei sicuro di resettare l'asta?")) return;

  db.ref("currentPlayer").remove();
  db.ref("timer").set({ seconds: 30, isRunning: false });
  db.ref("winners").remove();
  fetch("players.json").then(res => res.json()).then(data => { allPlayers = data; });

  document.getElementById("playerDisplay").textContent = "Attesa estrazione giocatore";
  document.getElementById("currentBid").textContent = 0;
  document.getElementById("currentLeader").textContent = "Nessuno";
  document.getElementById("timer").textContent = "--";
});

// =======================
// 🔹 TABELLA VINCITORI DIVISA PER SQUADRA
// =======================
db.ref("winners").on("value", snapshot => {
  const data = snapshot.val();
  const container = document.getElementById("winnerTables");
  container.innerHTML = "";

  if (!data) return;

  for (let team in data) {
    const teamDiv = document.createElement("div");
    teamDiv.classList.add("team-table");

    const title = document.createElement("h4");
    title.textContent = team;
    teamDiv.appendChild(title);

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th>Giocatore</th>
        <th>Capitano</th>
        <th>Offerta 💰</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    Object.values(data[team]).forEach(player => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${player.playerName}</td>
        <td>${player.leader}</td>
        <td>${player.bid}</td>
      `;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    teamDiv.appendChild(table);
    container.appendChild(teamDiv);
  }
});