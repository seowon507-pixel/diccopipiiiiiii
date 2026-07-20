const ICON_PATHS = {
  map: (
    <>
      <path d="M3.5 6.4 9 3.8l6 2.4 5.5-2.5v13.9L15 20.2l-6-2.4-5.5 2.5V6.4Z" />
      <path d="M9 3.8v14M15 6.2v14" />
    </>
  ),
  community: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.8 19v-1.2A4.8 4.8 0 0 1 8.6 13h.8a4.8 4.8 0 0 1 4.8 4.8V19" />
      <path d="M15.2 5.4a2.8 2.8 0 0 1 0 5.4M16.2 13.3a4.2 4.2 0 0 1 4 4.2V19" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5.5h11.5a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H9l-4.5 3v-3.4A3 3 0 0 1 2 12.2V8.5a3 3 0 0 1 2-3Z" />
      <path d="M7 9.2h6.5M7 12h4" />
    </>
  ),
  menu: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </>
  ),
  compose: (
    <>
      <path d="m4 20 4.1-1 10.7-10.7a2.2 2.2 0 0 0-3.1-3.1L5 15.9 4 20Z" />
      <path d="m14.5 6.5 3 3M12 20h8" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.8 12h16.4M12 3.5c2.2 2.3 3.3 5.1 3.3 8.5S14.2 18.2 12 20.5C9.8 18.2 8.7 15.4 8.7 12S9.8 5.8 12 3.5Z" />
    </>
  ),
  location: (
    <>
      <path d="M19 10.2c0 5.1-7 10.3-7 10.3S5 15.3 5 10.2a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  bell: (
    <>
      <path d="M5.5 17h13l-1.7-2.2V10a4.8 4.8 0 0 0-9.6 0v4.8L5.5 17Z" />
      <path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  key: (
    <>
      <circle cx="8.2" cy="12" r="4.2" />
      <path d="M12.4 12H21M17.5 12v3M20 12v2" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5.4c0 4.4-2.7 7.5-7 9.1-4.3-1.6-7-4.7-7-9.1V6l7-2.5Z" />
      <path d="m8.7 12 2.1 2.1 4.5-4.6" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  pin: (
    <>
      <path d="M6 9.5a6 6 0 0 1 12 0c0 4.4-6 10-6 10s-6-5.6-6-10Z" />
      <circle cx="12" cy="9.5" r="2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16M7 12h10M10 18h4" />
      <circle cx="8" cy="6" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="12" cy="18" r="1.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20v-1.2A5 5 0 0 1 10 13.8h4a5 5 0 0 1 5 5V20" />
    </>
  ),
}

function AppIcon({ name, size = 24, className = '' }) {
  return (
    <svg
      className={`app-icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name] ?? ICON_PATHS.menu}
    </svg>
  )
}

export default AppIcon
