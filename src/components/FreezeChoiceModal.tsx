export default function FreezeChoiceModal({
  streak,
  streakIfUsed,
  freezeCredits,
  onUse,
  onSkip,
}: {
  streak: number;
  streakIfUsed: number;
  freezeCredits: number;
  onUse: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl px-6 py-5 shadow-lg text-center max-w-sm">
        <div className="text-3xl mb-1">🧊</div>
        <div className="font-bold">어제 접속을 못 하셨네요</div>
        <p className="text-sm text-muted mt-1.5">
          프리즈를 사용하면 연속 {streakIfUsed}일 기록을 유지할 수 있어요
          <br />
          (보유 프리즈: {freezeCredits}개)
        </p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onSkip}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-bold text-muted border border-border"
          >
            사용 안 함
          </button>
          <button
            onClick={onUse}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-bold bg-navy text-white"
          >
            프리즈 사용
          </button>
        </div>
      </div>
    </div>
  );
}
