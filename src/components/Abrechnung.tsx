import React, { useState, useMemo, useCallback } from "react";
import {
  Training,
  Trainer,
  Spieler,
  Tarif,
  Vertretung,
  AbrechnungTab,
  PaymentsMap,
  TrainerPaymentsMap,
  TrainerMonthSettledMap,
} from "../types";

type Props = {
  trainings: Training[];
  trainer: Trainer[];
  spieler: Spieler[];
  tarife: Tarif[];
  vertretungen: Vertretung[];
  payments: PaymentsMap;
  trainerPayments: TrainerPaymentsMap;
  trainerMonthSettled: TrainerMonthSettledMap;
  isAdmin: boolean;
  ownTrainerId?: string;
  onPaymentsChange: (payments: PaymentsMap) => void;
  onTrainerPaymentsChange: (payments: TrainerPaymentsMap) => void;
  onTrainerMonthSettledChange: (settled: TrainerMonthSettledMap) => void;
  onTrainingClick: (training: Training) => void;
};

// Hilfsfunktionen
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function euro(n: number): string {
  if (!Number.isFinite(n)) return "0,00 €";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function paymentKey(monat: string, spielerId: string): string {
  return `${monat}__${spielerId}`;
}

function trainerMonthSettledKey(monat: string, trainerId: string): string {
  return `${monat}__${trainerId}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function durationMin(von: string, bis: string): number {
  const a = toMinutes(von);
  const b = toMinutes(bis);
  return Math.max(0, b - a);
}

function formatMonthLabel(monthISO: string): string {
  const parts = monthISO.split("-");
  const year = parts[0] ?? "";
  const month = parts[1] ?? "";
  return `${pad2(Number(month))}.${year}`;
}

const Abrechnung: React.FC<Props> = ({
  trainings,
  trainer,
  spieler,
  tarife,
  vertretungen,
  payments,
  trainerPayments,
  trainerMonthSettled,
  isAdmin,
  ownTrainerId,
  onPaymentsChange,
  onTrainerPaymentsChange,
  onTrainerMonthSettledChange,
  onTrainingClick,
}) => {
  const [abrechnungTab, setAbrechnungTab] = useState<AbrechnungTab>("spieler");
  const [abrechnungMonat, setAbrechnungMonat] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  });
  const [abrechnungTrainerFilter, setAbrechnungTrainerFilter] = useState<string>("alle");
  const [abrechnungSpielerSuche, setAbrechnungSpielerSuche] = useState("");
  const [selectedSpielerForDetail, setSelectedSpielerForDetail] = useState<string | null>(null);

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

  const tarifById = useMemo(() => {
    const map = new Map<string, Tarif>();
    tarife.forEach((t) => map.set(t.id, t));
    return map;
  }, [tarife]);

  const defaultTrainerId = trainer[0]?.id || "";

  // Trainings im gewählten Monat (nur durchgeführte)
  const trainingsInMonth = useMemo(() => {
    return trainings
      .filter((t) => t.datum.startsWith(abrechnungMonat))
      .filter((t) => t.status === "durchgefuehrt")
      .filter((t) => {
        if (abrechnungTrainerFilter === "alle") return true;
        const vertretung = vertretungen.find((v) => v.trainingId === t.id);
        const tid = vertretung?.vertretungTrainerId || t.trainerId || defaultTrainerId;
        return tid === abrechnungTrainerFilter;
      })
      .sort((a, b) => a.datum.localeCompare(b.datum) || a.uhrzeitVon.localeCompare(b.uhrzeitVon));
  }, [trainings, abrechnungMonat, abrechnungTrainerFilter, vertretungen, defaultTrainerId]);

  // Preis für ein Training berechnen (Preis pro Stunde pro Spieler * Dauer * Anzahl Spieler)
  const trainingPreisGesamt = useCallback((t: Training): number => {
    const tarif = t.tarifId ? tarifById.get(t.tarifId) : undefined;
    const preisProStunde = tarif?.preisProStunde ?? 0;
    const dauer = durationMin(t.uhrzeitVon, t.uhrzeitBis) / 60;
    // Preis pro Stunde pro Spieler * Dauer * Anzahl Spieler
    return round2(preisProStunde * dauer * t.spielerIds.length);
  }, [tarifById]);

  // Preis pro Spieler für ein Training
  const trainingPreisProSpieler = useCallback((t: Training): number => {
    const tarif = t.tarifId ? tarifById.get(t.tarifId) : undefined;
    const preisProStunde = tarif?.preisProStunde ?? 0;
    const dauer = durationMin(t.uhrzeitVon, t.uhrzeitBis) / 60;
    return round2(preisProStunde * dauer);
  }, [tarifById]);

  // Trainer Honorar berechnen
  const trainerHonorarFuerTraining = useCallback((t: Training): number => {
    const vertretung = vertretungen.find((v) => v.trainingId === t.id);
    const tid = vertretung?.vertretungTrainerId || t.trainerId || defaultTrainerId;
    const trainerObj = trainerById.get(tid);
    const stundensatz = trainerObj?.stundensatz ?? 0;
    const dauer = durationMin(t.uhrzeitVon, t.uhrzeitBis) / 60;
    return round2(stundensatz * dauer);
  }, [vertretungen, defaultTrainerId, trainerById]);

  // Spieler Abrechnung berechnen
  const spielerAbrechnung = useMemo(() => {
    const rows: {
      id: string;
      name: string;
      sum: number;
      trainingsCount: number;
    }[] = [];

    spieler.forEach((s) => {
      const spielerTrainings = trainingsInMonth.filter((t) =>
        t.spielerIds.includes(s.id)
      );

      if (spielerTrainings.length === 0) return;

      let sum = 0;
      spielerTrainings.forEach((t) => {
        // Jeder Spieler zahlt: preisProStunde * Dauer
        sum += trainingPreisProSpieler(t);
      });

      rows.push({
        id: s.id,
        name: `${s.vorname} ${s.nachname || ""}`.trim(),
        sum: round2(sum),
        trainingsCount: spielerTrainings.length,
      });
    });

    // Filtern nach Suche
    const searchQ = abrechnungSpielerSuche.trim().toLowerCase();
    const filtered = searchQ
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(searchQ) ||
            spielerById.get(r.id)?.kontaktEmail?.toLowerCase().includes(searchQ)
        )
      : rows;

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [
    spieler,
    trainingsInMonth,
    trainingPreisProSpieler,
    abrechnungSpielerSuche,
    spielerById,
  ]);

  // Trainer Abrechnung berechnen
  const trainerAbrechnung = useMemo(() => {
    const rows: {
      id: string;
      name: string;
      trainings: number;
      sum: number;
      honorar: number;
      honorarBezahlt: number;
      honorarOffen: number;
    }[] = [];

    trainer.forEach((tr) => {
      const trainerTrainings = trainingsInMonth.filter((t) => {
        const vertretung = vertretungen.find((v) => v.trainingId === t.id);
        const tid = vertretung?.vertretungTrainerId || t.trainerId || defaultTrainerId;
        return tid === tr.id;
      });

      if (trainerTrainings.length === 0 && abrechnungTrainerFilter !== "alle") return;

      let sum = 0;
      let honorar = 0;
      let honorarBezahlt = 0;

      trainerTrainings.forEach((t) => {
        const preis = trainingPreisGesamt(t);
        const hon = trainerHonorarFuerTraining(t);
        sum += preis;
        honorar += hon;
        if (trainerPayments[t.id]) {
          honorarBezahlt += hon;
        }
      });

      rows.push({
        id: tr.id,
        name: `${tr.name} ${tr.nachname || ""}`.trim(),
        trainings: trainerTrainings.length,
        sum: round2(sum),
        honorar: round2(honorar),
        honorarBezahlt: round2(honorarBezahlt),
        honorarOffen: round2(honorar - honorarBezahlt),
      });
    });

    return rows.filter((r) => r.trainings > 0 || abrechnungTrainerFilter === "alle");
  }, [
    trainer,
    trainingsInMonth,
    vertretungen,
    defaultTrainerId,
    trainerPayments,
    trainingPreisGesamt,
    trainerHonorarFuerTraining,
    abrechnungTrainerFilter,
  ]);

  // Gesamtsummen
  const totals = useMemo(() => {
    let total = 0;
    let bezahlt = 0;

    spielerAbrechnung.forEach((r) => {
      total += r.sum;
      const key = paymentKey(abrechnungMonat, r.id);
      if (payments[key]) {
        bezahlt += r.sum;
      }
    });

    return {
      total: round2(total),
      bezahlt: round2(bezahlt),
      offen: round2(total - bezahlt),
    };
  }, [spielerAbrechnung, payments, abrechnungMonat]);

  // Toggle Spieler bezahlt
  const togglePaidForPlayer = (spielerId: string) => {
    const key = paymentKey(abrechnungMonat, spielerId);
    onPaymentsChange({
      ...payments,
      [key]: !payments[key],
    });
  };

  // Toggle Trainer Training bezahlt
  const toggleTrainerPaid = (trainingId: string) => {
    onTrainerPaymentsChange({
      ...trainerPayments,
      [trainingId]: !trainerPayments[trainingId],
    });
  };

  // Monat als abgerechnet markieren
  const markMonthSettled = (trainerId: string) => {
    const key = trainerMonthSettledKey(abrechnungMonat, trainerId);
    onTrainerMonthSettledChange({
      ...trainerMonthSettled,
      [key]: true,
    });

    // Alle Trainings dieses Trainers als abgerechnet markieren
    const trainerTrainings = trainingsInMonth.filter((t) => {
      const vertretung = vertretungen.find((v) => v.trainingId === t.id);
      const tid = vertretung?.vertretungTrainerId || t.trainerId || defaultTrainerId;
      return tid === trainerId;
    });

    if (trainerTrainings.length > 0) {
      const newPayments = { ...trainerPayments };
      trainerTrainings.forEach((t) => {
        newPayments[t.id] = true;
      });
      onTrainerPaymentsChange(newPayments);
    }
  };

  // Monat-Markierung entfernen
  const unmarkMonthSettled = (trainerId: string) => {
    const key = trainerMonthSettledKey(abrechnungMonat, trainerId);
    const newSettled = { ...trainerMonthSettled };
    delete newSettled[key];
    onTrainerMonthSettledChange(newSettled);
  };

  // Spieler Name
  const getSpielerDisplayName = (id: string) => {
    const s = spielerById.get(id);
    return s ? `${s.vorname} ${s.nachname || ""}`.trim() : "Unbekannt";
  };

  // Für Trainer: nur eigene Trainings
  const ownTrainerTrainings = useMemo(() => {
    if (!ownTrainerId) return [];
    return trainingsInMonth.filter((t) => {
      const vertretung = vertretungen.find((v) => v.trainingId === t.id);
      const tid = vertretung?.vertretungTrainerId || t.trainerId || defaultTrainerId;
      return tid === ownTrainerId;
    });
  }, [trainingsInMonth, ownTrainerId, vertretungen, defaultTrainerId]);

  const ownHonorar = useMemo(() => {
    let total = 0;
    let bezahlt = 0;
    ownTrainerTrainings.forEach((t) => {
      const hon = trainerHonorarFuerTraining(t);
      total += hon;
      if (trainerPayments[t.id]) {
        bezahlt += hon;
      }
    });
    return {
      total: round2(total),
      bezahlt: round2(bezahlt),
      offen: round2(total - bezahlt),
    };
  }, [ownTrainerTrainings, trainerPayments, trainerHonorarFuerTraining]);

  // Detail-Modal für Spieler
  const selectedSpieler = selectedSpielerForDetail
    ? spielerById.get(selectedSpielerForDetail)
    : null;
  const selectedSpielerTrainings = selectedSpielerForDetail
    ? trainingsInMonth.filter((t) => t.spielerIds.includes(selectedSpielerForDetail))
    : [];

  return (
    <div className="abrechnung">
      <div className="abrechnung-header">
        <h2>Abrechnung</h2>
      </div>

      {/* Filter */}
      <div className="abrechnung-filters">
        <div className="filter-group">
          <label>Monat</label>
          <input
            type="month"
            value={abrechnungMonat}
            onChange={(e) => setAbrechnungMonat(e.target.value)}
          />
        </div>

        {isAdmin && trainer.length > 1 && (
          <div className="filter-group">
            <label>Trainer</label>
            <select
              value={abrechnungTrainerFilter}
              onChange={(e) => setAbrechnungTrainerFilter(e.target.value)}
            >
              <option value="alle">Alle Trainer</option>
              {trainer.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name} {tr.nachname || ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {isAdmin && abrechnungTab === "spieler" && (
          <div className="filter-group">
            <label>Spieler Suche</label>
            <input
              value={abrechnungSpielerSuche}
              onChange={(e) => setAbrechnungSpielerSuche(e.target.value)}
              placeholder="Name oder Email"
            />
          </div>
        )}
      </div>

      {/* Tabs für Admin */}
      {isAdmin && (
        <div className="abrechnung-tabs">
          <button
            className={`abrechnung-tab ${abrechnungTab === "spieler" ? "active" : ""}`}
            onClick={() => setAbrechnungTab("spieler")}
          >
            Spieler Abrechnung
          </button>
          <button
            className={`abrechnung-tab ${abrechnungTab === "trainer" ? "active" : ""}`}
            onClick={() => setAbrechnungTab("trainer")}
          >
            Trainer Abrechnung
          </button>
        </div>
      )}

      {/* Spieler Abrechnung */}
      {abrechnungTab === "spieler" && isAdmin && (
        <div className="abrechnung-content">
          {/* Zusammenfassung */}
          <div className="abrechnung-summary">
            <div className="summary-item">
              <span>Umsatz gesamt:</span>
              <strong>{euro(totals.total)}</strong>
            </div>
            <div className="summary-item">
              <span>Bezahlt:</span>
              <strong style={{ color: "#22c55e" }}>{euro(totals.bezahlt)}</strong>
            </div>
            <div className="summary-item">
              <span>Offen:</span>
              <strong style={{ color: totals.offen > 0 ? "#ef4444" : "#22c55e" }}>
                {euro(totals.offen)}
              </strong>
            </div>
          </div>

          {/* Spieler Liste */}
          <div className="abrechnung-table">
            <table>
              <thead>
                <tr>
                  <th>Spieler</th>
                  <th>Trainings</th>
                  <th>Summe</th>
                  <th>Status</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {spielerAbrechnung.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      Keine Trainings im gewählten Monat
                    </td>
                  </tr>
                ) : (
                  spielerAbrechnung.map((r) => {
                    const key = paymentKey(abrechnungMonat, r.id);
                    const isPaid = payments[key] ?? false;

                    return (
                      <tr key={r.id}>
                        <td>
                          <span
                            className="clickable-name"
                            onClick={() => setSelectedSpielerForDetail(r.id)}
                          >
                            {r.name}
                          </span>
                        </td>
                        <td>{r.trainingsCount}</td>
                        <td>{euro(r.sum)}</td>
                        <td>
                          <span className={`status-badge ${isPaid ? "paid" : "open"}`}>
                            {isPaid ? "Abgerechnet" : "Offen"}
                          </span>
                        </td>
                        <td>
                          <button
                            className={`action-btn ${isPaid ? "paid" : ""}`}
                            onClick={() => togglePaidForPlayer(r.id)}
                          >
                            {isPaid ? "Als offen markieren" : "Als abgerechnet markieren"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trainer Abrechnung */}
      {abrechnungTab === "trainer" && isAdmin && (
        <div className="abrechnung-content">
          {/* Trainer Übersicht */}
          {trainer.length > 1 && (
            <div className="abrechnung-table">
              <h3>Summe pro Trainer</h3>
              <table>
                <thead>
                  <tr>
                    <th>Trainer</th>
                    <th>Trainings</th>
                    <th>Umsatz</th>
                    <th>Honorar</th>
                    <th>Bezahlt</th>
                    <th>Offen</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {trainerAbrechnung.map((r) => {
                    const settledKey = trainerMonthSettledKey(abrechnungMonat, r.id);
                    const isSettled = trainerMonthSettled[settledKey] ?? false;

                    return (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{r.trainings}</td>
                        <td>{euro(r.sum)}</td>
                        <td>{euro(r.honorar)}</td>
                        <td style={{ color: "#22c55e" }}>{euro(r.honorarBezahlt)}</td>
                        <td style={{ color: r.honorarOffen > 0 ? "#ef4444" : "#22c55e" }}>
                          {euro(r.honorarOffen)}
                        </td>
                        <td>
                          {isSettled ? (
                            <div className="settled-status">
                              <span className="settled-badge">Abgerechnet</span>
                              <button
                                className="unsettle-btn"
                                onClick={() => unmarkMonthSettled(r.id)}
                              >
                                Entfernen
                              </button>
                            </div>
                          ) : (
                            <button
                              className="settle-btn"
                              onClick={() => markMonthSettled(r.id)}
                            >
                              Als abgerechnet markieren
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Einzelne Trainings */}
          <div className="trainings-list">
            <h3>Trainings im Monat ({formatMonthLabel(abrechnungMonat)})</h3>
            {trainingsInMonth.length === 0 ? (
              <p className="empty">Keine durchgeführten Trainings im gewählten Monat</p>
            ) : (
              <ul>
                {trainingsInMonth.map((t) => {
                  const vertretung = vertretungen.find((v) => v.trainingId === t.id);
                  const effectiveTrainerId =
                    vertretung?.vertretungTrainerId || t.trainerId || defaultTrainerId;
                  const trainerName =
                    trainerById.get(effectiveTrainerId)?.name ?? "Trainer";
                  const preis = trainingPreisGesamt(t);
                  const honorar = trainerHonorarFuerTraining(t);
                  const isPaid = trainerPayments[t.id] ?? false;
                  const spielerNames = t.spielerIds
                    .map((id) => getSpielerDisplayName(id))
                    .join(", ");

                  const [y, m, d] = t.datum.split("-");
                  const germanDate = d && m && y ? `${d}.${m}.${y}` : t.datum;

                  return (
                    <li key={t.id} className="training-item">
                      <div className="training-info">
                        <strong>
                          {germanDate} {t.uhrzeitVon} - {t.uhrzeitBis}
                        </strong>
                        <span className="training-detail">Spieler: {spielerNames}</span>
                        <span className="training-detail">Trainer: {trainerName}</span>
                        <span className="training-detail">
                          Umsatz: {euro(preis)} | Honorar: {euro(honorar)}
                        </span>
                      </div>
                      <div className="training-actions">
                        <span
                          className={`honorar-badge ${isPaid ? "paid" : "open"}`}
                          onClick={() => toggleTrainerPaid(t.id)}
                        >
                          {isPaid ? "Honorar abgerechnet" : "Honorar offen"}
                        </span>
                        <button
                          className="edit-btn"
                          onClick={() => onTrainingClick(t)}
                        >
                          Bearbeiten
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Trainer-Ansicht (nicht Admin) */}
      {!isAdmin && ownTrainerId && (
        <div className="abrechnung-content">
          <div className="abrechnung-summary">
            <div className="summary-item">
              <span>Dein Honorar gesamt:</span>
              <strong>{euro(ownHonorar.total)}</strong>
            </div>
            <div className="summary-item">
              <span>Bezahlt:</span>
              <strong style={{ color: "#22c55e" }}>{euro(ownHonorar.bezahlt)}</strong>
            </div>
            <div className="summary-item">
              <span>Offen:</span>
              <strong
                style={{ color: ownHonorar.offen > 0 ? "#ef4444" : "#22c55e" }}
              >
                {euro(ownHonorar.offen)}
              </strong>
            </div>
          </div>

          {/* Status */}
          {ownTrainerId && (
            <div className="trainer-month-status">
              {trainerMonthSettled[trainerMonthSettledKey(abrechnungMonat, ownTrainerId)] ? (
                <span className="settled-badge large">Monat abgerechnet</span>
              ) : (
                <span className="open-badge large">Monat noch nicht abgerechnet</span>
              )}
            </div>
          )}

          {/* Trainings Liste */}
          <div className="trainings-list">
            <h3>Deine Trainings ({formatMonthLabel(abrechnungMonat)})</h3>
            {ownTrainerTrainings.length === 0 ? (
              <p className="empty">Keine durchgeführten Trainings im gewählten Monat</p>
            ) : (
              <ul>
                {ownTrainerTrainings.map((t) => {
                  const honorar = trainerHonorarFuerTraining(t);
                  const isPaid = trainerPayments[t.id] ?? false;
                  const spielerNames = t.spielerIds
                    .map((id) => getSpielerDisplayName(id))
                    .join(", ");

                  const [y, m, d] = t.datum.split("-");
                  const germanDate = d && m && y ? `${d}.${m}.${y}` : t.datum;

                  return (
                    <li key={t.id} className="training-item">
                      <div className="training-info">
                        <strong>
                          {germanDate} {t.uhrzeitVon} - {t.uhrzeitBis}
                        </strong>
                        <span className="training-detail">Spieler: {spielerNames}</span>
                        <span className="training-detail">Honorar: {euro(honorar)}</span>
                      </div>
                      <div className="training-actions">
                        <span className={`honorar-badge ${isPaid ? "paid" : "open"}`}>
                          {isPaid ? "Abgerechnet" : "Offen"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Detail-Modal für Spieler */}
      {selectedSpieler && (
        <div className="modal-overlay" onClick={() => setSelectedSpielerForDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              Trainings von {selectedSpieler.vorname} {selectedSpieler.nachname || ""}
            </h3>
            <p className="modal-subtitle">
              Monat: {formatMonthLabel(abrechnungMonat)}
            </p>
            <div className="modal-content">
              {selectedSpielerTrainings.length === 0 ? (
                <p className="empty">Keine Trainings in diesem Monat</p>
              ) : (
                <ul className="detail-list">
                  {selectedSpielerTrainings.map((t) => {
                    const [y, m, d] = t.datum.split("-");
                    const germanDate = d && m && y ? `${d}.${m}.${y}` : t.datum;
                    const tarif = t.tarifId ? tarifById.get(t.tarifId) : undefined;
                    const preis = trainingPreisProSpieler(t);

                    return (
                      <li key={t.id}>
                        <strong>
                          {germanDate} {t.uhrzeitVon} - {t.uhrzeitBis}
                        </strong>
                        {tarif && <span>Tarif: {tarif.name}</span>}
                        <span>Betrag: {euro(preis)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setSelectedSpielerForDetail(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Abrechnung;
