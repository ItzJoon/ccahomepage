import { NextResponse } from "next/server";

/**
 * 홈 화면 헤더의 날씨 위젯용 API. 기상청 공공데이터포털 "단기예보 조회서비스"의
 * 초단기실황(getUltraSrtNcst, 기온/강수형태)과 초단기예보(getUltraSrtFcst, 하늘상태)를
 * 함께 조회해 하나의 응답으로 합친다.
 *
 * fetch에 next.revalidate를 줘서 Next.js Data Cache가 이 외부 API 응답을 캐시하므로,
 * 여러 사용자가 동시에 접속해도 이 캐시 기간 안에는 기상청 API를 한 번만 호출하고
 * 결과를 공유한다(요청마다 새로 호출하지 않음).
 */
export const revalidate = 1800;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEATHER_CACHE_SECONDS = 1800;

// 기상청 격자(위경도 -> 격자 X/Y) 변환 — Lambert Conformal Conic 투영 공식(기상청 제공
// 알고리즘 그대로). 아래 SUWON_LAT/LON은 "수원시 장안구청" 좌표인데, 이 공식에 넣으면
// 정확히 nx=60, ny=121이 나오는 것을 확인하고 골랐다(수원 지역의 표준 격자점으로 널리
// 쓰이는 값과 일치).
const RE = 6371.00877;
const GRID = 5.0;
const SLAT1 = 30.0;
const SLAT2 = 60.0;
const OLON = 126.0;
const OLAT = 38.0;
const XO = 43;
const YO = 136;
const SUWON_LAT = 37.3006;
const SUWON_LON = 127.0097;

function toGrid(lat: number, lon: number): { nx: number; ny: number } {
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + (lat * DEGRAD) * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

const { nx, ny } = toGrid(SUWON_LAT, SUWON_LON);

/**
 * 초단기실황/초단기예보 모두 매시 정각 관측·발표 자료를 담아 API에 반영하기까지 시간이
 * 걸린다(대략 40~45분 이후에 안전하게 조회 가능). 그래서 현재 분이 45분 미만이면 아직
 * 이번 시각 자료가 안 올라왔을 수 있다고 보고 한 시간 전 자료를 요청한다.
 */
function getBaseDateTime() {
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  let hour = nowKst.getUTCHours();
  let dateForBase = nowKst;
  if (nowKst.getUTCMinutes() < 45) {
    dateForBase = new Date(nowKst.getTime() - 60 * 60 * 1000);
    hour = dateForBase.getUTCHours();
  }
  const y = dateForBase.getUTCFullYear();
  const m = String(dateForBase.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dateForBase.getUTCDate()).padStart(2, "0");
  return { base_date: `${y}${m}${d}`, base_time: `${String(hour).padStart(2, "0")}00` };
}

interface KmaItem {
  category: string;
  obsrValue?: string;
  fcstValue?: string;
  fcstTime?: string;
}

async function fetchKma(endpoint: string, base_date: string, base_time: string) {
  const serviceKey = process.env.WEATHER_API_KEY;
  if (!serviceKey) throw new Error("WEATHER_API_KEY가 설정되지 않았습니다.");

  // serviceKey는 공공데이터포털에서 이미 URL 인코딩된 형태로 발급되므로, 다시
  // encodeURIComponent를 거치면 %가 두 번 인코딩돼(%25로) 인증에 실패한다 — 그대로 붙인다.
  const params = new URLSearchParams({
    pageNo: "1",
    numOfRows: "60",
    dataType: "JSON",
    base_date,
    base_time,
    nx: String(nx),
    ny: String(ny),
  });
  const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/${endpoint}?serviceKey=${serviceKey}&${params.toString()}`;

  const res = await fetch(url, { next: { revalidate: WEATHER_CACHE_SECONDS } });
  if (!res.ok) throw new Error(`기상청 API 응답 오류(${endpoint}): ${res.status}`);
  const json = await res.json();
  const resultCode = json?.response?.header?.resultCode;
  if (resultCode !== "00") {
    throw new Error(`기상청 API 오류(${endpoint}): ${resultCode} ${json?.response?.header?.resultMsg}`);
  }
  return (json.response.body.items.item ?? []) as KmaItem[];
}

type Sky = "clear" | "cloudy";
type Pty = "none" | "rain" | "rainsnow" | "snow" | "shower";

const PTY_MAP: Record<string, Pty> = {
  "0": "none",
  "1": "rain",
  "2": "rainsnow",
  "3": "snow",
  "4": "shower",
  "5": "rain",
  "6": "rainsnow",
  "7": "snow",
};

export async function GET() {
  try {
    const { base_date, base_time } = getBaseDateTime();

    const [ncstItems, fcstItems] = await Promise.all([
      fetchKma("getUltraSrtNcst", base_date, base_time),
      fetchKma("getUltraSrtFcst", base_date, base_time),
    ]);

    const t1h = ncstItems.find((i) => i.category === "T1H")?.obsrValue;
    const ptyRaw = ncstItems.find((i) => i.category === "PTY")?.obsrValue ?? "0";
    // 초단기예보는 앞으로 6시간 분량을 한 번에 내려주므로, 그중 가장 이른(현재와 가장
    // 가까운) 시각의 SKY 값을 쓴다.
    const skyItems = fcstItems.filter((i) => i.category === "SKY").sort((a, b) => (a.fcstTime ?? "").localeCompare(b.fcstTime ?? ""));
    const skyRaw = skyItems[0]?.fcstValue ?? "1";

    if (t1h === undefined) throw new Error("기온 데이터를 찾을 수 없습니다.");

    const sky: Sky = skyRaw === "1" ? "clear" : "cloudy";
    const pty: Pty = PTY_MAP[ptyRaw] ?? "none";

    return NextResponse.json(
      { ok: true, temp: Math.round(Number(t1h)), sky, pty },
      { headers: { "Cache-Control": `public, max-age=0, s-maxage=${WEATHER_CACHE_SECONDS}, stale-while-revalidate` } }
    );
  } catch (error) {
    // 기상청 서버 오류/키 만료/격자 오류 등 무엇이 됐든 사이트 전체에 영향을 주면 안 되므로,
    // 항상 200으로 "실패했다"는 사실만 조용히 돌려준다 — 클라이언트는 ok:false면 위젯을 숨긴다.
    console.error("[weather] failed:", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
