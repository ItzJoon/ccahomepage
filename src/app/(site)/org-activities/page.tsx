"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/hooks/useRealtimeList";
import SectionTitle from "@/components/SectionTitle";
import Badge from "@/components/Badge";
import type { Organization, OrgEvent, OrgRecord, Proposal, ProposalVote, Member } from "@/lib/types";

const STATUS_LABEL: Record<Proposal["status"], string> = {
  review: "검토 중",
  approved: "승인",
  rejected: "반려",
  completed: "완료",
};
const STATUS_CLASS: Record<Proposal["status"], string> = {
  review: "bg-[#FFF3DC] text-gold",
  approved: "bg-[#E4F5EE] text-teal",
  rejected: "bg-[#FDEBEC] text-red",
  completed: "bg-[#EAF0FB] text-blue",
};

const EVENT_CATEGORY_LABEL: Record<OrgEvent["category"], string> = {
  meeting: "회의",
  event: "행사",
  deadline: "마감",
  general: "일반",
};

const RECORD_CATEGORY_LABEL: Record<OrgRecord["category"], string> = {
  notice: "공지",
  activity: "활동",
  minutes: "회의록",
};
const RECORD_CATEGORY_COLOR: Record<OrgRecord["category"], "navy" | "teal" | "gold"> = {
  notice: "navy",
  activity: "teal",
  minutes: "gold",
};

