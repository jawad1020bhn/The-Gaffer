import { useId, useRef, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { playUiCue } from "../../lib/uiSound";

export interface ChoiceCardOption<V extends string> {
  value: V;
  label: string;
  description: string;
  icon?: React.ReactNode;
}

interface ChoiceCardsProps<V extends string> {
  label: string;
  options: ReadonlyArray<ChoiceCardOption<V>>;
  value: V;
  onChange: (value: V) => void;
  columns?: "two" | "four";
}

/** Large console-style radio cards: one tab stop, arrow keys move the choice. */
export default function ChoiceCards<V extends string>({
  label,
  options,
  value,
  onChange,
  columns = "two",
}: ChoiceCardsProps<V>) {
  const labelId = useId();
  const refs = useRef(new Map<V, HTMLButtonElement>());

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!delta) return;
    event.preventDefault();
    const next = options[(index + delta + options.length) % options.length];
    playUiCue("move");
    onChange(next.value);
    refs.current.get(next.value)?.focus();
  }

  return (
    <fieldset className="min-w-0">
      <legend
        id={labelId}
        className="mb-3 font-heading text-lead font-bold uppercase tracking-label text-fg"
      >
        {label}
      </legend>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={`grid gap-3 ${columns === "four" ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2"}`}
      >
        {options.map((option, index) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              ref={(node) => {
                if (node) refs.current.set(option.value, node);
                else refs.current.delete(option.value);
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => {
                playUiCue("move");
                onChange(option.value);
              }}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`group relative flex min-h-28 flex-col gap-2 rounded-panel border p-4 text-left transition-colors duration-150 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page ${
                checked
                  ? "border-selected bg-selected-tint"
                  : "border-line bg-panel hover:border-line-strong hover:bg-hover"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span
                  className={`font-heading text-lead font-bold uppercase tracking-label ${checked ? "text-selected" : "text-fg"}`}
                >
                  {option.label}
                </span>
                {checked ? (
                  <Check className="h-5 w-5 shrink-0 text-selected" aria-hidden="true" />
                ) : (
                  option.icon
                )}
              </span>
              <span className="text-body text-fg-muted">{option.description}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
