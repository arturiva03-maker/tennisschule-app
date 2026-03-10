import React, { useState } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { Training, Trainer, Spieler, Tarif, TrainingStatus } from "../types";

type Props = {
  trainings: Training[];
  trainer: Trainer[];
  spieler: Spieler[];
  tarife: Tarif[];
  onUpdate: () => void;
  isAdmin: boolean;
};

const TrainingVerwaltung: React.FC<Props> = ({
  trainings,
  trainer,
  spieler,
  tarife,
  onUpdate,
  isAdmin,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [filterStatus, setFilterStatus] = useState<TrainingStatus | "alle">("alle");
  const [filterDatum, setFilterDatum] = useState("");
  const [formData, setFormData] = useState({
    trainerId: "",
    datum: "",
    uhrzeitVon: "",
    uhrzeitBis: "",
    spielerIds: [] as string[],
    tarifId: "",
    status: "geplant" as TrainingStatus,
    notiz: "",
  });
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setFormData({
      trainerId: "",
      datum: "",
      uhrzeitVon: "",
      uhrzeitBis: "",
      spielerIds: [],
      tarifId: "",
      status: "geplant",
      notiz: "",
    });
    setEditingTraining(null);
    setShowForm(false);
  };

  const handleEdit = (t: Training) => {
    setEditingTraining(t);
    setFormData({
      trainerId: t.trainerId,
      datum: t.datum,
      uhrzeitVon: t.uhrzeitVon,
      uhrzeitBis: t.uhrzeitBis,
      spielerIds: t.spielerIds,
      tarifId: t.tarifId || "",
      status: t.status,
      notiz: t.notiz || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const trainingData = {
        trainerId: formData.trainerId,
        datum: formData.datum,
        uhrzeitVon: formData.uhrzeitVon,
        uhrzeitBis: formData.uhrzeitBis,
        spielerIds: formData.spielerIds,
        tarifId: formData.tarifId || null,
        status: formData.status,
        notiz: formData.notiz || null,
      };

      if (editingTraining) {
        await updateDoc(doc(db, "trainings", editingTraining.id), trainingData);
      } else {
        await addDoc(collection(db, "trainings"), {
          ...trainingData,
          createdAt: new Date().toISOString(),
        });
      }

      resetForm();
      onUpdate();
    } catch (err) {
      console.error(err);
      alert("Fehler beim Speichern");
    }

    setLoading(false);
  };

  const handleDelete = async (t: Training) => {
    if (!window.confirm("Training wirklich löschen?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "trainings", t.id));
      onUpdate();
    } catch (err) {
      console.error(err);
      alert("Fehler beim Löschen");
    }
  };

  const handleStatusChange = async (t: Training, newStatus: TrainingStatus) => {
    try {
      await updateDoc(doc(db, "trainings", t.id), { status: newStatus });
      onUpdate();
    } catch (err) {
      console.error(err);
      alert("Fehler beim Aktualisieren");
    }
  };

  const toggleSpieler = (spielerId: string) => {
    setFormData((prev) => ({
      ...prev,
      spielerIds: prev.spielerIds.includes(spielerId)
        ? prev.spielerIds.filter((id) => id !== spielerId)
        : [...prev.spielerIds, spielerId],
    }));
  };

  // Helper-Funktionen
  const getTrainerName = (id: string) => {
    const t = trainer.find((tr) => tr.id === id);
    return t ? `${t.name} ${t.nachname}` : "Unbekannt";
  };

  const getSpielerNames = (ids: string[]) => {
    return ids
      .map((id) => {
        const s = spieler.find((sp) => sp.id === id);
        return s ? `${s.vorname} ${s.nachname || ""}`.trim() : "";
      })
      .filter(Boolean)
      .join(", ");
  };

  const getTarifName = (id?: string) => {
    if (!id) return "-";
    const t = tarife.find((ta) => ta.id === id);
    return t ? t.name : "-";
  };

  const statusLabels: Record<TrainingStatus, string> = {
    geplant: "Geplant",
    durchgefuehrt: "Durchgeführt",
    abgesagt: "Abgesagt",
  };

  const statusColors: Record<TrainingStatus, string> = {
    geplant: "#3498db",
    durchgefuehrt: "#27ae60",
    abgesagt: "#e74c3c",
  };

  // Filter anwenden
  const filteredTrainings = trainings.filter((t) => {
    if (filterStatus !== "alle" && t.status !== filterStatus) return false;
    if (filterDatum && t.datum !== filterDatum) return false;
    return true;
  });

  return (
    <div className="verwaltung">
      <div className="verwaltung-header">
        <h2>Trainings</h2>
        {isAdmin && (
          <button onClick={() => setShowForm(true)} className="add-button">
            + Neues Training
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as TrainingStatus | "alle")}
        >
          <option value="alle">Alle Status</option>
          <option value="geplant">Geplant</option>
          <option value="durchgefuehrt">Durchgeführt</option>
          <option value="abgesagt">Abgesagt</option>
        </select>
        <input
          type="date"
          value={filterDatum}
          onChange={(e) => setFilterDatum(e.target.value)}
          placeholder="Datum filtern"
        />
        {filterDatum && (
          <button onClick={() => setFilterDatum("")} className="clear-filter">
            ✕
          </button>
        )}
      </div>

      {/* Trainings-Liste */}
      <div className="liste">
        {filteredTrainings.length === 0 ? (
          <p className="empty">Keine Trainings gefunden</p>
        ) : (
          filteredTrainings.map((t) => (
            <div key={t.id} className="liste-item training-item">
              <div className="item-info">
                <div className="training-header">
                  <strong>
                    {new Date(t.datum).toLocaleDateString("de-DE", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </strong>
                  <span>
                    {t.uhrzeitVon} - {t.uhrzeitBis}
                  </span>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: statusColors[t.status] }}
                  >
                    {statusLabels[t.status]}
                  </span>
                </div>
                <div className="training-details">
                  <span>Trainer: {getTrainerName(t.trainerId)}</span>
                  <span>Spieler: {getSpielerNames(t.spielerIds) || "Keine"}</span>
                  <span>Tarif: {getTarifName(t.tarifId)}</span>
                </div>
                {t.notiz && <div className="training-notiz">{t.notiz}</div>}
              </div>
              <div className="item-actions">
                {t.status === "geplant" && (
                  <>
                    <button
                      onClick={() => handleStatusChange(t, "durchgefuehrt")}
                      className="success"
                    >
                      ✓ Durchgeführt
                    </button>
                    <button
                      onClick={() => handleStatusChange(t, "abgesagt")}
                      className="warning"
                    >
                      ✕ Absagen
                    </button>
                  </>
                )}
                {isAdmin && (
                  <>
                    <button onClick={() => handleEdit(t)}>Bearbeiten</button>
                    <button onClick={() => handleDelete(t)} className="delete">
                      Löschen
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Formular Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <h3>{editingTraining ? "Training bearbeiten" : "Neues Training"}</h3>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Trainer *</label>
                <select
                  value={formData.trainerId}
                  onChange={(e) =>
                    setFormData({ ...formData, trainerId: e.target.value })
                  }
                  required
                >
                  <option value="">-- Trainer wählen --</option>
                  {trainer.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.nachname}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Datum *</label>
                  <input
                    type="date"
                    value={formData.datum}
                    onChange={(e) =>
                      setFormData({ ...formData, datum: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Von *</label>
                  <input
                    type="time"
                    value={formData.uhrzeitVon}
                    onChange={(e) =>
                      setFormData({ ...formData, uhrzeitVon: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Bis *</label>
                  <input
                    type="time"
                    value={formData.uhrzeitBis}
                    onChange={(e) =>
                      setFormData({ ...formData, uhrzeitBis: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Tarif</label>
                <select
                  value={formData.tarifId}
                  onChange={(e) =>
                    setFormData({ ...formData, tarifId: e.target.value })
                  }
                >
                  <option value="">-- Kein Tarif --</option>
                  {tarife.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.preisProStunde} €/h)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Spieler</label>
                <div className="spieler-checkbox-list">
                  {spieler.length === 0 ? (
                    <p className="empty">Keine Spieler vorhanden</p>
                  ) : (
                    spieler.map((s) => (
                      <label key={s.id} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={formData.spielerIds.includes(s.id)}
                          onChange={() => toggleSpieler(s.id)}
                        />
                        {s.vorname} {s.nachname}
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as TrainingStatus,
                    })
                  }
                >
                  <option value="geplant">Geplant</option>
                  <option value="durchgefuehrt">Durchgeführt</option>
                  <option value="abgesagt">Abgesagt</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notiz</label>
                <textarea
                  value={formData.notiz}
                  onChange={(e) =>
                    setFormData({ ...formData, notiz: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={resetForm}>
                  Abbrechen
                </button>
                <button type="submit" disabled={loading}>
                  {loading ? "Speichern..." : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingVerwaltung;
