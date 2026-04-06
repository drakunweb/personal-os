#!/bin/bash
# 全セクション初期データ投入スクリプト

API_URL="https://personal-os-api.drakunweb.workers.dev"
API_KEY="drakunweb4567"

echo "=== Personal OS データ初期化 ==="

curl -s -X PATCH "$API_URL/data" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
  "cia": {
    "p1": false,
    "p2": false,
    "p3": false,
    "hours": 0,
    "target_hours": 300,
    "exam_date": "2026-09-30",
    "study_sessions": []
  },
  "weightGoal": {
    "start": 72,
    "goal": 68,
    "started_date": "2026-04-06"
  },
  "finance": {
    "current": 0,
    "goal": 5000000
  },
  "financeDetail": {
    "income": 380000,
    "variable": 50000,
    "fixed": 260000
  },
  "assets": {
    "invest": 0,
    "cash": 0,
    "property": 55000000
  },
  "gym": {
    "schedule": ["月", "水", "金"],
    "exercises": [
      { "name": "ベンチプレス", "sets": 3, "reps": 10, "weight": 60 },
      { "name": "スクワット",   "sets": 3, "reps": 10, "weight": 70 },
      { "name": "デッドリフト", "sets": 3, "reps": 8,  "weight": 80 },
      { "name": "懸垂",        "sets": 3, "reps": 8,  "weight": 0  },
      { "name": "ショルダープレス", "sets": 3, "reps": 10, "weight": 30 }
    ],
    "logs": []
  },
  "schedule": {
    "events": []
  },
  "meals": {},
  "style": {
    "outfitToday": "",
    "brandNotes": "",
    "hairNotes": "",
    "seasons": {
      "spring": "",
      "summer": "",
      "autumn": "",
      "winter": ""
    }
  },
  "side": {
    "income": 0,
    "goal": 100000,
    "compliance": "",
    "tasks": [
      { "text": "Webサイト更新", "done": false },
      { "text": "SNS投稿スケジュール", "done": false },
      { "text": "ポートフォリオ更新", "done": false }
    ]
  },
  "news": {
    "items": [],
    "sources": ["日経電子版", "NHK", "Bloomberg Japan"]
  },
  "ideas": [],
  "instructionLog": [],
  "workStatus": "normal",
  "workNotes": "",
  "studyNotes": "",
  "weeklyTheme": "",
  "shopping": {
    "必需品": [],
    "ファッション": [],
    "ガジェット": [],
    "食料品": []
  },
  "health": {
    "height": {
      "current": 178.9,
      "checklist": {
        "sleep": false,
        "stretch": false,
        "nutrition": false,
        "posture": false
      }
    },
    "skincare": {
      "am": { "wash": false, "uv": false, "moisturize": false },
      "pm": { "wash": false, "lotion": false, "cream": false }
    }
  },
  "ecoMode": false
}' | python3 -m json.tool

echo ""
echo "=== 完了 ==="
