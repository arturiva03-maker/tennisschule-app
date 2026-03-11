// Benutzer-Rollen
export type UserRole = "admin" | "trainer";

// Benutzer (in Firebase Auth + Firestore)
export type AppUser = {
  uid: string;
  email: string;
  name: string;
  rolle: UserRole;
  createdAt: string;
};

// Trainer
export type Trainer = {
  id: string;
  name: string;
  nachname: string;
  email: string;
  stundensatz?: number;
  notiz?: string;
  adresse?: string;
  telefon?: string;
  createdAt: string;
};

// Spieler
export type Spieler = {
  id: string;
  vorname: string;
  nachname: string;
  kontaktEmail?: string;
  kontaktTelefon?: string;
  adresse?: string;
  notizen?: string;
  createdAt: string;
};

// Tarif (Preis pro Stunde pro Spieler)
export type Tarif = {
  id: string;
  name: string;
  preisProStunde: number; // Preis pro Stunde pro Spieler
  beschreibung?: string;
  createdAt: string;
};

// Training Status
export type TrainingStatus = "geplant" | "durchgefuehrt" | "abgesagt";

// Training
export type Training = {
  id: string;
  trainerId: string;
  datum: string;
  uhrzeitVon: string;
  uhrzeitBis: string;
  spielerIds: string[];
  tarifId?: string;
  status: TrainingStatus;
  notiz?: string;
  serieId?: string; // Für wiederkehrende Trainings
  serieEnde?: string; // Ende-Datum der Serie (YYYY-MM-DD)
  createdAt: string;
};

// Vertretung - wenn ein Trainer für einen anderen einspringt
export type Vertretung = {
  id: string;
  trainingId: string;
  vertretungTrainerId?: string; // Optional - wenn leer, dann "Vertretung offen"
  createdAt: string;
};

// View-Modi für den Kalender
export type ViewMode = "week" | "day";

// Abrechnung Tab
export type AbrechnungTab = "spieler" | "trainer";

// Payments Map für Spieler-Abrechnung pro Monat
export type PaymentsMap = Record<string, boolean>; // key: `${monat}__${spielerId}`

// Trainer Payments Map pro Training
export type TrainerPaymentsMap = Record<string, boolean>; // key: trainingId

// Trainer Monats-Abrechnung Status
export type TrainerMonthSettledMap = Record<string, boolean>; // key: `${monat}__${trainerId}`
