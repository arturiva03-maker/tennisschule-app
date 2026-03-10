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

type Tab = "trainings" | "spieler" | "trainer" | "tarife";

const Dashboard: React.FC = () => {
  const { appUser, logout, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("trainings");

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

  const tabs: { key: Tab; label: string; adminOnly?: boolean }[] = [
    { key: "trainings", label: "Trainings" },
    { key: "spieler", label: "Spieler" },
    { key: "trainer", label: "Trainer", adminOnly: true },
    { key: "tarife", label: "Tarife", adminOnly: true },
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
            {activeTab === "trainings" && (
              <TrainingVerwaltung
                trainings={trainings}
                trainer={trainer}
                spieler={spieler}
                tarife={tarife}
                onUpdate={loadData}
                isAdmin={isAdmin}
              />
            )}
            {activeTab === "spieler" && (
              <SpielerVerwaltung
                spieler={spieler}
                onUpdate={loadData}
                isAdmin={isAdmin}
              />
            )}
            {activeTab === "trainer" && isAdmin && (
              <TrainerVerwaltung trainer={trainer} onUpdate={loadData} />
            )}
            {activeTab === "tarife" && isAdmin && (
              <TarifVerwaltung tarife={tarife} onUpdate={loadData} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
