import React, { useState } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { Tarif } from "../types";

type Props = {
  tarife: Tarif[];
  onUpdate: () => void;
};

const TarifVerwaltung: React.FC<Props> = ({ tarife, onUpdate }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingTarif, setEditingTarif] = useState<Tarif | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    preisProStunde: "",
    abrechnung: "proTraining" as "proTraining" | "proSpieler" | "monatlich",
    beschreibung: "",
  });
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setFormData({
      name: "",
      preisProStunde: "",
      abrechnung: "proTraining",
      beschreibung: "",
    });
    setEditingTarif(null);
    setShowForm(false);
  };

  const handleEdit = (t: Tarif) => {
    setEditingTarif(t);
    setFormData({
      name: t.name,
      preisProStunde: t.preisProStunde.toString(),
      abrechnung: t.abrechnung,
      beschreibung: t.beschreibung || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tarifData = {
        name: formData.name,
        preisProStunde: parseFloat(formData.preisProStunde),
        abrechnung: formData.abrechnung,
        beschreibung: formData.beschreibung || null,
      };

      if (editingTarif) {
        await updateDoc(doc(db, "tarife", editingTarif.id), tarifData);
      } else {
        await addDoc(collection(db, "tarife"), {
          ...tarifData,
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

  const handleDelete = async (t: Tarif) => {
    if (!window.confirm(`Tarif "${t.name}" wirklich löschen?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "tarife", t.id));
      onUpdate();
    } catch (err) {
      console.error(err);
      alert("Fehler beim Löschen");
    }
  };

  const abrechnungLabels = {
    proTraining: "Pro Training",
    proSpieler: "Pro Spieler",
    monatlich: "Monatlich",
  };

  return (
    <div className="verwaltung">
      <div className="verwaltung-header">
        <h2>Tarife verwalten</h2>
        <button onClick={() => setShowForm(true)} className="add-button">
          + Neuer Tarif
        </button>
      </div>

      {/* Tarife-Liste */}
      <div className="liste">
        {tarife.length === 0 ? (
          <p className="empty">Noch keine Tarife angelegt</p>
        ) : (
          tarife.map((t) => (
            <div key={t.id} className="liste-item">
              <div className="item-info">
                <strong>{t.name}</strong>
                <span>{t.preisProStunde} €/h</span>
                <span className="badge">{abrechnungLabels[t.abrechnung]}</span>
                {t.beschreibung && <span className="beschreibung">{t.beschreibung}</span>}
              </div>
              <div className="item-actions">
                <button onClick={() => handleEdit(t)}>Bearbeiten</button>
                <button onClick={() => handleDelete(t)} className="delete">
                  Löschen
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Formular Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingTarif ? "Tarif bearbeiten" : "Neuer Tarif"}</h3>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  placeholder="z.B. Einzeltraining, Gruppentraining"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Preis pro Stunde (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.preisProStunde}
                    onChange={(e) =>
                      setFormData({ ...formData, preisProStunde: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Abrechnung *</label>
                  <select
                    value={formData.abrechnung}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        abrechnung: e.target.value as typeof formData.abrechnung,
                      })
                    }
                  >
                    <option value="proTraining">Pro Training</option>
                    <option value="proSpieler">Pro Spieler</option>
                    <option value="monatlich">Monatlich</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Beschreibung</label>
                <textarea
                  value={formData.beschreibung}
                  onChange={(e) =>
                    setFormData({ ...formData, beschreibung: e.target.value })
                  }
                  rows={3}
                  placeholder="Optionale Beschreibung des Tarifs"
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

export default TarifVerwaltung;
