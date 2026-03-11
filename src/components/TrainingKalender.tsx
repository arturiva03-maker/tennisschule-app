import React, { useState, useMemo, useCallback } from "react";
import { Training, Trainer, Spieler, Tarif, TrainingStatus, ViewMode, Vertretung } from "../types";

type Props = {
  trainings: Training[];
  trainer: Trainer[];
  spieler: Spieler[];
  tarife: Tarif[];
  vertretungen: Vertretung[];
  onTrainingClick: (training: Training) => void;
  isAdmin: boolean;
  ownTrainerId?: string; // Für Trainer-Accounts
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

function formatShort(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00");
  const w = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][(d.getDay() + 6) % 7];
  return `${w} ${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`;
}

function formatWeekRange(weekStartISO: string): string {
  const start = new Date(weekStartISO + "T12:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const months = [
    "Jan.", "Feb.", "März", "Apr.", "Mai", "Juni",
    "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez.",
  ];

  const sDay = start.getDate();
  const eDay = end.getDate();
  const sMonth = start.getMonth();
  const eMonth = end.getMonth();
  const year = end.getFullYear();

  if (sMonth === eMonth) {
    return `${sDay} – ${eDay}. ${months[eMonth]} ${year}`;
  }
  return `${sDay}. ${months[sMonth]} – ${eDay}. ${months[eMonth]} ${year}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function getTodayDayIndex(): number {
  const today = new Date();
  return (today.getDay() + 6) % 7;
}

const TrainingKalender: React.FC<Props> = ({
  trainings,
  trainer,
  spieler,
  tarife,
  vertretungen,
  onTrainingClick,
  isAdmin,
  ownTrainerId,
}) => {
  // Mobile-Erkennung für initiale Ansicht
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;

  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? "day" : "week");
  const [dayIndex, setDayIndex] = useState<number>(getTodayDayIndex());
  const [weekAnchor, setWeekAnchor] = useState<string>(todayISO());
  const [kalenderTrainerFilter, setKalenderTrainerFilter] = useState<string[]>([]);
  const [showTrainerDropdown, setShowTrainerDropdown] = useState(false);

  // Trainer Map für schnellen Zugriff
  const trainerById = useMemo(() => {
    const map = new Map<string, Trainer>();
    trainer.forEach((t) => map.set(t.id, t));
    return map;
  }, [trainer]);

  // Spieler Map
  const spielerById = useMemo(() => {
    const map = new Map<string, Spieler>();
    spieler.forEach((s) => map.set(s.id, s));
    return map;
  }, [spieler]);

  // Tarif Map
  const tarifById = useMemo(() => {
    const map = new Map<string, Tarif>();
    tarife.forEach((t) => map.set(t.id, t));
    return map;
  }, [tarife]);

  // Wochentage berechnen
  const weekStart = useMemo(() => startOfWeekISO(weekAnchor), [weekAnchor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i)),
    [weekStart]
  );

  // Default Trainer ID (erster Trainer als Fallback)
  const defaultTrainerId = trainer[0]?.id || "";

  // Trainings der Woche filtern
  const trainingsInWeek = useMemo(() => {
    const end = addDaysISO(weekStart, 7);
    return trainings
      .filter((t) => t.datum >= weekStart && t.datum < end)
      .filter((t) => {
        if (kalenderTrainerFilter.length === 0) return true;
        const vertretung = vertretungen.find((v) => v.trainingId === t.id);
        const tid = vertretung?.vertretungTrainerId || t.trainerId || defaultTrainerId;
        return kalenderTrainerFilter.includes(tid);
      })
      .sort((a, b) => toMinutes(a.uhrzeitVon) - toMinutes(b.uhrzeitVon));
  }, [trainings, weekStart, kalenderTrainerFilter, defaultTrainerId, vertretungen]);

  // Navigation
  const goNext = useCallback(() => {
    if (viewMode === "day") {
      const newIndex = (dayIndex + 1) % 7;
      setDayIndex(newIndex);
      if (newIndex === 0) {
        setWeekAnchor(addDaysISO(weekStart, 7));
      }
    } else {
      setWeekAnchor(addDaysISO(weekStart, 7));
    }
  }, [viewMode, dayIndex, weekStart]);

  const goPrev = useCallback(() => {
    if (viewMode === "day") {
      const newIndex = dayIndex === 0 ? 6 : dayIndex - 1;
      setDayIndex(newIndex);
      if (dayIndex === 0) {
        setWeekAnchor(addDaysISO(weekStart, -7));
      }
    } else {
      setWeekAnchor(addDaysISO(weekStart, -7));
    }
  }, [viewMode, dayIndex, weekStart]);

  const goToToday = useCallback(() => {
    const t = todayISO();
    setWeekAnchor(t);
    const d = new Date(t + "T12:00:00");
    const idx = (d.getDay() + 6) % 7;
    setDayIndex(idx);
  }, []);

  // Stunden für die Zeitleiste
  const hours = Array.from({ length: 15 }, (_, i) => 7 + i); // 7:00 bis 21:00

  // Status-Farben
  const statusColors: Record<TrainingStatus, { bg: string; border: string }> = {
    geplant: { bg: "rgba(59, 130, 246, 0.18)", border: "rgba(59, 130, 246, 0.30)" },
    durchgefuehrt: { bg: "rgba(34, 197, 94, 0.22)", border: "rgba(34, 197, 94, 0.45)" },
    abgesagt: { bg: "rgba(239, 68, 68, 0.14)", border: "rgba(239, 68, 68, 0.34)" },
  };

  // Spieler Name
  const getSpielerDisplayName = (id: string) => {
    const s = spielerById.get(id);
    return s ? `${s.vorname} ${s.nachname || ""}`.trim() : "Unbekannt";
  };

  // Trainer Name
  const getTrainerName = (id: string) => {
    const t = trainerById.get(id);
    return t ? `${t.name} ${t.nachname || ""}`.trim() : "Trainer";
  };

  // Heute-Datum für Hervorhebung
  const todayStr = todayISO();

  return (
    <div className="week-kalender">
      {/* Navigation Header */}
      <div className="calendar-nav-compact">
        <div className="calendar-nav-row">
          <button className="nav-arrow-btn" onClick={goPrev} aria-label="Zurück">
            ‹
          </button>

          <div className="calendar-nav-center">
            <span className="calendar-week-label">
              {viewMode === "day"
                ? formatShort(weekDays[dayIndex]) + " " + weekDays[dayIndex].split("-")[0]
                : formatWeekRange(weekStart)}
            </span>
            <div className="view-mode-toggle">
              <button
                className={`view-mode-btn ${viewMode === "week" ? "active" : ""}`}
                onClick={() => setViewMode("week")}
              >
                Woche
              </button>
              <button
                className={`view-mode-btn ${viewMode === "day" ? "active" : ""}`}
                onClick={() => setViewMode("day")}
              >
                Tag
              </button>
            </div>
          </div>

          <button className="nav-arrow-btn" onClick={goNext} aria-label="Weiter">
            ›
          </button>
        </div>

        <button className="today-btn-compact" onClick={goToToday}>
          Heute
        </button>
      </div>

      {/* Trainer Filter (nur für Admin mit mehreren Trainern) */}
      {isAdmin && trainer.length > 1 && (
        <div className="trainer-filter" style={{ position: "relative" }}>
          <button
            type="button"
            className="dropdown-toggle"
            onClick={() => setShowTrainerDropdown(!showTrainerDropdown)}
          >
            {kalenderTrainerFilter.length === 0
              ? "Alle Trainer"
              : kalenderTrainerFilter.length === 1
                ? trainerById.get(kalenderTrainerFilter[0])?.name
                : `${kalenderTrainerFilter.length} Trainer`}
            <span className="dropdown-arrow">▼</span>
          </button>
          {showTrainerDropdown && (
            <div className="dropdown-menu">
              {trainer.map((tr) => (
                <label key={tr.id} className="dropdown-item">
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
                  {tr.name} {tr.nachname || ""}
                </label>
              ))}
              {kalenderTrainerFilter.length > 0 && (
                <button
                  type="button"
                  className="dropdown-reset"
                  onClick={() => {
                    setKalenderTrainerFilter([]);
                    setShowTrainerDropdown(false);
                  }}
                >
                  Auswahl zurücksetzen
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Kalender Grid */}
      <div className={`k-grid ${viewMode === "day" ? "k-grid-day" : ""}`}>
        {/* Header mit Wochentagen */}
        <div className="k-head">
          <div className="k-head-cell">Zeit</div>
          {(viewMode === "week" ? weekDays : [weekDays[dayIndex]]).map((d) => (
            <div
              key={d}
              className={`k-head-cell ${d === todayStr ? "today" : ""}`}
            >
              {formatShort(d)}
            </div>
          ))}
        </div>

        {/* Body mit Zeiten und Events */}
        <div className="k-body">
          {/* Zeitspalte */}
          <div className="k-time-col">
            {hours.map((h) => (
              <div key={h} className="k-time">
                {pad2(h)}:00
              </div>
            ))}
          </div>

          {/* Tages-Spalten */}
          {(viewMode === "week" ? weekDays : [weekDays[dayIndex]]).map((day) => {
            const dayEvents = trainingsInWeek.filter((t) => t.datum === day);
            const startMin = 7 * 60;

            // Überlappende Trainings gruppieren
            const groupedEvents: Training[][] = [];
            dayEvents.forEach((training) => {
              const startA = toMinutes(training.uhrzeitVon);
              const endA = toMinutes(training.uhrzeitBis);

              let placed = false;
              for (const group of groupedEvents) {
                const hasOverlap = group.some((t) => {
                  const startB = toMinutes(t.uhrzeitVon);
                  const endB = toMinutes(t.uhrzeitBis);
                  return startA < endB && endA > startB;
                });

                if (hasOverlap) {
                  group.push(training);
                  placed = true;
                  break;
                }
              }

              if (!placed) {
                groupedEvents.push([training]);
              }
            });

            return (
              <div key={day} className={`k-day-col ${day === todayStr ? "today" : ""}`}>
                {/* Stundenlinien */}
                {hours.map((h) => (
                  <div key={h} className="k-hour-line" />
                ))}

                {/* Trainings */}
                {dayEvents.map((t) => {
                  const top = Math.max(0, (toMinutes(t.uhrzeitVon) - startMin) / 60) * 40;
                  const height = Math.max(26, ((toMinutes(t.uhrzeitBis) - toMinutes(t.uhrzeitVon)) / 60) * 40);

                  const tarif = t.tarifId ? tarifById.get(t.tarifId) : undefined;
                  const tarifInfo = tarif ? tarif.name : t.customPreisProStunde ? `${t.customPreisProStunde}€/h` : "";

                  const spielerNames = t.spielerIds
                    .map((id) => getSpielerDisplayName(id))
                    .join(", ");

                  // Vertretung prüfen
                  const trainingVertretung = vertretungen.find((v) => v.trainingId === t.id);
                  const effectiveTrainerId = trainingVertretung?.vertretungTrainerId || t.trainerId || defaultTrainerId;
                  const trainerName = getTrainerName(effectiveTrainerId);
                  const isVertretungOffen = trainingVertretung && !trainingVertretung.vertretungTrainerId;
                  const hasVertretung = !!trainingVertretung;

                  const isDone = t.status === "durchgefuehrt";
                  const isCancel = t.status === "abgesagt";

                  const colors = statusColors[t.status];
                  const bg = colors.bg;
                  const border = hasVertretung
                    ? isVertretungOffen
                      ? "rgba(220, 38, 38, 0.8)"
                      : "rgba(34, 197, 94, 0.8)"
                    : colors.border;

                  // Position für überlappende Trainings
                  let groupSize = 1;
                  let indexInGroup = 0;
                  for (const group of groupedEvents) {
                    if (group.includes(t)) {
                      groupSize = group.length;
                      indexInGroup = group.indexOf(t);
                      break;
                    }
                  }

                  const widthPercent = groupSize > 1 ? 100 / groupSize : 100;
                  const leftPercent = groupSize > 1 ? indexInGroup * widthPercent : 0;

                  return (
                    <div
                      key={t.id}
                      className="k-event"
                      style={{
                        top,
                        height,
                        width: `${widthPercent}%`,
                        left: `${leftPercent}%`,
                        backgroundColor: bg,
                        border: hasVertretung ? `2px solid ${border}` : `1px solid ${border}`,
                        opacity: isCancel ? 0.7 : 1,
                      }}
                      onClick={() => onTrainingClick(t)}
                      title={`Spieler: ${spielerNames}\nZeit: ${t.uhrzeitVon} - ${t.uhrzeitBis}\nTrainer: ${trainerName}${hasVertretung ? (isVertretungOffen ? "\nVertretung: offen" : "\n(Vertretung)") : ""}\nStatus: ${t.status}`}
                    >
                      <div className="k-event-content">
                        <div className="k-event-players">{spielerNames}</div>
                        <div className="k-event-info">
                          {trainer.length > 1 && (
                            <span>
                              {hasVertretung
                                ? isVertretungOffen
                                  ? "(V offen)"
                                  : `${trainerName.split(" ")[0]} (V)`
                                : trainerName.split(" ")[0]}
                            </span>
                          )}
                          {tarifInfo && <span>{tarifInfo}</span>}
                        </div>
                      </div>
                      <div className="k-event-badges">
                        {hasVertretung && (
                          <span
                            className="k-badge"
                            style={{
                              background: isVertretungOffen ? "#dc2626" : "#22c55e",
                            }}
                          >
                            V
                          </span>
                        )}
                        <span
                          className="k-status-dot"
                          style={{
                            backgroundColor: isDone ? "#22c55e" : isCancel ? "#ef4444" : "#3b82f6",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legende */}
      <div className="kalender-legende">
        <div className="legende-item">
          <span className="legende-color" style={{ backgroundColor: "#3b82f6" }}></span>
          Geplant
        </div>
        <div className="legende-item">
          <span className="legende-color" style={{ backgroundColor: "#22c55e" }}></span>
          Durchgeführt
        </div>
        <div className="legende-item">
          <span className="legende-color" style={{ backgroundColor: "#ef4444" }}></span>
          Abgesagt
        </div>
        {vertretungen.length > 0 && (
          <div className="legende-item">
            <span className="legende-color" style={{ backgroundColor: "#dc2626", border: "2px solid #dc2626" }}></span>
            Vertretung
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainingKalender;
