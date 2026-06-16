import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function fileName(filePath?: string): string {
  if (!filePath) return "";
  return filePath.split(/[\\/]/).pop() || filePath;
}

export function fileUrl(filePath?: string): string {
  if (!filePath) return "";
  return `roboneo-asset://local/file?path=${encodeURIComponent(filePath)}`;
}
