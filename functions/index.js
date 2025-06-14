const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});

admin.initializeApp();
const db = admin.firestore();

const validCodes = ["21396", "74167"];
const adminIPs = ["YOUR.ADMIN.IP.ADDRESS"];

exports.submitMessage = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const ipHeader = req.headers["x-forwarded-for"];
    const ip = ipHeader ? ipHeader.split(",")[0] : req.ip;
    const {code, message} = req.body;

    if (!code || !message) {
      return res.status(400).json({error: "Missing code or message"});
    }

    if (!validCodes.includes(code)) {
      return res.status(403).json({error: "Invalid fork code."});
    }

    const ipRef = db.collection("ipLogs").doc(`${code}_${ip}`);
    const ipDoc = await ipRef.get();

    if (ipDoc.exists) {
      return res.status(403).json({
        error: "You’ve already submitted a message for this fork.",
      });
    }

    const msgRef = db.collection("messages").doc(code);

    await msgRef.set(
        {
          messages: admin.firestore.FieldValue.arrayUnion({
            text: message,
            timestamp: Date.now(),
            ip,
          }),
        },
        {merge: true},
    );

    await ipRef.set({used: true});

    return res.json({success: true});
  });
});

exports.getMessages = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const ipHeader = req.headers["x-forwarded-for"];
    const ip = ipHeader ? ipHeader.split(",")[0] : req.ip;
    const {code} = req.body;

    if (!code) {
      return res.status(400).json({error: "Missing code."});
    }

    try {
      if (adminIPs.includes(ip)) {
        // Admin mode: return all messages
        const snapshot = await db.collection("messages").get();
        const allMessages = [];

        snapshot.forEach((doc) => {
          const codeId = doc.id;
          const messages = doc.data().messages || [];
          messages.forEach((entry) => {
            allMessages.push({
              code: codeId,
              text: entry.text,
              timestamp: entry.timestamp,
            });
          });
        });

        // Sort all messages by timestamp descending
        allMessages.sort((a, b) => b.timestamp - a.timestamp);
        return res.json({messages: allMessages});
      } else {
        // Regular user mode: return only messages for this fork
        const doc = await db.collection("messages").doc(code).get();
        if (!doc.exists || !doc.data().messages) {
          return res.json({messages: []});
        }
        const messages = doc.data().messages.sort(
            (a, b) => b.timestamp - a.timestamp,
        );
        return res.json({messages});
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
      return res.status(500).json({error: "Server error."});
    }
  });
});
