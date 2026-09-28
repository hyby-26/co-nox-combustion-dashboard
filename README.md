# CO-NOx Combination Dashboard

가스터빈 센서 데이터를 기반으로 CO/NOX 배출량과 운전 변수 간 관계를 탐색하는 시각화 대시보드.

## 실행 방법

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python src/app.py
```

브라우저에서 `http://127.0.0.1:8050` 접속.

## 모바일

768px 이하 화면(폰, 세로 태블릿)에서는 필터가 접이식 카드로 바뀌고 탭은 한 줄로 가로 스크롤된다. 터치 기기에서는 차트 줌 드래그를 꺼서 차트 위에서도 페이지 스크롤이 되고, 차트를 탭하면 해당 지점 값이 표시된다(줌 불가).

데스크톱에서는 브라우저 개발자 도구의 기기 툴바(Chrome: `Ctrl+Shift+M`)로 확인할 수 있다. 터치도 함께 에뮬레이션된다.

## 테스트

```bash
source .venv/bin/activate
pytest
```

## 배포 (Docker / Cloud Run)

```bash
docker build -t co-nox-combination-dashboard .
docker run -p 8080:8080 co-nox-combination-dashboard
```

브라우저에서 `http://localhost:8080` 접속. 컨테이너는 `$PORT` 환경변수(기본 8080)로 바인딩하므로 Cloud Run에 그대로 배포 가능:

```bash
gcloud run deploy co-nox-combination-dashboard --source . --region <region>
```
