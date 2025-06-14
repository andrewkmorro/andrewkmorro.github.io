const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.submitMessage = functions.https.onRequest(async (req, res) => {
  const ipHeader = req.headers["x-forwarded-for"];
  const ip = ipHeader ? ipHeader.split(",")[0] : req.ip;
  const {code, message} = req.body;

  if (!code || !message) {
    return res.status(400).json({error: "Missing code or message"});
  }

  const ipRef = db.collection("ipLogs").doc(`${code}_${ip}`);
  const ipDoc = await ipRef.get();

  if (ipDoc.exists) {
    return res.status(403).json({
      error: "You’ve already submitted a message for this code.",
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
