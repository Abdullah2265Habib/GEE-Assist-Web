/** The spinning-globe GIF from the assets, on a white disc so its white background fits every theme. */
export default function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="globe-badge">
        <img src="/media/earth-globe-icon.gif" alt="" width={56} height={56} />
      </span>
      <span>{label}</span>
    </div>
  );
}
