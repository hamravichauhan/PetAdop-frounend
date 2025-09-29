// src/pages/NewPet.jsx
import React from "react";
import Input from "../components/ui/Input.jsx";
import Textarea from "../components/ui/Textarea.jsx";
import Button from "../components/ui/Button.jsx";
import { usePetsStore } from "../store/pets.js";
import { useNavigate } from "react-router-dom";

export default function NewPet() {
  const nav = useNavigate();
  const { create } = usePetsStore();

  const [data, setData] = React.useState({
    name: "",
    species: "dog",   // must be one of: dog | cat | rabbit | other
    breed: "",
    gender: "male",   // must be one of: male | female
    ageMonths: "",
    size: "medium",   // small | medium | large (defaulted to avoid empty)
    city: "",
    vaccinated: false,
    dewormed: false,
    sterilized: false,
    description: "",
  });

  const [files, setFiles] = React.useState([]);       // File[]
  const [previews, setPreviews] = React.useState([]); // object URLs
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  const update = (k, v) => setData((s) => ({ ...s, [k]: v }));

  // previews + cleanup
  React.useEffect(() => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const handleFiles = (fileList) => {
    const picked = Array.from(fileList || []);
    const MAX = 5;
    const next = [...files, ...picked].slice(0, MAX);
    setFiles(next);
  };

  const removeFileAt = (idx) => {
    setFiles((arr) => arr.filter((_, i) => i !== idx));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      // quick client-side validation to avoid 400s
      if (!data.name?.trim()) throw new Error("Name is required");
      if (!data.species) throw new Error("Species is required");
      if (!["dog", "cat", "rabbit", "other"].includes(data.species))
        throw new Error("Invalid species");
      if (!data.gender) throw new Error("Gender is required");
      if (!["male", "female"].includes(data.gender))
        throw new Error("Invalid gender");
      if (!data.size) throw new Error("Size is required");
      if (!["small", "medium", "large"].includes(data.size))
        throw new Error("Invalid size");
      if (!data.city?.trim()) throw new Error("City is required");

      // Build a clean payload (do not send status; backend default applies)
      const clean = {
        name: data.name.trim(),
        species: data.species,
        breed: data.breed || "",
        gender: data.gender,
        ...(data.ageMonths === "" ? {} : { ageMonths: Math.max(0, Number(data.ageMonths)) }),
        size: data.size,
        city: data.city.trim(),
        vaccinated: !!data.vaccinated,
        dewormed: !!data.dewormed,
        sterilized: !!data.sterilized,
        description: data.description?.trim() || "",
      };

      let payload;

      if (files.length > 0) {
        // multipart for photos
        payload = new FormData();
        Object.entries(clean).forEach(([k, v]) => {
          if (v === "" || v == null) return; // skip empties
          payload.append(k, typeof v === "boolean" ? String(v) : v);
        });
        files.forEach((file) => payload.append("photos", file)); // field name must be "photos"
      } else {
        // JSON when no files
        payload = clean;
      }

      const created = await create(payload); // store should not force Content-Type for FormData
      if (created) nav("/pets");
    } catch (err) {
      console.error("create pet failed", err);
      setError(
        err?.response?.data?.errors?.[0]?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to publish this pet. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-3xl font-bold">List a pet for adoption</h1>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            placeholder="Name"
            value={data.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />

          <select
            className="rounded-2xl bg-muted/60 px-4 py-2.5"
            value={data.species}
            onChange={(e) => update("species", e.target.value)}
          >
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="rabbit">Rabbit</option>
            <option value="other">Other</option>
          </select>

          <Input
            placeholder="Breed"
            value={data.breed}
            onChange={(e) => update("breed", e.target.value)}
          />

          <select
            className="rounded-2xl bg-muted/60 px-4 py-2.5"
            value={data.gender}
            onChange={(e) => update("gender", e.target.value)}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>

          <Input
            placeholder="Age in months"
            type="number"
            min="0"
            value={data.ageMonths}
            onChange={(e) => update("ageMonths", e.target.value)}
          />

          <select
            className="rounded-2xl bg-muted/60 px-4 py-2.5"
            value={data.size}
            onChange={(e) => update("size", e.target.value)}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>

          <Input
            placeholder="City"
            value={data.city}
            onChange={(e) => update("city", e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.vaccinated}
              onChange={(e) => update("vaccinated", e.target.checked)}
            />
            Vaccinated
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.dewormed}
              onChange={(e) => update("dewormed", e.target.checked)}
            />
            Dewormed
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={data.sterilized}
              onChange={(e) => update("sterilized", e.target.checked)}
            />
            Sterilized
          </label>
        </div>

        <Textarea
          placeholder="Description"
          rows={5}
          value={data.description}
          onChange={(e) => update("description", e.target.value)}
        />

        {/* Photos */}
        <div>
          <label className="mb-2 block text-sm">Photos (up to 5)</label>
          <input
            name="photos"
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {previews.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {previews.map((src, i) => (
                <div
                  key={i}
                  className="relative h-24 w-32 overflow-hidden rounded-xl border"
                >
                  <img
                    src={src}
                    alt={`Selected ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1 rounded-md bg-black/50 px-1.5 py-0.5 text-xs text-white hover:bg-black/70"
                    onClick={() => removeFileAt(i)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 text-xs text-mutedForeground">
            {files.length} file{files.length !== 1 ? "s" : ""} selected
            {files.length >= 5 && " (maximum reached)"}
          </div>
        </div>

        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? "Publishing…" : "Publish"}
        </Button>
      </form>
    </div>
  );
}
