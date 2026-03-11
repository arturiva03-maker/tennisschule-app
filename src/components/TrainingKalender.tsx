import React, { useState, useMemo, useCallback } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { Training, Trainer, Spieler, Tarif, TrainingStatus, ViewMode, Vertretung } from "../types";

type Props = {
  trainings: Training[];
  trainer: Trainer[];
  spieler: Spieler[];
  tarife: Tarif[];
  vertretungen: Vertretung[];
  onUpdate: () => void;
  isAdmin: boolean;
  ownTrainerId?: string;
};

// Hilfsfunktionen
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfWeekISO(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00");
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDateLong(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00");
  const days = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  return `${days[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]}`;
}

function formatShort(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00");
  const w = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][d.getDay()];
  return `${w} ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`;
}

function formatWeekRange(weekStartISO: string): string {
  const start = new Date(weekStartISO + "T12:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const months = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const sDay = start.getDate();
  const eDay = end.getDate();
  const sMonth = start.getMonth();
  const eMonth = end.getMonth();
  const year = end.getFullYear();
  if (sMonth === eMonth) {
    return `${sDay}. – ${eDay}. ${months[eMonth]} ${year}`;
  }
  return `${sDay}. ${months[sMonth]} – ${eDay}. ${months[eMonth]} ${year}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

const TrainingKalender: React.FC<Props> = ({
  trainings,
  trainer,
  spieler,
  tarife,
  vertretungen,
  onUpdate,
  isAdmin,
  ownTrainerId,
}) => {
  // States
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [kalenderTrainerFilter, setKalenderTrainerFilter] = useState<string[]>([]);
  const [showTrainerDropdown, setShowTrainerDropdown] = useState(false);

  // Training Form States
  const [showForm, setShowForm] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [formData, setFormData] = useState({
    trainerId: "",
    datum: todayISO(),
    uhrzeitVon: "09:00",
    uhrzeitBis: "10:00",
    spielerIds: [] as string[],
    tarifId: "",
    status: "geplant" as TrainingStatus,
    notiz: "",
    wiederkehrend: false,
    serieEnde: "",
    alleZukuenftigen: false, // For editing series
  });
  const [saving, setSaving] = useState(false);

  // Delete Serie Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [trainingToDelete, setTrainingToDelete] = useState<Training | null>(null);

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

  const tarifById = useMemo(() => {
    const map = new Map<string, Tarif>();
    tarife.forEach((t) => map.set(t.id, t));
    return map;
  }, [tarife]);

  const weekStart = useMemo(() => startOfWeekISO(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)), [weekStart]);
  const defaultTrainerId = trainer[0]?.id || "";
  const todayStr = todayISO();

  // Trainings filtern
  const trainingsInView = useMemo(() => {
    const start = viewMode === "day" ? selectedDate : weekStart;
    const end = viewMode === "day" ? addDaysISO(selectedDate, 1) : addDaysISO(weekStart, 7);
    return trainings
      .filter((t) => t.datum >= start && t.datum < end)
      .filter((t) => {
        if (kalenderTrainerFilter.length === 0) return true;
        const vertretung = vertretungen.find((v) => v.trainingId === t.id);
        const tid = vertretung?.vertretungTrainerId || t.trainerId || defaultTrainerId;
        return kalenderTrainerFilter.includes(tid);
      })
      .sort((a, b) => toMinutes(a.uhrzeitVon) - toMinutes(b.uhrzeitVon));
  }, [trainings, selectedDate, weekStart, viewMode, kalenderTrainerFilter, defaultTrainerId, vertretungen]);

  // Trainings für den ausgewählten Tag
  const trainingsForSelectedDay = useMemo(() => {
    return trainings
      .filter((t) => t.datum === selectedDate)
      .sort((a, b) => toMinutes(a.uhrzeitVon) - toMinutes(b.uhrzeitVon));
  }, [trainings, selectedDate]);

  // Navigation
  const goNext = useCallback(() => {
    if (viewMode === "day") {
      setSelectedDate(addDaysISO(selectedDate, 1));
    } else {
      setSelectedDate(addDaysISO(weekStart, 7));
    }
  }, [viewMode, selectedDate, weekStart]);

  const goPrev = useCallback(() => {
    if (viewMode === "day") {
      setSelectedDate(addDaysISO(selectedDate, -1));
    } else {
      setSelectedDate(addDaysISO(weekStart, -7));
    }
  }, [viewMode, selectedDate, weekStart]);

  const goToToday = useCallback(() => {
    setSelectedDate(todayISO());
  }, []);

  // Form Funktionen
  const resetForm = () => {
    setFormData({
      trainerId: trainer[0]?.id || "",
      datum: selectedDate,
      uhrzeitVon: "09:00",
      uhrzeitBis: "10:00",
      spielerIds: [],
      tarifId: "",
      status: "geplant",
      notiz: "",
      wiederkehrend: false,
      serieEnde: "",
      alleZukuenftigen: false,
    });
    setEditingTraining(null);
    setShowForm(false);
  };

  const openNewTraining = () => {
    setFormData({
      trainerId: trainer[0]?.id || "",
      datum: selectedDate,
      uhrzeitVon: "09:00",
      uhrzeitBis: "10:00",
      spielerIds: [],
      tarifId: "",
      status: "geplant",
      notiz: "",
      wiederkehrend: false,
      serieEnde: "",
      alleZukuenftigen: false,
    });
    setEditingTraining(null);
    setShowForm(true);
  };

  const openEditTraining = (t: Training) => {
    setFormData({
      trainerId: t.trainerId,
      datum: t.datum,
      uhrzeitVon: t.uhrzeitVon,
      uhrzeitBis: t.uhrzeitBis,
      spielerIds: t.spielerIds,
      tarifId: t.tarifId || "",
      status: t.status,
      notiz: t.notiz || "",
      wiederkehrend: false,
      serieEnde: t.serieEnde || "",
      alleZukuenftigen: false,
    });
    setEditingTraining(t);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const baseData = {
        trainerId: formData.trainerId,
        uhrzeitVon: formData.uhrzeitVon,
        uhrzeitBis: formData.uhrzeitBis,
        spielerIds: formData.spielerIds,
        tarifId: formData.tarifId || null,
        status: formData.status,
        notiz: formData.notiz || null,
      };

      if (editingTraining) {
        // Bearbeiten
        if (formData.alleZukuenftigen && editingTraining.serieId) {
          // Alle zukünftigen Trainings der Serie aktualisieren
          const serieTrainings = trainings.filter(
            (t) => t.serieId === editingTraining.serieId && t.datum >= editingTraining.datum
          );
          const batch = writeBatch(db);
          for (const t of serieTrainings) {
            batch.update(doc(db, "trainings", t.id), baseData);
          }
          await batch.commit();
        } else {
          // Nur dieses Training aktualisieren
          await updateDoc(doc(db, "trainings", editingTraining.id), {
            ...baseData,
            datum: formData.datum,
          });
        }
      } else {
        // Neues Training erstellen
        if (formData.wiederkehrend && formData.serieEnde) {
          // Wiederkehrende Trainings erstellen (wöchentlich)
          const serieId = generateId();
          const startDate = new Date(formData.datum + "T12:00:00");
          const endDate = new Date(formData.serieEnde + "T12:00:00");

          const dates: string[] = [];
          let current = new Date(startDate);
          while (current <= endDate) {
            dates.push(`${current.getFullYear()}-${pad2(current.getMonth() + 1)}-${pad2(current.getDate())}`);
            current.setDate(current.getDate() + 7);
          }

          const batch = writeBatch(db);
          for (const datum of dates) {
            const newDocRef = doc(collection(db, "trainings"));
            batch.set(newDocRef, {
              ...baseData,
              datum,
              serieId,
              serieEnde: formData.serieEnde,
              createdAt: new Date().toISOString(),
            });
          }
          await batch.commit();
        } else {
          // Einzelnes Training erstellen
          await addDoc(collection(db, "trainings"), {
            ...baseData,
            datum: formData.datum,
            createdAt: new Date().toISOString(),
          });
        }
      }
      resetForm();
      onUpdate();
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleDelete = async (t: Training) => {
    if (t.serieId) {
      setTrainingToDelete(t);
      setShowDeleteModal(true);
    } else {
      if (!window.confirm("Training wirklich löschen?")) return;
      try {
        await deleteDoc(doc(db, "trainings", t.id));
        onUpdate();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const confirmDelete = async (deleteAll: boolean) => {
    if (!trainingToDelete) return;
    try {
      if (deleteAll && trainingToDelete.serieId) {
        // Alle zukünftigen löschen
        const serieTrainings = trainings.filter(
          (t) => t.serieId === trainingToDelete.serieId && t.datum >= trainingToDelete.datum
        );
        const batch = writeBatch(db);
        for (const t of serieTrainings) {
          batch.delete(doc(db, "trainings", t.id));
        }
        await batch.commit();
      } else {
        // Nur dieses Training löschen
        await deleteDoc(doc(db, "trainings", trainingToDelete.id));
      }
      onUpdate();
    } catch (err) {
      console.error(err);
    }
    setShowDeleteModal(false);
    setTrainingToDelete(null);
  };

  const handleStatusChange = async (t: Training, newStatus: TrainingStatus) => {
    try {
      await updateDoc(doc(db, "trainings", t.id), { status: newStatus });
      onUpdate();
    } catch (err) {
      console.error(err);
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

  // Helper
  const getSpielerDisplayName = (id: string) => {
    const s = spielerById.get(id);
    return s ? `${s.vorname} ${s.nachname || ""}`.trim() : "Unbekannt";
  };

  const getTrainerName = (id: string) => {
    const t = trainerById.get(id);
    return t ? `${t.name} ${t.nachname || ""}`.trim() : "Trainer";
  };

  const hours = Array.from({ length: 14 }, (_, i) => 8 + i);

  const statusConfig: Record<TrainingStatus, { bg: string; border: string; label: string }> = {
    geplant: { bg: "var(--status-planned-bg)", border: "var(--status-planned)", label: "Geplant" },
    durchgefuehrt: { bg: "var(--status-done-bg)", border: "var(--status-done)", label: "Durchgeführt" },
    abgesagt: { bg: "var(--status-cancelled-bg)", border: "var(--status-cancelled)", label: "Abgesagt" },
  };

  return (
    <div className="calendar-container">
      {/* Header */}
      <div className="calendar-header">
        <div className="calendar-nav">
          <button className="nav-btn" onClick={goPrev}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div className="calendar-title">
            <h2>{viewMode === "day" ? formatDateLong(selectedDate) : formatWeekRange(weekStart)}</h2>
            <button className="today-btn" onClick={goToToday}>Heute</button>
          </div>
          <button className="nav-btn" onClick={goNext}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>

        <div className="calendar-controls">
          <div className="view-toggle">
            <button className={viewMode === "day" ? "active" : ""} onClick={() => setViewMode("day")}>Tag</button>
            <button className={viewMode === "week" ? "active" : ""} onClick={() => setViewMode("week")}>Woche</button>
          </div>

          {isAdmin && trainer.length > 1 && (
            <div className="trainer-filter-wrap">
              <button className="filter-btn" onClick={() => setShowTrainerDropdown(!showTrainerDropdown)}>
                {kalenderTrainerFilter.length === 0 ? "Alle Trainer" : `${kalenderTrainerFilter.length} Trainer`}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
              {showTrainerDropdown && (
                <div className="filter-dropdown">
                  {trainer.map((tr) => (
                    <label key={tr.id}>
                      <input
                        type="checkbox"
                        checked={kalenderTrainerFilter.includes(tr.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setKalenderTrainerFilter([...kalenderTrainerFilter, tr.id]);
                          } else {
                            setKalenderTrainerFilter(kalenderTrainerFilter.filter((id) => id !== tr.id));
                          }
                        }}
                      />
                      {tr.name}
                    </label>
                  ))}
                  {kalenderTrainerFilter.length > 0 && (
                    <button onClick={() => { setKalenderTrainerFilter([]); setShowTrainerDropdown(false); }}>
                      Zurücksetzen
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {isAdmin && (
            <button className="add-training-btn" onClick={openNewTraining}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Training
            </button>
          )}
        </div>
      </div>

      {/* Week View Header */}
      {viewMode === "week" && (
        <div className="week-header">
          <div className="time-gutter"></div>
          {weekDays.map((day) => (
            <div
              key={day}
              className={`week-day-header ${day === todayStr ? "today" : ""} ${day === selectedDate ? "selected" : ""}`}
              onClick={() => { setSelectedDate(day); setViewMode("day"); }}
            >
              <span className="day-name">{formatShort(day).split(" ")[0]}</span>
              <span className="day-num">{new Date(day + "T12:00:00").getDate()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Calendar Grid */}
      <div className={`calendar-grid ${viewMode}`}>
        <div className="time-column">
          {hours.map((h) => (
            <div key={h} className="time-slot">{pad2(h)}:00</div>
          ))}
        </div>

        {(viewMode === "week" ? weekDays : [selectedDate]).map((day) => {
          const dayEvents = trainingsInView.filter((t) => t.datum === day);
          const startMin = 8 * 60;

          return (
            <div key={day} className={`day-column ${day === todayStr ? "today" : ""}`}>
              {hours.map((h) => (
                <div key={h} className="hour-cell" />
              ))}

              {dayEvents.map((t) => {
                const top = Math.max(0, (toMinutes(t.uhrzeitVon) - startMin) / 60) * 60;
                const height = Math.max(30, ((toMinutes(t.uhrzeitBis) - toMinutes(t.uhrzeitVon)) / 60) * 60);
                const vertretung = vertretungen.find((v) => v.trainingId === t.id);
                const effectiveTrainerId = vertretung?.vertretungTrainerId || t.trainerId || defaultTrainerId;
                const config = statusConfig[t.status];

                return (
                  <div
                    key={t.id}
                    className={`event ${t.status} ${t.serieId ? "recurring" : ""}`}
                    style={{ top, height, background: config.bg, borderLeftColor: config.border }}
                    onClick={() => openEditTraining(t)}
                  >
                    <div className="event-time">{t.uhrzeitVon} - {t.uhrzeitBis}</div>
                    <div className="event-title">{t.spielerIds.map(id => getSpielerDisplayName(id)).join(", ") || "Keine Spieler"}</div>
                    {trainer.length > 1 && <div className="event-trainer">{getTrainerName(effectiveTrainerId)}</div>}
                    {t.serieId && <span className="recurring-icon" title="Wiederkehrend">↻</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Day Detail Panel */}
      {viewMode === "day" && (
        <div className="day-panel">
          <h3>Trainings am {formatDateLong(selectedDate)}</h3>
          {trainingsForSelectedDay.length === 0 ? (
            <div className="empty-day">
              <p>Keine Trainings geplant</p>
              {isAdmin && <button onClick={openNewTraining}>Training hinzufügen</button>}
            </div>
          ) : (
            <div className="training-list">
              {trainingsForSelectedDay.map((t) => {
                const config = statusConfig[t.status];
                const vertretung = vertretungen.find((v) => v.trainingId === t.id);
                const effectiveTrainerId = vertretung?.vertretungTrainerId || t.trainerId || defaultTrainerId;
                const hasVertretung = !!vertretung;
                const vertretungOffen = hasVertretung && !vertretung.vertretungTrainerId;
                const vertretungBesetzt = hasVertretung && !!vertretung.vertretungTrainerId;

                const cardClasses = [
                  "training-card",
                  vertretungOffen ? "vertretung-open" : "",
                  vertretungBesetzt ? "vertretung-assigned" : "",
                ].filter(Boolean).join(" ");

                return (
                  <div key={t.id} className={cardClasses} style={{ borderLeftColor: config.border }}>
                    <div className="training-card-header">
                      <span className="training-time">{t.uhrzeitVon} - {t.uhrzeitBis}</span>
                      <div className="training-badges">
                        {t.serieId && <span className="badge recurring" title="Wiederkehrend">↻</span>}
                        {vertretungOffen && <span className="badge vertretung-offen" title="Vertretung offen">⚠</span>}
                        {vertretungBesetzt && <span className="badge vertretung-besetzt" title="Vertretung">✓V</span>}
                        <span className="training-status" style={{ background: config.border }}>{config.label}</span>
                      </div>
                    </div>
                    <div className="training-card-body">
                      <div className="training-players">
                        {t.spielerIds.map(id => getSpielerDisplayName(id)).join(", ") || "Keine Spieler"}
                      </div>
                      <div className="training-meta">
                        <span>{getTrainerName(effectiveTrainerId)}</span>
                        {vertretungBesetzt && <span className="vertretung-hint">(Vertretung)</span>}
                        {t.tarifId && <span>{tarifById.get(t.tarifId)?.name}</span>}
                      </div>
                      {t.notiz && <div className="training-note">{t.notiz}</div>}
                    </div>
                    <div className="training-card-actions">
                      {t.status === "geplant" && (
                        <>
                          <button className="action-done" onClick={() => handleStatusChange(t, "durchgefuehrt")}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 6L9 17l-5-5"/>
                            </svg>
                            Durchgeführt
                          </button>
                          <button className="action-cancel" onClick={() => handleStatusChange(t, "abgesagt")}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                            Absagen
                          </button>
                        </>
                      )}
                      {isAdmin && (
                        <>
                          <button className="action-edit" onClick={() => openEditTraining(t)}>Bearbeiten</button>
                          <button className="action-delete" onClick={() => handleDelete(t)}>Löschen</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Delete Serie Modal */}
      {showDeleteModal && trainingToDelete && (
        <div className="modal-overlay" onClick={() => { setShowDeleteModal(false); setTrainingToDelete(null); }}>
          <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Training löschen</h3>
              <button className="close-btn" onClick={() => { setShowDeleteModal(false); setTrainingToDelete(null); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p>Dieses Training ist Teil einer wiederkehrenden Serie.</p>
              <p>Was möchtest du löschen?</p>
            </div>
            <div className="modal-footer serie-actions">
              <button className="btn-secondary" onClick={() => confirmDelete(false)}>
                Nur dieses
              </button>
              <button className="btn-primary btn-danger" onClick={() => confirmDelete(true)}>
                Alle zukünftigen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Training Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingTraining ? "Training bearbeiten" : "Neues Training"}</h3>
              <button className="close-btn" onClick={resetForm}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group full">
                  <label>Trainer</label>
                  <select value={formData.trainerId} onChange={(e) => setFormData({...formData, trainerId: e.target.value})} required>
                    <option value="">Trainer wählen</option>
                    {trainer.map((t) => <option key={t.id} value={t.id}>{t.name} {t.nachname}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label>Datum</label>
                  <input
                    type="date"
                    value={formData.datum}
                    onChange={(e) => setFormData({...formData, datum: e.target.value})}
                    required
                    disabled={!!(editingTraining && editingTraining.serieId && formData.alleZukuenftigen)}
                  />
                </div>

                <div className="form-group">
                  <label>Von</label>
                  <input type="time" value={formData.uhrzeitVon} onChange={(e) => setFormData({...formData, uhrzeitVon: e.target.value})} required />
                </div>

                <div className="form-group">
                  <label>Bis</label>
                  <input type="time" value={formData.uhrzeitBis} onChange={(e) => setFormData({...formData, uhrzeitBis: e.target.value})} required />
                </div>

                <div className="form-group full">
                  <label>Tarif</label>
                  <select value={formData.tarifId} onChange={(e) => setFormData({...formData, tarifId: e.target.value})}>
                    <option value="">Kein Tarif</option>
                    {tarife.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.preisProStunde}€/h pro Spieler)</option>)}
                  </select>
                </div>

                <div className="form-group full">
                  <label>Spieler</label>
                  <div className="checkbox-grid">
                    {spieler.map((s) => (
                      <label key={s.id} className="checkbox-item">
                        <input type="checkbox" checked={formData.spielerIds.includes(s.id)} onChange={() => toggleSpieler(s.id)} />
                        <span>{s.vorname} {s.nachname}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group full">
                  <label>Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as TrainingStatus})}>
                    <option value="geplant">Geplant</option>
                    <option value="durchgefuehrt">Durchgeführt</option>
                    <option value="abgesagt">Abgesagt</option>
                  </select>
                </div>

                {/* Wiederkehrend Option - nur bei neuem Training */}
                {!editingTraining && (
                  <>
                    <div className="form-group full">
                      <label className="checkbox-item inline">
                        <input
                          type="checkbox"
                          checked={formData.wiederkehrend}
                          onChange={(e) => setFormData({...formData, wiederkehrend: e.target.checked})}
                        />
                        <span>Wiederkehrendes Training (wöchentlich)</span>
                      </label>
                    </div>

                    {formData.wiederkehrend && (
                      <div className="form-group full">
                        <label>Serie endet am</label>
                        <input
                          type="date"
                          value={formData.serieEnde}
                          onChange={(e) => setFormData({...formData, serieEnde: e.target.value})}
                          min={formData.datum}
                          required={formData.wiederkehrend}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Option für Serie-Bearbeitung - nur bei bestehendem Serie-Training */}
                {editingTraining && editingTraining.serieId && (
                  <div className="form-group full">
                    <label className="checkbox-item inline serie-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.alleZukuenftigen}
                        onChange={(e) => setFormData({...formData, alleZukuenftigen: e.target.checked})}
                      />
                      <span>Alle zukünftigen Trainings dieser Serie bearbeiten</span>
                    </label>
                  </div>
                )}

                <div className="form-group full">
                  <label>Notiz</label>
                  <textarea value={formData.notiz} onChange={(e) => setFormData({...formData, notiz: e.target.value})} rows={2} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={resetForm}>Abbrechen</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Speichern..." : (formData.wiederkehrend && !editingTraining ? "Serie erstellen" : "Speichern")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingKalender;
