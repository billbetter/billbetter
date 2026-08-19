import { PasswordStrength } from "@/components/ui/password-strength";
import { useId, useState } from "react";

export function PasswordStrengthDemo() {
  const id = useId();
  const [value, setValue] = useState("");

  return (
    <div className="mx-auto w-full max-w-[320px]">
      <label
        htmlFor={id}
        className="block text-[13px] font-medium text-sand-700 dark:text-sand-200"
      >
        New password
      </label>

      <input
        id={id}
        type="password"
        value={value}
        autoComplete="new-password"
        spellCheck={false}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type a password"
        className="mt-1.5 h-10 w-full rounded-[10px] border-2 border-sand-200 bg-sand-100/70 px-3 text-[13px] text-sand-700 shadow-[inset_0_1px_2px_rgba(28,25,23,0.07)] outline-none transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-sand-500 focus:border-[#4568FF] focus:bg-surface focus:shadow-none focus-visible:outline-none dark:border-content-inverted/[0.08] dark:bg-[#1D1D1A] dark:text-sand-200 dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)] dark:placeholder:text-sand-500 dark:focus:border-[#93B0FF] dark:focus:bg-[#252522]"
      />

      <PasswordStrength value={value} className="mt-3" />
    </div>
  );
}

export default PasswordStrengthDemo;
