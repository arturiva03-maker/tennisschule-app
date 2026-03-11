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

// Import der Komponenten
import TrainerVerwaltung from "../components/TrainerVerwaltung";
import SpielerVerwaltung from "../components/SpielerVerwaltung";
import TarifVerwaltung from "../components/TarifVerwaltung";
import TrainingKalender from "../components/TrainingKalender";
import Abrechnung from "../components/Abrechnung";
import Vertretung from "../components/Vertretung";

type Tab = "kalender" | "abrechnung" | "vertretung" | "verwaltung";
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

  // Abrechnung States
  const [payments, setPayments] = useState<PaymentsMap>({});
  const [trainerPayments, setTrainerPayments] = useState<TrainerPaymentsMap>({});
  const [trainerMonthSettled, setTrainerMonthSettled] = useState<TrainerMonthSettledMap>({});

  // Trainer ID für Trainer-Accounts
  const [ownTrainerId, setOwnTrainerId] = useState<string | undefined>();

  // Daten laden
  const loadData = async () => {
    setLoading(true);
    try {
      const trainerSnap = await getDocs(query(collection(db, "trainer"), orderBy("name")));
      const loadedTrainer = trainerSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Trainer));
      setTrainer(loadedTrainer);

      const spielerSnap = await getDocs(query(collection(db, "spieler"), orderBy("nachname")));
      setSpieler(spielerSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Spieler)));

      const tarifeSnap = await getDocs(query(collection(db, "tarife"), orderBy("name")));
      setTarife(tarifeSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Tarif)));

      const trainingsSnap = await getDocs(query(collection(db, "trainings"), orderBy("datum", "desc")));
      setTrainings(trainingsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Training)));

      const vertretungenSnap = await getDocs(collection(db, "vertretungen"));
      setVertretungen(vertretungenSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as VertretungType)));

      const paymentsSnap = await getDocs(collection(db, "payments"));
      const paymentsData: PaymentsMap = {};
      paymentsSnap.docs.forEach((doc) => { paymentsData[doc.id] = true; });
      setPayments(paymentsData);

      const trainerPaymentsSnap = await getDocs(collection(db, "trainerPayments"));
      const trainerPaymentsData: TrainerPaymentsMap = {};
      trainerPaymentsSnap.docs.forEach((doc) => { trainerPaymentsData[doc.id] = true; });
      setTrainerPayments(trainerPaymentsData);

      const settledSnap = await getDocs(collection(db, "trainerMonthSettled"));
      const settledData: TrainerMonthSettledMap = {};
      settledSnap.docs.forEach((doc) => { settledData[doc.id] = true; });
      setTrainerMonthSettled(settledData);

      if (!isAdmin && appUser?.email) {
        const ownTrainer = loadedTrainer.find((t) => t.email?.toLowerCase() === appUser.email.toLowerCase());
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
    try {
      const currentKeys = Object.keys(payments).filter((k) => payments[k]);
      const newKeys = Object.keys(newPayments).filter((k) => newPayments[k]);
      for (const key of newKeys) {
        if (!currentKeys.includes(key)) await setDoc(doc(db, "payments", key), { paid: true });
      }
      for (const key of currentKeys) {
        if (!newKeys.includes(key)) await deleteDoc(doc(db, "payments", key));
      }
    } catch (error) {
      console.error("Fehler beim Speichern der Payments:", error);
    }
  };

  const handleTrainerPaymentsChange = async (newPayments: TrainerPaymentsMap) => {
    setTrainerPayments(newPayments);
    try {
      const currentKeys = Object.keys(trainerPayments).filter((k) => trainerPayments[k]);
      const newKeys = Object.keys(newPayments).filter((k) => newPayments[k]);
      for (const key of newKeys) {
        if (!currentKeys.includes(key)) await setDoc(doc(db, "trainerPayments", key), { paid: true });
      }
      for (const key of currentKeys) {
        if (!newKeys.includes(key)) await deleteDoc(doc(db, "trainerPayments", key));
      }
    } catch (error) {
      console.error("Fehler beim Speichern der Trainer Payments:", error);
    }
  };

  const handleTrainerMonthSettledChange = async (newSettled: TrainerMonthSettledMap) => {
    setTrainerMonthSettled(newSettled);
    try {
      const currentKeys = Object.keys(trainerMonthSettled).filter((k) => trainerMonthSettled[k]);
      const newKeys = Object.keys(newSettled).filter((k) => newSettled[k]);
      for (const key of newKeys) {
        if (!currentKeys.includes(key)) await setDoc(doc(db, "trainerMonthSettled", key), { settled: true });
      }
      for (const key of currentKeys) {
        if (!newKeys.includes(key)) await deleteDoc(doc(db, "trainerMonthSettled", key));
      }
    } catch (error) {
      console.error("Fehler beim Speichern des Settled-Status:", error);
    }
  };

  const handleTrainingClick = () => {
    setActiveTab("kalender");
  };

  const tabs: { key: Tab; label: string; adminOnly?: boolean; trainerVisible?: boolean }[] = [
    { key: "kalender", label: "Kalender", trainerVisible: true },
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
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>Tennisschule</h1>
          <div className="user-menu">
            <span className="user-name">{appUser?.name}</span>
            <span className="user-role">{appUser?.rolle}</span>
            <button onClick={logout} className="logout-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="app-nav">
        <div className="nav-content">
          {tabs
            .filter((tab) => {
              if (tab.adminOnly && !isAdmin) return false;
              if (!isAdmin && !tab.trainerVisible) return false;
              return true;
            })
            .map((tab) => (
              <button
                key={tab.key}
                className={`nav-item ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
        </div>
      </nav>

      {/* Content */}
      <main className="app-content">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Laden...</p>
          </div>
        ) : (
          <>
            {activeTab === "kalender" && (
              <TrainingKalender
                trainings={trainings}
                trainer={trainer}
                spieler={spieler}
                tarife={tarife}
                vertretungen={vertretungen}
                onUpdate={loadData}
                isAdmin={isAdmin}
                ownTrainerId={ownTrainerId}
              />
            )}

            {activeTab === "abrechnung" && (
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
            )}

            {activeTab === "vertretung" && isAdmin && (
              <Vertretung
                trainings={trainings}
                trainer={trainer}
                spieler={spieler}
                vertretungen={vertretungen}
                onUpdate={loadData}
              />
            )}

            {activeTab === "verwaltung" && isAdmin && (
              <div className="card">
                <div className="sub-nav">
                  {verwaltungTabs.map((tab) => (
                    <button
                      key={tab.key}
                      className={`sub-nav-item ${verwaltungSubTab === tab.key ? "active" : ""}`}
                      onClick={() => setVerwaltungSubTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="card-content">
                  {verwaltungSubTab === "spieler" && <SpielerVerwaltung spieler={spieler} onUpdate={loadData} isAdmin={isAdmin} />}
                  {verwaltungSubTab === "trainer" && <TrainerVerwaltung trainer={trainer} onUpdate={loadData} />}
                  {verwaltungSubTab === "tarife" && <TarifVerwaltung tarife={tarife} onUpdate={loadData} />}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
