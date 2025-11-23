// src/pages/InventoryReconciliation.jsx
import React, { useEffect, useState } from "react";
import { Card, Button, Spinner } from "react-bootstrap";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { useSelector } from "react-redux";
import { db } from "../firebase";

export default function InventoryReconciliation() {
  const { user } = useSelector((s) => s.auth);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [fixing, setFixing] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const medSnap = await getDocs(collection(db, "medicines"));
      const invSnap = await getDocs(collection(db, "inventory"));

      const medicines = [];
      medSnap.forEach((d) => medicines.push({ id: d.id, ...d.data() }));
      const inventory = [];
      invSnap.forEach((d) => inventory.push({ id: d.id, ...d.data() }));

      const medById = new Map(medicines.map((m) => [m.id, m]));
      let missingInventory = 0;
      let missingMedicine = 0;
      let mismatchedMeta = 0;

      inventory.forEach((inv) => {
        const med = medById.get(inv.medicineId);
        if (!med) {
          missingMedicine++;
        } else {
          if (
            inv.name !== med.name ||
            inv.strength !== med.strength ||
            inv.form !== med.dosageForm ||
            inv.category !== med.category
          ) {
            mismatchedMeta++;
          }
        }
      });

      const invByMed = new Map();
      inventory.forEach((inv) => {
        if (!inv.medicineId) return;
        const arr = invByMed.get(inv.medicineId) || [];
        arr.push(inv);
        invByMed.set(inv.medicineId, arr);
      });

      invByMed.forEach((arr) => {
        if (arr.length === 0) return;
        const med = medById.get(arr[0].medicineId);
        if (!med) {
          missingInventory++;
          return;
        }
      });

      setSummary({
        medicineCount: medicines.length,
        inventoryCount: inventory.length,
        missingInventory,
        missingMedicine,
        mismatchedMeta,
      });
    } catch (err) {
      console.error(err);
      alert("Failed to load reconciliation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const runFixMetadata = async () => {
    if (!window.confirm("Sync inventory metadata from medicines?")) return;
    setFixing(true);
    try {
      const medSnap = await getDocs(collection(db, "medicines"));
      const invSnap = await getDocs(collection(db, "inventory"));

      const medById = new Map();
      medSnap.forEach((d) => medById.set(d.id, { id: d.id, ...d.data() }));

      const updates = [];
      invSnap.forEach((d) => {
        const inv = { id: d.id, ...d.data() };
        const med = medById.get(inv.medicineId);
        if (!med) return;
        if (
          inv.name !== med.name ||
          inv.strength !== med.strength ||
          inv.form !== med.dosageForm ||
          inv.category !== med.category
        ) {
          updates.push({ invId: inv.id, med });
        }
      });

      for (const u of updates) {
        await updateDoc(doc(db, "inventory", u.invId), {
          name: u.med.name,
          strength: u.med.strength,
          form: u.med.dosageForm,
          category: u.med.category,
        });
      }

      alert(`Synced ${updates.length} inventory records.`);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to fix metadata.");
    } finally {
      setFixing(false);
    }
  };

  return (
    <div>
      <Card className="shadow-sm border-0">
        <Card.Body>
          <Card.Title>Inventory Reconciliation</Card.Title>
          {loading || !summary ? (
            <div className="py-4 text-center">
              <Spinner animation="border" />
            </div>
          ) : (
            <>
              <p className="text-muted small mb-3">
                Compare medicine master data with inventory and fix mismatches.
              </p>
              <ul className="small mb-3">
                <li>Total medicines: {summary.medicineCount}</li>
                <li>Total inventory records: {summary.inventoryCount}</li>
                <li>Inventory with missing medicine: {summary.missingMedicine}</li>
                <li>Inventory with mismatched metadata: {summary.mismatchedMeta}</li>
              </ul>
              <Button
                variant="outline-primary"
                onClick={runFixMetadata}
                disabled={fixing}
              >
                {fixing ? "Syncing..." : "Sync inventory metadata from medicines"}
              </Button>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
