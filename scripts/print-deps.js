// 빌드 때 실제로 설치된 의존성 버전을 로그에 찍는다 — 배포 환경(Render)은 셸 접속이 안 되어서,
// 어떤 버전으로 빌드됐는지 빌드 로그로 확인하려는 것. package.json의 prebuild가 `npm run build` 앞에서 자동 실행한다.
// node_modules/<이름>/package.json을 상대 경로로 직접 읽으므로 npm·pnpm 어느 레이아웃에서도 동작한다.
// (확인용이라 실패해도 빌드를 막지 않는다 — 항상 종료 코드 0)
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// 인증처럼 버전이 동작에 직접 영향을 주는 것은 맨 위에 따로 보여준다
const KEY = ['better-auth', '@prisma/client', 'prisma', '@nestjs/core'];

function installedVersion(name) {
  try {
    const file = path.join(root, 'node_modules', name, 'package.json');
    return JSON.parse(fs.readFileSync(file, 'utf8')).version;
  } catch {
    return '(설치 안 됨)';
  }
}

const declared = { ...pkg.dependencies, ...pkg.devDependencies };
const names = Object.keys(declared).sort();
const ordered = [...KEY.filter((n) => names.includes(n)), ...names.filter((n) => !KEY.includes(n))];

console.log(`[deps] node ${process.version} / 설치된 의존성 ${names.length}개 (선언 → 설치)`);
for (const name of ordered) {
  const mark = KEY.includes(name) ? '*' : ' ';
  console.log(`[deps] ${mark} ${name} ${declared[name]} -> ${installedVersion(name)}`);
}
