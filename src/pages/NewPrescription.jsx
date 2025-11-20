// src/pages/NewPrescription.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Form,
  Button,
  ListGroup,
} from "react-bootstrap";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  addDoc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "../firebase";

const DOSAGE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const TIMES_OPTIONS = [
  "Once",
  "Twice",
  "Thrice",
  "Four Times",
  "Five Times",
];

function buildPattern(dosageCount, timesPerDay) {
  const d = dosageCount || 1;
  let base = [];

  switch (timesPerDay) {
    case "Once":
      base = ["1", "x", "x"];
      break;
    case "Twice":
      base = ["1", "x", "1"];
      break;
    case "Thrice":
      base = ["1", "1", "1"];
      break;
    case "Four Times":
      base = ["1", "1", "1", "1"];
      break;
    case "Five Times":
      base = ["1", "1", "1", "1", "1"];
      break;
    default:
      base = ["1"];
  }

  return base
    .map((slot) => (slot === "1" ? String(d) : "x"))
    .join("--");
}

export default function NewPrescription() {
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const location = useLocation();
  const { patientId, workorderId } = location.state || {};

  // Patients list + selection
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientError, setPatientError] = useState("");

  // Medicines db + search
  const [medicines, setMedicines] = useState([]);
  const [medSearch, setMedSearch] = useState("");
  const [selectedMeds, setSelectedMeds] = useState([]);

  // Diagnosis
  const [diagnosis, setDiagnosis] = useState("");

  // Saving / editing
  const [saving, setSaving] = useState(false);
  const [editingWorkorder, setEditingWorkorder] = useState(null);

  // Load patients
  useEffect(() => {
    const q = query(collection(db, "patients"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPatients(list);
    });
    return () => unsub();
  }, []);

  // Load medicines
  useEffect(() => {
    const q = query(collection(db, "medicines"), orderBy("name", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMedicines(list);
    });
    return () => unsub();
  }, []);

  // If we came from NewPatient with patientId
  useEffect(() => {
    if (patientId && patients.length) {
      const p = patients.find((p) => p.id === patientId);
      if (p) setSelectedPatient(p);
    }
  }, [patientId, patients]);

  // If we came from Edit (PreviousConsultations) with workorderId
  useEffect(() => {
    const loadWorkorder = async () => {
      if (!workorderId) return;
      try {
        const snap = await getDoc(doc(db, "workorders", workorderId));
        if (!snap.exists()) return;
        const data = snap.data();
        setEditingWorkorder({ id: snap.id, ...data });
        setDiagnosis(data.instructions || "");
        const pat = data.patient || {};
        setSelectedPatient({
          id: pat.id || null,
          name: pat.name,
          age: pat.age,
          sex: pat.sex,
          address: pat.address,
        });

        const meds = (data.medicines || []).map((m) => ({
          id: m.id,
          name: m.name,
          strength: m.strength,
          dosageCount: m.dosageCount || m.dosage || 1,
          dosageForm: m.dosageForm || "Tablet",
          timesPerDay: m.timesPerDay || "Once",
          instructions: m.instructions || "",
          pattern:
            m.pattern ||
            buildPattern(m.dosageCount || m.dosage || 1, m.timesPerDay || "Once"),
        }));
        setSelectedMeds(meds);
      } catch (err) {
        console.error(err);
      }
    };
    loadWorkorder();
  }, [workorderId]);

  const filteredPatientSuggestions = useMemo(() => {
    const term = patientSearch.trim().toLowerCase();
    if (!term) return [];
    return patients
      .filter((p) =>
        (p.name || "").toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [patientSearch, patients]);

  const filteredMedicines = useMemo(() => {
    const term = medSearch.trim().toLowerCase();
    if (!term) return [];
    return medicines
      .filter((m) => m.name.toLowerCase().includes(term))
      .slice(0, 5);
  }, [medSearch, medicines]);

  const handleSelectPatient = (p) => {
    setSelectedPatient(p);
    setPatientSearch("");
    setPatientError("");
  };

  const handleClearPatient = () => {
    setSelectedPatient(null);
    setPatientSearch("");
  };

  const handleAddMed = (med) => {
    if (!selectedMeds.find((m) => m.id === med.id)) {
      setSelectedMeds((prev) => [
        ...prev,
        {
          id: med.id,
          name: med.name,
          strength: med.strength,
          dosageCount: 1,
          dosageForm: "Tablet",
          timesPerDay: "Once",
          instructions: "",
          pattern: buildPattern(1, "Once"),
        },
      ]);
    }
    setMedSearch("");
  };

  const handleRemoveMed = (id) => {
    setSelectedMeds((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMedField = (id, field, value) => {
    setSelectedMeds((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const updated = { ...m, [field]: value };
        if (
          field === "dosageCount" ||
          field === "timesPerDay"
        ) {
          const dCount =
            field === "dosageCount"
              ? Number(value) || 1
              : Number(m.dosageCount) || 1;
          const times =
            field === "timesPerDay" ? value : m.timesPerDay;
          updated.pattern = buildPattern(dCount, times);
        }
        return updated;
      })
    );
  };

  const validate = () => {
    let ok = true;
    if (!selectedPatient) {
      setPatientError("Please select a patient");
      ok = false;
    } else {
      setPatientError("");
    }

    if (selectedMeds.length === 0) {
      alert("Please add at least one medicine");
      ok = false;
    }

    return ok;
  };

  const getNextOrderId = async () => {
    const ref = doc(db, "counters", "workorders");
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, { current: 1000 });
        return 1000;
      }
      const current = snap.data().current || 1000;
      const next = current + 1;
      tx.update(ref, { current: next });
      return next;
    });
  };

