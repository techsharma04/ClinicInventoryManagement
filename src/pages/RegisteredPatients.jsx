// src/pages/RegisteredPatients.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Card, Form, Table, Pagination } from "react-bootstrap";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
const PAGE_SIZE = 10;

export default function RegisteredPatients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const q = query(collection(db, "patients"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPatients(list);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter((p) => {
      const name = p.name?.toLowerCase() || "";
      const address = p.address?.toLowerCase() || "";
      const sex = p.sex?.toLowerCase() || "";
      return (
        name.includes(term) || address.includes(term) || sex.includes(term)
      );
    });
  }, [search, patients]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  useEffect(() => setPage(1), [search]);

  return (
    <div>
      <Card className="shadow-sm border-0">
        <Card.Body>
          <Card.Title>Registered Patients</Card.Title>
          <Form className="mb-3">
            <Form.Control
              placeholder="Search patients by name, address, or gender"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Form>
          <div className="clinic-table-wrapper">
            <Table striped bordered={false} hover responsive size="sm" className="clinic-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Sex</th>
                  <th>Address</th>
                  <th>Registered On</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((p, index) => (
                  <tr key={p.id}>
                    <td>{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td>{p.name}</td>
                    <td>{p.age}</td>
                    <td>{p.sex}</td>
                    <td>{p.address}</td>
                    <td>
                      {p.createdAt?.toDate
                        ? p.createdAt.toDate().toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
                {pageData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center">
                      No patients found
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
          {pageCount > 1 && (
            <Pagination>
              {Array.from({ length: pageCount }).map((_, i) => (
                <Pagination.Item
                  key={i}
                  active={i + 1 === page}
                  onClick={() => setPage(i + 1)}
                >
                  {i + 1}
                </Pagination.Item>
              ))}
            </Pagination>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
