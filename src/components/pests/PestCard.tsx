export default function PestCard({
  thumbnailUrl,
  nameKor,
  subtitle,
  cropName,
  onDetail,
}: {
  thumbnailUrl: string | null;
  nameKor: string;
  subtitle: string | null;
  cropName: string | null;
  onDetail: () => void;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-lg bg-background">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={nameKor} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-muted">이미지 없음</span>
        )}
      </div>

      <h4 className="text-sm font-semibold text-text">{nameKor}</h4>
      {subtitle && <p className="mt-0.5 text-xs italic text-muted">{subtitle}</p>}
      {cropName && <p className="mt-1 text-xs text-muted">작물: {cropName}</p>}

      <button
        type="button"
        onClick={onDetail}
        className="mt-3 rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-status-good-bg"
      >
        상세보기
      </button>
    </div>
  );
}
