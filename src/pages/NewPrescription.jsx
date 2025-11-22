// src/pages/NewPrescription.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Form,
  Button,
  ListGroup,
  Modal,
  Badge,
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
  increment,
} from "firebase/firestore";
import { useSelector } from "react-redux";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "../firebase";

const DOSAGE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const TIMES_OPTIONS = ["Once daily", "Twice daily", "Thrice daily", "Four times in a day", "Five times in a day", "Six times in a day", "Bedtime"," Empty Stomach"];

const TIMES_NUMERIC = {
  "Once Daily": 1,
  "Twice Daily": 2,
  "Thrice Daily": 3,
  "Four times in a day": 4,
  "Five times in a day": 5,
  "Six times in a day": 6,
  "Bedtime": 1,
  "Empty Stomach": 1
};

const MEDICINE_CATEGORIES = [
  "Analgesic / Pain Relief",
  "Antibiotic",
  "Antacid",
  "Antihypertensive",
  "Antidiabetic",
  "Vitamin / Supplement",
  "Cough & Cold",
  "Dermatology",
  "Other",
];

const COMMON_STRENGTHS_BY_FORM = {
  Tablet: ["250mg", "500mg", "650mg"],
  Capsule: ["250mg", "500mg"],
  Syrup: ["5ml", "10ml"],
  Injection: ["1ml", "2ml"],
  Ointment: ["5g", "10g"],
  Drops: ["5 drops", "10 drops"],
  Inhaler: ["40ug", "50ug", "60ug", "70ug", "80ug", "90ug", "100ug"],
  Other: [],
};

