import React, { useState } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "../firebase";
import { Trainer } from "../types";

type Props = {
  trainer: Trainer[];
  onUpdate: () => void;
};

const TrainerVerwaltung: React.FC<Props> = ({ trainer, onUpdate }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<Trainer | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    nachname: "",
    email: "",
    telefon: "",
    stundensatz: "",
    adresse: "",
    iban: "",
    notiz: "",
    password: "", // Nur für neue Trainer
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setFormData({
      name: "",
      nachname: "",
      email: "",
      telefon: "",
      stundensatz: "",
      adresse: "",
      iban: "",
      notiz: "",
      password: "",
    });
    setEditingTrainer(null);
    setShowForm(false);
    setError("");
  };

  const handleEdit = (t: Trainer) => {
    setEditingTrainer(t);
    setFormData({
      name: t.name,
      nachname: t.nachname,
      email: t.email,
      telefon: t.telefon || "",
      stundensatz: t.stundensatz?.toString() || "",
      adresse: t.adresse || "",
      iban: t.iban || "",
      notiz: t.notiz || "",
      password: "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (editingTrainer) {
        // Trainer aktualisieren
        await updateDoc(doc(db, "trainer", editingTrainer.id), {
          name: formData.name,
          nachname: formData.nachname,
          email: formData.email,
          telefon: formData.telefon || null,
          stundensatz: formData.stundensatz ? parseFloat(formData.stundensatz) : null,
          adresse: formData.adresse || null,
          iban: formData.iban || null,
          notiz: formData.notiz || null,
        });
      } else {
        // Neuen Trainer anlegen
        if (!formData.password || formData.password.length < 6) {
          setError("Passwort muss mindestens 6 Zeichen haben");
          setLoading(false);
          return;
        }

        // Firebase Auth User erstellen
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

        // User-Dokument in Firestore erstellen
        const { setDoc, doc: firestoreDoc } = await import("firebase/firestore");
        await setDoc(firestoreDoc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: formData.email,
          name: `${formData.name} ${formData.nachname}`,
          rolle: "trainer",
          createdAt: new Date().toISOString(),
        });

        // Trainer-Dokument erstellen
        await addDoc(collection(db, "trainer"), {
          name: formData.name,
          nachname: formData.nachname,
          email: formData.email,
          telefon: formData.telefon || null,
          stundensatz: formData.stundensatz ? parseFloat(formData.stundensatz) : null,
          adresse: formData.adresse || null,
          iban: formData.iban || null,
          notiz: formData.notiz || null,
          userId: userCredential.user.uid,
          createdAt: new Date().toISOString(),
        });
      }

      resetForm();
      onUpdate();
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("Diese E-Mail ist bereits registriert");
      } else {
        setError("Fehler beim Speichern");
      }
    }

    setLoading(false);
  };

  const handleDelete = async (t: Trainer) => {
    if (!window.confirm(`Trainer "${t.name} ${t.nachname}" wirklich löschen?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "trainer", t.id));
      onUpdate();
    } catch (err) {
      console.error(err);
      alert("Fehler beim Löschen");
    }
  };

  return (
    <div className="verwaltung">
      <div className="verwaltung-header">
        <h2>Trainer verwalten</h2>
        <button onClick={() => setShowForm(true)} className="add-button">
          + Neuer Trainer
        </button>
      </div>

      {/* Trainer-Liste */}
      <div className="liste">
        {trainer.length === 0 ? (
          <p className="empty">Noch keine Trainer angelegt</p>
        ) : (
          trainer.map((t) => (
            <div key={t.id} className="liste-item">
              <div className="item-info">
                <strong>{t.name} {t.nachname}</strong>
                <span>{t.email}</span>
                {t.stundensatz && <span>{t.stundensatz} €/h</span>}
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
            <h3>{editingTrainer ? "Trainer bearbeiten" : "Neuer Trainer"}</h3>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Vorname *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Nachname *</label>
                  <input
                    type="text"
                    value={formData.nachname}
                    onChange={(e) =>
                      setFormData({ ...formData, nachname: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>E-Mail *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  disabled={!!editingTrainer}
                />
              </div>

              {!editingTrainer && (
                <div className="form-group">
                  <label>Passwort * (min. 6 Zeichen)</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    minLength={6}
                  />
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Telefon</label>
                  <input
                    type="tel"
                    value={formData.telefon}
                    onChange={(e) =>
                      setFormData({ ...formData, telefon: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Stundensatz (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.stundensatz}
                    onChange={(e) =>
                      setFormData({ ...formData, stundensatz: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Adresse</label>
                <input
                  type="text"
                  value={formData.adresse}
                  onChange={(e) =>
                    setFormData({ ...formData, adresse: e.target.value })
                  }
                />
              </div>

              <div className="form-group">
                <label>IBAN</label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) =>
                    setFormData({ ...formData, iban: e.target.value })
                  }
                />
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

export default TrainerVerwaltung;
