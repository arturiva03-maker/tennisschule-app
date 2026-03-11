import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

admin.initializeApp();

// SMTP Konfiguration aus Firebase Environment
const getTransporter = () => {
  const smtpConfig = functions.config().smtp;

  return nodemailer.createTransport({
    host: smtpConfig?.host || "smtp.gmail.com",
    port: parseInt(smtpConfig?.port || "587"),
    secure: smtpConfig?.secure === "true",
    auth: {
      user: smtpConfig?.user,
      pass: smtpConfig?.pass,
    },
  });
};

// Email-Absender aus Config
const getSender = () => {
  const smtp = functions.config().smtp;
  return smtp?.from || smtp?.user || "noreply@tennisschule.de";
};

// ============================================
// VERTRETUNG EMAIL
// ============================================
export const sendVertretungEmail = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    // Authentifizierung prüfen
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Nur authentifizierte Benutzer können Emails senden"
      );
    }

    const { trainerEmail, trainerName, trainings, vertretungTrainerName } = data;

    if (!trainerEmail || !trainings || trainings.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Email und Trainings sind erforderlich"
      );
    }

    const transporter = getTransporter();

    // Trainings formatieren
    const trainingsListe = trainings
      .map((t: { datum: string; uhrzeitVon: string; uhrzeitBis: string; spieler: string }) => {
        const [y, m, d] = t.datum.split("-");
        return `• ${d}.${m}.${y} von ${t.uhrzeitVon} bis ${t.uhrzeitBis} Uhr - ${t.spieler}`;
      })
      .join("\n");

    const mailOptions = {
      from: getSender(),
      to: trainerEmail,
      subject: `Vertretung benötigt - ${trainings.length} Training(s)`,
      text: `Hallo ${trainerName},

für folgende Trainings wird eine Vertretung benötigt:

${trainingsListe}

${vertretungTrainerName ? `Als Vertretung ist ${vertretungTrainerName} eingetragen.` : "Bitte melde dich, wenn du als Vertretung einspringen kannst."}

Mit sportlichen Grüßen,
Deine Tennisschule`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Vertretung benötigt</h2>
          <p>Hallo ${trainerName},</p>
          <p>für folgende Trainings wird eine Vertretung benötigt:</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            ${trainings
              .map((t: { datum: string; uhrzeitVon: string; uhrzeitBis: string; spieler: string }) => {
                const [y, m, d] = t.datum.split("-");
                return `<p style="margin: 8px 0;"><strong>${d}.${m}.${y}</strong> von ${t.uhrzeitVon} bis ${t.uhrzeitBis} Uhr<br><span style="color: #6b7280;">${t.spieler}</span></p>`;
              })
              .join("")}
          </div>
          ${vertretungTrainerName
            ? `<p>Als Vertretung ist <strong>${vertretungTrainerName}</strong> eingetragen.</p>`
            : "<p>Bitte melde dich, wenn du als Vertretung einspringen kannst.</p>"}
          <p style="margin-top: 24px;">Mit sportlichen Grüßen,<br><strong>Deine Tennisschule</strong></p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true, message: "Email erfolgreich gesendet" };
    } catch (error) {
      console.error("Email Fehler:", error);
      throw new functions.https.HttpsError("internal", "Email konnte nicht gesendet werden");
    }
  });

// ============================================
// NEWSLETTER EMAIL
// ============================================
export const sendNewsletter = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Nicht authentifiziert");
    }

    const { recipients, subject, content } = data;

    if (!recipients || recipients.length === 0 || !subject || !content) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Empfänger, Betreff und Inhalt sind erforderlich"
      );
    }

    const transporter = getTransporter();
    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const recipient of recipients) {
      const mailOptions = {
        from: getSender(),
        to: recipient.email,
        subject: subject,
        text: content,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">${subject}</h2>
            <div style="line-height: 1.6;">
              ${content.replace(/\n/g, "<br>")}
            </div>
            <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px;">
              Du erhältst diese Email, weil du bei unserer Tennisschule angemeldet bist.
            </p>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        results.push({ email: recipient.email, success: true });
      } catch (error) {
        console.error(`Fehler beim Senden an ${recipient.email}:`, error);
        results.push({ email: recipient.email, success: false, error: String(error) });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return {
      success: true,
      message: `${successCount}/${recipients.length} Emails erfolgreich gesendet`,
      results,
    };
  });

