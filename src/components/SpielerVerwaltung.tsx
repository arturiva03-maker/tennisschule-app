import React, { useState } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { Spieler } from "../types";

type Props = {
  spieler: Spieler[];
  onUpdate: () => void;
  isAdmin: boolean;
};

const SpielerVerwaltung: React.FC<Props> = ({ spieler, onUpdate, isAdmin }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingSpieler, setEditingSpieler] = useState<Spieler | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    vorname: "",
    nachname: "",
    kontaktEmail: "",
    kontaktTelefon: "",
    adresse: "",
    notizen: "",
  });
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setFormData({
      vorname: "",
      nachname: "",
      kontaktEmail: "",
      kontaktTelefon: "",
      adresse: "",
      notizen: "",
    });
    setEditingSpieler(null);
    setShowForm(false);
  };

  const handleEdit = (s: Spieler) => {
    setEditingSpieler(s);
    setFormData({
      vorname: s.vorname,
      nachname: s.nachname || "",
      kontaktEmail: s.kontaktEmail || "",
      kontaktTelefon: s.kontaktTelefon || "",
      adresse: s.adresse || "",
      notizen: s.notizen || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingSpieler) {
        await updateDoc(doc(db, "spieler", editingSpieler.id), {
          vorname: formData.vorname,
          nachname: formData.nachname || null,
          kontaktEmail: formData.kontaktEmail || null,
          kontaktTelefon: formData.kontaktTelefon || null,
          adresse: formData.adresse || null,
          notizen: formData.notizen || null,
        });
      } else {
        await addDoc(collection(db, "spieler"), {
          vorname: formData.vorname,
          nachname: formData.nachname || null,
          kontaktEmail: formData.kontaktEmail || null,
          kontaktTelefon: formData.kontaktTelefon || null,
          adresse: formData.adresse || null,
          notizen: formData.notizen || null,
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

  const handleDelete = async (s: Spieler) => {
    if (!window.confirm(`Spieler "${s.vorname} ${s.nachname}" wirklich löschen?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "spieler", s.id));
      onUpdate();
    } catch (err) {
      console.error(err);
      alert("Fehler beim Löschen");
    }
  };

  // Filter Spieler nach Suchbegriff
  const filteredSpieler = spieler.filter((s) => {
    const fullName = `${s.vorname} ${s.nachname || ""}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="verwaltung">
      <div className="verwaltung-header">
        <h2>Spieler verwalten</h2>
        {isAdmin && (
          <button onClick={() => setShowForm(true)} className="add-button">
            + Neuer Spieler
          </button>
        )}
      </div>

      {/* Suche */}
      <div className="search-box">
        <input
          type="text"
          placeholder="Spieler suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Spieler-Liste */}
      <div className="liste">
        {filteredSpieler.length === 0 ? (
          <p className="empty">
            {searchTerm ? "Keine Spieler gefunden" : "Noch keine Spieler angelegt"}
          </p>
        ) : (
          filteredSpieler.map((s) => (
            <div key={s.id} className="liste-item">
              <div className="item-info">
                <strong>{s.vorname} {s.nachname}</strong>
                {s.kontaktEmail && <span>{s.kontaktEmail}</span>}
                {s.kontaktTelefon && <span>{s.kontaktTelefon}</span>}
              </div>
              {isAdmin && (
                <div className="item-actions">
                  <button onClick={() => handleEdit(s)}>Bearbeiten</button>
                  <button onClick={() => handleDelete(s)} className="delete">
                    Löschen
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Formular Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{editingSpieler ? "Spieler bearbeiten" : "Neuer Spieler"}</h3>

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Vorname *</label>
                  <input
                    type="text"
                    value={formData.vorname}
                    onChange={(e) =>
                      setFormData({ ...formData, vorname: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Nachname</label>
                  <input
                    type="text"
                    value={formData.nachname}
                    onChange={(e) =>
                      setFormData({ ...formData, nachname: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>E-Mail</label>
                  <input
                    type="email"
                    value={formData.kontaktEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, kontaktEmail: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Telefon</label>
                  <input
                    type="tel"
                    value={formData.kontaktTelefon}
                    onChange={(e) =>
                      setFormData({ ...formData, kontaktTelefon: e.target.value })
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
                <label>Notizen</label>
                <textarea
                  value={formData.notizen}
                  onChange={(e) =>
                    setFormData({ ...formData, notizen: e.target.value })
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

export default SpielerVerwaltung;
