// src/store/pets.js
import { create } from "zustand";
import api from "../utils/api.js";

/* -------------------- helpers -------------------- */
function normalizeList(resp) {
  const d = resp?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
}

function readMeta(resp, fallback = {}) {
  const d = resp?.data;
  const meta = d?.meta || d?.pagination || {};
  return {
    total: Number(meta.total ?? 0),
    page: Number(meta.page ?? 1),
    limit: Number(meta.limit ?? 12),
    hasNext: Boolean(meta.hasNext ?? false),
    sort: meta.sort || undefined,
    ...fallback,
  };
}

function readTotal(resp, fallbackLen = 0) {
  const d = resp?.data;
  return (
    d?.meta?.total ??
    d?.pagination?.total ??
    (Array.isArray(d) ? d.length : Array.isArray(d?.data) ? d.data.length : fallbackLen)
  );
}

/* ---- payload builders for JSON path ---- */
function toJSONBody(input = {}) {
  const b = { ...input };

  // sanitize strings
  if (typeof b.name === "string") b.name = b.name.trim();
  if (typeof b.city === "string") b.city = b.city.trim();
  if (typeof b.description === "string") b.description = b.description.trim();

  // booleans
  b.vaccinated = !!b.vaccinated;
  b.dewormed   = !!b.dewormed;
  b.sterilized = !!b.sterilized;

  // ageMonths: omit if empty; else number >= 0
  if (b.ageMonths === "" || b.ageMonths == null) {
    delete b.ageMonths;
  } else {
    b.ageMonths = Math.max(0, Number(b.ageMonths));
  }

  // never send files in JSON
  delete b.photos;

  // do NOT send status; let schema default
  delete b.status;

  // drop empty optional strings (breed/description etc.) if ""
  Object.entries(b).forEach(([k, v]) => {
    if (v === "") delete b[k];
  });

  return b;
}

/* -------------------- store -------------------- */
export const usePetsStore = create((set, get) => ({
  // collections
  list: [],
  listMeta: { total: 0, page: 1, limit: 12, hasNext: false, sort: "-createdAt" },

  featured: [],
  adopted: [],
  adoptedCount: 0,
  waitingCount: 0,

  myListings: [],
  myListingsMeta: { total: 0, page: 1, limit: 12, hasNext: false, sort: "-createdAt" },

  // details
  current: null,

  // flags
  loading: false,
  myListingsLoading: false,

  /** List/browse with optional filters (q, species, city, status, etc.) */
  async fetchList(params = {}) {
    set({ loading: true });
    try {
      const resp = await api.get("/pets", { params });
      set({
        list: normalizeList(resp),
        listMeta: readMeta(resp, { sort: params.sort || "-createdAt" }),
      });
    } finally {
      set({ loading: false });
    }
  },

  /** Featured = a few currently-available pets */
  async fetchFeatured() {
    try {
      const resp = await api.get("/pets", {
        params: { status: "available", limit: 6, sort: "-createdAt" },
      });
      set({ featured: normalizeList(resp) });
    } catch (e) {
      console.warn("fetchFeatured failed", e);
      set({ featured: [] });
    }
  },

  /** Success stories (adopted) + count */
  async fetchAdopted() {
    try {
      const resp = await api.get("/pets", {
        params: { status: "adopted", limit: 12, sort: "-updatedAt" },
      });
      const adopted = normalizeList(resp);
      const count = readTotal(resp, adopted.length);
      set({ adopted, adoptedCount: Number(count || 0) });
    } catch (e) {
      console.warn("fetchAdopted failed", e);
      set({ adopted: [], adoptedCount: 0 });
    }
  },

  /** Counts: total adopted + total waiting (available) */
  async fetchCounts() {
    try {
      const [adoptedRes, waitingRes] = await Promise.all([
        api.get("/pets", { params: { status: "adopted", limit: 1 } }),
        api.get("/pets", { params: { status: "available", limit: 1 } }),
      ]);

      set({
        adoptedCount: Number(readTotal(adoptedRes, 0) || 0),
        waitingCount: Number(readTotal(waitingRes, 0) || 0),
      });
    } catch (e) {
      console.warn("fetchCounts failed", e);
    }
  },

  /** Single pet */
  async fetchOne(id) {
    try {
      const resp = await api.get(`/pets/${id}`);
      set({ current: resp?.data?.data || resp?.data || null });
    } catch (e) {
      console.error("fetchOne failed", e);
      set({ current: null });
    }
  },

  /**
   * Create new pet listing.
   * - If called with FormData, post it directly.
   * - Otherwise, build clean JSON and post.
   * Returns created doc or null.
   */
  async create(input) {
    try {
      let resp;

      if (typeof FormData !== "undefined" && input instanceof FormData) {
        // FormData path (photos selected in UI)
        // Do NOT set Content-Type; browser sets multipart boundary.
        resp = await api.post("/pets", input);
      } else {
        // JSON path (no photos)
        const body = toJSONBody(input);
        resp = await api.post("/pets", body);
      }

      const created = resp?.data?.data || null;
      if (created) {
        const mine = get().myListings || [];
        set({ myListings: [created, ...mine] });
      }
      return created;
    } catch (e) {
      console.error("create pet failed", {
        status: e?.response?.status,
        data: e?.response?.data,
      });
      return null;
    }
  },

  /** My listings (auth required) with optional { page, limit, status, sort } */
  async fetchMyListings(params = {}) {
    const page = params.page ?? get().myListingsMeta.page ?? 1;
    const limit = params.limit ?? get().myListingsMeta.limit ?? 12;

    set({ myListingsLoading: true });
    try {
      const resp = await api.get("/pets/mine", {
        params: {
          page,
          limit,
          ...(params.status ? { status: params.status } : {}),
          ...(params.sort ? { sort: params.sort } : {}),
        },
      });

      set({
        myListings: normalizeList(resp),
        myListingsMeta: readMeta(resp, {
          page,
          limit,
          sort: params.sort || "-createdAt",
        }),
      });
    } catch (e) {
      console.warn("fetchMyListings failed", e);
      set({
        myListings: [],
        myListingsMeta: { total: 0, page: 1, limit: 12, hasNext: false, sort: "-createdAt" },
      });
    } finally {
      set({ myListingsLoading: false });
    }
  },
}));
