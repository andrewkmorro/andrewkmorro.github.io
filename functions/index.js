const projectId = "pronged-174c2";
let currentCode = "";
let visitorId = "";

// Hardcoded valid fork codes
const validCodes = ["21396", "74167"];

// Load FingerprintJS
FingerprintJS.load().then(fp => {
  fp.get().then(result => {
    visitorId = result.visitorId;
  });
});

function isValidCode(code) {
  return validCodes.includes(code);
}

async function loadMessages() {
  const code = document.getElementById("codeInput").value.trim();

  if (!code) {
    alert("Please enter a fork code.");
    return;
  }

  if (!isValidCode(code)) {
    alert("That code isn’t valid.");
    return;
  }

  currentCode = code;
  document.getElementById("codeDisplay").textContent = code;
  document.getElementById("entryArea").style.display = "none";
  document.getElementById("codeArea").style.display = "block";

  const list = document.getElementById("messagesList");
  list.innerHTML = "";

  fetch(`https://us-central1-${projectId}.cloudfunctions.net/getMessages?code=${code}`)
    .then(res => res.json())
    .then(data => {
      const messages = data.messages || [];
      if (messages.length === 0) {
        list.innerHTML = "<li>This is a brand new fork.</li>";
      } else {
        messages.forEach(entry => {
          const text = entry.text;
          const timestamp = new Date(entry.timestamp).toLocaleString();
          const prefix = entry.code ? `[${entry.code}] ` : "";
          const li = document.createElement("li");
          li.textContent = `${prefix}${text} — ${timestamp}`;
          list.appendChild(li);
        });
      }
    })
    .catch(() => {
      list.innerHTML = "<li>forkive me! error loading messages.</li>";
    });
}

function submitMessage() {
  const message = document.getElementById("messageInput").value.trim();
  if (!message) {
    alert("Message can’t be empty.");
    return;
  }

  if (!visitorId) {
    alert("oh no! forkive me! please try again");
    return;
  }

  const cloudFunctionUrl = `https://us-central1-${projectId}.cloudfunctions.net/submitMessage`;

  fetch(cloudFunctionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: currentCode, message, visitorId })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        document.getElementById("status").textContent = "Message posted!";
        document.getElementById("messageInput").value = "";
        loadMessages();
      } else {
        document.getElementById("status").textContent = data.error;
      }
    })
    .catch(() => {
      document.getElementById("status").textContent = "there's a spoon in the code! your message was sabotaged. try again.";
    });
}
