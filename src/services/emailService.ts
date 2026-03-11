import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions(undefined, "europe-west1");

// Types
interface Training {
  datum: string;
  uhrzeitVon: string;
  uhrzeitBis: string;
  spieler: string;
}

interface Recipient {
  email: string;
  name?: string;
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
  const sendEmail = httpsCallable(functions, "sendVertretungEmail");
  return sendEmail({ trainerEmail, trainerName, trainings, vertretungTrainerName });
};

// ============================================
// NEWSLETTER EMAIL
// ============================================
export const sendNewsletter = async (
  recipients: Recipient[],
  subject: string,
  content: string
) => {
  const send = httpsCallable(functions, "sendNewsletter");
  return send({ recipients, subject, content });
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
  const send = httpsCallable(functions, "sendTrainingsAnmeldung");
  return send({ spielerEmail, spielerName, training, trainerName, aktion });
};

// ============================================
// TEST EMAIL
// ============================================
export const sendTestEmail = async (to: string) => {
  const send = httpsCallable(functions, "sendTestEmail");
  return send({ to });
};
