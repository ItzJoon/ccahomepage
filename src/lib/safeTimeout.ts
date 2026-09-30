// setTimeout의 delay는 내부적으로 32비트 부호 있는 정수로 저장돼서 약 24.8일
// (2^31-1ms)을 넘기면 오버플로가 나 delay가 사실상 0이 된 것처럼 즉시 실행돼버린다.
// "한 달간 노출" 같은 알림 자동 만료 타이머에서 실제로 이 문제가 발생했다(노출 기간이
// 24.8일을 넘는 순간 뜨자마자 바로 닫혀버림). 안전한 상한선 안에서 여러 번 다시
// 예약해서, 아무리 긴 delay라도 정확히 그 시각에 콜백이 실행되도록 한다.
const MAX_SAFE_DELAY_MS = 2_147_483_000; // 2^31-1보다 살짝 여유 있게 낮춘 값

export function scheduleSafeTimeout(callback: () => void, delayMs: number): () => void {
  if (delayMs <= 0) {
    callback();
    return () => {};
  }
  if (delayMs <= MAX_SAFE_DELAY_MS) {
    const id = setTimeout(callback, delayMs);
    return () => clearTimeout(id);
  }
  const id = setTimeout(() => {
    cancelNext = scheduleSafeTimeout(callback, delayMs - MAX_SAFE_DELAY_MS);
  }, MAX_SAFE_DELAY_MS);
  let cancelNext = () => clearTimeout(id);
  return () => cancelNext();
}
