"use client";

import type { NormalizedDiseaseDetail, NormalizedInsectDetail } from "@/types/analysis";
import { ncpmsHtmlToLines } from "@/lib/sanitizeNcpmsHtml";

type PestDetailKind = "disease" | "insect";

interface PestDetailModalProps {
  kind: PestDetailKind;
  fallbackTitle: string;
  detail: NormalizedDiseaseDetail | NormalizedInsectDetail | null;
  onClose: () => void;
}

function TextRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-text">{value}</dd>
    </div>
  );
}

function MultilineRow({ label, value }: { label: string; value: string | null }) {
  const lines = ncpmsHtmlToLines(value);
  if (lines.length === 0) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 space-y-1 text-sm text-text">
        {lines.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </dd>
    </div>
  );
}

function ListRow({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-text">{values.join(", ")}</dd>
    </div>
  );
}

function ImageRow({
  label,
  images,
}: {
  label: string;
  images: { url: string; title: string | null }[];
}) {
  if (images.length === 0) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 flex flex-wrap gap-2">
        {images.map((image, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${image.url}-${index}`}
            src={image.url}
            alt={image.title ?? label}
            className="h-20 w-20 rounded-lg object-cover"
          />
        ))}
      </dd>
    </div>
  );
}

function DiseaseDetailBody({ detail }: { detail: NormalizedDiseaseDetail }) {
  return (
    <dl className="space-y-4">
      <TextRow label="병 한글명" value={detail.nameKor || null} />
      <TextRow label="병 영문명" value={detail.nameEng} />
      <MultilineRow label="전염경로" value={detail.infectionRoute} />
      <MultilineRow label="발생생태" value={detail.developmentCondition} />
      <MultilineRow label="병 증상" value={detail.symptoms} />
      <MultilineRow label="방제방법" value={detail.preventionMethod} />
      <MultilineRow label="생물학적 방제방법" value={detail.biologicalControlMethod} />
      <MultilineRow label="화학적 방제방법" value={detail.chemicalControlMethod} />
      <ListRow label="병원체 이름" values={detail.pathogenNames} />
      <ImageRow label="병 피해 이미지" images={detail.diseaseImages} />
    </dl>
  );
}

function InsectDetailBody({ detail }: { detail: NormalizedInsectDetail }) {
  const naturalEnemyNames = detail.naturalEnemies
    .map((enemy) => enemy.nameKor ?? enemy.speciesName)
    .filter((name): name is string => Boolean(name));

  return (
    <dl className="space-y-4">
      <TextRow label="해충 한국종명" value={detail.speciesNameKor || null} />
      <TextRow label="학명" value={detail.speciesName} />
      <TextRow label="목명" value={detail.orderName} />
      <TextRow label="과명" value={detail.familyName} />
      <MultilineRow label="분포정보" value={detail.distributionInfo} />
      <MultilineRow label="형태정보" value={detail.morphologyInfo} />
      <MultilineRow label="검역정보" value={detail.quarantineInfo} />
      <MultilineRow label="생태정보" value={detail.ecologyInfo} />
      <MultilineRow label="피해정보" value={detail.damageInfo} />
      <MultilineRow label="방제방법" value={detail.preventionMethod} />
      <MultilineRow label="생물학적 방제방법" value={detail.biologicalControlMethod} />
      <MultilineRow label="화학적 방제방법" value={detail.chemicalControlMethod} />
      <ImageRow label="해충 이미지" images={detail.pestImages} />
      <ListRow label="천적곤충 정보" values={naturalEnemyNames} />
    </dl>
  );
}

export default function PestDetailModal({ kind, fallbackTitle, detail, onClose }: PestDetailModalProps) {
  const title =
    detail === null ? fallbackTitle : kind === "disease" ? (detail as NormalizedDiseaseDetail).nameKor || fallbackTitle : (detail as NormalizedInsectDetail).speciesNameKor || fallbackTitle;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-text">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full px-2 py-1 text-muted hover:bg-background hover:text-text"
          >
            ✕
          </button>
        </div>

        {detail === null ? (
          <p className="text-sm text-muted">이 항목의 상세정보를 불러오지 못했습니다.</p>
        ) : kind === "disease" ? (
          <DiseaseDetailBody detail={detail as NormalizedDiseaseDetail} />
        ) : (
          <InsectDetailBody detail={detail as NormalizedInsectDetail} />
        )}
      </div>
    </div>
  );
}
