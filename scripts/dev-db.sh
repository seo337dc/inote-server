#!/usr/bin/env bash
# 로컬 개발 DB 도우미 — 운영 DB를 실수로 건드리지 않게, 항상 이 PC의 개발 DB 주소를 스스로 만들어 쓴다.
# (평소 .env의 DATABASE_URL은 운영 DB다. 여기서는 그 값을 쓰지 않고 DATABASE_URL을 개발 DB 주소로 덮어쓴다.)
#
#   scripts/dev-db.sh up        개발 DB 컨테이너 시작 (처음엔 .env.dev의 비밀번호가 필요: cp .env.dev.example .env.dev)
#   scripts/dev-db.sh migrate   prisma migrate deploy 를 개발 DB에 적용
#   scripts/dev-db.sh seed      공개 글(공개 API) + 테스트용 비공개 글·임시저장 글을 넣는다 (여러 번 실행해도 안전)
#   scripts/dev-db.sh psql      개발 DB에 psql로 접속
#   scripts/dev-db.sh start     BE를 개발 DB로 실행 (pnpm run start:dev)
#   scripts/dev-db.sh url       개발 DB 주소(비밀번호 가림) 출력
#   scripts/dev-db.sh down      컨테이너 정지(데이터 유지)    reset  컨테이너+데이터 삭제 후 다시 만들기
set -euo pipefail
cd "$(dirname "$0")/.."

# docker가 PATH에 안 잡힌 PC(Docker Desktop 앱 안의 실행 파일)도 쓸 수 있게
[ -d /Applications/Docker.app/Contents/Resources/bin ] && export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"

[ -f .env.dev ] || { echo ".env.dev가 없습니다: cp .env.dev.example .env.dev 후 INOTE_DEV_DB_PASSWORD를 채워 주세요 (openssl rand -hex 16)" >&2; exit 1; }
PW="$(grep '^INOTE_DEV_DB_PASSWORD=' .env.dev | cut -d= -f2-)"
[ -n "$PW" ] || { echo ".env.dev의 INOTE_DEV_DB_PASSWORD가 비어 있습니다." >&2; exit 1; }

DEV_URL="postgresql://inote:${PW}@127.0.0.1:5435/inote_dev"
compose() { docker compose -f docker-compose.dev.yml --env-file .env.dev "$@"; }

wait_ready() {
  # 처음 만들 때는 초기화용 임시 서버가 먼저 응답한 뒤 다시 시작된다 — 두 번 연속 성공할 때까지 기다린다
  local ok=0
  for _ in $(seq 1 40); do
    if compose exec -T db psql -U inote -d inote_dev -Atc "select 1" >/dev/null 2>&1; then ok=$((ok + 1)); else ok=0; fi
    [ "$ok" -ge 2 ] && { echo "개발 DB 준비됨 (localhost:5435)"; return 0; }
    sleep 2
  done
  echo "개발 DB가 준비되지 않았습니다." >&2; return 1
}

case "${1:-}" in
  up)      compose up -d && wait_ready ;;
  down)    compose down ;;
  reset)   compose down -v && compose up -d && wait_ready ;;
  migrate) DATABASE_URL="$DEV_URL" npx prisma migrate deploy ;;
  seed)    DATABASE_URL="$DEV_URL" npx ts-node --transpile-only -O '{"module":"commonjs","moduleResolution":"node","resolvePackageJsonExports":false,"rootDir":"."}' prisma/seed-dev.ts ;;
  psql)    compose exec db psql -U inote -d inote_dev ;;
  start)   DATABASE_URL="$DEV_URL" pnpm run start:dev ;;
  url)     echo "${DEV_URL/:${PW}@/:***@}" ;;
  *)       sed -n '2,13p' "$0"; exit 1 ;;
esac
