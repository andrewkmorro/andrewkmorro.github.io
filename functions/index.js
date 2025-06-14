const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({origin: true});

admin.initializeApp();
const db = admin.firestore();

const validCodes = ["143", "forkit", "zebra", "example1", "example2"];
const adminIPs = ["YOUR.ADMIN.IP.ADDRESS"];

exports.submitMessage = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const ipHeader = req.headers["x-forwarded-for"];
      const ip = ipHeader ? ipHeader.split(",")[0].trim() : req.ip;
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

      const fingerprintRef = db
          .collection("fingerprints")
          .doc(`${code}_${visitorId}`);
      const fingerprintDoc = await fingerprintRef.get();

      if (fingerprintDoc.exists) {
        return res.status(403).json({
          error:
          "You've already submitted a message for this code from this device.",
        });
      }

      const msgRef = db.collection("messages").doc(code);
      await msgRef.set(
          {
            messages: admin.firestore.FieldValue.arrayUnion({
              text: message,
              timestamp: Date.now(),
              ip,
              visitorId,
            }),
          },
          {merge: true},
      );

      await fingerprintRef.set({used: true});

      return res.json({success: true});
    } catch (error) {
      console.error("submitMessage error:", error);
      return res.status(500).json({
        error: "Server error while submitting message.",
      });
    }
  });
});

exports.getMessages = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const ipHeader = req.headers["x-forwarded-for"];
      const ip = ipHeader ? ipHeader.split(",")[0].trim() : req.ip;
      const code = req.query.code;

      if (!code) {
        return res.status(400).json({error: "Missing code."});
      }

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
        const messages = doc.data().messages.sort(
            (a, b) => b.timestamp - a.timestamp,
        );
        return res.json({messages});
      }
    } catch (err) {
      console.error("getMessages error:", err);
      return res.status(500).json({
        error: "Server error while fetching messages.",
      });
    }
  });
});
