export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return base || "track";
}

export function uniqueSlug(input: string, suffix: string | number): string {
  return `${slugify(input)}-${suffix}`;
}
