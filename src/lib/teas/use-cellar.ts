import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  addComment,
  createTea,
  joinCellar,
  leaveCellar,
  listCellar,
  logSteep,
  markNotifiedToday,
  removeComment,
  removeTea,
  renameCellar,
  setNotify,
  setLookupPrefs,
  setCategories,
  switchCellar,
  updateTea,
} from "./api";
import { enqueueSteep, readCache, readQueue, writeCache, writeQueue, type CellarCache } from "./offline";
import type { CellarSettings, LogSteepInput, SharedCellar, Tea, TeaCategory, TeaDraft } from "./types";
import { cloneCategories, defaultCellarSettings } from "./types";

const emptySettings: CellarSettings = defaultCellarSettings();

function mergeSettings(s: CellarSettings | undefined | null): CellarSettings {
  if (!s) return emptySettings;
  return {
    notify: Boolean(s.notify),
    lastNotifiedOn: s.lastNotifiedOn ?? null,
    pullPhotos: s.pullPhotos !== false,
    confirmPhotos: s.confirmPhotos !== false,
    lookupSources: Array.isArray(s.lookupSources) ? s.lookupSources : emptySettings.lookupSources,
    categories: Array.isArray(s.categories) && s.categories.length > 0 ? s.categories : cloneCategories(),
  };
}

export function cellarQueryKey(userId: string | undefined) {
  return ["cellar", userId ?? "none"] as const;
}

