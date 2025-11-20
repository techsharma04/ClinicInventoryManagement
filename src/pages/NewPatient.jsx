// src/pages/NewPatient.jsx
import React, { useState } from "react";
import { Card, Form, Button } from "react-bootstrap";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";

export default function NewPatient() {
  const { user } = useSelector((s) => s.auth);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    age: "",
    sex: "",
    address: "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name required";
    if (!form.age.trim()) e.age = "Age required";
    else if (isNaN(Number(form.age))) e.age = "Age must be a number";
    if (!form.sex.trim()) e.sex = "Sex required";
    if (!form.address.trim()) e.address = "Address required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const savePatient = async (mode = "save") => {
    if (!validate()) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "patients"), {
        name: form.name.trim(),
        age: Number(form.age),
        sex: form.sex,
        address: form.address.trim(),
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
        doctorName: user?.name || "",
        doctorEmail: user?.email || "",
      });

      if (mode === "save-create") {
        navigate("/app/consultations/new", {
          state: { patientId: ref.id },
        });
      } else {
        setForm({ name: "", age: "", sex: "", address: "" });
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save patient");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    savePatient("save");
  };

  return (
    <div>
      <h4 className="mb-3">New Patient</h4>
      <Card className="shadow-sm border-0">
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Patient Name</Form.Label>
              <Form.Control
                placeholder="Enter patient's full name"
                value={form.name}
                isInvalid={!!errors.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
              <Form.Control.Feedback type="invalid">
                {errors.name}
              </Form.Control.Feedback>
            </Form.Group>

            <div className="row">
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Age</Form.Label>
                  <Form.Control
                    placeholder="Enter age in years"
                    value={form.age}
                    isInvalid={!!errors.age}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, age: e.target.value }))
                    }
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.age}
                  </Form.Control.Feedback>
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Sex</Form.Label>
                  <Form.Select
                    value={form.sex}
                    isInvalid={!!errors.sex}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sex: e.target.value }))
                    }
                  >
                    <option value="">Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">
                    {errors.sex}
                  </Form.Control.Feedback>
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>Address</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Enter full address"
                value={form.address}
                isInvalid={!!errors.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
              />
              <Form.Control.Feedback type="invalid">
                {errors.address}
              </Form.Control.Feedback>
            </Form.Group>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <Button
                variant="secondary"
                type="button"
                disabled={saving}
                onClick={() => savePatient("save")}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="primary"
                type="button"
                disabled={saving}
                onClick={() => savePatient("save-create")}
              >
                {saving ? "Saving..." : "Save & Create Case"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
