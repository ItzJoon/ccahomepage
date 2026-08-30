import nodemailer from "nodemailer";

// Gmail SMTP(앱 비밀번호 방식)로 발송한다. 서버리스(Vercel) 환경에서는 함수 호출마다
// 새 인스턴스가 뜰 수 있어 커넥션이 매번 재사용되지는 않지만, 한 번의 발송 요청 안에서
// 여러 통을 보낼 때는 pool: true + maxConnections로 TLS 핸드셰이크를 줄여준다.
// rateLimit/rateDelta는 Gmail 계정의 발송 한도(일반 계정 기준 하루 약 500통)를 넘기지
// 않도록 초당 발송 개수를 직접 제한한다 — "몇 통씩 나눠서 발송" 요구사항을 nodemailer
// 내장 옵션만으로 처리한다.
let transporter: nodemailer.Transporter | null = null;

export function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD 환경변수가 설정되어 있지 않습니다.");
  }
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5, // 초당 최대 5통
  });
  return transporter;
}
