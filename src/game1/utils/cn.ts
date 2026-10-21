export type ClassValue = string | number | boolean | undefined | null | { [key: string]: any } | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const flat = (arr: ClassValue[]): string[] =>
    arr.flatMap((x) => (Array.isArray(x) ? flat(x) : typeof x === 'string' ? [x] : []));
  return flat(inputs).filter(Boolean).join(' ');
}
