import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";

export function useMarks(subjectId, semester) {
  return useQuery({
    queryKey: ["marks", subjectId, semester],
    queryFn:  () =>
      api.get("/marks", { params: { subjectId, semester } }).then(r => r.data),
    enabled: !!subjectId && !!semester,
  });
}

export function useUpsertMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentId, subjectId, scores, semester }) =>
      api.put(`/marks/${studentId}/${subjectId}`, { scores, semester }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marks"] }),
  });
}

export function useDeleteMark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/marks/${id}`).then(r => r.data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["marks"] }),
  });
}

export function useMarksSummary(semester) {
  return useQuery({
    queryKey: ["marks-summary", semester],
    queryFn:  () =>
      api.get("/marks/summary", { params: { semester } }).then(r => r.data),
    enabled: !!semester,
  });
}

export function useUpdateGradeComponents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subjectId, gradeComponents }) =>
      api.patch(`/subjects/${subjectId}/grade-components`, { gradeComponents }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects"] }),
  });
}
