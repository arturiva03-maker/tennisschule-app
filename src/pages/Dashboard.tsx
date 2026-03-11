import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { collection, getDocs, query, orderBy, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  Trainer,
  Spieler,
  Tarif,
  Training,
  Vertretung as VertretungType,
  PaymentsMap,
  TrainerPaymentsMap,
  TrainerMonthSettledMap,
} from "../types";

// Import der Verwaltungs-Komponenten
import TrainerVerwaltung from "../components/TrainerVerwaltung";
import SpielerVerwaltung from "../components/SpielerVerwaltung";
import TarifVerwaltung from "../components/TarifVerwaltung";
import TrainingVerwaltung from "../components/TrainingVerwaltung";
import TrainingKalender from "../components/TrainingKalender";
import Abrechnung from "../components/Abrechnung";
import Vertretung from "../components/Vertretung";

type Tab = "kalender" | "trainings" | "verwaltung" | "abrechnung" | "vertretung";
type VerwaltungSubTab = "spieler" | "trainer" | "tarife";

const Dashboard: React.FC = () => {
  const { appUser, logout, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("kalender");
  const [verwaltungSubTab, setVerwaltungSubTab] = useState<VerwaltungSubTab>("spieler");

  // Daten-States
  const [trainer, setTrainer] = useState<Trainer[]>([]);
  const [spieler, setSpieler] = useState<Spieler[]>([]);
  const [tarife, setTarife] = useState<Tarif[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [vertretungen, setVertretungen] = useState<VertretungType[]>([]);
  const [loading, setLoading] = useState(true);

  // Abrechnung States (in Firestore speichern)
  const [payments, setPayments] = useState<PaymentsMap>({});
  const [trainerPayments, setTrainerPayments] = useState<TrainerPaymentsMap>({});
  const [trainerMonthSettled, setTrainerMonthSettled] = useState<TrainerMonthSettledMap>({});

  // Trainer ID für Trainer-Accounts
  const [ownTrainerId, setOwnTrainerId] = useState<string | undefined>();

  // Daten laden
  const loadData = async () => {
    setLoading(true);
    try {
      // Trainer laden
      const trainerSnap = await getDocs(
        query(collection(db, "trainer"), orderBy("name"))
      );
      const loadedTrainer = trainerSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Trainer)
      );
      setTrainer(loadedTrainer);

      // Spieler laden
      const spielerSnap = await getDocs(
        query(collection(db, "spieler"), orderBy("nachname"))
      );
      setSpieler(
        spielerSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Spieler))
      );

      // Tarife laden
      const tarifeSnap = await getDocs(
        query(collection(db, "tarife"), orderBy("name"))
      );
      setTarife(
        tarifeSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Tarif))
      );

      // Trainings laden
      const trainingsSnap = await getDocs(
        query(collection(db, "trainings"), orderBy("datum", "desc"))
      );
      setTrainings(
        trainingsSnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Training)
        )
      );

      // Vertretungen laden
      const vertretungenSnap = await getDocs(collection(db, "vertretungen"));
      setVertretungen(
        vertretungenSnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as VertretungType)
        )
      );

      // Payments laden
      const paymentsSnap = await getDocs(collection(db, "payments"));
      const paymentsData: PaymentsMap = {};
      paymentsSnap.docs.forEach((doc) => {
        paymentsData[doc.id] = true;
      });
      setPayments(paymentsData);

      // Trainer Payments laden
      const trainerPaymentsSnap = await getDocs(collection(db, "trainerPayments"));
      const trainerPaymentsData: TrainerPaymentsMap = {};
      trainerPaymentsSnap.docs.forEach((doc) => {
        trainerPaymentsData[doc.id] = true;
      });
      setTrainerPayments(trainerPaymentsData);

      // Trainer Month Settled laden
      const settledSnap = await getDocs(collection(db, "trainerMonthSettled"));
      const settledData: TrainerMonthSettledMap = {};
      settledSnap.docs.forEach((doc) => {
        settledData[doc.id] = true;
      });
      setTrainerMonthSettled(settledData);

      // Eigene Trainer-ID finden (für Trainer-Accounts)
      if (!isAdmin && appUser?.email) {
        const ownTrainer = loadedTrainer.find(
          (t) => t.email?.toLowerCase() === appUser.email.toLowerCase()
        );
        setOwnTrainerId(ownTrainer?.id);
      }
    } catch (error) {
      console.error("Fehler beim Laden der Daten:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Payments Handler
  const handlePaymentsChange = async (newPayments: PaymentsMap) => {
    setPayments(newPayments);

    // Synchronisiere mit Firestore
    try {
      const currentKeys = Object.keys(payments).filter((k) => payments[k]);
      const newKeys = Object.keys(newPayments).filter((k) => newPayments[k]);

      // Hinzufügen
      for (const key of newKeys) {
        if (!currentKeys.includes(key)) {
          await setDoc(doc(db, "payments", key), { paid: true });
        }
      }

      // Entfernen
      for (const key of currentKeys) {
        if (!newKeys.includes(key)) {
          await deleteDoc(doc(db, "payments", key));
        }
      }
    } catch (error) {
      console.error("Fehler beim Speichern der Payments:", error);
    }
  };

  // Trainer Payments Handler
  const handleTrainerPaymentsChange = async (newPayments: TrainerPaymentsMap) => {
    setTrainerPayments(newPayments);

    try {
      const currentKeys = Object.keys(trainerPayments).filter((k) => trainerPayments[k]);
      const newKeys = Object.keys(newPayments).filter((k) => newPayments[k]);

      for (const key of newKeys) {
        if (!currentKeys.includes(key)) {
          await setDoc(doc(db, "trainerPayments", key), { paid: true });
        }
      }

      for (const key of currentKeys) {
        if (!newKeys.includes(key)) {
          await deleteDoc(doc(db, "trainerPayments", key));
        }
      }
    } catch (error) {
      console.error("Fehler beim Speichern der Trainer Payments:", error);
    }
  };

  // Trainer Month Settled Handler
  const handleTrainerMonthSettledChange = async (newSettled: TrainerMonthSettledMap) => {
    setTrainerMonthSettled(newSettled);

    try {
      const currentKeys = Object.keys(trainerMonthSettled).filter((k) => trainerMonthSettled[k]);
      const newKeys = Object.keys(newSettled).filter((k) => newSettled[k]);

      for (const key of newKeys) {
        if (!currentKeys.includes(key)) {
          await setDoc(doc(db, "trainerMonthSettled", key), { settled: true });
        }
      }

      for (const key of currentKeys) {
        if (!newKeys.includes(key)) {
          await deleteDoc(doc(db, "trainerMonthSettled", key));
        }
      }
    } catch (error) {
      console.error("Fehler beim Speichern des Settled-Status:", error);
    }
  };

  // Training klick Handler für Navigation zur Liste
  const handleTrainingClick = (training: Training) => {
    setActiveTab("trainings");
    // Optional: Training vorauswählen für Bearbeitung
  };

  const tabs: { key: Tab; label: string; adminOnly?: boolean; trainerVisible?: boolean }[] = [
    { key: "kalender", label: "Kalender", trainerVisible: true },
    { key: "trainings", label: "Trainings", trainerVisible: true },
    { key: "abrechnung", label: "Abrechnung", trainerVisible: true },
    { key: "vertretung", label: "Vertretung", adminOnly: true },
    { key: "verwaltung", label: "Verwaltung", adminOnly: true },
  ];

  const verwaltungTabs: { key: VerwaltungSubTab; label: string }[] = [
    { key: "spieler", label: "Spieler" },
    { key: "trainer", label: "Trainer" },
    { key: "tarife", label: "Tarife" },
  ];

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <h1>Tennisschule</h1>
        <div className="user-info">
          <span>
            {appUser?.name} ({appUser?.rolle})
          </span>
          <button onClick={logout} className="logout-button">
            Abmelden
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="dashboard-nav">
        {tabs
          .filter((tab) => {
            if (tab.adminOnly && !isAdmin) return false;
            if (!isAdmin && !tab.trainerVisible) return false;
            return true;
          })
          .map((tab) => (
            <button
              key={tab.key}
              className={`nav-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
      </nav>

      {/* Content */}
      <main className="dashboard-content">
        {loading ? (
          <div className="loading">Laden...</div>
        ) : (
          <>
            {/* Kalender Tab */}
            {activeTab === "kalender" && (
              <div className="verwaltung">
                <TrainingKalender
                  trainings={trainings}
                  trainer={trainer}
                  spieler={spieler}
                  tarife={tarife}
                  vertretungen={vertretungen}
                  onTrainingClick={handleTrainingClick}
                  isAdmin={isAdmin}
                  ownTrainerId={ownTrainerId}
                />
              </div>
            )}

            {/* Trainings Tab */}
            {activeTab === "trainings" && (
              <div className="verwaltung">
                <TrainingVerwaltung
                  trainings={trainings}
                  trainer={trainer}
                  spieler={spieler}
                  tarife={tarife}
                  onUpdate={loadData}
                  isAdmin={isAdmin}
                />
              </div>
            )}

            {/* Abrechnung Tab */}
            {activeTab === "abrechnung" && (
              <div className="verwaltung">
                <Abrechnung
                  trainings={trainings}
                  trainer={trainer}
                  spieler={spieler}
                  tarife={tarife}
                  vertretungen={vertretungen}
                  payments={payments}
                  trainerPayments={trainerPayments}
                  trainerMonthSettled={trainerMonthSettled}
                  isAdmin={isAdmin}
                  ownTrainerId={ownTrainerId}
                  onPaymentsChange={handlePaymentsChange}
                  onTrainerPaymentsChange={handleTrainerPaymentsChange}
                  onTrainerMonthSettledChange={handleTrainerMonthSettledChange}
                  onTrainingClick={handleTrainingClick}
                />
              </div>
            )}

            {/* Vertretung Tab (nur Admin) */}
            {activeTab === "vertretung" && isAdmin && (
              <div className="verwaltung">
                <Vertretung
                  trainings={trainings}
                  trainer={trainer}
                  spieler={spieler}
                  vertretungen={vertretungen}
                  onUpdate={loadData}
                />
              </div>
            )}

            {/* Verwaltung Tab (nur Admin) */}
            {activeTab === "verwaltung" && isAdmin && (
              <div className="verwaltung">
                {/* Sub-Tabs */}
                <div className="verwaltung-tabs">
                  {verwaltungTabs.map((tab) => (
                    <button
                      key={tab.key}
                      className={`verwaltung-tab ${verwaltungSubTab === tab.key ? "active" : ""}`}
                      onClick={() => setVerwaltungSubTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Sub-Tab Content */}
                {verwaltungSubTab === "spieler" && (
                  <SpielerVerwaltung
                    spieler={spieler}
                    onUpdate={loadData}
                    isAdmin={isAdmin}
                  />
                )}
                {verwaltungSubTab === "trainer" && (
                  <TrainerVerwaltung trainer={trainer} onUpdate={loadData} />
                )}
                {verwaltungSubTab === "tarife" && (
                  <TarifVerwaltung tarife={tarife} onUpdate={loadData} />
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
