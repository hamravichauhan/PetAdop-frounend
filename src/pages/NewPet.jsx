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
    species: "dog",
    otherSpecies: "",
    breed: "",
    gender: "unknown",          // align with model enum/default
    ageMonths: "",
    size: "medium",             // avoid enum "" problem
    city: "",
    vaccinated: false,
    dewormed: false,
    sterilized: false,
    description: "",
  });

  const [files, setFiles] = React.useState([]);      // File[]
  const [previews, setPreviews] = React.useState([]); // object URLs
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");

  const update = (k, v) => setData((s) => ({ ...s, [k]: v }));

  // build previews + cleanup
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
      // Build multipart/form-data for file upload + fields
      const fd = new FormData();

      fd.append("name", data.name);
      fd.append("species", data.species);

      if (data.species === "other") {
        // required by model when species="other"
        fd.append("otherSpecies", data.otherSpecies.trim());
      }

      if (data.breed) fd.append("breed", data.breed);
      fd.append("gender", data.gender); // includes "unknown"
      if (data.ageMonths !== "") {
        const age = Math.max(0, Number(data.ageMonths));
        fd.append("ageMonths", String(age));
      }
      if (data.size) fd.append("size", data.size);
      if (data.city) fd.append("city", data.city);
      if (data.description) fd.append("description", data.description);

      // Booleans as strings; server can coerce ("true"/"false")
      fd.append("vaccinated", String(data.vaccinated));
      fd.append("dewormed", String(data.dewormed));
      fd.append("sterilized", String(data.sterilized));

      // Status default is "available" on the model, so we don't need to send it.

      // Files
      files.forEach((file) => fd.append("photos", file)); // field name "photos"

      const ok = await create(fd); // your store should POST fd without manually setting Content-Type
      if (ok) nav("/pets");
    } catch (err) {
      console.error(err);
      setError("Failed to publish this pet. Please try again.");
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
            <option value="bird">Bird</option>
            <option value="other">Other</option>
          </select>

          {/* Only show when "Other" */}
          {data.species === "other" && (
            <Input
              placeholder="What species?"
              value={data.otherSpecies}
              onChange={(e) => update("otherSpecies", e.target.value)}
              required
            />
          )}

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
            <option value="unknown">Unknown</option>
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
