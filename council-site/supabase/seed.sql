-- 선택 사항: 초기 데모 데이터. schema.sql 실행 후 필요하면 실행하세요.

insert into organizations (name, slug, color, description, role_description, order_index) values
  ('학생회 임원회', 'exec', 'navy', '학생회장단을 중심으로 학생자치회 전체 운영을 총괄합니다.', '예산 운영, 행사 기획, 대외 협력.', 1),
  ('대의원회', 'representatives', 'teal', '학급별 대표로 구성되어 학생 의견을 수렴합니다.', '학급 의견 수렴, 안건 발의·심의.', 2),
  ('사법위원회', 'judiciary', 'red', '생활협약 위반 사안을 심의하고 갈등을 중재합니다.', '생활협약 위반 심의, 조정·중재.', 3),
  ('학생총회', 'assembly', 'gold', '전교생이 참여하는 최고 의결 기구입니다.', '규정 제·개정, 최종 의결.', 4)
on conflict (slug) do nothing;

insert into rules (title, category, content) values
  ('학생생활협약', '공통', E'제1조(목적) 이 협약은 학생 상호 간 존중과 자율적인 학교생활 문화를 조성함을 목적으로 한다.\n제2조(적용범위) 이 협약은 전교생에게 적용한다.'),
  ('학생자치회 운영 규정', '자치회', E'제1조(구성) 학생자치회는 학생회 임원회, 대의원회, 사법위원회, 학생총회로 구성한다.\n제2조(임기) 각 조직의 임기는 1년으로 한다.')
on conflict do nothing;

insert into posts (type, title, content, category, is_pinned, status, publish_at) values
  ('notice', '2학기 학생회비 사용 내역 공개', '2학기 학생회비 사용 내역을 공개합니다. 자세한 내역은 첨부파일을 확인해주세요.', '행정', true, 'published', current_date),
  ('notice', '가을 축제 부스 운영 신청 안내', '가을 축제 부스 운영을 희망하는 동아리 및 학급은 신청서를 제출해주세요.', '행사', true, 'published', current_date),
  ('news', '제1회 대의원회 정기회의 개최', '지난주 열린 정기회의에서 학급 건의사항 15건을 심의했습니다.', '대의원회', false, 'published', current_date);

insert into events (title, description, start_at, location, category) values
  ('대의원회 정기회의', '학급 건의사항 심의', current_date, '학생회실', '회의'),
  ('가을 축제', '동아리·학급 부스 운영', current_date + 3, '운동장', '행사'),
  ('정기 학생총회', '생활협약 개정안 의결', current_date + 12, '대강당', '총회');
