import React, { useState, useMemo } from "react";
import { Training, Trainer, Spieler, Vertretung as VertretungType } from "../types";
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

type Props = {
  trainings: Training[];
  trainer: Trainer[];
  spieler: Spieler[];
  vertretungen: VertretungType[];
  onUpdate: () => void;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const Vertretung: React.FC<Props> = ({
  trainings,
  trainer,
  spieler,
  vertretungen,
  onUpdate,
}) => {
  const [vertretungTrainerId, setVertretungTrainerId] = useState<string>("");
  const [vertretungModus, setVertretungModus] = useState<"einzeln" | "zeitraum">("einzeln");
  const [vertretungDaten, setVertretungDaten] = useState<string[]>([]);
  const [vertretungVon, setVertretungVon] = useState<string>("");
  const [vertretungBis, setVertretungBis] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [selectedVertretungen, setSelectedVertretungen] = useState<Record<string, string>>({});

  const heute = todayISO();

  // Maps
  const trainerById = useMemo(() => {
    const map = new Map<string, Trainer>();
    trainer.forEach((t) => map.set(t.id, t));
    return map;
  }, [trainer]);

  const spielerById = useMemo(() => {
    const map = new Map<string, Spieler>();
    spieler.forEach((s) => map.set(s.id, s));
    return map;
  }, [spieler]);

  const getSpielerDisplayName = (id: string) => {
    const s = spielerById.get(id);
    return s ? `${s.vorname} ${s.nachname || ""}`.trim() : "Unbekannt";
  };

  // Alle zukünftigen Vertretungen mit Training-Daten
  const alleVertretungen = useMemo(() => {
    const jetzt = new Date();
    return vertretungen
      .map((v) => {
        const training = trainings.find((t) => t.id === v.trainingId);
        if (!training) return null;
        if (training.status === "abgesagt") return null;
        const trainingsEnde = new Date(`${training.datum}T${training.uhrzeitBis}:00`);
        if (trainingsEnde <= jetzt) return null;
        return { vertretung: v, training };
      })
      .filter((x): x is { vertretung: VertretungType; training: Training } => x !== null)
      .sort((a, b) => {
        const dateComp = a.training.datum.localeCompare(b.training.datum);
        if (dateComp !== 0) return dateComp;
        return a.training.uhrzeitVon.localeCompare(b.training.uhrzeitVon);
      });
  }, [vertretungen, trainings]);

  const offeneVertretungen = alleVertretungen.filter((x) => !x.vertretung.vertretungTrainerId);
  const besetzteVertretungen = alleVertretungen.filter((x) => x.vertretung.vertretungTrainerId);

  // Trainings für neue Vertretung
  const trainingsForSelection = useMemo(() => {
    if (!vertretungTrainerId) return [];

    let dates: string[] = [];
    if (vertretungModus === "einzeln") {
      dates = vertretungDaten;
    } else if (vertretungVon && vertretungBis && vertretungVon <= vertretungBis) {
      let current = vertretungVon;
      while (current <= vertretungBis) {
        dates.push(current);
        current = addDaysISO(current, 1);
      }
    }

    return trainings.filter((t) => {
      if (t.trainerId !== vertretungTrainerId) return false;
      if (t.status === "abgesagt") return false;
      if (!dates.includes(t.datum)) return false;
      const trainingsEnde = new Date(`${t.datum}T${t.uhrzeitBis}:00`);
      if (trainingsEnde <= new Date()) return false;
      if (vertretungen.some((v) => v.trainingId === t.id)) return false;
      return true;
    });
  }, [vertretungTrainerId, vertretungModus, vertretungDaten, vertretungVon, vertretungBis, trainings, vertretungen]);

  const addVertretungen = async () => {
    if (trainingsForSelection.length === 0) return;
    setSaving(true);
    try {
      for (const training of trainingsForSelection) {
        const zugewiesenerTrainer = selectedVertretungen[training.id] || null;
        await addDoc(collection(db, "vertretungen"), {
          trainingId: training.id,
          vertretungTrainerId: zugewiesenerTrainer,
          createdAt: serverTimestamp(),
        });
      }
      setVertretungDaten([]);
      setVertretungVon("");
      setVertretungBis("");
      setSelectedVertretungen({});
      onUpdate();
    } catch (error) {
      console.error("Fehler beim Hinzufügen der Vertretungen:", error);
    }
    setSaving(false);
  };

  const deleteVertretung = async (vertretungId: string) => {
    try {
      await deleteDoc(doc(db, "vertretungen", vertretungId));
      onUpdate();
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
    }
  };

  const assignVertretungTrainer = async (vertretungId: string, newTrainerId: string) => {
    try {
      await updateDoc(doc(db, "vertretungen", vertretungId), {
        vertretungTrainerId: newTrainerId || null,
      });
      onUpdate();
    } catch (error) {
      console.error("Fehler beim Zuweisen:", error);
    }
  };

  const setVertretungForTraining = (trainingId: string, trainerId: string) => {
    setSelectedVertretungen((prev) => ({ ...prev, [trainingId]: trainerId }));
  };

  const formatDate = (datum: string) => {
    const [, m, d] = datum.split("-");
    const date = new Date(datum + "T12:00:00");
    return `${dayNames[date.getDay()]} ${d}.${m}.`;
  };

  return (
    <div className="vertretung">
      <div className="vertretung-header">
        <h2>Vertretungen</h2>
      </div>

      {/* Übersicht - immer sichtbar */}
      <div className="vertretung-overview">
        {/* Offene Vertretungen */}
        <div className="overview-section">
          <div className="overview-header open">
            <span className="overview-icon">⚠</span>
            <span className="overview-title">Offen ({offeneVertretungen.length})</span>
          </div>
          {offeneVertretungen.length === 0 ? (
            <div className="overview-empty">Keine offenen Vertretungen</div>
          ) : (
            <div className="overview-list">
              {offeneVertretungen.map(({ vertretung: v, training: t }) => {
                const originalTrainer = trainerById.get(t.trainerId)?.name || "Unbekannt";
                const spielerNames = t.spielerIds.map((id) => getSpielerDisplayName(id)).join(", ");

                return (
                  <div key={v.id} className="overview-item open">
                    <div className="overview-item-main">
                      <span className="overview-date">{formatDate(t.datum)}</span>
                      <span className="overview-time">{t.uhrzeitVon}-{t.uhrzeitBis}</span>
                      <span className="overview-original">({originalTrainer} fehlt)</span>
                    </div>
                    <div className="overview-item-details">
                      <span className="overview-players">{spielerNames}</span>
                    </div>
                    <div className="overview-item-actions">
                      <select
                        className="trainer-select open"
                        value={v.vertretungTrainerId ?? ""}
                        onChange={(e) => assignVertretungTrainer(v.id, e.target.value)}
                      >
                        <option value="">-- Vertretung wählen --</option>
                        {trainer
                          .filter((tr) => tr.id !== t.trainerId)
                          .map((tr) => (
                            <option key={tr.id} value={tr.id}>
                              {tr.name} {tr.nachname || ""}
                            </option>
                          ))}
                      </select>
                      <button className="btn-icon delete" onClick={() => deleteVertretung(v.id)} title="Entfernen">×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Besetzte Vertretungen */}
        <div className="overview-section">
          <div className="overview-header assigned">
            <span className="overview-icon">✓</span>
            <span className="overview-title">Besetzt ({besetzteVertretungen.length})</span>
          </div>
          {besetzteVertretungen.length === 0 ? (
            <div className="overview-empty">Keine besetzten Vertretungen</div>
          ) : (
            <div className="overview-list">
              {besetzteVertretungen.map(({ vertretung: v, training: t }) => {
                const originalTrainer = trainerById.get(t.trainerId)?.name || "Unbekannt";
                const vertretungTrainer = trainerById.get(v.vertretungTrainerId!)?.name || "Unbekannt";
                const spielerNames = t.spielerIds.map((id) => getSpielerDisplayName(id)).join(", ");

                return (
                  <div key={v.id} className="overview-item assigned">
                    <div className="overview-item-main">
                      <span className="overview-date">{formatDate(t.datum)}</span>
                      <span className="overview-time">{t.uhrzeitVon}-{t.uhrzeitBis}</span>
                      <span className="overview-trainer">{vertretungTrainer}</span>
                      <span className="overview-original">für {originalTrainer}</span>
                    </div>
                    <div className="overview-item-details">
                      <span className="overview-players">{spielerNames}</span>
                    </div>
                    <div className="overview-item-actions">
                      <select
                        className="trainer-select assigned"
                        value={v.vertretungTrainerId ?? ""}
                        onChange={(e) => assignVertretungTrainer(v.id, e.target.value)}
                      >
                        <option value="">-- Offen setzen --</option>
                        {trainer
                          .filter((tr) => tr.id !== t.trainerId)
                          .map((tr) => (
                            <option key={tr.id} value={tr.id}>
                              {tr.name} {tr.nachname || ""}
                            </option>
                          ))}
                      </select>
                      <button className="btn-icon delete" onClick={() => deleteVertretung(v.id)} title="Entfernen">×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Neue Vertretung planen */}
      <div className="new-vertretung">
        <h3>Neue Vertretung planen</h3>

        <div className="form-row">
          <div className="form-group">
            <label>Trainer fehlt</label>
            <select
              value={vertretungTrainerId}
              onChange={(e) => {
                setVertretungTrainerId(e.target.value);
                setVertretungDaten([]);
                setVertretungVon("");
                setVertretungBis("");
                setSelectedVertretungen({});
              }}
            >
              <option value="">-- wählen --</option>
              {trainer.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name} {tr.nachname || ""}
                </option>
              ))}
            </select>
          </div>

          {vertretungTrainerId && (
            <div className="form-group">
              <label>Modus</label>
              <div className="mode-toggle">
                <button
                  type="button"
                  className={vertretungModus === "einzeln" ? "active" : ""}
                  onClick={() => setVertretungModus("einzeln")}
                >
                  Einzelne Tage
                </button>
                <button
                  type="button"
                  className={vertretungModus === "zeitraum" ? "active" : ""}
                  onClick={() => setVertretungModus("zeitraum")}
                >
                  Zeitraum
                </button>
              </div>
            </div>
          )}
        </div>

        {vertretungTrainerId && vertretungModus === "einzeln" && (
          <div className="form-group">
            <label>Datum hinzufügen</label>
            <div className="date-picker-row">
              <input
                type="date"
                min={heute}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val && !vertretungDaten.includes(val)) {
                    setVertretungDaten([...vertretungDaten, val].sort());
                  }
                  e.target.value = "";
                }}
              />
            </div>
            {vertretungDaten.length > 0 && (
              <div className="selected-dates">
                {vertretungDaten.map((d) => {
                  const date = new Date(d + "T12:00:00");
                  return (
                    <span key={d} className="date-chip">
                      {dayNames[date.getDay()]} {pad2(date.getDate())}.{pad2(date.getMonth() + 1)}.
                      <button type="button" onClick={() => setVertretungDaten(vertretungDaten.filter((x) => x !== d))}>×</button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {vertretungTrainerId && vertretungModus === "zeitraum" && (
          <div className="form-row">
            <div className="form-group">
              <label>Von</label>
              <input
                type="date"
                min={heute}
                value={vertretungVon}
                onChange={(e) => setVertretungVon(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Bis</label>
              <input
                type="date"
                min={vertretungVon || heute}
                value={vertretungBis}
                onChange={(e) => setVertretungBis(e.target.value)}
              />
            </div>
          </div>
        )}

        {trainingsForSelection.length > 0 && (
          <div className="preview">
            <h4>Betroffene Trainings ({trainingsForSelection.length})</h4>
            <div className="preview-trainings">
              {trainingsForSelection.map((t) => {
                const spielerNames = t.spielerIds.map((id) => getSpielerDisplayName(id)).join(", ");

                return (
                  <div key={t.id} className="preview-training-item">
                    <div className="preview-training-info">
                      <span className="preview-date">{formatDate(t.datum)}</span>
                      <span className="preview-time">{t.uhrzeitVon}-{t.uhrzeitBis}</span>
                      <span className="preview-players" title={spielerNames}>{spielerNames}</span>
                    </div>
                    <select
                      className={`trainer-select ${selectedVertretungen[t.id] ? "assigned" : "open"}`}
                      value={selectedVertretungen[t.id] || ""}
                      onChange={(e) => setVertretungForTraining(t.id, e.target.value)}
                    >
                      <option value="">-- Vertretung wählen --</option>
                      {trainer
                        .filter((tr) => tr.id !== vertretungTrainerId)
                        .map((tr) => (
                          <option key={tr.id} value={tr.id}>
                            {tr.name} {tr.nachname || ""}
                          </option>
                        ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={trainingsForSelection.length === 0 || saving}
            onClick={addVertretungen}
          >
            {saving ? "Speichern..." : `${trainingsForSelection.length} Vertretung${trainingsForSelection.length !== 1 ? "en" : ""} hinzufügen`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Vertretung;
