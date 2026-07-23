export default function LocationInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (address: string) => void;
}) {
  return (
    <div>
      <label htmlFor="location-address" className="mb-2 block text-sm font-medium text-text">
        지역
      </label>
      <input
        id="location-address"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="예: 전북 고창군"
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-text placeholder:text-muted focus:border-primary focus:outline-none"
      />
    </div>
  );
}
