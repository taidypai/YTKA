#!/usr/bin/env python3
"""
VK Proxy Server
Локальный сервер-прокси для VK API. Сайт обращается сюда, сервер идёт в VK.

Установка:
    pip install flask flask-cors requests

Запуск:
    python server.py

Сервер будет доступен на http://localhost:5000
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from datetime import datetime

app = Flask(__name__)
CORS(app)

VK_API_URL = "https://api.vk.com/method"
API_VERSION = "5.131"


def vk_get(method: str, params: dict, token: str) -> dict:
    params = {**params, "access_token": token, "v": API_VERSION}
    resp = requests.get(f"{VK_API_URL}/{method}", params=params, timeout=15)
    data = resp.json()
    if "error" in data:
        raise RuntimeError(data["error"]["error_msg"])
    return data["response"]


def resolve_group(screen_name: str, token: str) -> str:
    result = vk_get("utils.resolveScreenName", {"screen_name": screen_name}, token)
    if not result or not result.get("object_id"):
        raise RuntimeError(f"Группа не найдена: {screen_name}")
    return "-" + str(result["object_id"])


# ── OAuth callback — закрывает попап и передаёт токен родительскому окну ───────
@app.route("/auth")
def auth_callback():
    return """<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Авторизация...</title>
<style>
  body { background:#0d0d0d; color:#f0f0f0; font-family:sans-serif;
         display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
  p { font-size:14px; opacity:.6; }
</style>
</head>
<body>
<p>Авторизация...</p>
<script>
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  const token = params.get('access_token');
  if (token && window.opener) {
    window.opener.postMessage({ type: 'vk_token', token }, 'http://localhost:5000');
    window.close();
  } else {
    document.querySelector('p').textContent = 'Не удалось получить токен. Закройте окно и попробуйте снова.';
  }
</script>
</body>
</html>"""


@app.route("/api/posts")
def get_posts():
    """
    GET /api/posts?count=10&filter=others&group=screen_name&token=...
    """
    count   = request.args.get("count",  10,      type=int)
    filter_ = request.args.get("filter", "others")
    group   = request.args.get("group",  "").strip()
    token   = request.args.get("token",  "").strip()

    if not token:
        return jsonify({"ok": False, "error": "Токен не передан"}), 400
    if not group:
        return jsonify({"ok": False, "error": "Группа не указана"}), 400

    count = max(1, min(count, 100))

    # Убираем ведущий слеш или полный URL, оставляем только screen_name
    for prefix in ("https://vk.com/", "http://vk.com/", "vk.com/"):
        if group.startswith(prefix):
            group = group[len(prefix):]
    group = group.strip("/")

    try:
        owner_id = resolve_group(group, token)

        posts_resp = vk_get("wall.get", {
            "owner_id": owner_id,
            "count":    count,
            "filter":   filter_,
        }, token)
        posts = posts_resp.get("items", [])

        user_ids = list({p["from_id"] for p in posts if p["from_id"] > 0})
        users = {}
        if user_ids:
            users_resp = vk_get("users.get", {
                "user_ids": ",".join(map(str, user_ids)),
                "fields":   "photo_50",
            }, token)
            for u in users_resp:
                users[u["id"]] = u

        result = []
        for post in posts:
            user = users.get(post["from_id"])
            photo = None
            for att in post.get("attachments") or []:
                if att["type"] == "photo":
                    sizes = att["photo"]["sizes"]
                    m = next((s for s in sizes if s["type"] == "m"), sizes[0])
                    photo = m["url"]
                    break

            result.append({
                "id":      post["id"],
                "from_id": post["from_id"],
                "date":    post["date"],
                "text":    post.get("text", ""),
                "photo":   photo,
                "author": {
                    "id":         user["id"]                  if user else post["from_id"],
                    "first_name": user.get("first_name", "")  if user else "",
                    "last_name":  user.get("last_name",  "")  if user else f"id{post['from_id']}",
                    "photo_50":   user.get("photo_50",   "")  if user else "",
                } if user else None,
            })

        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✓ Отдано {len(result)} постов (filter={filter_}, group={group})")
        return jsonify({"ok": True, "posts": result})

    except RuntimeError as e:
        print(f"[ERR] {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/health")
def health():
    return jsonify({"ok": True})


if __name__ == "__main__":
    print("=" * 50)
    print("  VK Proxy Server запущен")
    print(f"  Адрес  : http://localhost:5000")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=False)