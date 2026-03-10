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
  iban?: string;
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

// Tarif
export type Tarif = {
  id: string;
  name: string;
  preisProStunde: number;
  abrechnung: "proTraining" | "proSpieler" | "monatlich";
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
  createdAt: string;
};
