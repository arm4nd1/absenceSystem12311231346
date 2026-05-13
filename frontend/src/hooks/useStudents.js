import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";

export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn:  () => api.get("/students").then(r => r.data),
  });
}

export function useStudent(id) {
  return useQuery({
    queryKey: ["students", id],
    queryFn:  () => api.get(`/students/${id}`).then(r => r.data),
    enabled:  !!id,
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post("/students", data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/students/${id}`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/students/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}

export function useAssignFingerprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fingerprintId }) =>
      api.patch(`/students/${id}/fingerprint`, { fingerprintId }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students"] }),
  });
}
