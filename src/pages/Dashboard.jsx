// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { Card, Row, Col } from "react-bootstrap";
import { collection, getCountFromServer, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function Dashboard() {
  const [counts, setCounts] = useState({
    medicines: 0,
    workorders: 0,
    patients: 0,
    male: 0,
    female: 0,
    others: 0,
    loading: true,
  });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const medsRef = collection(db, "medicines");
        const woRef = collection(db, "workorders");
        const patientsRef = collection(db, "patients");

        const [medsSnap, woSnap, patientsCountSnap, patientsDocsSnap] =
          await Promise.all([
            getCountFromServer(medsRef),
            getCountFromServer(woRef),
            getCountFromServer(patientsRef),
            getDocs(patientsRef),
          ]);

        let male = 0;
        let female = 0;
        let others = 0;

        patientsDocsSnap.forEach((doc) => {
          const sex = (doc.data().sex || "").toLowerCase();
          if (sex === "male") male++;
          else if (sex === "female") female++;
          else others++;
        });

        setCounts({
          medicines: medsSnap.data().count,
          workorders: woSnap.data().count,
          patients: patientsCountSnap.data().count,
          male,
          female,
          others,
          loading: false,
        });
      } catch (err) {
        console.error(err);
        setCounts((c) => ({ ...c, loading: false }));
      }
    };
    fetchCounts();
  }, []);

  const loadingText = counts.loading ? "..." : null;

  return (
    <div>
      <h4 className="mb-4">Dashboard</h4>
      <Row className="g-3">
        <Col md={4}>
          <Card className="dashboard-card">
            <Card.Body className="dashboard-card-body">
              <div className="dashboard-card-title">Medicines</div>
              <div className="dashboard-card-value">
                {loadingText || counts.medicines}
              </div>
              <div className="dashboard-card-meta">
                Total medicines in inventory
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="dashboard-card">
            <Card.Body className="dashboard-card-body">
              <div className="dashboard-card-title">Consultations</div>
              <div className="dashboard-card-value">
                {loadingText || counts.workorders}
              </div>
              <div className="dashboard-card-meta">
                Total prescriptions created
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="dashboard-card">
            <Card.Body className="dashboard-card-body">
              <div className="dashboard-card-title">Patients</div>
              <div className="dashboard-card-value">
                {loadingText || counts.patients}
              </div>
              {!counts.loading && (
                <div className="dashboard-card-meta">
                  Male: <strong>{counts.male}</strong> &nbsp;|&nbsp; Female:{" "}
                  <strong>{counts.female}</strong> &nbsp;|&nbsp; Others:{" "}
                  <strong>{counts.others}</strong>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
