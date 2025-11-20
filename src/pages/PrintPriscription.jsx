// src/pages/PrintPrescription.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Spinner } from "react-bootstrap";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import "../styles/print.css";
import logo from "../assets/images/hospital-logo.png";

const formatPrescriptionDate = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const months = [
        "JAN",
        "FEB",
        "MAR",
        "APR",
        "MAY",
        "JUN",
        "JUL",
        "AUG",
        "SEP",
        "OCT",
        "NOV",
        "DEC",
    ];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
};

export default function PrintPrescription() {
    const { id } = useParams(); // workorder id
    const navigate = useNavigate();

    const [workorder, setWorkorder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, "workorders", id));
                if (!snap.exists()) {
                    setError("Consultation not found.");
                } else {
                    setWorkorder({ id: snap.id, ...snap.data() });
                }
            } catch (err) {
                console.error(err);
                setError("Failed to load consultation.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="rx-page d-flex align-items-center justify-content-center">
                <Spinner animation="border" />
            </div>
        );
    }

    if (error || !workorder) {
        return (
            <div className="rx-page d-flex flex-column align-items-center justify-content-center">
                <p className="text-danger mb-3">{error || "Something went wrong."}</p>
                <Button variant="secondary" onClick={() => navigate(-1)}>
                    Back
                </Button>
            </div>
        );
    }

    const {
        patient = {},
        doctor = {},
        medicines = [],
        instructions,
        orderId,
        createdAt,
    } = workorder;

    const doctorName = doctor.name || doctor.email || "Dr.";
    const doctorPhone = "+91 96469-68788"; // fixed as per your details

    const dateStr = formatPrescriptionDate(
        createdAt?.toDate ? createdAt.toDate() : new Date()
    );

    const patientContact = patient.phone || patient.contact || "";

    const getTimingFromPattern = (pattern) => {
        if (!pattern) return "";

        // Example: "1--x--1" OR "3--3--3"
        const parts = pattern.split("--");

        // Ensure exactly 3 slots
        if (parts.length !== 3) return "";

        const [morning, afternoon, evening] = parts;

        const result = [];

        if (morning && morning !== "x") {
            result.push(`${morning} – Morning`);
        }

        if (afternoon && afternoon !== "x") {
            result.push(`${afternoon} – Afternoon`);
        }

        if (evening && evening !== "x") {
            result.push(`${evening} – Evening`);
        }

        return result.join(", ");
    };


    return (
        <div className="rx-page">
            <div className="rx-sheet">
                {/* HEADER */}
                <div>
                    <header className="rx-header">
                        <div className="rx-header-left">
                            <div className="rx-clinic-name">LIFE KARE HOSPITAL</div>
                            <div className="rx-clinic-line">
                                3-4-5, Nirankari Colony, Amritsar
                            </div>
                            <div className="rx-clinic-line">
                                lifekarehospital@gmail.com &nbsp;|&nbsp; www.lifekarehospital.in
                            </div>
                        </div>
                        <div className="rx-header-right">
                            <div className="rx-logo-circle">
                                <img
                                    src={logo}
                                    alt="Hospital Logo"
                                    crossOrigin="anonymous"
                                />
                            </div>
                        </div>
                    </header>

                    {/* BODY */}
                    <main className="rx-body">
                        {/* Doc info + prescription meta */}
                        <div>

                            <hr className="rx-divider" />

                            <div className="rx-top-info">
                                <div className="rx-doctor-block">
                                    <div className="rx-doctor-name">Dr. Raghu Sharma, MD</div>
                                    <div className="rx-doctor-phone">{doctorPhone}</div>
                                </div>
                                <div className="rx-meta-block">
                                    <div className="rx-meta-row">
                                        <span className="rx-meta-label">Prescription no.:</span>
                                        <span className="rx-meta-value">#{orderId}</span>
                                    </div>
                                    <div className="rx-meta-row">
                                        <span className="rx-meta-label">Date:</span>
                                        <span className="rx-meta-value">{dateStr}</span>
                                    </div>
                                </div>
                            </div>

                            <hr className="rx-divider" />

                            <div className="rx-patient-row">
                                <div className="rx-patient-label">Patient:</div>
                                <div className="rx-patient-value">{patient.name} ({patient.age}y, {patient.sex}) from {patient.address} </div>
                            </div>
                            {/* Medicines list */}
                            <section className="rx-meds-section">

                                <table className="rx-med-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: "40px" }}>#</th>
                                            <th>Medicine</th>
                                            <th>Dosage</th>
                                            <th>Timing – Frequency – Duration</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {medicines.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="text-muted text-center py-3">
                                                    No medicines added.
                                                </td>
                                            </tr>
                                        )}

                                        {medicines.map((m, index) => {
                                            return (
                                                <tr key={index}>
                                                    {/* Numbering */}
                                                    <td><strong>{index + 1}</strong></td>

                                                    {/* Medicine Name in Bold */}
                                                    <td>
                                                        <strong>{m.name}&nbsp;({m.strength})</strong>
                                                        <br />
                                                        <strong style={{ fontSize: 12, color: '#464545' }}>Timings: {getTimingFromPattern(m.pattern)}</strong>
                                                    </td>

                                                    {/* Dosage Pattern */}
                                                    <td>
                                                        {m.pattern ? (
                                                            <span>{m.pattern}</span>
                                                        ) : (
                                                            <span className="text-muted">—</span>
                                                        )}
                                                    </td>

                                                    {/* Timing – Frequency – Duration */}
                                                    <td>
                                                        <strong style={{ fontWeight: 400 }}>{m.timesPerDay} - {m.instructions}</strong>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* General Instructions */}
                                {instructions && (
                                    <div className="mt-3">
                                        <strong>Diagnose & Remarks:</strong>
                                        <p className="mt-1" style={{ whiteSpace: "pre-line" }}>
                                            {instructions}
                                        </p>
                                    </div>
                                )}
                            </section>

                        </div>

                    </main>
                </div>
                {/* FOOTER BAR */}
                <footer className="rx-footer">
                    <div className="rx-footer-item">
                        <i className="bi bi-telephone rx-footer-icon" />
                        <span>+91 9216172500</span>
                    </div>
                    <div className="rx-footer-item">
                        <i className="bi bi-envelope rx-footer-icon" />
                        <span>lifekarehospital@gmail.com</span>
                    </div>
                    <div className="rx-footer-item">
                        <i className="bi bi-globe rx-footer-icon" />
                        <span>www.lifekarehospital.in</span>
                    </div>
                </footer>
            </div>

            {/* Buttons – hidden on print */}
            <div className="rx-actions">
                <Button variant="secondary" onClick={() => navigate(-1)}>
                    Back
                </Button>
                <Button variant="primary" onClick={handlePrint}>
                    Print Now
                </Button>
            </div>
        </div>
    );
}
