import React, { useState } from "react";
import { Training, Trainer, Spieler, Tarif, TrainingStatus } from "../types";

type Props = {
  trainings: Training[];
  trainer: Trainer[];
  spieler: Spieler[];
  tarife: Tarif[];
  onTrainingClick: () => void;
  isAdmin: boolean;
};

const TrainingKalender: React.FC<Props> = ({
  trainings,
  trainer,
  spieler,
  onTrainingClick,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Monat und Jahr
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Erster Tag des Monats
  const firstDayOfMonth = new Date(year, month, 1);
  const startingDayOfWeek = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;

  // Anzahl Tage im Monat
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Trainings für einen Tag
  const getTrainingsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return trainings.filter((t) => t.datum === dateStr);
  };

  // Trainer-Name
  const getTrainerName = (id: string) => {
    const t = trainer.find((tr) => tr.id === id);
    return t ? `${t.name} ${t.nachname}` : "";
  };

  // Status-Farben
  const statusColors: Record<TrainingStatus, string> = {
    geplant: "#3498db",
    durchgefuehrt: "#27ae60",
    abgesagt: "#e74c3c",
  };

  // Wochentage
  const weekDays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  // Monatsnamen
  const monthNames = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];

  // Kalender-Grid erstellen
  const calendarDays = [];

  // Leere Zellen vor dem ersten Tag
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // Tage des Monats
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  // Heute prüfen
  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  return (
    <div className="kalender">
      {/* Header */}
      <div className="kalender-header">
        <button onClick={goToPreviousMonth} className="kalender-nav">
          ←
        </button>
        <div className="kalender-title">
          <h3>{monthNames[month]} {year}</h3>
          <button onClick={goToToday} className="heute-button">
            Heute
          </button>
        </div>
        <button onClick={goToNextMonth} className="kalender-nav">
          →
        </button>
      </div>

      {/* Wochentage */}
      <div className="kalender-weekdays">
        {weekDays.map((day) => (
          <div key={day} className="weekday">
            {day}
          </div>
        ))}
      </div>

      {/* Kalender-Grid */}
      <div className="kalender-grid">
        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`kalender-day ${day === null ? "empty" : ""} ${day && isToday(day) ? "today" : ""}`}
          >
            {day && (
              <>
                <span className="day-number">{day}</span>
                <div className="day-trainings">
                  {getTrainingsForDay(day).map((training) => (
                    <div
                      key={training.id}
                      className="training-chip"
                      style={{ backgroundColor: statusColors[training.status] }}
                      onClick={() => onTrainingClick()}
                      title={`${training.uhrzeitVon} - ${training.uhrzeitBis}\n${getTrainerName(training.trainerId)}`}
                    >
                      <span className="chip-time">{training.uhrzeitVon}</span>
                      <span className="chip-trainer">{getTrainerName(training.trainerId).split(" ")[0]}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Legende */}
      <div className="kalender-legende">
        <div className="legende-item">
          <span className="legende-color" style={{ backgroundColor: "#3498db" }}></span>
          Geplant
        </div>
        <div className="legende-item">
          <span className="legende-color" style={{ backgroundColor: "#27ae60" }}></span>
          Durchgeführt
        </div>
        <div className="legende-item">
          <span className="legende-color" style={{ backgroundColor: "#e74c3c" }}></span>
          Abgesagt
        </div>
      </div>
    </div>
  );
};

export default TrainingKalender;
