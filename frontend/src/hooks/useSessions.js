import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";

export function useActiveSessions() {
  return useQuery({
    queryKey:        ["sessions-active"],
    queryFn:         () => api.get("/sessions/active").then(r => r.data),
    refetchInterval: 10_000,
  });
}

export function useSessionHistory(subjectId) {
  return useQuery({
    queryKey: ["sessions-history", subjectId],
    queryFn:  () =>
      api.get("/sessions/history", { params: { subjectId, limit: 30 } }).then(r => r.data),
  });
}

export function useBridgeStatus() {
  return useQuery({
    queryKey:        ["bridge-status"],
    queryFn:         () => api.get("/sessions/bridge").then(r => r.data),
    refetchInterval: 5_000,
    retry:           false,
  });
}

export function useOpenSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subjectId) =>
      api.post("/sessions/open", { subjectId }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions-active"] });
      qc.invalidateQueries({ queryKey: ["bridge-status"] });
    },
  });
}

export function useCloseSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/sessions/close").then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions-active"] });
      qc.invalidateQueries({ queryKey: ["bridge-status"] });
    },
  });
}

export function useEnrollFingerprint() {
  return useMutation({
    mutationFn: (fp_id) =>
      api.post("/sessions/enroll", { fp_id }).then(r => r.data),
  });
}

export function useDeleteFingerprint() {
  return useMutation({
    mutationFn: (fp_id) =>
      api.post("/sessions/delete-fp", { fp_id }).then(r => r.data),
  });
}
