#!/bin/bash
# 학생자치회 웹사이트 기능 목록 -> GitHub Issues 일괄 생성
# 사용법: Claude Code 터미널에서 (저장소 루트 디렉토리 기준) 실행
#   chmod +x create_issues.sh
#   ./create_issues.sh
# 사전 조건: gh CLI 로그인 되어 있어야 함 (gh auth status 로 확인)

set -e

echo "라벨 생성 중..."
gh label create "뱃지/알림" --color "F4C430" --force
gh label create "회원/권한관리" --color "1F6FEB" --force
gh label create "게시판/QnA" --color "8B5CF6" --force
gh label create "통계/관리자UI" --color "2DA44E" --force
gh label create "박다엘통합" --color "DA3633" --force
gh label create "실시간채팅" --color "0E8A16" --force
gh label create "테마" --color "D4A017" --force
gh label create "기타" --color "6E7781" --force
gh label create "확인필요" --color "D93F0B" --force
gh label create "진행중" --color "FBCA04" --force

# 이슈 생성 후 완료 상태면 바로 close
create_issue() {
  local title="$1"
  local label="$2"
  local status="$3"   # done | inprogress | planned
  local extra_label=""
  if [ "$status" = "inprogress" ]; then
    extra_label="--label 진행중"
  fi

  url=$(gh issue create --title "$title" --body "학생자치회 웹사이트 기능 정리에서 이관됨" --label "$label" $extra_label)
  number=$(echo "$url" | grep -oE '[0-9]+$')

  if [ "$status" = "done" ]; then
    gh issue close "$number" --comment "완료됨"
  fi

  echo "생성됨: #$number [$status] $title"
}

echo ""
echo "===== 뱃지/알림 ====="
create_issue "뱃지 부여 시 학생 목록 유지" "뱃지/알림" done
create_issue "이미 뱃지 있어도 알림 뜨던 버그 수정" "뱃지/알림" done
create_issue "알림 발송 없애기 + 지속 시간 설정 기능" "뱃지/알림" done
create_issue "알림 발송 기록 삭제 / 팝업 중지 기능 분리" "뱃지/알림" done
create_issue "알림·공지사항 발송자 기록 남기기 (기록 삭제는 admin 이상만 가능)" "뱃지/알림" done
create_issue "공지사항 상단 배너 / 팝업 표시 방식 선택 가능" "뱃지/알림" done
create_issue "접속 체크 버튼 없이 팝업으로 자동 접속 확인" "뱃지/알림" done
create_issue "연속 접속일수 듀오링고식 보상" "뱃지/알림" done
create_issue "뱃지 추가 + 뱃지 조건 추가 기능 자체" "뱃지/알림" inprogress
create_issue "버그 발견 뱃지 신설" "뱃지/알림" planned
create_issue "실시간 뱃지 알림 안 되는 버그 수정" "뱃지/알림" planned
create_issue "Q&A 작성 시 뱃지 조건 추가" "뱃지/알림" planned

echo ""
echo "===== 회원/권한 관리 ====="
create_issue "가입자 수 세분화 (전체 학생/일반 학생/관리 권한/선생님)" "회원/권한관리" done
create_issue "외부 계정 관리" "회원/권한관리" done
create_issue "sub_editor 역할 생성 (권한 미부여)" "회원/권한관리" inprogress
create_issue "Teacher 역할 생성 (권한 미부여)" "회원/권한관리" inprogress
create_issue "학년별/교사 필터링, 반·번호순 정렬 (엑셀 연동)" "회원/권한관리" planned
create_issue "학생·교사 목록 조회 기능" "회원/권한관리" planned
create_issue "다른 사람 마이페이지 열람 기능" "회원/권한관리" planned
create_issue "구성원 목록에 프로필 사진 표시" "회원/권한관리" planned
create_issue "부장·부원·사법위원회·학생회 임원회 권한 세분화 (9/1 회의)" "회원/권한관리" planned
create_issue "부장이 소속 부서 공지사항 작성·알림 발송 권한" "회원/권한관리" planned

echo ""
echo "===== 게시판/Q&A ====="
create_issue "Q&A 작성자 식별 가능" "게시판/QnA" done
create_issue "작성자·admin Q&A 질문 삭제 가능" "게시판/QnA" done
create_issue "댓글 작성 기능 (댓글에 작성자 표시)" "게시판/QnA" planned
create_issue "게시글 작성자 표시" "게시판/QnA" planned
create_issue "사진 첨부" "게시판/QnA" planned
create_issue "작성자 본인 + admin 이상 글 삭제 가능" "게시판/QnA" planned

echo ""
echo "===== 통계/관리자 UI ====="
create_issue "통계 탭 순서/기본탭 변경" "통계/관리자UI" done
create_issue "통계 카드 이동·재정렬, 하루 방문 횟수로 변경" "통계/관리자UI" done
create_issue "접속 통계 탭 형식으로 변경" "통계/관리자UI" done
create_issue "관리자 페이지 UI 개선" "통계/관리자UI" done
create_issue "README에 권한별 기능 정리" "통계/관리자UI" done

echo ""
echo "===== 박다엘 사이트 통합 ====="
create_issue "안건함 - 제안 등록 + 찬반투표 (중복투표 방지)" "박다엘통합" inprogress
create_issue "조직별 일정 (org_events)" "박다엘통합" inprogress
create_issue "조직별 활동기록 (org_records)" "박다엘통합" inprogress
create_issue "관리자 화면 /admin/org-activities/ 독립 섹션 구성" "박다엘통합" inprogress

echo ""
echo "===== 실시간 채팅 ====="
create_issue "1:1 DM + 학교 전체 채팅방 (시간표시/신고/차단)" "실시간채팅" inprogress
create_issue "수업시간 채팅 제한 + 관리자 승인 기능" "실시간채팅" planned

echo ""
echo "===== 테마 ====="
create_issue "classic/green 테마 객체 구현 (src/lib/homeTheme.ts)" "테마" inprogress

echo ""
echo "===== 기타 ====="
create_issue "폰트/아이콘 변경 (학교 아이콘, 학생자치회 소개 폰트)" "기타" done
create_issue "마이페이지 프로필 설정 기능" "기타" done
create_issue "수정 없을 시 저장 버튼 비활성화" "기타" planned
create_issue "도배 방지 기능" "기타" planned
create_issue "사용자 이름 클릭 시 임시 제한/닉네임 변경" "기타" planned
create_issue "학생자치회 뉴스에 회의록 영상 첨부" "기타" planned

echo ""
echo "===== 확인 필요 ====="
create_issue "공지사항 설정 시 학생들에게 이메일 알림 발송되는지 확인" "확인필요" planned

echo ""
echo "완료! gh issue list --state all 로 확인 가능"