export function useCellar() {
  const { user, isPending: authPending } = useCurrentUserState();
  const queryClient = useQueryClient();
  const key = cellarQueryKey(user?.id);
  const userId = user?.id;
  const cacheRef = useRef<CellarCache | null>(null);
  if (cacheRef.current == null && userId) cacheRef.current = readCache(userId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => listCellar(),
    enabled: Boolean(user),
    staleTime: 8_000,
    retry: 1,
  });

  useEffect(() => {
    if (!userId || !query.data) return;
    writeCache(userId, {
      teas: query.data.teas,
      settings: query.data.settings,
      cellar: query.data.cellar,
      meId: query.data.meId,
    });
    cacheRef.current = {
      teas: query.data.teas,
      settings: query.data.settings,
      cellar: query.data.cellar,
      meId: query.data.meId,
      savedAt: new Date().toISOString(),
    };
  }, [userId, query.data]);

  const flushing = useRef(false);
  useEffect(() => {
    if (!userId) return;
    const uid = userId;
    async function flush() {
      if (flushing.current) return;
      const queue = readQueue(uid);
      if (queue.length === 0) return;
      flushing.current = true;
      const remain: typeof queue = [];
      for (const item of queue) {
        try {
          const { queuedAt: _q, ...payload } = item;
          await logSteep({ data: payload });
        } catch {
          remain.push(item);
        }
      }
      writeQueue(uid, remain);
      flushing.current = false;
      if (remain.length !== queue.length) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    }
    void flush();
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [userId, key, queryClient]);

  const cached = cacheRef.current;
  const teas: Tea[] = query.data?.teas ?? cached?.teas ?? [];
  const settings: CellarSettings = mergeSettings(query.data?.settings ?? cached?.settings);
  const cellar: SharedCellar | null = query.data?.cellar ?? cached?.cellar ?? null;
  const meId = query.data?.meId ?? cached?.meId ?? user?.id ?? "";
  const fromCache = !query.data && Boolean(cached);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });

  const addMutation = useMutation({
    mutationFn: (draft: TeaDraft) => createTea({ data: draft }),
    onSuccess: invalidate,
  });
  const updateMutation = useMutation({
    mutationFn: (input: { id: string; patch: Partial<Tea> }) => updateTea({ data: input }),
    onSuccess: invalidate,
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => removeTea({ data: { id } }),
    onSuccess: invalidate,
  });
  const steepMutation = useMutation({
    mutationFn: (input: LogSteepInput) =>
      logSteep({
        data: {
          id: input.id,
          note: input.note ?? "",
          rating: input.rating ?? null,
          vessel: input.vessel ?? "",
          leafGrams: input.leafGrams ?? null,
          waterMl: input.waterMl ?? null,
          waterTemp: input.waterTemp ?? null,
          infusionCount: input.infusionCount ?? null,
          liquorPhotoUrl: input.liquorPhotoUrl ?? "",
          wetLeafPhotoUrl: input.wetLeafPhotoUrl ?? "",
          steepTimes: input.steepTimes ?? [],
          tasteTags: input.tasteTags ?? [],
          steepedAt: input.steepedAt,
        },
      }),
    onSuccess: invalidate,
  });
  const notifyMutation = useMutation({
    mutationFn: (notify: boolean) => setNotify({ data: { notify } }),
    onSuccess: invalidate,
  });
  const lookupPrefsMutation = useMutation({
    mutationFn: (prefs: { pullPhotos: boolean; confirmPhotos: boolean; lookupSources: string[] }) =>
      setLookupPrefs({ data: prefs }),
    onMutate: async (prefs) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<{
        teas: Tea[];
        settings: CellarSettings;
        cellar: SharedCellar | null;
        meId: string;
      }>(key);
      if (prev) {
        queryClient.setQueryData(key, {
          ...prev,
          settings: { ...prev.settings, ...prefs },
        });
      }
      return { prev };
    },
    onError: (_err, _prefs, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });
  const categoriesMutation = useMutation({
    mutationFn: (categories: TeaCategory[]) => setCategories({ data: { categories } }),
    onMutate: async (categories) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<{
        teas: Tea[];
        settings: CellarSettings;
        cellar: SharedCellar | null;
        meId: string;
      }>(key);
      if (prev) {
        queryClient.setQueryData(key, {
          ...prev,
          settings: { ...prev.settings, categories },
        });
      }
      return { prev };
    },
    onError: (_err, _cats, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
    },
    onSettled: invalidate,
  });
  const notifiedMutation = useMutation({
    mutationFn: (day: string) => markNotifiedToday({ data: { day } }),
    onSuccess: invalidate,
  });
  const commentMutation = useMutation({
    mutationFn: (input: { teaId: string; body: string }) => addComment({ data: input }),
    onSuccess: invalidate,
  });
  const removeCommentMutation = useMutation({
    mutationFn: (id: string) => removeComment({ data: { id } }),
    onSuccess: invalidate,
  });
  const joinMutation = useMutation({
    mutationFn: (code: string) => joinCellar({ data: { code } }),
    onSuccess: invalidate,
  });
  const leaveMutation = useMutation({
    mutationFn: () => leaveCellar(),
    onSuccess: invalidate,
  });
  const renameMutation = useMutation({
    mutationFn: (name: string) => renameCellar({ data: { name } }),
    onSuccess: invalidate,
  });
  const switchMutation = useMutation({
    mutationFn: (cellarId: string) => switchCellar({ data: { cellarId } }),
    onSuccess: invalidate,
  });

  return {
    teas,
    settings,
    cellar,
    meId,
    fromCache,
    isLoading: authPending || (Boolean(user) && query.isPending && !cached),
    isError: query.isError && !cached,
    addTea: async (draft: TeaDraft) => {
      const tea = await addMutation.mutateAsync(draft);
      return tea.id;
    },
    updateTea: async (id: string, patch: Partial<Tea>) => {
      await updateMutation.mutateAsync({ id, patch });
    },
    removeTea: async (id: string) => {
      await removeMutation.mutateAsync(id);
    },
    logSteep: async (input: LogSteepInput) => {
      try {
        await steepMutation.mutateAsync(input);
      } catch (err) {
        if (userId && typeof navigator !== "undefined" && !navigator.onLine) {
          enqueueSteep(userId, input);
          return;
        }
        throw err;
      }
    },
    setNotify: async (notify: boolean) => {
      await notifyMutation.mutateAsync(notify);
    },
    setLookupPrefs: async (prefs: { pullPhotos: boolean; confirmPhotos: boolean; lookupSources: string[] }) => {
      await lookupPrefsMutation.mutateAsync(prefs);
    },
    setCategories: async (categories: TeaCategory[]) => {
      await categoriesMutation.mutateAsync(categories);
    },
    markNotifiedToday: (day: string) => {
      void notifiedMutation.mutateAsync(day);
    },
    addComment: async (teaId: string, body: string) => {
      await commentMutation.mutateAsync({ teaId, body });
    },
    removeComment: async (id: string) => {
      await removeCommentMutation.mutateAsync(id);
    },
    joinCellar: async (code: string) => joinMutation.mutateAsync(code),
    leaveCellar: async () => {
      await leaveMutation.mutateAsync();
    },
    renameCellar: async (name: string) => {
      await renameMutation.mutateAsync(name);
    },
    switchCellar: async (cellarId: string) => {
      await switchMutation.mutateAsync(cellarId);
    },
    adding: addMutation.isPending,
    updating: updateMutation.isPending,
    commenting: commentMutation.isPending,
    joining: joinMutation.isPending,
  };
}
