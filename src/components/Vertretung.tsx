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

// Hilfsfunktionen
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

const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

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
  const [expandedTrainer, setExpandedTrainer] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const heute = todayISO();

  // Maps für schnellen Zugriff
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

  const defaultTrainerId = trainer[0]?.id || "";

  // Spieler Name
  const getSpielerDisplayName = (id: string) => {
    const s = spielerById.get(id);
    return s ? `${s.vorname} ${s.nachname || ""}`.trim() : "Unbekannt";
  };

  // Gruppiere Vertretungen nach fehlendem Trainer (nur zukünftige)
  const groupedByTrainer = useMemo(() => {
    const jetzt = new Date();
    const groups: Record<string, { vertretung: VertretungType; training: Training }[]> = {};

    vertretungen.forEach((v) => {
      const training = trainings.find((t) => t.id === v.trainingId);
      if (!training) return;
      if (training.status === "abgesagt") return;

      // Vergangene Trainings ausblenden
      const trainingsEnde = new Date(`${training.datum}T${training.uhrzeitBis}:00`);
      if (trainingsEnde <= jetzt) return;

      const trainerId = training.trainerId || defaultTrainerId;
      if (!groups[trainerId]) groups[trainerId] = [];
      groups[trainerId].push({ vertretung: v, training });
    });

    return groups;
  }, [vertretungen, trainings, defaultTrainerId]);

  // Trainings des ausgewählten Trainers für die gewählten Daten
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
      // Nur zukünftige
      const trainingsEnde = new Date(`${t.datum}T${t.uhrzeitBis}:00`);
      if (trainingsEnde <= new Date()) return false;
      // Noch keine Vertretung eingetragen
      if (vertretungen.some((v) => v.trainingId === t.id)) return false;
      return true;
    });
  }, [vertretungTrainerId, vertretungModus, vertretungDaten, vertretungVon, vertretungBis, trainings, vertretungen]);

  // Vertretung hinzufügen
  const addVertretungen = async () => {
    if (trainingsForSelection.length === 0) return;
    setSaving(true);

    try {
      for (const training of trainingsForSelection) {
        await addDoc(collection(db, "vertretungen"), {
          trainingId: training.id,
          vertretungTrainerId: null,
          createdAt: serverTimestamp(),
        });
      }
      // Reset
      setVertretungDaten([]);
      setVertretungVon("");
      setVertretungBis("");
      onUpdate();
    } catch (error) {
      console.error("Fehler beim Hinzufügen der Vertretungen:", error);
    }

    setSaving(false);
  };

  // Vertretung löschen
  const deleteVertretung = async (vertretungId: string) => {
    try {
      await deleteDoc(doc(db, "vertretungen", vertretungId));
      onUpdate();
    } catch (error) {
      console.error("Fehler beim Löschen der Vertretung:", error);
    }
  };

  // Vertretungstrainer zuweisen
  const assignVertretungTrainer = async (vertretungId: string, newTrainerId: string) => {
    try {
      await updateDoc(doc(db, "vertretungen", vertretungId), {
        vertretungTrainerId: newTrainerId || null,
      });
      onUpdate();
    } catch (error) {
      console.error("Fehler beim Zuweisen des Vertretungstrainers:", error);
    }
  };

  // Toggle expanded
  const toggleExpanded = (trainerId: string) => {
    setExpandedTrainer((prev) =>
      prev.includes(trainerId)
        ? prev.filter((id) => id !== trainerId)
        : [...prev, trainerId]
    );
  };

  const trainerEntries = Object.entries(groupedByTrainer);

  return (
    <div className="vertretung">
      <div className="vertretung-header">
        <h2>Vertretungen</h2>
      </div>

      {/* Bestehende Vertretungen */}
      <div className="vertretung-list">
        {trainerEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <p>Keine offenen Vertretungen</p>
          </div>
        ) : (
          trainerEntries
            .sort(([, a], [, b]) => {
              const dateA = a[0]?.training.datum || "";
              const dateB = b[0]?.training.datum || "";
              return dateA.localeCompare(dateB);
            })
            .map(([trainerId, items]) => {
              const trainerName = trainerById.get(trainerId)?.name || "Unbekannt";
              const isExpanded = expandedTrainer.includes(trainerId);

              // Sortiere nach Datum und Zeit
              const sortedItems = [...items].sort((a, b) => {
                const dateComp = a.training.datum.localeCompare(b.training.datum);
                if (dateComp !== 0) return dateComp;
                return a.training.uhrzeitVon.localeCompare(b.training.uhrzeitVon);
              });

              // Gruppiere nach Datum
              const groupedByDate: Record<string, typeof sortedItems> = {};
              sortedItems.forEach((item) => {
                const datum = item.training.datum;
                if (!groupedByDate[datum]) groupedByDate[datum] = [];
                groupedByDate[datum].push(item);
              });

              const uniqueDates = Object.keys(groupedByDate).length;
              const openDates = Object.entries(groupedByDate).filter(([, dateItems]) =>
                dateItems.some((item) => !item.vertretung.vertretungTrainerId)
              ).length;

              return (
                <div key={trainerId} className="trainer-group">
                  <div
                    className={`trainer-header ${openDates > 0 ? "has-open" : "all-covered"}`}
                    onClick={() => toggleExpanded(trainerId)}
                  >
                    <span className={`expand-icon ${isExpanded ? "expanded" : ""}`}>▼</span>
                    <div className="trainer-info">
                      <div className="trainer-name">{trainerName} fehlt</div>
                      <div className="trainer-stats">
                        {uniqueDates} Tag{uniqueDates !== 1 ? "e" : ""} betroffen
                        {openDates > 0 ? ` • ${openDates} offen` : " • alle gedeckt ✓"}
                      </div>
                    </div>
                    <span className="toggle-hint">
                      {isExpanded ? "Zuklappen" : "Aufklappen"}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="trainer-content">
                      {Object.entries(groupedByDate)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([datum, dateItems]) => {
                          const d = new Date(datum + "T12:00:00");
                          const formattedDate = `${dayNames[d.getDay()]}, ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;

                          return (
                            <div key={datum} className="date-group">
                              <div className="date-header">
                                <span className="date-icon">📅</span>
                                {formattedDate}
                                <span className="date-count">
                                  {dateItems.length} Training{dateItems.length !== 1 ? "s" : ""}
                                </span>
                              </div>

                              <div className="date-trainings">
                                {dateItems.map(({ vertretung: v, training: t }) => {
                                  const spielerNames = t.spielerIds
                                    .map((id) => getSpielerDisplayName(id))
                                    .join(", ");
                                  const isOffen = !v.vertretungTrainerId;

                                  return (
                                    <div key={v.id} className="vertretung-item">
                                      <div className="time">{t.uhrzeitVon}–{t.uhrzeitBis}</div>
                                      <div className="players" title={spielerNames}>
                                        {spielerNames}
                                      </div>
                                      <select
                                        className={`trainer-select ${isOffen ? "open" : "assigned"}`}
                                        value={v.vertretungTrainerId ?? ""}
                                        onChange={(e) => assignVertretungTrainer(v.id, e.target.value)}
                                      >
                                        <option value="">⚠ Offen</option>
                                        {trainer
                                          .filter((tr) => tr.id !== trainerId)
                                          .map((tr) => (
                                            <option key={tr.id} value={tr.id}>
                                              ✓ {tr.name} {tr.nachname || ""}
                                            </option>
                                          ))}
                                      </select>
                                      <button
                                        className="delete-btn"
                                        onClick={() => deleteVertretung(v.id)}
                                        title="Vertretung entfernen"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })
        )}
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
                  className={vertretungModus === "einzeln" ? "active" : ""}
                  onClick={() => setVertretungModus("einzeln")}
                >
                  Einzelne Tage
                </button>
                <button
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
                      {dayNames[date.getDay()].slice(0, 2)} {pad2(date.getDate())}.{pad2(date.getMonth() + 1)}.
                      <button onClick={() => setVertretungDaten(vertretungDaten.filter((x) => x !== d))}>×</button>
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
            <ul>
              {trainingsForSelection.slice(0, 5).map((t) => {
                const [y, m, d] = t.datum.split("-");
                const germanDate = d && m && y ? `${d}.${m}.${y}` : t.datum;
                return (
                  <li key={t.id}>
                    {germanDate} {t.uhrzeitVon}-{t.uhrzeitBis}
                  </li>
                );
              })}
              {trainingsForSelection.length > 5 && (
                <li>... und {trainingsForSelection.length - 5} weitere</li>
              )}
            </ul>
          </div>
        )}

        <div className="form-actions">
          <button
            className="add-btn"
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