function buildPattern(dosageCount, timesPerDay) {
  const d = dosageCount || 1;
  let base = [];

  switch (timesPerDay) {
    case "Once daily": base = ["1", "x", "x"]; break;
    case "Twice daily": base = ["1", "x", "1"]; break;
    case "Thrice daily": base = ["1", "1", "1"]; break;
    case "Four times in a day": base = ["1", "1", "1", "1"]; break;
    case "Five times in a day": base = ["1", "1", "1", "1", "1"]; break;
    case "Six times in a day": base = ["1", "1", "1", "1", "1", "1"]; break;
    case "Bedtime": base = ["x", "x", "1"]; break;
    case "Empty Stomach": base = ["1", "x", "x"]; break;
    default: base = ["1"];
  }

  return base.map(slot => (slot === "1" ? String(d) : "x")).join("--");
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

  // Add New Medicine Modal
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [savingMed, setSavingMed] = useState(false);
  const [newMed, setNewMed] = useState({
    name: "",
    strength: "",
    dosageForm: "Tablet",
    category: "Analgesic / Pain Relief",
    stock: "",
  });

  // Load patients
  useEffect(() => {
    const q = query(collection(db, "patients"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Load medicines
  useEffect(() => {
    const q = query(collection(db, "medicines"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) => {
      setMedicines(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // If coming from NewPatient
  useEffect(() => {
    if (patientId && patients.length) {
      const p = patients.find((p) => p.id === patientId);
      if (p) setSelectedPatient(p);
    }
  }, [patientId, patients]);

  // Editing mode
  useEffect(() => {
    const load = async () => {
      if (!workorderId) return;

      const snap = await getDoc(doc(db, "workorders", workorderId));
      if (!snap.exists()) return;

      const data = snap.data();
      setEditingWorkorder({ id: snap.id, ...data });

      setDiagnosis(data.instructions || "");

      const pat = data.patient;
      setSelectedPatient(pat);

      const meds = data.medicines.map((m) => ({
        ...m,
        pattern: m.pattern || buildPattern(m.dosageCount, m.timesPerDay),
      }));

      setSelectedMeds(meds);
    };
    load();
  }, [workorderId]);

  const filteredPatientSuggestions = useMemo(() => {
    const t = patientSearch.trim().toLowerCase();
    if (!t) return [];
    return patients
      .filter((p) => p.name.toLowerCase().includes(t))
      .slice(0, 8);
  }, [patientSearch, patients]);

  const filteredMedicines = useMemo(() => {
    const t = medSearch.trim().toLowerCase();
    if (!t) return [];
    return medicines
      .filter((m) => m.name.toLowerCase().includes(t))
      .slice(0, 5);
  }, [medSearch, medicines]);

  const handleAddMed = (m) => {
    if (!selectedMeds.find((x) => x.id === m.id)) {
      setSelectedMeds((prev) => [
        ...prev,
        {
          id: m.id,
          name: m.name,
          strength: m.strength,
          dosageForm: m.dosageForm || "Tablet",
          dosageCount: 1,
          timesPerDay: "Once daily",
          pattern: buildPattern(1, "Once daily"),
          instructions: "",
          days: 5,
        },
      ]);
    }
    setMedSearch("");
  };

  const updateMedField = (id, field, value) => {
    setSelectedMeds((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;

        const updated = { ...m, [field]: value };

        if (field === "dosageCount" || field === "timesPerDay") {
          updated.pattern = buildPattern(
            field === "dosageCount" ? value : m.dosageCount,
            field === "timesPerDay" ? value : m.timesPerDay
          );
        }

        return updated;
      })
    );
  };

  // ---------- SAVE NEW MEDICINE + INVENTORY ----------
  const handleSaveNewMedicine = async () => {
    if (!newMed.name.trim()) {
      alert("Medicine name is required");
      return;
    }
    if (!newMed.strength.trim()) {
      alert("Strength is required");
      return;
    }

    if (newMed.stock.trim() === "") {
      alert("Opening stock is required");
      return;
    }

    const stockNum = Number(newMed.stock);
    if (Number.isNaN(stockNum) || stockNum < 0) {
      alert("Opening stock must be a non-negative number");
      return;
    }

    setSavingMed(true);

    try {
      const trimmedName =
        newMed.name.trim().charAt(0).toUpperCase() +
        newMed.name.trim().slice(1);

      // 1️⃣ Add medicine
      const medRef = await addDoc(collection(db, "medicines"), {
        name: trimmedName,
        strength: newMed.strength.trim(),
        dosageForm: newMed.dosageForm,
        category: newMed.category,
        stock: stockNum,
        createdAt: serverTimestamp(),
      });

      const medicineId = medRef.id;

      // 2️⃣ Add inventory record
      await addDoc(collection(db, "inventory"), {
        medicineId,
        name: trimmedName,
        strength: newMed.strength.trim(),
        form: newMed.dosageForm,
        category: newMed.category,
        openingStock: stockNum,
        currentStock: stockNum,
        createdAt: serverTimestamp(),
      });

      // 3️⃣ Add to selected meds for the prescription
      setSelectedMeds((prev) => [
        ...prev,
        {
          id: medicineId,
          name: trimmedName,
          strength: newMed.strength.trim(),
          dosageForm: newMed.dosageForm,
          dosageCount: 1,
          timesPerDay: "Once daily",
          pattern: buildPattern(1, "Once daily"),
          instructions: "",
          days: 5,
        },
      ]);

      setShowAddMedModal(false);
      setNewMed({
        name: "",
        strength: "",
        dosageForm: "Tablet",
        category: "Analgesic / Pain Relief",
        stock: "",
      });
      setMedSearch("");

    } catch (err) {
      console.error(err);
      alert("Failed to save medicine");
    } finally {
      setSavingMed(false);
    }
  };

  // ---------- VALIDATION ----------
  const validate = () => {
    if (!selectedPatient) {
      setPatientError("Please select a patient");
      return false;
    }
    if (selectedMeds.length === 0) {
      alert("Please add at least one medicine");
      return false;
    }
    return true;
  };

  const getNextOrderId = async () => {
    const ref = doc(db, "counters", "workorders");
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        tx.set(ref, { current: 1000 });
        return 1000;
      }
      const next = (snap.data().current || 1000) + 1;
      tx.update(ref, { current: next });
      return next;
    });
  };

  const updateMedicineStock = async (medsPayload) => {
    try {
      const updates = medsPayload.map((m) => {
        const times = TIMES_NUMERIC[m.timesPerDay];
        const total = m.dosageCount * times * m.days;
        if (!total) return null;

        return updateDoc(doc(db, "medicines", m.id), {
          stock: increment(-total),
        });
      });

      await Promise.all(updates.filter(Boolean));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = () => navigate("/app/consultations/previous");

  // ---------- SUBMIT PRESCRIPTION ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);

    try {
      const medsPayload = selectedMeds.map((m) => ({
        id: m.id,
        name: m.name,
        strength: m.strength,
        dosageCount: m.dosageCount,
        dosageForm: m.dosageForm,
        timesPerDay: m.timesPerDay,
        days: m.days,
        pattern: buildPattern(m.dosageCount, m.timesPerDay),
        instructions: m.instructions,
      }));

      if (editingWorkorder) {
        await updateDoc(doc(db, "workorders", editingWorkorder.id), {
          patient: selectedPatient,
          medicines: medsPayload,
          instructions: diagnosis,
          doctor: {
            id: user.uid,
            name: user.name,
            email: user.email,
          },
          updatedAt: serverTimestamp(),
        });
      } else {
        const orderId = await getNextOrderId();
        await addDoc(collection(db, "workorders"), {
          orderId,
          patient: selectedPatient,
          medicines: medsPayload,
          instructions: diagnosis,
          doctor: {
            id: user.uid,
            name: user.name,
            email: user.email,
          },
          createdAt: serverTimestamp(),
        });
      }

      await updateMedicineStock(medsPayload);

      navigate("/app/consultations/previous");
    } catch (err) {
      console.error(err);
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const currentStrengthSuggestions =
    COMMON_STRENGTHS_BY_FORM[newMed.dosageForm] || [];

  return (
    <div>
      <h4 className="mb-3">
        {editingWorkorder ? "Edit Prescription" : "New Prescription"}
      </h4>
      <Card className="shadow-sm border-0 mb-4">
        <Card.Body>
          <Form onSubmit={handleSubmit}>

            {/* PATIENT SEARCH */}
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
                    style={{ top: "100%", zIndex: 20, maxHeight: 220, overflowY: "auto"}}
                  >
                    {filteredPatientSuggestions.length > 0 ? (
                      filteredPatientSuggestions.map((p) => (
                        <ListGroup.Item key={p.id} action onClick={() => setSelectedPatient(p)} style={{textTransform:'capitalize' }}>
                          {p.name} ({p.age}y / {p.sex})
                        </ListGroup.Item>
                      ))
                    ) : (
                      <ListGroup.Item className="d-flex justify-content-between">
                        No patient found
                        <Button size="sm" onClick={() => navigate("/app/patients/new")}>
                          Add Patient
                        </Button>
                      </ListGroup.Item>
                    )}
                  </ListGroup>
                )}
              </Form.Group>
            )}

            {/* PATIENT BOX */}
            {selectedPatient && (
              <Card className="mb-3 p-2 bg-light border-0">
                <div className="d-flex justify-content-between">
                  <div style={{textTransform:"capitalize"}}>
                    <strong>{selectedPatient.name}</strong>
                    <div className="small text-muted">
                      {selectedPatient.age} years old / {selectedPatient.sex} from {selectedPatient.address}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => setSelectedPatient(null)}
                  >
                    Change
                  </Button>
                </div>
              </Card>
            )}

            {/* DIAGNOSIS */}
            <Form.Group className="mb-4">
              <Form.Label>Diagnosis / Notes</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </Form.Group>

            {/* MED SEARCH */}
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
                        {m.name} <span className="text-muted small">{m.strength}</span>
                      </ListGroup.Item>
                    ))
                  ) : (
                    <ListGroup.Item className="d-flex justify-content-between">
                      No medicine found
                      <Button
                        size="sm"
                        onClick={() => {
                          setNewMed((p) => ({ ...p, name: medSearch.trim() }));
                          setShowAddMedModal(true);
                        }}
                      >
                        + Add New Medicine
                      </Button>
                    </ListGroup.Item>
                  )}
                </ListGroup>
              )}
            </Form.Group>

            {/* SELECTED MEDICINES */}
            {selectedMeds.length > 0 && (
              <ListGroup className="mt-3">
                {selectedMeds.map((m) => (
                  <ListGroup.Item key={m.id}>
                    <div className="d-flex justify-content-between">
                      <div>
                        <strong>{m.name}</strong>{" "}
                        <span className="text-muted">{m.strength}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline-danger"
                        onClick={() =>
                          setSelectedMeds((prev) => prev.filter((x) => x.id !== m.id))
                        }
                      >
                        Remove
                      </Button>
                    </div>

                    {/* ROW */}
                    <div className="row mt-2">
                      <div className="col-md-2">
                        <Form.Label className="small">Dosage</Form.Label>
                        <Form.Select
                          size="sm"
                          value={m.dosageCount}
                          onChange={(e) =>
                            updateMedField(m.id, "dosageCount", Number(e.target.value))
                          }
                        >
                          {DOSAGE_OPTIONS.map((n) => (
                            <option key={n}>{n}</option>
                          ))}
                        </Form.Select>
                      </div>

                      <div className="col-md-2">
                        <Form.Label className="small">Form</Form.Label>
                        <Form.Select
                          size="sm"
                          value={m.dosageForm}
                          onChange={(e) =>
                            updateMedField(m.id, "dosageForm", e.target.value)
                          }
                        >
                          <option>Tablet</option>
                          <option>Syrup</option>
                          <option>Capsule</option>
                          <option>Injection</option>
                          <option>Ointment</option>
                          <option>Drops</option>
                        </Form.Select>
                      </div>

                      <div className="col-md-3">
                        <Form.Label className="small">Times a Day</Form.Label>
                        <Form.Select
                          size="sm"
                          value={m.timesPerDay}
                          onChange={(e) =>
                            updateMedField(m.id, "timesPerDay", e.target.value)
                          }
                        >
                          {TIMES_OPTIONS.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </Form.Select>
                      </div>

                      <div className="col-md-2">
                        <Form.Label className="small">Days</Form.Label>
                        <Form.Control
                          size="sm"
                          type="number"
                          min="1"
                          value={m.days}
                          onChange={(e) =>
                            updateMedField(m.id, "days", Number(e.target.value))
                          }
                        />
                      </div>

                      <div className="col-md-3">
                        <Form.Label className="small">Pattern</Form.Label>
                        <Form.Control size="sm" value={m.pattern} disabled readOnly />
                      </div>
                    </div>

                    {/* INSTRUCTIONS */}
                    <Form.Group className="mt-2">
                      <Form.Label className="small">Instructions</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        size="sm"
                        value={m.instructions}
                        onChange={(e) =>
                          updateMedField(m.id, "instructions", e.target.value)
                        }
                      />
                    </Form.Group>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}

            <div className="mt-4 d-flex justify-content-end gap-2">
              <Button variant="outline-secondary" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingWorkorder ? "Update Case" : "Create Case"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      {/* ADD NEW MEDICINE MODAL */}
      <Modal show={showAddMedModal} onHide={() => setShowAddMedModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add New Medicine</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Medicine Name</Form.Label>
            <Form.Control
              value={newMed.name}
              onChange={(e) => setNewMed((p) => ({ ...p, name: e.target.value }))}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Category</Form.Label>
            <Form.Select
              value={newMed.category}
              onChange={(e) => setNewMed((p) => ({ ...p, category: e.target.value }))}
            >
              {MEDICINE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Form</Form.Label>
            <Form.Select
              value={newMed.dosageForm}
              onChange={(e) => setNewMed((p) => ({ ...p, dosageForm: e.target.value }))}
            >
              <option>Tablet</option>
              <option>Syrup</option>
              <option>Capsule</option>
              <option>Injection</option>
              <option>Ointment</option>
              <option>Drops</option>
              <option>Inhaler</option>
              <option>Other</option>
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Strength</Form.Label>
            <Form.Control
              value={newMed.strength}
              onChange={(e) => setNewMed((p) => ({ ...p, strength: e.target.value }))}
            />
            {COMMON_STRENGTHS_BY_FORM[newMed.dosageForm]?.length > 0 && (
              <div className="d-flex flex-wrap gap-2 mt-2">
                {COMMON_STRENGTHS_BY_FORM[newMed.dosageForm].map((s) => (
                  <Badge
                    key={s}
                    bg="light"
                    text="dark"
                    style={{ cursor: "pointer" }}
                    onClick={() => setNewMed((p) => ({ ...p, strength: s }))}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </Form.Group>

          <Form.Group>
            <Form.Label>Opening Stock (Required)</Form.Label>
            <Form.Control
              type="number"
              min="0"
              value={newMed.stock}
              onChange={(e) => setNewMed((p) => ({ ...p, stock: e.target.value }))}
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddMedModal(false)}>
            Cancel
          </Button>
          <Button disabled={savingMed} onClick={handleSaveNewMedicine}>
            {savingMed ? "Saving..." : "Save Medicine"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
