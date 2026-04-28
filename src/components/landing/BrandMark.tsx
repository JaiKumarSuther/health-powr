export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/healthPowr-logo.png"
      alt="HealthPowr"
      className={className ?? "h-9 w-9"}
      loading="eager"
      draggable={false}
    />
  );
}