// ============================================
// TRAININGSANMELDUNG EMAIL
// ============================================
export const sendTrainingsAnmeldung = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Nicht authentifiziert");
    }

    const { spielerEmail, spielerName, training, trainerName, aktion } = data;

    if (!spielerEmail || !training) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Spieler-Email und Training sind erforderlich"
      );
    }

    const transporter = getTransporter();
    const [y, m, d] = training.datum.split("-");
    const germanDate = `${d}.${m}.${y}`;

    const isAnmeldung = aktion === "anmeldung";
    const subject = isAnmeldung
      ? `Trainingsbestätigung - ${germanDate}`
      : `Training abgesagt - ${germanDate}`;

    const mailOptions = {
      from: getSender(),
      to: spielerEmail,
      subject: subject,
      text: isAnmeldung
        ? `Hallo ${spielerName},

dein Training wurde bestätigt:

Datum: ${germanDate}
Uhrzeit: ${training.uhrzeitVon} - ${training.uhrzeitBis} Uhr
Trainer: ${trainerName}

Wir freuen uns auf dich!

Mit sportlichen Grüßen,
Deine Tennisschule`
        : `Hallo ${spielerName},

dein Training am ${germanDate} von ${training.uhrzeitVon} - ${training.uhrzeitBis} Uhr wurde abgesagt.

Bei Fragen melde dich gerne bei uns.

Mit sportlichen Grüßen,
Deine Tennisschule`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${isAnmeldung ? "#22c55e" : "#ef4444"};">
            ${isAnmeldung ? "Training bestätigt" : "Training abgesagt"}
          </h2>
          <p>Hallo ${spielerName},</p>
          ${isAnmeldung
            ? `<p>dein Training wurde bestätigt:</p>
               <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                 <p style="margin: 4px 0;"><strong>Datum:</strong> ${germanDate}</p>
                 <p style="margin: 4px 0;"><strong>Uhrzeit:</strong> ${training.uhrzeitVon} - ${training.uhrzeitBis} Uhr</p>
                 <p style="margin: 4px 0;"><strong>Trainer:</strong> ${trainerName}</p>
               </div>
               <p>Wir freuen uns auf dich!</p>`
            : `<p>dein Training am <strong>${germanDate}</strong> von ${training.uhrzeitVon} - ${training.uhrzeitBis} Uhr wurde leider abgesagt.</p>
               <p>Bei Fragen melde dich gerne bei uns.</p>`
          }
          <p style="margin-top: 24px;">Mit sportlichen Grüßen,<br><strong>Deine Tennisschule</strong></p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true, message: "Email erfolgreich gesendet" };
    } catch (error) {
      console.error("Email Fehler:", error);
      throw new functions.https.HttpsError("internal", "Email konnte nicht gesendet werden");
    }
  });

// ============================================
// TEST EMAIL (zum Testen der Konfiguration)
// ============================================
export const sendTestEmail = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Nicht authentifiziert");
    }

    const { to } = data;

    if (!to) {
      throw new functions.https.HttpsError("invalid-argument", "Empfänger-Email erforderlich");
    }

    const transporter = getTransporter();

    const mailOptions = {
      from: getSender(),
      to: to,
      subject: "Test Email - Tennisschule",
      text: "Dies ist eine Test-Email. Die SMTP-Konfiguration funktioniert!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #22c55e;">SMTP Test erfolgreich!</h2>
          <p>Die Email-Konfiguration funktioniert korrekt.</p>
          <p style="color: #6b7280; font-size: 12px;">Tennisschule App</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
      return { success: true, message: "Test-Email erfolgreich gesendet" };
    } catch (error) {
      console.error("Test Email Fehler:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Email konnte nicht gesendet werden: ${error}`
      );
    }
  });
