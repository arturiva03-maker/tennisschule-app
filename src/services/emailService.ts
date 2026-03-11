import emailjs from "@emailjs/browser";

// EmailJS Konfiguration - aus Environment Variables
const SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID || "";
const PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY || "";

// Template IDs
const TEMPLATE_VERTRETUNG = process.env.REACT_APP_EMAILJS_TEMPLATE_VERTRETUNG || "";
const TEMPLATE_NEWSLETTER = process.env.REACT_APP_EMAILJS_TEMPLATE_NEWSLETTER || "";
const TEMPLATE_TRAINING = process.env.REACT_APP_EMAILJS_TEMPLATE_TRAINING || "";

// Initialisierung
emailjs.init(PUBLIC_KEY);

// Types
interface Training {
  datum: string;
  uhrzeitVon: string;
  uhrzeitBis: string;
  spieler: string;
}

// ============================================
// VERTRETUNG EMAIL
// ============================================
export const sendVertretungEmail = async (
  trainerEmail: string,
  trainerName: string,
  trainings: Training[],
  vertretungTrainerName?: string
) => {
  const trainingsListe = trainings
    .map((t) => {
      const [y, m, d] = t.datum.split("-");
      return `• ${d}.${m}.${y} von ${t.uhrzeitVon} bis ${t.uhrzeitBis} Uhr - ${t.spieler}`;
    })
    .join("\n");

  const templateParams = {
    to_email: trainerEmail,
    to_name: trainerName,
    trainings_liste: trainingsListe,
    trainings_count: trainings.length,
    vertretung_name: vertretungTrainerName || "Noch nicht zugewiesen",
  };

  return emailjs.send(SERVICE_ID, TEMPLATE_VERTRETUNG, templateParams);
};

// ============================================
// NEWSLETTER EMAIL
// ============================================
export const sendNewsletter = async (
  recipients: { email: string; name?: string }[],
  subject: string,
  content: string
) => {
  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const recipient of recipients) {
    try {
      await emailjs.send(SERVICE_ID, TEMPLATE_NEWSLETTER, {
        to_email: recipient.email,
        to_name: recipient.name || "Tennisfreund",
        subject: subject,
        message: content,
      });
      results.push({ email: recipient.email, success: true });
    } catch (error) {
      results.push({ email: recipient.email, success: false, error: String(error) });
    }
  }

  return {
    success: true,
    sent: results.filter((r) => r.success).length,
    total: recipients.length,
    results,
  };
};

// ============================================
// TRAININGSANMELDUNG EMAIL
// ============================================
export const sendTrainingsAnmeldungEmail = async (
  spielerEmail: string,
  spielerName: string,
  training: { datum: string; uhrzeitVon: string; uhrzeitBis: string },
  trainerName: string,
  aktion: "anmeldung" | "absage"
) => {
  const [y, m, d] = training.datum.split("-");
  const germanDate = `${d}.${m}.${y}`;

  const templateParams = {
    to_email: spielerEmail,
    to_name: spielerName,
    datum: germanDate,
    uhrzeit_von: training.uhrzeitVon,
    uhrzeit_bis: training.uhrzeitBis,
    trainer_name: trainerName,
    aktion: aktion,
    is_anmeldung: aktion === "anmeldung",
  };

  return emailjs.send(SERVICE_ID, TEMPLATE_TRAINING, templateParams);
};

// ============================================
// TEST EMAIL
// ============================================
export const sendTestEmail = async (to: string) => {
  return emailjs.send(SERVICE_ID, TEMPLATE_NEWSLETTER, {
    to_email: to,
    to_name: "Test",
    subject: "Test Email - Tennisschule",
    message: "Dies ist eine Test-Email. Die EmailJS-Konfiguration funktioniert!",
  });
};

// ============================================
// CHECK CONFIG
// ============================================
export const isEmailConfigured = () => {
  return !!(SERVICE_ID && PUBLIC_KEY && (TEMPLATE_VERTRETUNG || TEMPLATE_NEWSLETTER || TEMPLATE_TRAINING));
};
