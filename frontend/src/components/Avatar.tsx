const PALETTE = ["#178ac7", "#444441", "#639922", "#993c1d", "#534ab7", "#0f6e56", "#993556"];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/);
  if (words.length === 0 || words[0] === "") return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface AvatarProps {
  name: string;
  size?: "sm" | "lg";
}

export function Avatar({ name, size = "sm" }: AvatarProps) {
  const color = PALETTE[hashString(name) % PALETTE.length];
  return (
    <div
      className={size === "lg" ? "avatar avatar-lg" : "avatar"}
      style={{ background: color }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
