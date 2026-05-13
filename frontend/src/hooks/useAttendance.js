import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, onSnapshot, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import api from "../lib/api";
import { useEffect, useState } from "react";

// ── REST queries ──────────────────────────────────────────────────────────────

export function useAttendance(params = {}) {
  return useQuery({
    queryKey: ["attendance", params],
    queryFn:  () => api.get("/attendance", { params }).then(r => r.data),
  });
}

export function useAttendanceSummary() {
  return useQuery({
    queryKey:        ["attendance-summary"],
    queryFn:         () => api.get("/attendance/summary").then(r => r.data),
    refetchInterval: 30_000,
  });
}

export function useAttendanceReport(subjectId, startDate, endDate) {
  return useQuery({
    queryKey: ["attendance-report", subjectId, startDate, endDate],
    queryFn:  () =>
      api.get("/attendance/report", { params: { subjectId, startDate, endDate } })
         .then(r => r.data),
    enabled: !!subjectId,
  });
}

export function useUpdateAttendanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) =>
      api.patch(`/attendance/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
}

export function useCreateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post("/attendance", data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
  });
}

export function useDeleteAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/attendance/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
}

// ── Real-time Firestore listener ──────────────────────────────────────────────

export function useRealtimeAttendance(subjectId, dateStr) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use only a single equality where clause to avoid requiring composite indexes.
    // Secondary filtering and sorting is done client-side.
    let q;

    if (subjectId && dateStr) {
      // Filter by subjectId only (no orderBy) — date filtered client-side
      q = query(
        collection(db, "attendance"),
        where("subjectId", "==", subjectId),
        limit(200)
      );
    } else if (subjectId) {
      q = query(
        collection(db, "attendance"),
        where("subjectId", "==", subjectId),
        limit(100)
      );
    } else if (dateStr) {
      q = query(
        collection(db, "attendance"),
        where("date", "==", dateStr),
        limit(200)
      );
    } else {
      q = query(
        collection(db, "attendance"),
        limit(50)
      );
    }

    const unsub = onSnapshot(q, snap => {
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Client-side date filter when both subjectId and dateStr are provided
      if (subjectId && dateStr) {
        docs = docs.filter(d => d.date === dateStr);
      }

      // Sort by timestamp descending client-side
      docs.sort((a, b) => {
        const ta = a.timestamp?.seconds ?? (a.timestamp?.toDate?.()?.getTime?.() ?? 0) / 1000;
        const tb = b.timestamp?.seconds ?? (b.timestamp?.toDate?.()?.getTime?.() ?? 0) / 1000;
        return tb - ta;
      });

      setRecords(docs);
      setLoading(false);
    }, (err) => {
      console.error("Firestore listener error:", err.message);
      if (err.message?.includes("permission")) {
        console.warn(
          "%c[AttendFP] Firestore permission denied.\n" +
          "Go to Firebase Console → Firestore → Rules and set:\n" +
          "  allow read, write: if request.auth != null;",
          "color: orange; font-weight: bold"
        );
      }
      setLoading(false);
    });

    return unsub;
  }, [subjectId, dateStr]);

  return { records, loading };
}
