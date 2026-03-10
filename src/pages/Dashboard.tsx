import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { Trainer, Spieler, Tarif, Training } from "../types";

// Import der Verwaltungs-Komponenten
import TrainerVerwaltung from "../components/TrainerVerwaltung";
import SpielerVerwaltung from "../components/SpielerVerwaltung";
import TarifVerwaltung from "../components/TarifVerwaltung";
import TrainingVerwaltung from "../components/TrainingVerwaltung";
import TrainingKalender from "../components/TrainingKalender";

type Tab = "trainings" | "verwaltung";
type VerwaltungSubTab = "spieler" | "trainer" | "tarife";
type TrainingAnsicht = "kalender" | "liste";

const Dashboard: React.FC = () => {
  const { appUser, logout, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("trainings");
  const [verwaltungSubTab, setVerwaltungSubTab] = useState<VerwaltungSubTab>("spieler");
  const [trainingAnsicht, setTrainingAnsicht] = useState<TrainingAnsicht>("kalender");

  // Daten-States
  const [trainer, setTrainer] = useState<Trainer[]>([]);
  const [spieler, setSpieler] = useState<Spieler[]>([]);
  const [tarife, setTarife] = useState<Tarif[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);

  // Daten laden
  const loadData = async () => {
    setLoading(true);
    try {
      // Trainer laden
      const trainerSnap = await getDocs(
        query(collection(db, "trainer"), orderBy("name"))
      );
      setTrainer(
        trainerSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Trainer))
      );

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
    } catch (error) {
      console.error("Fehler beim Laden der Daten:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTrainingClick = () => {
    setTrainingAnsicht("liste");
  };

  const tabs: { key: Tab; label: string; adminOnly?: boolean }[] = [
    { key: "trainings", label: "Trainings" },
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
          .filter((tab) => !tab.adminOnly || isAdmin)
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
            {/* Trainings Tab */}
            {activeTab === "trainings" && (
              <div className="verwaltung">
                {/* Ansicht Toggle */}
                <div className="ansicht-toggle">
                  <button
                    className={`ansicht-button ${trainingAnsicht === "kalender" ? "active" : ""}`}
                    onClick={() => setTrainingAnsicht("kalender")}
                  >
                    Kalender
                  </button>
                  <button
                    className={`ansicht-button ${trainingAnsicht === "liste" ? "active" : ""}`}
                    onClick={() => setTrainingAnsicht("liste")}
                  >
                    Liste
                  </button>
                </div>

                {trainingAnsicht === "kalender" ? (
                  <TrainingKalender
                    trainings={trainings}
                    trainer={trainer}
                    spieler={spieler}
                    tarife={tarife}
                    onTrainingClick={handleTrainingClick}
                    isAdmin={isAdmin}
                  />
                ) : (
                  <TrainingVerwaltung
                    trainings={trainings}
                    trainer={trainer}
                    spieler={spieler}
                    tarife={tarife}
                    onUpdate={loadData}
                    isAdmin={isAdmin}
                  />
                )}
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
