import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";

export function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn:  () => api.get("/subjects").then(r => r.data),
  });
}

export function useSubject(id) {
  return useQuery({
    queryKey: ["subjects", id],
    queryFn:  () => api.get(`/subjects/${id}`).then(r => r.data),
    enabled:  !!id,
  });
}

export function useCreateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post("/subjects", data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["subjects"] }),
  });
}

export function useUpdateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/subjects/${id}`, data).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["subjects"] }),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/subjects/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["subjects"] }),
  });
}

export function useEnrollStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subjectId, studentId }) =>
      api.post(`/subjects/${subjectId}/enroll`, { studentId }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useUnenrollStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subjectId, studentId }) =>
      api.post(`/subjects/${subjectId}/unenroll`, { studentId }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });
}
