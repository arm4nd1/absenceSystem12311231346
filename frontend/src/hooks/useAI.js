import { useQuery, useMutation } from "@tanstack/react-query";
import api from "../lib/api";

export function useAIInsights() {
  return useQuery({
    queryKey:        ["ai-insights"],
    queryFn:         () => api.get("/ai/insights").then(r => r.data),
    staleTime:       1000 * 60 * 10,  // cache for 10 minutes
    retry:           false,
    enabled:         false,           // only fetch when manually triggered
  });
}

export function useAIChat() {
  return useMutation({
    mutationFn: ({ message, history }) =>
      api.post("/ai/chat", { message, history }).then(r => r.data),
  });
}
