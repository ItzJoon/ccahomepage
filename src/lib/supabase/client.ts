import { createBrowserClient } from "@supabase/ssr";
import { isPreviewModeActive } from "./previewMode";

// 브라우저 전체에서 클라이언트를 하나만 재사용합니다 (중복 생성 방지)
let client: ReturnType<typeof createBrowserClient> | undefined;

const PREVIEW_BLOCK_MESSAGE = "미리보기 모드에서는 이 작업을 할 수 없습니다.";
const MUTATING_METHODS = ["insert", "update", "upsert", "delete"];

/** "글쓰기/좋아요/체크인"처럼 콘텐츠를 만들거나 바꾸는 진짜 쓰기 액션이 아니라, 화면에
 * "이미 봤다"는 개인 열람 상태만 기록하는 테이블들 — 항상 auth.uid()=user_id로만 쓸 수
 * 있게 RLS가 걸려 있어 미리보기 계정 자기 자신 것만 건드릴 수 있고, 이걸 막으면 패치노트
 * 팝업의 "확인"이 실패해서 페이지를 옮길 때마다 같은 팝업이 계속 다시 뜨는 등 미리보기
 * 세션 자체가 "새 학생" 체험을 흉내 내지 못하게 된다. 그래서 이 테이블들만 예외로 둔다. */
const READ_TRACKING_TABLES = new Set(["board_post_reads", "patch_note_reads"]);

/** insert/update/upsert/delete 이후 어떤 메서드가 이어져 체이닝돼도(.select().single() 등)
 * 항상 같은 객체를 반환하고, await/.then()하면 "차단됨" 에러로 즉시 resolve되는 가짜
 * 빌더. 실제 네트워크 요청은 전혀 나가지 않는다. */
function createBlockedBuilder(): any {
  const result = { data: null, error: { message: PREVIEW_BLOCK_MESSAGE, code: "PREVIEW_MODE_BLOCKED" }, count: null, status: 403, statusText: "Preview Mode" };
  const proxy: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") return (resolve: (v: typeof result) => void) => resolve(result);
        if (prop === "catch" || prop === "finally") return () => proxy;
        return () => proxy;
      },
    }
  );
  return proxy;
}

function notifyBlocked() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("preview-write-blocked", { detail: { message: PREVIEW_BLOCK_MESSAGE } }));
  }
}

/** .from(table)이 돌려준 쿼리 빌더를 감싸서, 미리보기 세션일 때만 쓰기 메서드를
 * 가로챈다 — 읽기(select 등)는 그대로 실제 서버로 나간다(미리보기 계정 자신의 진짜
 * 데이터를 읽어야 하므로). */
function wrapQueryBuilder(builder: any, table: string) {
  if (READ_TRACKING_TABLES.has(table)) return builder;
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (MUTATING_METHODS.includes(prop as string) && isPreviewModeActive()) {
        return (..._args: unknown[]) => {
          notifyBlocked();
          return createBlockedBuilder();
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/** storage.from(bucket)도 같은 방식으로 upload/remove/move/copy를 막는다. */
function wrapStorageBucket(bucket: any) {
  return new Proxy(bucket, {
    get(target, prop, receiver) {
      if (["upload", "update", "remove", "move", "copy"].includes(prop as string) && isPreviewModeActive()) {
        return async (..._args: unknown[]) => {
          notifyBlocked();
          return { data: null, error: { message: PREVIEW_BLOCK_MESSAGE } };
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

function wrapClient(real: ReturnType<typeof createBrowserClient>) {
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) => wrapQueryBuilder((target.from as any)(table), table);
      }
      if (prop === "rpc" && isPreviewModeActive()) {
        return (..._args: unknown[]) => {
          notifyBlocked();
          return createBlockedBuilder();
        };
      }
      if (prop === "storage") {
        const storage = target.storage;
        return new Proxy(storage, {
          get(storageTarget, storageProp, storageReceiver) {
            if (storageProp === "from") {
              return (bucket: string) => wrapStorageBucket((storageTarget.from as any)(bucket));
            }
            return Reflect.get(storageTarget, storageProp, storageReceiver);
          },
        });
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as ReturnType<typeof createBrowserClient>;
}

export function createClient() {
  if (client) return client;
  const real = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  // auth 메서드(setSession 등)는 이 Proxy가 손대지 않는 target의 다른 프로퍼티라
  // 그대로 통과한다 — 세션 전환 자체는 미리보기 모드 판단과 무관하게 항상 동작해야 한다.
  client = wrapClient(real);
  return client;
}
