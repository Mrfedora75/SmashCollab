export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        fill="var(--color-accent)"
        d="M0.6 20.2C6 22.1 10.6 23 16 23s10-0.9 15.4-2.8C26.4 19.1 21.4 18.4 16 18.4S5.6 19.1 0.6 20.2z"
      />
      <path
        fill="var(--color-accent)"
        d="M8.4 19.6V12.2C8.4 8.8 10.7 6.6 13.1 6.2C14.1 8.5 14.9 10 16 10C17.1 10 17.9 8.5 18.9 6.2C21.3 6.6 23.6 8.8 23.6 12.2V19.6H8.4z"
      />
      <path d="M9 15.8h14" stroke="#141210" strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  );
}
