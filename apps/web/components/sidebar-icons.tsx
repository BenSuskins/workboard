/**
 * Sidebar glyphs as one consistent 16px stroke set. Unicode symbols were close
 * enough to read but never matched each other in weight or baseline.
 */
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

export function BoardIcon() {
  return (
    <Icon>
      <rect x="2" y="2.5" width="12" height="11" rx="2" />
      <path d="M2 6.5h12M6.5 6.5v7" />
    </Icon>
  );
}

export function InboxIcon() {
  return (
    <Icon>
      <path d="M2 8.5V4a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 14 4v4.5" />
      <path d="M2 8.5h3l1 2h4l1-2h3v3a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" />
    </Icon>
  );
}

export function PullRequestIcon() {
  return (
    <Icon>
      <circle cx="4" cy="4" r="1.75" />
      <circle cx="4" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <path d="M4 5.75v4.5M12 10.25V7a2 2 0 0 0-2-2H7.5" />
      <path d="m9 3.5 -1.5 1.5L9 6.5" />
    </Icon>
  );
}

export function DigestIcon() {
  return (
    <Icon>
      <path d="M3 3.5h10M3 6.5h10M3 9.5h7M3 12.5h5" />
    </Icon>
  );
}

export function TriageIcon() {
  return (
    <Icon>
      <path d="M3.5 14V2.5" />
      <path d="M3.5 3h7l-1.2 2.25L10.5 7.5h-7z" />
    </Icon>
  );
}

export function AccomplishmentsIcon() {
  return (
    <Icon>
      <circle cx="8" cy="8" r="5.75" />
      <path d="m5.5 8 1.75 1.75L10.5 6.5" />
    </Icon>
  );
}

export function SearchIcon() {
  return (
    <Icon>
      <circle cx="7.25" cy="7.25" r="4.25" />
      <path d="m10.5 10.5 2.75 2.75" />
    </Icon>
  );
}

export function ComposeIcon() {
  return (
    <Icon>
      <path d="M11.5 2.5a1.6 1.6 0 0 1 2.25 2.25L6.5 12 3.5 12.75 4.25 9.75z" />
    </Icon>
  );
}

export function CollapseIcon() {
  return (
    <Icon>
      <rect x="2" y="2.5" width="12" height="11" rx="2" />
      <path d="M6 2.5v11" />
    </Icon>
  );
}

/**
 * Theme glyphs. These were "☀"/"☾", which several platforms promote to a full
 * emoji — a yellow sun in an otherwise monochrome rail. Drawn in the same
 * stroke set, they inherit currentColor like every other icon here.
 */
export function LightModeIcon() {
  return (
    <Icon>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.75M8 12.75v1.75M14.5 8h-1.75M3.25 8H1.5M12.6 3.4l-1.25 1.25M4.65 11.35 3.4 12.6M12.6 12.6l-1.25-1.25M4.65 4.65 3.4 3.4" />
    </Icon>
  );
}

export function DarkModeIcon() {
  return (
    <Icon>
      <path d="M13.5 9.6A5.75 5.75 0 0 1 6.4 2.5a5.75 5.75 0 1 0 7.1 7.1z" />
    </Icon>
  );
}

/** Stands in until the client knows which theme is active — same 16px footprint. */
export function ThemePendingIcon() {
  return (
    <Icon>
      <circle cx="8" cy="8" r="5.5" />
    </Icon>
  );
}
