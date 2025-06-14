const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});

admin.initializeApp();
const db = admin.firestore();

const adminIPs = ["YOUR.ADMIN.IP.ADDRESS"];
const validCodes = ["21396", "74167", "52984", "60013",
  "47737", "82145", "39362", "91237"];

exports.submitMessage = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const ipHeader = req.headers["x-forwarded-for"];
    const ip = ipHeader ? ipHeader.split(",")[0] : req.ip;
    const {code, message, visitorId} = req.body;

    if (!code || !message || !visitorId) {
      return res.status(400).json({
        error: "Missing code, message, or visitor ID",
      });
    }

    if (!validCodes.includes(code)) {
      return res.status(403).json({
        error: "Invalid fork code.",
      });
    }

    try {
      const now = Date.now();
      const fingerprintRef = db
          .collection("fingerprints")
          .doc(`${code}_${visitorId}`);
      const fingerprintDoc = await fingerprintRef.get();

      if (fingerprintDoc.exists) {
        const lastUsed = fingerprintDoc.data().timestamp || 0;
        const daysSince = (now - lastUsed) / (1000 * 60 * 60 * 24);

        if (daysSince < 30) {
          const daysRemaining = Math.ceil(30 - daysSince);
          return res.status(403).json({
            error:
              `You can only submit once every 30 days for this code. ` +
              `Try again in ${daysRemaining} day(s).`,
          });
        }
      }

      const msgRef = db.collection("messages").doc(code);

      await msgRef.set(
          {
            messages: admin.firestore.FieldValue.arrayUnion({
              text: message,
              timestamp: now,
              ip,
              visitorId,
            }),
          },
          {merge: true},
      );

      await fingerprintRef.set({timestamp: now});

      return res.json({success: true});
    } catch (err) {
      console.error("Error submitting message:", err);
      return res.status(500).json({error: "Server error."});
    }
  });
});

exports.getMessages = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const ipHeader = req.headers["x-forwarded-for"];
    const ip = ipHeader ? ipHeader.split(",")[0] : req.ip;
    const code = req.query.code;

    if (!code) {
      return res.status(400).json({error: "Missing code."});
    }

    if (!validCodes.includes(code)) {
      return res.status(403).json({error: "Invalid fork code."});
    }

    try {
      if (adminIPs.includes(ip)) {
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

        allMessages.sort((a, b) => b.timestamp - a.timestamp);
        return res.json({messages: allMessages});
      } else {
        const doc = await db.collection("messages").doc(code).get();
        if (!doc.exists || !doc.data().messages) {
          return res.json({messages: []});
        }
        const messages = doc
            .data()
            .messages.sort((a, b) => b.timestamp - a.timestamp);
        return res.json({messages});
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
      return res.status(500).json({error: "Server error."});
    }
  });
});
