'use client';

interface Props {
  reportType: 'MOVE_IN' | 'MOVE_OUT' | 'INSPECTION';
  photoCount: number;
  checklistCount: number;
}

const MOVE_IN_OUT_MIN_PHOTOS = 6;
const MOVE_IN_OUT_MIN_CHECKLIST = 4;
const INSPECTION_MIN_PHOTOS = 1;

export default function ConditionEvidenceProgress({
  reportType,
  photoCount,
  checklistCount,
}: Props) {
  const isStrict = reportType !== 'INSPECTION';
  const minPhotos = isStrict ? MOVE_IN_OUT_MIN_PHOTOS : INSPECTION_MIN_PHOTOS;
  const minChecklist = isStrict ? MOVE_IN_OUT_MIN_CHECKLIST : 0;

  const photoProgress = Math.min(photoCount / minPhotos, 1);
  const photoMet = photoCount >= minPhotos;

  const checklistProgress =
    minChecklist > 0 ? Math.min(checklistCount / minChecklist, 1) : 1;
  const checklistMet = checklistCount >= minChecklist;

  return (
    <div className="space-y-3 py-3">
      {/* Photos progress */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-white/60">Photos</span>
          <span
            className={`text-xs font-semibold ${photoMet ? 'text-[#4ade80]' : 'text-[#E8B84B]'}`}
          >
            {photoCount} / {minPhotos} minimum
          </span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${photoMet ? 'bg-green-500' : 'bg-amber-400'}`}
            style={{ width: `${photoProgress * 100}%` }}
          />
        </div>
      </div>

      {/* Checklist progress — only for move-in/out */}
      {isStrict && (
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium text-white/60">
              Evidence areas
            </span>
            <span
              className={`text-xs font-semibold ${checklistMet ? 'text-[#4ade80]' : 'text-[#E8B84B]'}`}
            >
              {checklistCount} / {minChecklist} required
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${checklistMet ? 'bg-green-500' : 'bg-amber-400'}`}
              style={{ width: `${checklistProgress * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
