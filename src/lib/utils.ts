import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Blocks "." and "," so users cannot type decimals into integer quantity fields. */
export function preventDecimalInput(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "." || e.key === ",") e.preventDefault();
}
