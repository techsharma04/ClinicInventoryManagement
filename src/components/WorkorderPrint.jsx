// src/components/WorkorderPrint.jsx
import React, { forwardRef } from "react";
import "../styles/print.css";
import logo from "../assets/images/hospital-logo.png";

const WorkorderPrint = forwardRef(({ data }, ref) => {
  if (!data) return null;

  const {
    orderId,
    patient,
    medicines = [],
    doctor,
    instructions,
    createdAt,
  } = data;

  const doctorName =
    doctor?.name || doctor?.email || "Doctor (Unavailable)";

  const dateStr = createdAt?.toDate
    ? createdAt.toDate().toLocaleDateString()
    : new Date().toLocaleDateString();

  return (
    <div ref={ref} className="print-container">
      <div className="print-header">
        <img
          src={logo}
          className="print-logo"
          alt="Hospital Logo"
          crossOrigin="anonymous"
        />
        <div>
          <h2>CityCare Hospital</h2>
          <p>123 Healthcare Avenue, Toronto</p>
          <p>Phone: (416) 555-2024</p>
        </div>
      </div>

      <hr />

      <h3 className="print-title">Doctor Recommendation Slip</h3>

      <div className="print-section">
        <p>
          <strong>Order ID:</strong> {orderId}
        </p>
        <p>
          <strong>Date:</strong> {dateStr}
        </p>
        <p>
          <strong>Doctor:</strong> {doctorName}
        </p>
      </div>

      <h4 className="print-subtitle">Patient Details</h4>
      <div className="print-section">
        <p>
          <strong>Name:</strong> {patient?.name}
        </p>
        <p>
          <strong>Age:</strong> {patient?.age}
        </p>
        <p>
          <strong>Sex:</strong> {patient?.sex}
        </p>
        <p>
          <strong>Address:</strong> {patient?.address}
        </p>
      </div>

      <h4 className="print-subtitle">Medicines</h4>
      <table className="print-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Medicine</th>
            <th>Strength</th>
            <th>Dose</th>
            <th>Times / Day</th>
            <th>Pattern</th>
            <th>Instructions</th>
          </tr>
        </thead>
        <tbody>
          {medicines.map((m, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{m.name}</td>
              <td>{m.strength}</td>
              <td>
                {m.dosageCount} {m.dosageForm}
              </td>
              <td>{m.timesPerDay}</td>
              <td>{m.pattern}</td>
              <td>{m.instructions}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {instructions && (
        <>
          <h4 className="print-subtitle">General Instructions</h4>
          <div className="print-section">
            <p>{instructions}</p>
          </div>
        </>
      )}

      <div className="print-footer">
        <p>
          <strong>Doctor Signature:</strong> ___________________________
        </p>
      </div>
    </div>
  );
});

export default WorkorderPrint;
