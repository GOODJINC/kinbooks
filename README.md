# KinBooks 📖

> **초경량 셀프호스팅 가족 & 개인 가계부 (Ultra-lightweight Self-hosted Family & Personal Accounting Web App)**

[![Go Version](https://img.shields.io/badge/Go-1.24-00ADD8?style=flat&logo=go)](https://golang.org)
[![React Version](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**KinBooks**는 홈서버, NAS(Synology, QNAP), 라즈베리 파이 또는 저사양 VPS에서도 메모리 30MB 내외로 가볍고 안정적으로 동작하는 **로컬 퍼스트(Local-First) 가족 & 개인 협업 가계부**입니다.

복식부기 원리를 간소화하여 자산 간의 이동(이체), 카드 대금 청구일 계산, 영수증 압축 보관, 실시간 통계 분석, 그리고 가족 공유까지 군더더기 없이 제공합니다.

---

## ✨ 주요 기능 (Key Features)

### 👨‍👩‍👧‍👦 1. 가족 공유 & 멀티 가계부 (Multi-Book & Collaboration)
- **여러 가계부 생성 및 관리**: 개인용, 부부 공동, 동아리/모임 등 가계부를 분리하여 운영 가능
- **기본 가계부 지정**: 로그인 시 주로 사용하는 가계부가 자동으로 선택되도록 설정
- **가족 초대 및 권한 제어**: 소유자(Owner), 관리자(Admin), 멤버(Member), 읽기전용(Viewer) 권한 분리
- **원클릭 공유 초대 링크**: 링크 하나로 가족이나 동반자를 손쉽게 초대

### 📊 2. 4가지 직관적인 탐색 뷰
- 📜 **타임라인 (Timeline)**: 일자별/월별 수입, 지출, 계좌 이체 피드 및 영수증 썸네일 확인
- 📅 **캘린더 (Calendar)**: 날짜별 지출/수입 합계 뱃지와 클릭 시 하단에 상세 내역 즉시 조회
- 💳 **자산 관리 (Accounts)**: 은행, 신용/체크카드, 현금, 투자, 대출 잔액 종합 관리
  - 카드 결제일 및 **차월 청구 예정액 자동 계산**
  - 계좌 클릭 시 해당 계좌의 전체 입출금 타임라인(시간 단위) 및 상세 정보 제공
- 📈 **통계 및 분석 (Analytics)**:
  - 카테고리별 지출/수입 인터랙티브 도넛 차트
  - 월별 수입·지출 추이 막대 그래프 및 전월 대비 증감 분석
  - 1개월/3개월/6개월/올해 및 수입/지출/이체 필터 프리셋

### 🧾 3. 영수증 관리 & WebP 자동 압축
- 모바일 사진 촬영 및 영수증 이미지 첨부 지원
- 브라우저 Canvas 기반 **WebP 무손실/고효율 압축 변환** (원본 대비 70~80% 용량 절감)
- 압축 비율 및 자동 압축 활성화 여부 사용자/관리자 맞춤 설정
- 원본 영수증 확대/축소 및 다운로드가 가능한 **고해상도 영수증 뷰어**

### 🔒 4. 보안 및 로컬 계정 체계
- **ID 또는 이메일 로그인**: 편리한 계정명(username) 단위 가입 및 로그인
- **2단계 인증 (2FA TOTP)**: Google Authenticator, Authy 등 OTP 앱을 연동하여 완벽한 계정 보안
- **CGO Free 순수 Go 바이너리**: 외부 C 라이브러리 의존성 없는 순수 SQLite(`modernc.org/sqlite`) 탑재

### ⚙️ 5. 시스템 관리자 전용 콘솔 (`/admin`)
- 최초 가입자 자동 관리자 지정
- **브랜딩 커스텀**: 서비스 이름(기본 `KinBooks`에서 가족/모임 명칭으로 변경 가능), 부제목, 로고
- **시스템 모듈 스위치**: 영수증 압축, 로컬 AI, MCP 활성화 여부 원클릭 제어
- **메일(SMTP) 서버 설정**: 계정 복구 및 알림용 메일 서버 설정 및 테스트 메일 발송
- **전체 회원 관리**: 계정 활성화/비활성화, 관리자 권한 부여/회수

### 🤖 6. AI & 확장 연동 (선택 모듈)
- **홈서버 로컬 AI (Ollama)**: 영수증/결제 문자 자연어 파싱 자동 기입
- **외부 연동 API Key & MCP (Model Context Protocol)**: 가계부 데이터를 다양한 외부 에이전트 및 서비스와 연동

### 💾 7. 데이터 주권 & 백업/복원
- 클라우드 종속 없는 100% 로컬 SQLite 파일 기반 저장 (`./data/kinbooks.db`)
- **원클릭 JSON 백업**: 전체 계좌, 카테고리, 거래내역을 JSON으로 백업(Export)
- **원클릭 데이터 복원**: 백업 파일 업로드로 언제든 무손실 데이터 복원(Import)

---

## 🚀 빠른 시작 (Quick Start)

### 1. Docker Compose로 실행 (가장 권장)

가장 간단하게 KinBooks를 배포하는 방법입니다.

```yaml
# docker-compose.yml
services:
  kinbooks:
    image: ghcr.io/your-username/kinbooks:latest # 또는 docker build .
    container_name: kinbooks
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
    environment:
      - PORT=8080
      - DATA_DIR=/app/data
      - DB_PATH=/app/data/kinbooks.db
      - JWT_SECRET=your-secret-key-change-this
      - TZ=Asia/Seoul
```

실행:
```bash
docker compose up -d
```

브라우저에서 `http://localhost:8080`으로 접속하여 첫 관리자 계정을 생성합니다.

---

### 2. 소스 코드에서 직접 빌드 및 실행

#### 사전 요구사항
- **Go**: 1.22 이상
- **Node.js**: 20.x 이상 (npm)

#### 단계별 빌드

1. **저장소 클론**:
   ```bash
   git clone https://github.com/your-username/kinbooks.git
   cd kinbooks
   ```

2. **프론트엔드 빌드**:
   ```bash
   cd web
   npm install
   npm run build
   cd ..
   ```

3. **백엔드 빌드 및 실행**:
   ```bash
   # Windows
   go build -o bin/kinbooks.exe ./cmd/server
   .\bin\kinbooks.exe

   # Linux / macOS
   go build -o bin/kinbooks ./cmd/server
   ./bin/kinbooks
   ```

서버가 구동되면 `http://localhost:8080`에서 즉시 이용하실 수 있습니다.

---

## ⚙️ 환경 변수 설정 (Environment Variables)

| 환경 변수 | 기본값 | 설명 |
| :--- | :--- | :--- |
| `PORT` | `8080` | HTTP 웹 서버 수신 포트 |
| `DATA_DIR` | `./data` | SQLite DB 파일 및 영수증 업로드 저장 디렉토리 |
| `DB_PATH` | `./data/kinbooks.db` | SQLite 데이터베이스 파일 경로 |
| `JWT_SECRET` | `kinbooks-default-secret-key` | 사용자 세션 인증 토큰 암호화 키 (운영 환경 변경 권장) |
| `TZ` | `Asia/Seoul` | 시스템 타임존 |

---

## 🏗️ 아키텍처 및 기술 스택 (Tech Stack)

```
kinbooks/
├── cmd/server/            # Go 메인 엔트리포인트 (Server Bootstrap)
├── internal/
│   ├── ai/                # 로컬 AI / 자연어 파서 서비스
│   ├── api/               # RESTful API 핸들러 & Echo 라우터
│   ├── auth/              # JWT 토큰 발급 및 검증 미들웨어
│   ├── config/            # 환경 변수 로더
│   ├── core/              # 이중전표 회계/거래 처리 엔진
│   ├── db/                # GORM SQLite 초기화 및 자동 마이그레이션
│   ├── mcp/               # Model Context Protocol JSON-RPC 서버
│   └── models/            # 도메인 데이터 모델 정의
└── web/                   # React 19 + TypeScript + Vite SPA
    ├── src/
    │   ├── components/    # 뷰 및 모달 UI 컴포넌트
    │   ├── hooks/         # 커스텀 훅 (LIFO useEscapeKey 등)
    │   └── api.ts         # REST API 통신 클라이언트
```

- **Backend**: Go 1.24, [Echo v4](https://echo.labstack.com), [GORM](https://gorm.io), [modernc.org/sqlite](https://gitlab.com/cznic/sqlite) (Pure Go)
- **Frontend**: [React 19](https://react.dev), [TypeScript](https://www.typescriptlang.org), [Vite](https://vite.dev), [Tailwind CSS v4](https://tailwindcss.com), [Lucide React](https://lucide.dev)
- **Container**: Multi-stage Alpine Linux (~30MB)

---

## 📄 라이선스 (License)

이 프로젝트는 [MIT License](LICENSE)에 따라 배포됩니다.
자유롭게 수정, 배포 및 자체 호스팅 환경에서 사용하실 수 있습니다.
