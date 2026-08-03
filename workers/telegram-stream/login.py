"""Interactive Telethon login to create a local session file."""

import os

from dotenv import load_dotenv
from telethon.sync import TelegramClient

load_dotenv()

api_id = int(os.getenv("TELEGRAM_API_ID", "0"))
api_hash = os.getenv("TELEGRAM_API_HASH", "")
session = os.getenv("TELEGRAM_SESSION", "musicma")

if not api_id or not api_hash:
    raise SystemExit("Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env first")

with TelegramClient(session, api_id, api_hash) as client:
    me = client.get_me()
    print(f"Logged in as {me.username or me.id}")
