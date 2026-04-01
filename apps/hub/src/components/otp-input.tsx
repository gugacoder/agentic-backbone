import { useRef, useCallback, type ClipboardEvent, type KeyboardEvent, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";

interface OtpInputProps {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
}

export function OtpInput({ length = 6, onComplete, disabled }: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const getCode = () => inputsRef.current.map((el) => el?.value ?? "").join("");

  const handleChange = useCallback(
    (index: number, e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/\D/g, "");
      e.target.value = value.slice(-1);
      if (value && index < length - 1) {
        inputsRef.current[index + 1]?.focus();
      }
      const code = getCode();
      if (code.length === length && !code.includes("")) {
        onComplete(code);
      }
    },
    [length, onComplete],
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !e.currentTarget.value && index > 0) {
        inputsRef.current[index - 1]?.focus();
      }
    },
    [],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
      pasted.split("").forEach((char, i) => {
        if (inputsRef.current[i]) {
          inputsRef.current[i]!.value = char;
        }
      });
      const nextIndex = Math.min(pasted.length, length - 1);
      inputsRef.current[nextIndex]?.focus();
      if (pasted.length === length) {
        onComplete(pasted);
      }
    },
    [length, onComplete],
  );

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }, (_, i) => (
        <Input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          className="w-12 h-14 text-center text-lg font-mono"
          style={{ minWidth: 44, minHeight: 44 }}
          disabled={disabled}
          aria-label={`Dígito ${i + 1} de ${length}`}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}
