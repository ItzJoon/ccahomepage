export default function CheckInToast({ streak }: { streak: number }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none px-4">
      <div className="bg-navy text-white rounded-2xl px-6 py-5 shadow-lg text-center">
        <div className="text-3xl mb-1">🔥</div>
        <div className="font-bold">오늘 접속 체크 완료!</div>
        <div className="text-sm text-[#C9D2E3] mt-0.5">연속 {streak}일째</div>
      </div>
    </div>
  );
}