const handleCancel = () => {
  setEditingWorkorder(null);
  navigate('/app/consultations/previous');
}

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (!selectedPatient) return;

    setSaving(true);
    try {
      const medsPayload = selectedMeds.map((m) => ({
        id: m.id,
        name: m.name,
        strength: m.strength,
        dosageCount: Number(m.dosageCount) || 1,
        dosageForm: m.dosageForm,
        timesPerDay: m.timesPerDay,
        pattern: buildPattern(
          Number(m.dosageCount) || 1,
          m.timesPerDay
        ),
        instructions: m.instructions || "",
      }));

      if (editingWorkorder) {
        const ref = doc(db, "workorders", editingWorkorder.id);
        await updateDoc(ref, {
          orderId: editingWorkorder.orderId,
          patient: {
            id: selectedPatient.id || null,
            name: selectedPatient.name,
            age: selectedPatient.age,
            sex: selectedPatient.sex,
            address: selectedPatient.address,
          },
          medicines: medsPayload,
          instructions: diagnosis || "",
          doctor: {
            id: user.uid,
            name: user.name || "",
            email: user.email || "",
          },
          updatedAt: serverTimestamp(),
        });
      } else {
        const orderId = await getNextOrderId();
        await addDoc(collection(db, "workorders"), {
          orderId,
          patient: {
            id: selectedPatient.id || null,
            name: selectedPatient.name,
            age: selectedPatient.age,
            sex: selectedPatient.sex,
            address: selectedPatient.address,
          },
          medicines: medsPayload,
          instructions: diagnosis || "",
          doctor: {
            id: user.uid,
            name: user.name || "",
            email: user.email || "",
          },
          createdAt: serverTimestamp(),
        });
      }

      // Reset only if creating new; for editing you may keep
      setDiagnosis("");
      setSelectedMeds([]);
      if (!editingWorkorder && !patientId) {
        setSelectedPatient(null);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save case");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h4 className="mb-3">
        {editingWorkorder ? "Edit Prescription" : "New Prescription"}
      </h4>
      <Card className="shadow-sm border-0 mb-4">
        <Card.Body>
          {/* Patient selection */}
          <Form onSubmit={handleSubmit}>
            {!selectedPatient && (
              <Form.Group className="mb-3 position-relative">
                <Form.Label>Search Patient</Form.Label>
                <Form.Control
                  placeholder="Start typing patient name..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  isInvalid={!!patientError}
                />
                <Form.Control.Feedback type="invalid">
                  {patientError}
                </Form.Control.Feedback>

                {patientSearch.trim() && (
                  <ListGroup
                    className="position-absolute w-100"
                    style={{
                      top: "100%",
                      zIndex: 20,
                      maxHeight: 220,
                      overflowY: "auto",
                    }}
                  >
                    {filteredPatientSuggestions.length > 0 ? (
                      filteredPatientSuggestions.map((p) => (
                        <ListGroup.Item
                          key={p.id}
                          action
                          onClick={() => handleSelectPatient(p)}
                        >
                          {p.name}{" "}
                          <span className="text-muted small">
                            ({p.age} yrs, {p.sex}) – {p.address}
                          </span>
                        </ListGroup.Item>
                      ))
                    ) : (
                      <ListGroup.Item className="d-flex justify-content-between p-5" >
                        No patient found. <Button onClick={()=> navigate('/app/patients/new')}>Add Patient</Button>
                      </ListGroup.Item>
                    )}
                  </ListGroup>
                )}
              </Form.Group>
            )}

            {selectedPatient && (
              <Card className="mb-3 border-0 bg-light">
                <Card.Body className="py-2 d-flex justify-content-between align-items-start">
                  <div>
                    <div>
                      <strong>{selectedPatient.name}</strong>
                    </div>
                    <div className="small text-muted">
                      Age: {selectedPatient.age} | Sex: {selectedPatient.sex}
                    </div>
                    <div className="small text-muted">
                      {selectedPatient.address}
                    </div>
                  </div>
                  {!patientId && !editingWorkorder && (
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={handleClearPatient}
                    >
                      Change
                    </Button>
                  )}
                </Card.Body>
              </Card>
            )}

            {/* Diagnosis */}
            <Form.Group className="mb-3">
              <Form.Label>Diagnosis / Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Enter diagnosis and general instructions"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </Form.Group>

            {/* Medicine search */}
            <Form.Group className="position-relative mb-2">
              <Form.Label>Search Medicine</Form.Label>
              <Form.Control
                placeholder="Type medicine name..."
                value={medSearch}
                onChange={(e) => setMedSearch(e.target.value)}
              />
              {medSearch.trim() && (
                <ListGroup
                  className="position-absolute w-100"
                  style={{
                    top: "100%",
                    zIndex: 20,
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {filteredMedicines.length > 0 ? (
                    filteredMedicines.map((m) => (
                      <ListGroup.Item
                        key={m.id}
                        action
                        onClick={() => handleAddMed(m)}
                      >
                        {m.name}{" "}
                        <span className="text-muted small">
                          {m.strength}
                        </span>
                      </ListGroup.Item>
                    ))
                  ) : (
                    <ListGroup.Item>No medicines found</ListGroup.Item>
                  )}
                </ListGroup>
              )}
            </Form.Group>

            {/* Selected medicines */}
            {selectedMeds.length > 0 && (
              <ListGroup className="mt-3">
                {selectedMeds.map((m) => (
                  <ListGroup.Item key={m.id}>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{m.name}</strong>{" "}
                        <span className="text-muted small">
                          {m.strength}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() => handleRemoveMed(m.id)}
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="row mt-2">
                      <div className="col-md-3 mb-2">
                        <Form.Label className="small mb-1">
                          Dosage
                        </Form.Label>
                        <Form.Select
                          size="sm"
                          value={m.dosageCount}
                          onChange={(e) =>
                            updateMedField(
                              m.id,
                              "dosageCount",
                              Number(e.target.value) || 1
                            )
                          }
                        >
                          {DOSAGE_OPTIONS.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </Form.Select>
                      </div>
                      <div className="col-md-3 mb-2">
                        <Form.Label className="small mb-1">
                          Form
                        </Form.Label>
                        <Form.Select
                          size="sm"
                          value={m.dosageForm}
                          onChange={(e) =>
                            updateMedField(
                              m.id,
                              "dosageForm",
                              e.target.value
                            )
                          }
                        >
                          <option value="Tablet">Tablet</option>
                          <option value="Syrup">Syrup</option>
                        </Form.Select>
                      </div>
                      <div className="col-md-3 mb-2">
                        <Form.Label className="small mb-1">
                          Times a Day
                        </Form.Label>
                        <Form.Select
                          size="sm"
                          value={m.timesPerDay}
                          onChange={(e) =>
                            updateMedField(
                              m.id,
                              "timesPerDay",
                              e.target.value
                            )
                          }
                        >
                          {TIMES_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </Form.Select>
                      </div>
                      <div className="col-md-3 mb-2">
                        <Form.Label className="small mb-1">
                          Pattern
                        </Form.Label>
                        <Form.Control
                          size="sm"
                          value={m.pattern || ""}
                          disabled
                          readOnly
                        />
                      </div>
                    </div>

                    <Form.Group className="mt-2">
                      <Form.Label className="small mb-1">
                        Instructions
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        size="sm"
                        placeholder="Instructions (e.g. after meals, 5 days)"
                        value={m.instructions || ""}
                        onChange={(e) =>
                          updateMedField(
                            m.id,
                            "instructions",
                            e.target.value
                          )
                        }
                      />
                    </Form.Group>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}

            <div className="mt-4 d-flex justify-content-between gap-2">
              <Button onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving..."
                  : editingWorkorder
                    ? "Update Case"
                    : "Create Case"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
