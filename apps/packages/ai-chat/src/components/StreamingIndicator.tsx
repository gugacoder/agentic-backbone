export function StreamingIndicator() {
  return (
    <span
      className="inline-block w-2 h-4 align-text-bottom bg-current animate-pulse"
      aria-label="Gerando resposta..."
      role="status"
    >
      |
    </span>
  );
}
