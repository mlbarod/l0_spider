# L0 Spider SSO 적용·운영

## 1. 적용 범위와 파일

참고: [sso_template](https://github.com/mlbarod/sso_template/tree/814ed66e69b15c9f4cffe692338f3bb9579714b1), 특히 `oidcService.mjs`, `authApi.mjs`, `spec/authentication-contract.md`.

| 파일 | 변경 이유 |
|---|---|
| `server/oidcService.mjs` | 템플릿에서 설정·로그인 요청·RS256 검증 부분을 이식. issuer 탐색과 새 역할 체계는 제외. 검증된 claim의 키/자료형 진단 지원 |
| `server/ssoAuth.mjs` | 전체 HTTP 인증 관문, 로그인 transaction·세션, 프록시/출처 검사, 로그인·콜백·로그아웃 |
| `server/accessControl.mjs`, `src/components/common/AccessManagement.jsx` | SSO 이후 접근 허용 검사, 최초 마스터 설정, 마스터·일반 접근 규칙 관리 |
| `server.mjs` | API와 React 제공 전 인증 실행, 세션 상태 API, SSO에서는 정적 React 제공 |
| `server/currentUser.mjs` | `{ ok: true, knoxId }` 응답 유지, SSO 세션 사용자 우선 |
| `server/notices.mjs` | 기존 공지 관리자 목록/작성자에 SSO Knox ID 연결 |
| `server/hitHistory.mjs`, `server/clickedCategoryHistory.mjs`, `server/passHistory.mjs` | HIT·클릭·SKIP 이력의 실행자를 SSO 사용자로 연결 |
| `server/myEqpRegistration.mjs`, `server/selfEquipmentData.mjs` | My EQP 조회·소유 여부·기본 등록 사용자 연결 |
| `src/components/common/SsoSession.jsx`, `src/features/fdc-trend/components/FdcTrendShell.jsx` | 우측 상단 이름·사용자 정보 메뉴, 로그아웃, 초기/60초/창 복귀 시 세션 확인 및 만료 로그인 이동 |
| `vite.config.mjs` | SSO 활성화 시 인증 없는 Vite 단독 개발 서버 시작 차단 |
| `server/ssoAuth.test.mjs`, `server/ssoServer.test.mjs` | 합성 RSA 토큰을 이용한 인증·권한·만료·위조 방어 검증 |
| `.env.sso.example`, 이 문서, `README.md`, `docs/operations/runbook.md` | 설정 예시, 운영자가 실행할 배포·복구 절차 |

기존 Nginx/TLS 설정, 업무 DB/schema, Python 업무 처리, 공지 관리자 목록과 수신인 지정 계약은 유지한다. `SSO_ENABLED` 미설정/false이면 기존 IP 기반 동작이다. true에서 설정 오류는 시작 실패이며, 인증 실패를 IP 조회로 우회하지 않는다.

**배포 전 확인:** 이 구현은 단일 Node 프로세스용이다. 템플릿의 MySQL 세션 저장소 대신 크기가 제한된 서버 메모리를 사용한다. 프로세스 재시작·Secret 교체 후 재시작 시 모든 사용자가 재로그인한다. PM2 cluster, 여러 컨테이너, 여러 Node 인스턴스에는 현재 버전을 활성화하지 않는다. 해당 환경이면 공유 세션 저장소 구현이 선행되어야 한다. 운영 프로세스 수는 아직 확인되지 않았다.

## 2. SSO 인증 흐름

1. `Browser → HTTPS Nginx → HTTP Node` 경로를 유지한다.
2. 미인증 화면/파일 GET은 `/auth/login?returnTo=...`으로 이동한다. `/api`와 `/api/*`는 JSON `401`, `code=SSO_AUTHENTICATION_REQUIRED`로 응답한다. 알 수 없는 API도 보호한다.
3. 로그인에서 무작위 state·nonce·correlation을 만든다. 서버에는 state/correlation의 HMAC을 저장한다. IdP에 `response_type=code id_token`, `response_mode=form_post`, `scope=openid profile`을 요청한다.
4. IdP가 `POST /auth/callback`으로 응답한다. 일회성 state·correlation, RS256 서명, issuer, audience/azp, exp/nbf/iat, nonce, c_hash를 검증한다.
5. `SSO_USER_ID_CLAIM`에 설정한 claim의 값을 기존 Knox ID로 사용한다. 앞뒤 공백만 제거하며 대소문자는 보존한다. 이메일의 앞부분·subject·IP에서 ID를 추정하지 않는다. 관리자는 기존 DB의 Knox ID와 **정확히 같은 값**을 발급하도록 claim을 설정해야 한다.
6. 무작위 세션 쿠키를 발급하고 원래 서비스 내부 경로로 돌아간다. 서버에는 토큰 HMAC·Knox ID·이름·부서·만료를 보관하며 ID Token/code는 저장하지 않는다. 재로그인 시 이전 세션을 폐기한다.
7. 이후 React/static과 모든 API에서 서버 세션과 접근 권한을 검사한다. 마스터 계정이거나 일반 접근 규칙에 일치해야 이용할 수 있다. 공지 권한은 기존 `NOTICE_ADMIN_KNOX_IDS`/`NOTICE_ADMIN_KNOX_ID`를 그대로 사용한다. My EQP와 Mailing의 타 사용자 수신인 지정 기능은 기존 계약을 유지한다. 새 DB 사용자/권한을 자동 생성하지 않는다. 서비스 이용 대상은 SSO 관리자 측 앱 할당 정책도 확인해야 한다.
8. 로그아웃 버튼은 동일 출처 `POST /auth/logout`을 보낸다. 로컬 세션 폐기 후 설정한 IdP 로그아웃 URL로 이동한다. `/auth/logged-out`은 재로그인을 자동 시작하지 않는 완료 화면이다. 단순 완료 화면 GET은 세션을 폐기하지 않는다.

템플릿처럼 code를 토큰 엔드포인트에서 교환하지 않는다. 따라서 **Client Secret은 사용하지 않는다**. 관리자 정책이 authorization-code + PKCE/Client Secret 교환을 요구하면 이 흐름과 다르므로 운영 활성화 전에 구현 변경이 필요하다. 지원하지 않는 Client Secret을 임의로 추가해 해결하지 않는다. 검증 기준: [OpenID Connect Hybrid ID Token](https://openid.net/specs/openid-connect-core-1_0.html#HybridIDToken).

## 3. 환경변수와 프록시·세션

| 변수 | 필수/기본값 | 설정 내용 |
|---|---|---|
| `SSO_ENABLED` | 기본 false | 준비 완료 후 true, 복구 시 false |
| `SSO_CLIENT_ID` | true일 때 필수 | SSO 등록 앱 ID |
| `SSO_REDIRECT_URI` | 필수 | 실제 공개 HTTPS origin + `/auth/callback`, query/fragment 금지 |
| `SSO_AUTHORIZE_URL` | 필수 | 관리자 제공 HTTPS 인증 엔드포인트 |
| `SSO_SIGNOUT_URL` | 필수 | 관리자 제공 HTTPS 로그아웃 URL 전체. 복귀 주소 query도 관리자가 확인한 방식으로 포함 |
| `SSO_EXPECTED_ISSUER` | 필수 | 실제 ID Token의 issuer와 정확히 일치하는 문자열 |
| `SSO_USER_ID_CLAIM` | 일반 로그인 필수 | 기존 Knox ID를 담은 claim의 정확한 이름. 진단 모드에서는 비워 둘 수 있음 |
| `SSO_DISPLAY_NAME_CLAIM` | 이름 표시에 필요 | 사용자 이름을 담은 claim 키 |
| `SSO_DEPARTMENT_CLAIM` | 부서 표시에 필요 | 소속부서를 담은 claim 키 |
| `SSO_SAFE_CLAIM_TRACE` | 기본 false | true이면 검증 후 claim 키/자료형만 서버 로그에 출력, 세션 생성 없이 503 반환 |
| `SSO_CERTIFICATE_PATH` | 필수 | IdP Token Signing X.509 공개 인증서 파일. Nginx TLS 인증서가 아님 |
| `SSO_SESSION_SECRET` | 필수 | 최소 32바이트, 암호학적으로 무작위 생성. Git/브라우저/로그에 출력 금지 |
| `SSO_TRUSTED_PROXY_IPS` | 필수 | Node socket에서 보이는 Nginx의 정확한 IP를 쉼표로 지정. 같은 호스트일 때만 `127.0.0.1,::1` |
| `SSO_LOGIN_TRANSACTION_SECONDS` | 300초 | 로그인 시도 만료, 최대 900초 |
| `SSO_SESSION_IDLE_SECONDS` | 1800초 | 마지막 인증된 업무 요청 이후 만료 |
| `SSO_SESSION_ABSOLUTE_SECONDS` | 28800초 | 로그인 이후 최대 유지 시간. ID Token 만료가 더 빠르면 그 시각 적용 |
| `SSO_CLOCK_TOLERANCE_SECONDS` | 60초 | token 시간 검증 허용 오차, 최대 300초. 만료된 token으로 세션 생성은 불가 |
| `SSO_MAX_SESSIONS` | 10000 | 세션/대기 로그인 각각의 저장 한도. 초과 시 신규 로그인 503 |
| `LIVE_RELOAD` | SSO에서 0 | 1이면 시작 거부. 미설정이어도 SSO는 정적 모드 |
| `BUILD_ON_START` | 운영 권장 0 | 사전 `npm run build` 필요 |
| `SSO_BOOTSTRAP_MASTER_USER_IDS` | 최초 권한 파일 생성 시 필수 | 쉼표로 구분한 Knox 유저ID. 파일 생성 후에는 재적용하지 않음 |
| `SSO_ACCESS_CONTROL_FILE` | 기본 `프로젝트/.local/sso-access.json` | 권한 영속 파일. 배포 폴더 밖의 쓰기 가능한 절대 경로 권장 |

`SSO_SECURE_COOKIES=false`는 거부한다. 세션 쿠키는 `__Host-l0_spider_session`, `Path=/`, `Secure`, `HttpOnly`, `SameSite=Lax`, Domain 없음이다. cross-site POST callback용 correlation 쿠키는 `__Secure-l0_spider_oidc`, `Path=/auth/callback`, `SameSite=None; Secure; HttpOnly`이다. [쿠키 속성 기준](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

Express가 없어 `app.set('trust proxy', ...)`를 추가하지 않는다. 지정된 socket peer와 단일 `X-Forwarded-Proto: https`를 모두 확인한다. 요청 Host나 전달된 사용자 ID 헤더로 로그인 주소/신원을 결정하지 않는다. 업무 변경 요청과 로그아웃은 공개 origin과 일치하는 Origin 또는 Referer가 필요하다. 미인증 callback만 state/correlation 검증으로 출처 검사를 대신한다. 상태 polling은 idle 시간을 연장하지 않는다.

공개 origin은 이 서비스 전용이어야 한다. Node 포트는 Nginx만 접근하도록 기존 네트워크 제한을 확인한다. 같은 호스트의 임의 프로세스까지 인증된 프록시로 구분하는 기능은 아니다. Nginx가 모든 React/API/auth 경로를 Node로 전달하며 인증 응답을 캐시하지 않는지 확인한다. 이미 이 조건을 만족하면 Nginx 변경이 없다. 부족한 경우에만 담당자가 기존 server/location에 다음 전달 설정을 확인·반영한다(별도 TLS/server 구성을 만들지 않음).

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
```

Nginx가 React 파일을 직접 제공하거나 proxy cache에서 제공하면 Node 인증을 거치지 않으므로 배포 전 조정이 필요하다. callback POST 본문을 access/error 로그에 기록하지 않는다. IdP 공개 인증서는 실제 발급 출처를 확인하고 서버가 읽을 수 있게 배치한다. 인증서 교체 때 경로의 새 인증서를 반영 후 Node를 재시작한다.

### 사용자 이름·부서 표시와 claim 키 확인

[Quality-Hub의 사용자 프로필 구조](https://github.com/mlbarod/Quality-Hub/tree/d1220c527229402fae271376db2d854135e49abb)를 참고했다. 해당 저장소도 실제 운영 claim 키는 환경설정으로 받으며 예시 파일의 키는 비어 있다. `USER ID`, `USER NAME`, `DEP NAME`은 **화면 라벨**이며 실제 token의 키 이름이라고 가정하면 안 된다.

| 화면 항목 | 환경변수로 지정하는 claim 키 | 서버 세션 | `/api/auth/session` 응답 |
|---|---|---|---|
| USER ID | `SSO_USER_ID_CLAIM` | `knoxId` | `user.userId` |
| USER NAME | `SSO_DISPLAY_NAME_CLAIM` | `displayName` | `user.displayName` |
| DEP NAME | `SSO_DEPARTMENT_CLAIM` | `department` | `user.department` |

SSO 인증 후 기존 경로로 복귀하면 우측 상단에 이름이 표시되고, 클릭하면 세 항목과 로그아웃 메뉴가 열린다. 외부 SSO 세션이 유효할 때 추가 로그인 화면을 생략하는지는 IdP 정책에 달려 있다. 이름이 없으면 Knox ID를 버튼에 표시한다. 이름·부서의 claim 미설정/누락/잘못된 자료형/최대길이 초과는 빈값으로 처리하고 메뉴에 `미제공`을 표시한다. 이름 최대 100자, 부서 최대 200자이며 앞뒤 공백만 제거한다. 이 두 필드는 표시용이므로 기존 인증/권한 판정을 바꾸지 않는다. `/api/current-user`의 `{ ok: true, knoxId }` 계약도 유지한다.

실제 키를 모르면 관리자에게 확인하거나 별도 검증 환경에서 다음 절차를 수행한다.

1. 기존 issuer·client·인증서·HTTPS proxy 설정을 준비한다. `SSO_ENABLED=true`, `SSO_SAFE_CLAIM_TRACE=true`로 실행한다. **issuer 검증은 그대로 필수**이므로 issuer까지 모르면 먼저 관리자에게 확인한다.
2. 검증 계정으로 로그인한다. 검증된 callback은 `SSO_CLAIM_TRACE` 503 안내를 반환하며 세션을 생성하지 않는다. 서버 로그의 `SSO safe claim trace`에서 `claimTypes`의 키/자료형만 확인한다. 원본 token, code, claim 값, issuer 값은 출력하지 않는다.
3. 출력된 키 중 어떤 것이 Knox ID·이름·부서인지는 관리자와 확인하여 세 환경변수에 각각 입력한다. `name`이나 `department`를 실제 키로 추정하여 넣지 않는다. claim 키가 URI 형태라면 전체 URI를 그대로 넣는다.
4. `SSO_SAFE_CLAIM_TRACE=false`로 바꾸고 Node를 재시작한 뒤 다시 로그인한다. 진단 모드를 true로 유지하면 서비스를 사용할 수 없다.
5. 우측 상단 이름과 펼친 세 항목을 확인한다. 실제 SSO claim과 화면 표시의 일치는 **수동 확인 필요**다. 실제 개인정보나 token을 공유하지 않는다.

`SSO_ENABLED=false`이면 진단과 SSO 사용자 메뉴 모두 비활성화된다. 설정 변경은 재시작 및 재로그인 후 반영된다. 사용자 프로필 API 응답은 `no-store`이며 token·전체 claim은 브라우저로 보내지 않는다.

## 4. SSO 관리자 등록 항목

실제 공개 origin을 `https://spider.example` 자리에 넣고 와일드카드 없이 등록한다.

| 항목 | 값 |
|---|---|
| Redirect/Reply URI | `https://spider.example/auth/callback` (POST form_post) |
| Logout 후 복귀 URI | `https://spider.example/auth/logged-out` |
| 서비스 로컬 로그아웃 | `https://spider.example/auth/logout` (브라우저의 동일 출처 POST) |

로컬 POST 로그아웃을 IdP의 front-channel GET logout endpoint로 등록하지 않는다. IdP에서 시작하는 front/back-channel 전역 로그아웃은 이 구현 범위에 없다. 다른 서비스/IdP에서 로그아웃하더라도 이 서비스 세션은 자체 만료까지 남을 수 있다.

관리자에게 hybrid 응답 허용 여부, issuer, Knox ID claim, Token Signing 인증서, 앱 할당 대상, IdP signout endpoint와 복귀 URI query 규칙을 함께 확인한다. `SSO_SIGNOUT_URL`을 완성된 URL로 설정하며 애플리케이션이 `wreply`/`post_logout_redirect_uri` 등을 추정하지 않는다.

## 5. 운영 서버 작업과 명령

아래는 **운영자가 확인 후 직접 실행할 명령이며 이번 작업에서 운영 실행하지 않았다**. 실제 서비스 manager·unit·배포 경로가 저장소에 없어 `<...>`는 실값으로 바꿔야 한다.

1. 단일 프로세스임을 확인하고 현재 release, service 실행 명령, `LIVE_RELOAD`/`BUILD_ON_START` 값과 환경 주입 경로를 기록한다. 기존 HTTPS가 정상인 release 산출물을 보관한다. 비밀값을 터미널이나 작업 기록에 출력하지 않는다.
2. 관리자에게 위 항목을 등록받고 공개 인증서를 Git 밖에 배치한다. `.env.sso.example`을 참고해 기존 process manager의 Secret/환경파일에 값을 설정한다. 예시는 자동 로드되지 않는다. 기존 `notices.env`와 공지 관리자 설정을 덮어쓰지 않는다. 기존 환경값이 있으면 process 환경이 우선하므로 중복 키도 확인한다.
3. Session Secret은 승인된 비밀 저장소에서 생성하거나, 새 파일에 아래와 같이 직접 기록한다. `x` 모드이므로 기존 파일을 덮어쓰지 않는다. 이후 편집기로 나머지 설정을 추가하며 파일을 출력하지 않는다.

```bash
# 실제 비밀파일 경로로 치환. 상위 디렉터리는 운영자가 접근권한을 준비해야 한다.
node --input-type=module -e 'import {writeFileSync} from "node:fs"; import {randomBytes} from "node:crypto"; writeFileSync(process.argv[1], "SSO_SESSION_SECRET=" + randomBytes(48).toString("base64url") + "\nSSO_ENABLED=false\n", {mode:0o600,flag:"wx"})' '<secret-env-file>'
```

4. 배포 checkout에서 잠금 파일 기준으로 설치·빌드·직접 테스트한다. 테스트에 실제 운영 환경파일을 로드하지 않는다.

```bash
cd <deployment-checkout>
npm ci
npm run build
node --test server/ssoAuth.test.mjs server/accessControl.test.mjs
# 별도 개발/검증 환경에서만 실제 Node를 띄우는 합성 통합 테스트(openssl 필요)
# node --test server/ssoServer.test.mjs
```

5. 환경파일의 `SSO_ENABLED=true`, `LIVE_RELOAD=0`, `BUILD_ON_START=0`을 설정한다. 최초 배포에는 `SSO_BOOTSTRAP_MASTER_USER_IDS`에 실제 최초 마스터 ID를 지정하고, `SSO_ACCESS_CONTROL_FILE`에는 실행 계정이 읽고 쓸 수 있는 영속 파일 경로를 지정한다. 초기에는 마스터만 접근할 수 있으므로 마스터 로그인 후 일반 접근 규칙을 등록한다. 파일은 실행 계정만 읽게 한다. systemd 사용이 확인된 경우 기존 unit drop-in의 `[Service]`에 `EnvironmentFile=<secret-env-file>`을 추가한다. 기존 `WorkingDirectory`, `ExecStart`, HOST/PORT, Python/DB 설정은 유지한다. 실제 SSO 설정을 출력하지 않는 사전 검사(아래 명령은 권한 파일을 생성하지 않으며, 권한 파일 검사는 실제 서버 시작 시 수행):

```bash
cd <deployment-checkout>
node --env-file='<secret-env-file>' --input-type=module -e 'const {createSsoAuth}=await import("./server/ssoAuth.mjs"); if(!createSsoAuth().enabled) throw new Error("SSO_DISABLED"); console.log("SSO 설정 및 공개키 로드 통과")'
```

이 검사는 설정과 인증서 읽기만 확인하며 SSO 로그인을 증명하지 않는다. service manager가 환경을 이미 주입하는 경우 해당 환경에서 `--env-file` 없이 실행한다.

```bash
# systemd임을 확인한 경우만. unit/drop-in 변경 시 daemon-reload 필요.
sudo systemctl daemon-reload
sudo systemctl restart <unit-name>
systemctl is-active <unit-name>
```

systemd가 아니면 기존 manager의 환경 주입/재시작 절차를 사용한다. 기존 서비스와 별도 `npm start`를 중복 실행하지 않는다. 수동 실행 방식인 경우 기존 프로세스를 기존 절차로 정지한 후 `node --env-file='<secret-env-file>' server.mjs`로 실행한다.

6. 비로그인 점검은 쿠키 없이 HTTP 상태만 확인한다. 정상 기대값은 화면 303, API 401이다.

```bash
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' 'https://<public-host>/'
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' 'https://<public-host>/api/current-user'
```

7. 브라우저에서 아래 수동 항목을 확인한다. Nginx 설정을 실제 수정한 경우에만 담당자의 기존 `nginx -t` 및 reload 절차를 수행한다. DB migration이나 `/appdata` 변경은 이 SSO 배포에 필요하지 않다.

## 6. 검증과 수동 확인

자동 검증 결과:

- `server/ssoAuth.test.mjs` 통과: 설정, 서명/claim, 위조·재사용, 프록시, 출처, 만료, 세션 회전, 공지 권한, 비활성화.
- `server/ssoServer.test.mjs` 통과: 실제 `server.mjs`와 합성 인증서로 전체 등록 API의 비로그인 401, React/정적 파일 보호, 로그인→current-user→로그아웃, SSO 비활성화 후 화면 복구. 로컬 서버 바인딩의 sandbox EPERM 제한 때문에 허용된 sandbox 밖 실행으로 확인했다.
- 기존 `notices`, `hitHistory`, `clickedCategoryHistory`, `passHistory`, `myEqpRegistration`, `selfEquipmentData` 테스트 통과.
- 변경 대상 ESLint 및 `git diff --check` 통과. `npm run build` 통과(큰 bundle 경고 있음).
- 독립 인증 검수 1회 PASS. 검수 도구 제약으로 전달한 인증 코드·연결부·검증 결과를 기준으로 검토했으며, 검수자가 실제 파일의 최종 diff를 대조하지는 못했다.
- 실제 SSO/운영 DB, 실제 HTTPS 브라우저 로그인·로그아웃은 미검증이다.

사용자 프로필 추가 검증: 합성 claim 매핑·세션 응답·진단 모드의 개인정보 미출력/세션 미생성 테스트와 실제 Node 세션 API 연동 테스트 통과. 브라우저에서 이름·세 항목 표시, 공지 버튼과 겹침 없음, Escape/초점 복원, 키보드 POST 로그아웃, 모바일, 누락 정보·HTML 문자 처리, SSO false 메뉴 숨김을 확인했다. 실제 IdP claim 매핑과 추가 입력 없는 자동 로그인 여부는 별도 수동 확인이 필요하다.

**수동 확인 필요:**

- 운영 프로세스 수/manager, 정확한 공개 origin과 Nginx peer IP, 직접 Node 접근 차단, Nginx 전체 경로 전달·캐시 설정.
- 실제 IdP 로그인과 form_post callback, Secure/SameSite 쿠키 수신, 원래 경로 복귀. 로그인 실패 화면은 `/auth/login`에서 다시 시작.
- `SSO_USER_ID_CLAIM` 값과 기존 DB Knox ID 일치, 일반 사용자/공지 관리자별 권한, 앱 할당 대상. DB의 `available` 값을 새로운 권한 정책으로 해석하지 않는다.
- 기존 조회, My EQP의 본인/공개 데이터 구분, 타 사용자 수신인 지정 동작. 실제 쓰기·메일 발송을 자동 검증하지 않았다.
- HIT·클릭·SKIP 이력 실행자가 SSO Knox ID로 기록되는지. 운영 데이터에 테스트용 이력을 만들지 말고 승인된 실제 업무 또는 별도 검증 환경에서 확인한다.
- `GET /api/my-eqp-registration`과 관련 설비 조회는 기존 Python 코드가 조건부 DDL을 수행할 수 있다. 운영에 점검용 요청을 보내지 말고 기존 운영 증거 또는 별도 검증 환경으로 확인한다.
- 세션 idle/absolute/토큰 만료, 새 탭/뒤로가기/재로그인, POST 실패 시 자동 재전송 없이 다시 작업하는지.
- 로그아웃 후 이전 세션 API 접근 401, IdP 로그아웃 완료와 `/auth/logged-out` 복귀, 다시 로그인. IdP signout 실패여도 로컬 세션은 이미 폐기된다.
- 재시작 후 재로그인, 공개 인증서 갱신 절차. 인증서·Secret 파일 읽기 권한과 로그에 token/code/secret이 없는지.

## 7. Rollback

빠른 복구는 활성 환경 주입 위치에서 **`SSO_ENABLED=false`**로 바꾼 뒤 기존 Node 서비스를 재시작한다. true 값을 다른 process 환경에 남겨 두지 않는다. 이때 기존 IP 사용자 조회가 복원되고 SSO 보호는 해제되지만 HTTPS는 계속 Nginx에서 처리한다. 유지 중인 `LIVE_RELOAD=0`과 `dist`로 기존 기능을 제공할 수 있다.

```bash
# 환경파일/Secret을 편집하여 SSO_ENABLED=false 설정 후
sudo systemctl restart <unit-name>
systemctl is-active <unit-name>
curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' 'https://<public-host>/'
```

정상 기대는 기존 화면 응답과 기존 IP 기반 `/api/current-user` 동작이다. 후자는 기존 사용자 조회 DB 접근이 필요하다. 비정상일 때 반복 restart하지 말고 활성 환경과 이전 release로 확인한다.

소스 자체 복구가 필요하면 보관한 **SSO 적용 전 release + 그 release의 dist/환경**을 기존 배포 절차로 재배포하고 재시작한다. 사용자 변경을 지우는 `git reset --hard`/강제 push는 사용하지 않는다. 이전 `LIVE_RELOAD`/`BUILD_ON_START` 값 복원이 필요하면 기록한 값으로 되돌린다. DB 변경이 없어 migration rollback은 없다. Nginx/TLS는 그대로 유지하며, 이번 배포에서 별도 프록시 조정을 했다면 HTTPS가 완료된 직전 구성으로만 복구한다.

## 8. 접근 권한 관리

- SSO 사용 시 역할은 `master`(마스터 유저), `general`(일반 유저) 두 가지다. 마스터만 우측 상단 프로필 왼쪽의 **권한 관리** 버튼에서 마스터 계정과 일반 접근 규칙을 추가·수정·삭제할 수 있다. 그 외 업무 기능의 기존 권한은 변경하지 않는다.
- 마스터는 유저ID 직접 일치로만 지정한다. 일반 접근 규칙은 유저ID 직접 일치 또는 소속부서 직접 일치·텍스트 포함이다. 하나 이상의 규칙에 맞으면 일반 접근을 허용하고, 마스터 계정 일치가 우선한다. quality-hub와 같이 권한 비교용 유저ID는 앞뒤 공백 제거·소문자 변환하며 기존 SSO Knox ID와 업무 데이터의 대소문자는 바꾸지 않는다. 부서 조건은 앞뒤 공백을 제거해 저장하고 SSO 부서 값과 대소문자를 구분해 비교한다. 빈 조건이나 유저ID 텍스트 포함은 거부한다.
- 최초 설정 예: `SSO_BOOTSTRAP_MASTER_USER_IDS=master.one,master.two` (예시 ID를 실제 ID로 교체). 권한 파일이 없을 때만 초기화한다. 기존 파일이 있으면 환경변수에 ID를 추가해도 마스터가 추가되지 않으며, 관리 화면을 이용해야 한다. 마지막 마스터는 회수할 수 없다. 부서 규칙을 쓰려면 `SSO_DEPARTMENT_CLAIM`도 실제 claim 키로 설정해야 한다.
- 권한 파일은 단일 Node 프로세스에서 읽고 원자적으로 교체하며 재시작 후 유지된다. 실행 계정만 읽고 쓸 수 있게 생성한다. 파일과 상위 디렉터리의 쓰기 권한을 유지하고, 운영자는 파일을 백업·복구 대상에 포함한다. 재배포 시 파일을 삭제하거나 초기화하지 않는다. 저장소가 손상되면 시작을 거부하며, 실행 중 읽기 오류는 `503 ACCESS_STORE_UNAVAILABLE`로 차단한다. 복구는 보관한 정상 권한 파일을 기존 운영 절차로 복원한다.
- `GET /api/access-control`은 마스터에게만 `{ok, masters, rules}`를 제공한다. 같은 경로의 `POST`/`DELETE`는 `{target:"master", userId}`로 계정을 추가·회수한다. `POST`/`PATCH`는 `{target:"rule", field:"user_id"|"department", matchType:"exact"|"contains", matchValue, ruleId?}`로 규칙을 저장한다. 수정에는 `ruleId`가 필수이며 `DELETE`는 `{target:"rule", ruleId}`다. 변경 응답은 `{ok:true}`이며 출처 검사와 변경 직전 마스터 재검사를 수행한다.
- `GET /api/auth/session`은 접근 허용 사용자에게 기존 응답과 함께 `role`을 제공한다. 권한이 없으면 모든 업무 API는 `403 ACCESS_DENIED`, 화면은 접근 거부 안내를 제공한다. 일반 유저의 관리 API 요청은 `403 MASTER_REQUIRED`다. 이미 로그인한 사용자의 권한도 요청마다 확인하므로 회수 후 다음 요청부터 반영된다. 이미 브라우저에 전달된 데이터까지 회수하지는 않는다. 열린 화면은 60초 주기·창 복귀 시 세션 확인으로 접근 거부 안내로 이동한다. 차단된 사용자도 로그아웃할 수 있다.
- `SSO_ENABLED=false`일 때는 기존 동작을 유지하며 권한 파일을 생성하지 않고 관리 API는 `404`로 닫힌다. SSO를 끄면 이 접근 제한도 비활성화되므로 운영에서 권한 회수 수단으로 사용하지 않는다.