// "학생회 임원회" 역할이 아직 role/조직 체계에 정식으로 없어서(9/1 회의에서 확정 예정,
// 이슈 #21), 우선 학생회 전체를 이끄는 두 조직(학생회장단/CCHS 총학생회) 소속 여부로
// 판단한다. 나중에 임원회가 별도 role이나 조직으로 확정되면 이 목록만 바꾸면 된다.
const EXECUTIVE_ORG_NAMES = ["학생회장단", "CCHS 총학생회"];

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${fmt(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}


export default function OrgActivitiesPage() {
  const [tab, setTab] = useState<"proposals" | "events" | "records" | "executive">("proposals");
  const { rows: orgs } = useRealtimeList<Organization>("organizations", { orderBy: { column: "order_index" } });
  const { rows: members } = useRealtimeList<Member>("members");
  const [orgFilter, setOrgFilter] = useState("all");
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  const executiveOrgIds = orgs.filter((o) => EXECUTIVE_ORG_NAMES.includes(o.name)).map((o) => o.id);
  const isExecutive = !!userId && members.some((m) => m.user_id === userId && executiveOrgIds.includes(m.org_id));

  return (
    <div>
      <SectionTitle eyebrow="ORGANIZATIONS" title="조직 활동" />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex border border-border rounded-lg overflow-hidden">
          <button
            className={`px-3.5 py-1.5 text-sm font-semibold ${tab === "proposals" ? "bg-navy text-white" : "bg-white"}`}
            onClick={() => setTab("proposals")}
          >
            안건함
          </button>
          <button
            className={`px-3.5 py-1.5 text-sm font-semibold ${tab === "events" ? "bg-navy text-white" : "bg-white"}`}
            onClick={() => setTab("events")}
          >
            조직 일정
          </button>
          <button
            className={`px-3.5 py-1.5 text-sm font-semibold ${tab === "records" ? "bg-navy text-white" : "bg-white"}`}
            onClick={() => setTab("records")}
          >
            활동기록
          </button>
          {isExecutive && (
            <button
              className={`px-3.5 py-1.5 text-sm font-semibold ${tab === "executive" ? "bg-navy text-white" : "bg-white"}`}
              onClick={() => setTab("executive")}
            >
              임원회 캘린더
            </button>
          )}
        </div>
        {tab !== "executive" && (
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
          >
            <option value="all">전체 조직</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
      </div>

      {tab === "proposals" && <ProposalsTab orgs={orgs} orgFilter={orgFilter} />}
      {tab === "events" && <EventsTab orgs={orgs} orgFilter={orgFilter} />}
      {tab === "records" && <RecordsTab orgs={orgs} orgFilter={orgFilter} />}
      {tab === "executive" && isExecutive && <ExecutiveCalendarTab orgs={orgs} />}
    </div>
  );
}

function ProposalsTab({ orgs, orgFilter }: { orgs: Organization[]; orgFilter: string }) {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ org_id: "", title: "", summary: "" });
  const [error, setError] = useState<string | null>(null);

  const { rows: proposals } = useRealtimeList<Proposal>("proposals", {
    orderBy: { column: "updated_at", ascending: false },
  });
  const { rows: votes } = useRealtimeList<ProposalVote>("proposal_votes");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || "-";

  const list = orgFilter === "all" ? proposals : proposals.filter((p) => p.org_id === orgFilter);

  const myVote = (proposalId: string) => votes.find((v) => v.proposal_id === proposalId && v.user_id === userId);
  const voteCount = (proposalId: string, vote: "yes" | "no") =>
    votes.filter((v) => v.proposal_id === proposalId && v.vote === vote).length;

  const castVote = async (proposalId: string, vote: "yes" | "no") => {
    if (!userId) return;
    const existing = myVote(proposalId);
    if (existing && existing.vote === vote) {
      await supabase.from("proposal_votes").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase.from("proposal_votes").update({ vote }).eq("id", existing.id);
    } else {
      await supabase.from("proposal_votes").insert({ proposal_id: proposalId, user_id: userId, vote });
    }
  };

  const submit = async () => {
    setError(null);
    if (!userId) {
      setError("로그인 후 안건을 등록할 수 있습니다.");
      return;
    }
    if (!form.org_id || !form.title.trim() || !form.summary.trim()) {
      setError("소속 조직, 제목, 내용을 모두 입력해 주세요.");
      return;
    }
    const { error } = await supabase.from("proposals").insert({
      org_id: form.org_id,
      title: form.title,
      summary: form.summary,
      author_id: userId,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ org_id: "", title: "", summary: "" });
    setWriting(false);
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setWriting((v) => !v)}
          className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5"
        >
          {writing ? "닫기" : "+ 안건 제안"}
        </button>
      </div>

      {writing && (
        <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-1.5 mb-4">
          {userId === null && (
            <div className="text-sm bg-[#FFF7E6] rounded-lg p-3 mb-2">로그인 후 안건을 등록할 수 있습니다.</div>
          )}
          <label className="text-sm font-bold">소속 조직</label>
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.org_id}
            onChange={(e) => setForm({ ...form, org_id: e.target.value })}
          >
            <option value="">조직을 선택하세요</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <label className="text-sm font-bold mt-2">안건 제목</label>
          <input
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <label className="text-sm font-bold mt-2">안건 내용</label>
          <textarea
            rows={4}
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
          />
          {error && <div className="text-red text-xs">{error}</div>}
          <button onClick={submit} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2.5 mt-3 self-start">
            안건 등록
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {list.map((p) => {
          const mine = myVote(p.id);
          return (
            <div key={p.id} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLASS[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
                <h3 className="text-base m-0">{p.title}</h3>
              </div>
              <div className="text-muted text-xs mb-2">{orgName(p.org_id)} · {fmt(p.created_at)}</div>
              <p className="text-sm whitespace-pre-wrap">{p.summary}</p>
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  onClick={() => castVote(p.id, "yes")}
                  disabled={!userId}
                  className={`text-xs font-bold rounded-lg px-3 py-1.5 border ${
                    mine?.vote === "yes" ? "bg-teal text-white border-teal" : "border-border bg-white"
                  } disabled:opacity-40`}
                >
                  찬성 {voteCount(p.id, "yes")}
                </button>
                <button
                  onClick={() => castVote(p.id, "no")}
                  disabled={!userId}
                  className={`text-xs font-bold rounded-lg px-3 py-1.5 border ${
                    mine?.vote === "no" ? "bg-red text-white border-red" : "border-border bg-white"
                  } disabled:opacity-40`}
                >
                  반대 {voteCount(p.id, "no")}
                </button>
                {!userId && <span className="text-muted text-xs">로그인하면 투표할 수 있어요</span>}
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div className="text-muted text-center py-8 text-sm">등록된 안건이 없습니다.</div>}
      </div>
    </div>
  );
}

function EventsTab({ orgs, orgFilter }: { orgs: Organization[]; orgFilter: string }) {
  const supabase = createClient();
  const [iAmEditor, setIAmEditor] = useState(false);
  const [writing, setWriting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState({
    org_id: "",
    title: "",
    description: "",
    location: "",
    category: "meeting" as OrgEvent["category"],
    start_at: "",
    end_at: "",
  });
  const [error, setError] = useState<string | null>(null);

  const { rows: events } = useRealtimeList<OrgEvent>("org_events", { orderBy: { column: "start_at" } });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUserId(data.user?.id ?? null);
      if (!data.user) return;
      const { data: me } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      setIAmEditor(!!me && ["editor", "admin", "superadmin"].includes(me.role));
    });
  }, [supabase]);

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || "-";
  const list = orgFilter === "all" ? events : events.filter((e) => e.org_id === orgFilter);

  const submit = async () => {
    setError(null);
    if (!form.org_id || !form.title.trim() || !form.start_at || !form.end_at) {
      setError("소속 조직, 일정명, 시작·종료 시간을 확인해 주세요.");
      return;
    }
    const start = new Date(form.start_at);
    const end = new Date(form.end_at);
    if (end <= start) {
      setError("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }
    const { error } = await supabase.from("org_events").insert({
      org_id: form.org_id,
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      category: form.category,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      created_by: userId,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ org_id: "", title: "", description: "", location: "", category: "meeting", start_at: "", end_at: "" });
    setWriting(false);
  };

  return (
    <div>
      {iAmEditor && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setWriting((v) => !v)}
            className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5"
          >
            {writing ? "닫기" : "+ 일정 등록"}
          </button>
        </div>
      )}

      {writing && iAmEditor && (
        <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-1.5 mb-4">
          <label className="text-sm font-bold">소속 조직</label>
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.org_id}
            onChange={(e) => setForm({ ...form, org_id: e.target.value })}
          >
            <option value="">조직을 선택하세요</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <label className="text-sm font-bold mt-2">일정명</label>
          <input
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <label className="text-sm font-bold mt-2">분류</label>
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as OrgEvent["category"] })}
          >
            {Object.entries(EVENT_CATEGORY_LABEL).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-bold">시작 시간</label>
              <input
                type="datetime-local"
                className="border border-border rounded-lg px-3 py-2 text-sm w-full"
                value={form.start_at}
                onChange={(e) => setForm({ ...form, start_at: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-bold">종료 시간</label>
              <input
                type="datetime-local"
                className="border border-border rounded-lg px-3 py-2 text-sm w-full"
                value={form.end_at}
                onChange={(e) => setForm({ ...form, end_at: e.target.value })}
              />
            </div>
          </div>
          <label className="text-sm font-bold mt-2">장소</label>
          <input
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
          <label className="text-sm font-bold mt-2">설명</label>
          <textarea
            rows={3}
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          {error && <div className="text-red text-xs">{error}</div>}
          <button onClick={submit} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2.5 mt-3 self-start">
            일정 등록
          </button>
        </div>
      )}

      <ul className="list-none m-0 p-0">
        {list.map((e) => (
          <li key={e.id} className="border-b border-border py-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge color="navy">{EVENT_CATEGORY_LABEL[e.category]}</Badge>
              <span className="flex-1 text-sm font-bold">{e.title}</span>
              <span className="text-xs text-muted">{orgName(e.org_id)}</span>
            </div>
            <div className="text-xs text-muted mt-1">
              {fmtDateTime(e.start_at)} ~ {fmtDateTime(e.end_at)}
              {e.location ? ` · ${e.location}` : ""}
            </div>
            {e.description && <p className="text-sm mt-1">{e.description}</p>}
          </li>
        ))}
        {list.length === 0 && <div className="text-muted text-center py-8 text-sm">등록된 일정이 없습니다.</div>}
      </ul>
    </div>
  );
}

// 어느 부서가 조직 일정(org_events)을 등록하든, 새 데이터를 따로 저장하지 않고 기존
// org_events를 조직 구분 없이 전부 모아서 보여준다(요청사항: 새 테이블 없이 재사용).
// 조직 필터 UI는 상위(OrgActivitiesPage)에서 이 탭일 때 숨긴다 — 전체를 한눈에 보는 게
// 이 캘린더의 목적이라 필터를 두지 않았다.
function ExecutiveCalendarTab({ orgs }: { orgs: Organization[] }) {
  const { rows: events } = useRealtimeList<OrgEvent>("org_events", { orderBy: { column: "start_at" } });
  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || "-";

  return (
    <div>
      <p className="text-muted text-sm mb-3">
        모든 부서의 조직 일정을 한곳에 모아 보여주는 학생회 임원회 전용 캘린더입니다.
      </p>
      <ul className="list-none m-0 p-0">
        {events.map((e) => (
          <li key={e.id} className="border-b border-border py-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge color="gold">{orgName(e.org_id)}</Badge>
              <Badge color="navy">{EVENT_CATEGORY_LABEL[e.category]}</Badge>
              <span className="flex-1 text-sm font-bold">{e.title}</span>
            </div>
            <div className="text-xs text-muted mt-1">
              {fmtDateTime(e.start_at)} ~ {fmtDateTime(e.end_at)}
              {e.location ? ` · ${e.location}` : ""}
            </div>
            {e.description && <p className="text-sm mt-1">{e.description}</p>}
          </li>
        ))}
        {events.length === 0 && <div className="text-muted text-center py-8 text-sm">등록된 조직 일정이 없습니다.</div>}
      </ul>
    </div>
  );
}

function RecordsTab({ orgs, orgFilter }: { orgs: Organization[]; orgFilter: string }) {
  const supabase = createClient();
  const [iAmEditor, setIAmEditor] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ org_id: "", category: "notice" as OrgRecord["category"], title: "", content: "" });
  const [error, setError] = useState<string | null>(null);

  const { rows: records } = useRealtimeList<OrgRecord>("org_records", { orderBy: { column: "created_at", ascending: false } });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUserId(data.user?.id ?? null);
      if (!data.user) return;
      const { data: me } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      setIAmEditor(!!me && ["editor", "admin", "superadmin"].includes(me.role));
    });
  }, [supabase]);

  const orgName = (id: string) => orgs.find((o) => o.id === id)?.name || "-";
  const list = orgFilter === "all" ? records : records.filter((r) => r.org_id === orgFilter);

  const submit = async () => {
    setError(null);
    if (!form.org_id || !form.title.trim() || !form.content.trim()) {
      setError("소속 조직, 제목, 내용을 모두 입력해 주세요.");
      return;
    }
    const { error } = await supabase.from("org_records").insert({
      org_id: form.org_id,
      category: form.category,
      title: form.title,
      content: form.content,
      author_id: userId,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ org_id: "", category: "notice", title: "", content: "" });
    setWriting(false);
  };

  return (
    <div>
      {iAmEditor && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => setWriting((v) => !v)}
            className="bg-gold text-white font-bold text-sm rounded-lg px-3.5 py-1.5"
          >
            {writing ? "닫기" : "+ 기록 작성"}
          </button>
        </div>
      )}

      {writing && iAmEditor && (
        <div className="bg-white border border-border rounded-xl p-5 flex flex-col gap-1.5 mb-4">
          <label className="text-sm font-bold">소속 조직</label>
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.org_id}
            onChange={(e) => setForm({ ...form, org_id: e.target.value })}
          >
            <option value="">조직을 선택하세요</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <label className="text-sm font-bold mt-2">분류</label>
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as OrgRecord["category"] })}
          >
            {Object.entries(RECORD_CATEGORY_LABEL).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
          <label className="text-sm font-bold mt-2">제목</label>
          <input
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <label className="text-sm font-bold mt-2">내용</label>
          <textarea
            rows={5}
            className="border border-border rounded-lg px-3 py-2 text-sm"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          {error && <div className="text-red text-xs">{error}</div>}
          <button onClick={submit} className="bg-gold text-white font-bold text-sm rounded-lg px-4 py-2.5 mt-3 self-start">
            기록 등록
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {list.map((r) => (
          <div key={r.id} className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <Badge color={RECORD_CATEGORY_COLOR[r.category]}>{RECORD_CATEGORY_LABEL[r.category]}</Badge>
              <h3 className="text-base m-0">{r.title}</h3>
            </div>
            <div className="text-muted text-xs mb-2">{orgName(r.org_id)} · {fmt(r.created_at)}</div>
            <p className="text-sm whitespace-pre-wrap">{r.content}</p>
          </div>
        ))}
        {list.length === 0 && <div className="text-muted text-center py-8 text-sm">등록된 기록이 없습니다.</div>}
      </div>
    </div>
  );
}
