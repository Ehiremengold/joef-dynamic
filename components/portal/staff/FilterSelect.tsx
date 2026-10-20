"use client";

/** A labelled dropdown for narrowing a staff list (Students, Exams). */
export default function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[13px] font-semibold text-graphite">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="mt-1 w-full cursor-pointer rounded-btn border border-smoke bg-white px-3 py-2.5 text-sm font-normal text-ink outline-none focus:border-brand-navy disabled:cursor-not-allowed disabled:bg-mist disabled:text-pewter"
      >
        {children}
      </select>
    </label>
  );
}
