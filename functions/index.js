const functions = require("firebase-functions");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");
const crypto = require("crypto");
admin.initializeApp();

function getRazorpayClient() {
  const keyId = functions.config().razorpay && functions.config().razorpay.key_id;
  const keySecret = functions.config().razorpay && functions.config().razorpay.key_secret;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys not configured in functions config");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function generateAccessCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function generateUniqueAccessCode(roundId) {
  const registrationsRef = admin.firestore().collection("registrations");
  for (let i = 0; i < 5; i += 1) {
    const code = generateAccessCode();
    const snap = await registrationsRef
      .where("roundId", "==", roundId)
      .where("accessCode", "==", code)
      .limit(1)
      .get();
    if (snap.empty) return code;
  }
  return generateAccessCode();
}

exports.createRazorpayOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required");
  }

  const { amount, currency = "INR", roundId } = data || {};
  const amountNumber = Number(amount);
  if (!amountNumber || amountNumber <= 0 || !roundId) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid amount or roundId");
  }

  const razorpay = getRazorpayClient();
  const order = await razorpay.orders.create({
    amount: Math.round(amountNumber * 100),
    currency,
    receipt: `${roundId}_${context.auth.uid}_${Date.now()}`,
    notes: {
      roundId,
      userId: context.auth.uid,
    },
  });

  return { orderId: order.id };
});

exports.verifyRazorpayPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required");
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    roundId,
  } = data || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !roundId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required payment fields");
  }

  const keySecret = functions.config().razorpay && functions.config().razorpay.key_secret;
  if (!keySecret) {
    throw new functions.https.HttpsError("failed-precondition", "Razorpay secret not configured");
  }

  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (generatedSignature !== razorpay_signature) {
    throw new functions.https.HttpsError("permission-denied", "Invalid payment signature");
  }

  const uid = context.auth.uid;
  const userSnap = await admin.firestore().collection("users").doc(uid).get();
  const userProfile = userSnap.exists ? userSnap.data() : {};

  const accessCode = await generateUniqueAccessCode(roundId);
  const registrationsRef = admin.firestore().collection("registrations");

  const existing = await registrationsRef
    .where("roundId", "==", roundId)
    .where("userId", "==", uid)
    .limit(1)
    .get();

  const registrationData = {
    roundId,
    userId: uid,
    fullName: userProfile?.name || "",
    mobile: userProfile?.mobile || "",
    college: userProfile?.college || "",
    branch: userProfile?.branch || "",
    section: userProfile?.section || "",
    rollNumber: userProfile?.rollNumber || "",
    paymentStatus: "completed",
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
    accessCode,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (existing.empty) {
    await registrationsRef.add(registrationData);
  } else {
    await existing.docs[0].ref.set(registrationData, { merge: true });
  }

  await admin.firestore().collection("payments").add({
    roundId,
    userId: uid,
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
    status: "completed",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { accessCode };
});

exports.createPaymentLink = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required");
  }

  const { roundId } = data || {};
  if (!roundId) {
    throw new functions.https.HttpsError("invalid-argument", "roundId is required");
  }

  const roundSnap = await admin.firestore().collection("rounds").doc(roundId).get();
  if (!roundSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Round not found");
  }

  const round = roundSnap.data() || {};
  const amount = Number(round.entryFee || 0);
  if (!amount || amount <= 0) {
    throw new functions.https.HttpsError("failed-precondition", "Invalid round entry fee");
  }

  const razorpay = getRazorpayClient();
  const userSnap = await admin.firestore().collection("users").doc(context.auth.uid).get();
  const userProfile = userSnap.exists ? userSnap.data() : {};

  const link = await razorpay.paymentLink.create({
    amount: Math.round(amount * 100),
    currency: "INR",
    description: `TypeHaki Registration: ${round.name || "Round"}`,
    customer: {
      name: userProfile?.name || "",
      email: userProfile?.email || "",
      contact: userProfile?.mobile || "",
    },
    notify: {
      sms: false,
      email: false,
    },
    notes: {
      roundId,
      userId: context.auth.uid,
    },
    callback_url: "https://typehaki-fdba0.web.app/payment",
    callback_method: "get",
  });

  return { shortUrl: link.short_url, id: link.id };
});

exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = functions.config().razorpay && functions.config().razorpay.webhook_secret;
    if (!webhookSecret) {
      res.status(500).send("Webhook secret not configured");
      return;
    }

    const body = req.rawBody;
    const expected = crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");
    if (signature !== expected) {
      res.status(400).send("Invalid signature");
      return;
    }

    const event = req.body?.event;
    const payload = req.body?.payload || {};

    if (event === "payment_link.paid" || event === "payment.captured") {
      const paymentLink = payload.payment_link?.entity;
      const payment = payload.payment?.entity;
      const notes = paymentLink?.notes || payment?.notes || {};
      const roundId = notes.roundId;
      const userId = notes.userId;

      if (roundId && userId) {
        const accessCode = await generateUniqueAccessCode(roundId);
        const registrationsRef = admin.firestore().collection("registrations");
        const existing = await registrationsRef
          .where("roundId", "==", roundId)
          .where("userId", "==", userId)
          .limit(1)
          .get();

        const registrationData = {
          roundId,
          userId,
          fullName: "",
          mobile: "",
          college: "",
          branch: "",
          section: "",
          rollNumber: "",
          paymentStatus: "completed",
          paymentId: payment?.id,
          orderId: payment?.order_id,
          accessCode,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (existing.empty) {
          await registrationsRef.add(registrationData);
        } else {
          await existing.docs[0].ref.set(registrationData, { merge: true });
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("razorpayWebhook error:", error);
    res.status(500).send("Webhook error");
  }
});
