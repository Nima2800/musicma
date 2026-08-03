"""Musicma Telegram indexer + stream proxy."""

from __future__ import annotations

import asyncio
import json
import logging
import mimetypes
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from telethon import TelegramClient, events
from telethon.errors import (
    PasswordHashInvalidError,
    PhoneCodeInvalidError,
    SessionPasswordNeededError,
)
from telethon.tl.types import DocumentAttributeAudio, MessageMediaDocument

load_dotenv()

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("musicma-worker")

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(ROOT / "data"))).resolve()
CACHE_DIR = DATA_DIR / "cache"
COVERS_DIR = DATA_DIR / "covers"
AVATARS_DIR = DATA_DIR / "channel-avatars"
CREDS_PATH = ROOT / "data" / "telegram_creds.json"
SESSION_NAME = os.getenv("TELEGRAM_SESSION", "musicma")
SESSION_PATH = str(ROOT / SESSION_NAME)
INGEST_SECRET = os.getenv("INGEST_SECRET", "dev-ingest-secret-change-me")
WEB_URL = os.getenv("WEB_URL", "http://localhost:3000").rstrip("/")
MAX_CONCURRENT_STREAMS = int(os.getenv("MAX_CONCURRENT_STREAMS", "4"))
INDEX_LIMIT = int(os.getenv("INDEX_LIMIT", "80"))
CACHE_MAX_FILES = int(os.getenv("CACHE_MAX_FILES", "12"))

for d in (DATA_DIR, CACHE_DIR, COVERS_DIR, AVATARS_DIR, CREDS_PATH.parent):
    d.mkdir(parents=True, exist_ok=True)

client: Optional[TelegramClient] = None
client_lock = asyncio.Lock()
stream_sem = asyncio.Semaphore(MAX_CONCURRENT_STREAMS)
pending_phone: Optional[str] = None
phone_code_hash: Optional[str] = None
auto_sync_task: Optional[asyncio.Task] = None


def _read_creds() -> dict[str, Any]:
    if CREDS_PATH.exists():
        try:
            return json.loads(CREDS_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def _write_creds(api_id: int, api_hash: str) -> None:
    CREDS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CREDS_PATH.write_text(
        json.dumps({"api_id": api_id, "api_hash": api_hash}, indent=2),
        encoding="utf-8",
    )


def _resolve_api() -> tuple[Optional[int], Optional[str]]:
    creds = _read_creds()
    api_id = creds.get("api_id") or os.getenv("TELEGRAM_API_ID")
    api_hash = creds.get("api_hash") or os.getenv("TELEGRAM_API_HASH")
    try:
        api_id_int = int(api_id) if api_id else None
    except (TypeError, ValueError):
        api_id_int = None
    api_hash_str = str(api_hash).strip() if api_hash else None
    return api_id_int, api_hash_str or None


def require_secret(secret: Optional[str]) -> None:
    if not secret or secret != INGEST_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


async def web_get(path: str) -> Any:
    async with httpx.AsyncClient(timeout=60) as http:
        res = await http.get(
            f"{WEB_URL}{path}",
            headers={"X-Ingest-Secret": INGEST_SECRET},
        )
        res.raise_for_status()
        return res.json()


async def web_post(path: str, payload: dict[str, Any]) -> Any:
    async with httpx.AsyncClient(timeout=120) as http:
        res = await http.post(
            f"{WEB_URL}{path}",
            headers={
                "X-Ingest-Secret": INGEST_SECRET,
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if res.status_code >= 400:
            detail = res.text[:300]
            raise HTTPException(status_code=502, detail=f"Web ingest failed: {detail}")
        return res.json()


async def ensure_client(connect: bool = True) -> TelegramClient:
    global client
    api_id, api_hash = _resolve_api()
    if not api_id or not api_hash:
        raise HTTPException(
            status_code=400,
            detail="Telegram API credentials not configured",
        )

    async with client_lock:
        if client is None:
            client = TelegramClient(SESSION_PATH, api_id, api_hash)
        if connect and not client.is_connected():
            await client.connect()
        return client


async def telegram_status() -> dict[str, Any]:
    api_id, api_hash = _resolve_api()
    configured = bool(api_id and api_hash)
    if not configured:
        return {
            "configured": False,
            "connected": False,
            "authorized": False,
            "me": None,
            "pendingLogin": bool(pending_phone),
        }

    try:
        tg = await ensure_client()
        authorized = await tg.is_user_authorized()
        me_data = None
        if authorized:
            me = await tg.get_me()
            me_data = {
                "id": me.id,
                "username": me.username,
                "phone": me.phone,
            }
        return {
            "configured": True,
            "connected": tg.is_connected(),
            "authorized": authorized,
            "me": me_data,
            "pendingLogin": bool(pending_phone),
        }
    except Exception as exc:
        log.exception("telegram status failed")
        return {
            "configured": True,
            "connected": False,
            "authorized": False,
            "me": None,
            "pendingLogin": bool(pending_phone),
            "error": str(exc),
        }


def parse_channel_query(query: str) -> str:
    q = query.strip()
    m = re.search(r"(?:https?://)?t\.me/(?:s/)?(@?[\w\d_]+)", q, re.I)
    if m:
        q = m.group(1)
    if q.startswith("@"):
        q = q[1:]
    return q


async def download_channel_avatar(entity: Any, telegram_id: str) -> Optional[str]:
    tg = await ensure_client()
    dest = AVATARS_DIR / f"{telegram_id}.jpg"
    try:
        path = await tg.download_profile_photo(entity, file=str(dest))
        if path:
            return f"channel-avatars/{telegram_id}.jpg"
    except Exception:
        log.exception("avatar download failed for %s", telegram_id)
    return None


def _audio_meta(message: Any) -> Optional[dict[str, Any]]:
    media = message.media
    if not isinstance(media, MessageMediaDocument) or not media.document:
        return None
    doc = media.document
    mime = getattr(doc, "mime_type", "") or ""
    if not mime.startswith("audio/") and "audio" not in mime:
        # also accept voice / mpeg without audio/ prefix via attributes
        has_audio_attr = any(
            isinstance(a, DocumentAttributeAudio) for a in (doc.attributes or [])
        )
        if not has_audio_attr:
            return None

    title = None
    artist = None
    duration = None
    for attr in doc.attributes or []:
        if isinstance(attr, DocumentAttributeAudio):
            title = attr.title
            artist = attr.performer
            duration = attr.duration
            break

    if not title:
        title = (
            (message.file.name if message.file else None)
            or (message.message or "").strip()
            or f"Track {message.id}"
        )
        title = Path(title).stem if "." in title else title

    file_unique = getattr(doc, "id", None)
    if file_unique is None:
        return None

    caption = (message.message or "").strip() or None
    published_at = None
    try:
        if getattr(message, "date", None):
            published_at = message.date.isoformat()
    except Exception:
        published_at = None

    return {
        "title": str(title)[:240],
        "artist": (str(artist)[:240] if artist else None),
        "duration": int(duration) if duration else None,
        "mimeType": mime or "audio/mpeg",
        "fileSize": int(getattr(doc, "size", 0) or 0) or None,
        "caption": caption[:2000] if caption else None,
        "publishedAt": published_at,
        "telegramMessageId": int(message.id),
        "telegramFileId": int(doc.id),
        "telegramFileUniqueId": str(doc.id),
        "telegramAccessHash": str(getattr(doc, "access_hash", "") or ""),
    }


async def maybe_download_cover(message: Any, track_key: str) -> Optional[str]:
    try:
        doc = getattr(message, "document", None)
        if not doc or not getattr(doc, "thumbs", None):
            return None
        # Prefer the largest available thumb (better fullscreen quality)
        thumbs = list(doc.thumbs)
        best = None
        best_area = -1
        for thumb in thumbs:
            w = int(getattr(thumb, "w", 0) or 0)
            h = int(getattr(thumb, "h", 0) or 0)
            area = w * h
            if area >= best_area:
                best = thumb
                best_area = area
        dest = COVERS_DIR / f"{track_key}.jpg"
        tg = await ensure_client()
        path = await tg.download_media(
            message,
            file=str(dest),
            thumb=best if best is not None else -1,
        )
        if path:
            return f"covers/{track_key}.jpg"
    except Exception:
        log.debug("cover download skipped for %s", track_key, exc_info=True)
    return None


async def ingest_messages(
    channel_telegram_id: str,
    messages: list[Any],
    *,
    username: Optional[str] = None,
) -> int:
    tracks: list[dict[str, Any]] = []
    for message in messages:
        meta = _audio_meta(message)
        if not meta:
            # deleted / non-audio → mark unavailable if we know the message id
            if getattr(message, "action", None) is None and not getattr(message, "media", None):
                try:
                    await web_post(
                        "/api/ingest/tracks",
                        {
                            "tracks": [
                                {
                                    "title": f"Removed {message.id}",
                                    "channelTelegramId": channel_telegram_id,
                                    "telegramMessageId": int(message.id),
                                    "telegramFileUniqueId": f"removed-{channel_telegram_id}-{message.id}",
                                    "isAvailable": False,
                                }
                            ]
                        },
                    )
                except Exception:
                    pass
            continue
        cover = await maybe_download_cover(message, str(meta["telegramFileUniqueId"]))
        post_url = None
        if username:
            post_url = f"https://t.me/{str(username).lstrip('@')}/{meta['telegramMessageId']}"
        tracks.append(
            {
                **meta,
                "coverPath": cover,
                "telegramPostUrl": post_url,
                "channelTelegramId": channel_telegram_id,
                "isAvailable": True,
            }
        )

    if not tracks:
        return 0

    # batch to keep payloads reasonable
    total = 0
    for i in range(0, len(tracks), 40):
        chunk = tracks[i : i + 40]
        data = await web_post("/api/ingest/tracks", {"tracks": chunk})
        total += int(data.get("upserted") or 0)
    return total


async def persist_channel_avatar(entity: Any, telegram_id: str) -> Optional[str]:
    avatar_rel = await download_channel_avatar(entity, telegram_id)
    if not avatar_rel:
        return None
    cover_url = f"/api/channel-avatars/{telegram_id}"
    try:
        await web_post(
            "/api/ingest/channel-cover",
            {"channelTelegramId": telegram_id, "coverUrl": cover_url},
        )
    except Exception:
        log.exception("failed to persist channel cover for %s", telegram_id)
    return cover_url


async def index_channel(
    channel: dict[str, Any],
    *,
    limit: int = 10,
    mode: str = "latest",
) -> int:
    tg = await ensure_client()
    if not await tg.is_user_authorized():
        raise HTTPException(status_code=401, detail="Telegram not authorized")

    entity_ref: Any = channel.get("username") or int(channel["telegramId"])
    entity = await tg.get_entity(entity_ref)
    await persist_channel_avatar(entity, str(channel["telegramId"]))

    limit = max(1, min(int(limit or 10), 500))
    collected: list[Any] = []

    if mode == "catchup":
        min_id = int(channel.get("lastMessageId") or 0)
        async for message in tg.iter_messages(entity, min_id=min_id, reverse=True):
            collected.append(message)
            if len(collected) >= limit:
                break
    else:
        async for message in tg.iter_messages(entity, limit=limit):
            collected.append(message)

    return await ingest_messages(
        str(channel["telegramId"]),
        collected,
        username=channel.get("username"),
    )


async def fetch_channels() -> list[dict[str, Any]]:
    data = await web_get("/api/ingest/channels")
    return list(data.get("channels") or [])


async def on_new_message(event: events.NewMessage.Event) -> None:
    try:
        chat = await event.get_chat()
        telegram_id = str(getattr(chat, "id", "") or "")
        if not telegram_id:
            return
        channels = await fetch_channels()
        match = next(
            (
                c
                for c in channels
                if str(c.get("telegramId")) == telegram_id and c.get("autoSync")
            ),
            None,
        )
        if not match:
            # also try absolute id formats
            abs_id = str(getattr(chat, "id", ""))
            match = next(
                (
                    c
                    for c in channels
                    if str(c.get("telegramId")).endswith(abs_id) and c.get("autoSync")
                ),
                None,
            )
        if not match:
            return
        await ingest_messages(
            str(match["telegramId"]),
            [event.message],
            username=match.get("username"),
        )
    except Exception:
        log.exception("auto-sync message failed")


def _register_handlers(tg: TelegramClient) -> None:
    tg.add_event_handler(on_new_message, events.NewMessage)


def _trim_cache() -> None:
    files = sorted(CACHE_DIR.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in files[CACHE_MAX_FILES:]:
        try:
            old.unlink(missing_ok=True)
        except Exception:
            pass


async def bootstrap_from_web() -> None:
    try:
        data = await web_get("/api/ingest/settings")
        api_id = data.get("apiId")
        api_hash = data.get("apiHash")
        if api_id and api_hash:
            _write_creds(int(api_id), str(api_hash))
    except Exception:
        log.info("could not bootstrap credentials from web")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global auto_sync_task
    await bootstrap_from_web()
    api_id, api_hash = _resolve_api()
    if api_id and api_hash:
        try:
            tg = await ensure_client()
            if await tg.is_user_authorized():
                _register_handlers(tg)
                log.info("Telegram client ready; auto-sync handlers registered")
        except Exception:
            log.exception("startup telegram connect failed")
    yield
    if client and client.is_connected():
        await client.disconnect()


app = FastAPI(title="Musicma Telegram Worker", lifespan=lifespan)


class ConfigureBody(BaseModel):
    apiId: int
    apiHash: str


class PhoneBody(BaseModel):
    phone: str


class SignInBody(BaseModel):
    phone: str
    code: str
    password: Optional[str] = None


class ValidateBody(BaseModel):
    query: str


class ReindexBody(BaseModel):
    channelId: Optional[str] = None
    limit: int = Field(default=10, ge=1, le=500)
    mode: str = "latest"


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/telegram/status")
async def status(x_ingest_secret: Optional[str] = Header(default=None)):
    require_secret(x_ingest_secret)
    return await telegram_status()


@app.post("/telegram/configure")
async def configure(
    body: ConfigureBody,
    x_ingest_secret: Optional[str] = Header(default=None),
):
    global client
    require_secret(x_ingest_secret)
    _write_creds(body.apiId, body.apiHash.strip())
    async with client_lock:
        if client is not None:
            try:
                if client.is_connected():
                    await client.disconnect()
            except Exception:
                pass
            client = None
    tg = await ensure_client()
    return {
        "ok": True,
        "configured": True,
        "connected": tg.is_connected(),
        "authorized": await tg.is_user_authorized(),
    }


@app.post("/telegram/send-code")
async def send_code(
    body: PhoneBody,
    x_ingest_secret: Optional[str] = Header(default=None),
):
    global pending_phone, phone_code_hash
    require_secret(x_ingest_secret)
    tg = await ensure_client()
    phone = body.phone.strip()
    result = await tg.send_code_request(phone)
    pending_phone = phone
    phone_code_hash = result.phone_code_hash
    return {"ok": True, "phone": phone}


@app.post("/telegram/sign-in")
async def sign_in(
    body: SignInBody,
    x_ingest_secret: Optional[str] = Header(default=None),
):
    global pending_phone, phone_code_hash
    require_secret(x_ingest_secret)
    tg = await ensure_client()
    phone = body.phone.strip()
    try:
        if body.password:
            await tg.sign_in(password=body.password)
        else:
            await tg.sign_in(
                phone=phone,
                code=body.code.strip(),
                phone_code_hash=phone_code_hash,
            )
    except SessionPasswordNeededError:
        return {"ok": False, "needPassword": True}
    except PhoneCodeInvalidError:
        raise HTTPException(status_code=400, detail="کد نادرست است")
    except PasswordHashInvalidError:
        raise HTTPException(status_code=400, detail="رمز دو مرحله‌ای نادرست است")

    pending_phone = None
    phone_code_hash = None
    _register_handlers(tg)
    me = await tg.get_me()
    return {
        "ok": True,
        "authorized": True,
        "me": {"id": me.id, "username": me.username, "phone": me.phone},
    }


@app.post("/validate-channel")
async def validate_channel(
    body: ValidateBody,
    x_ingest_secret: Optional[str] = Header(default=None),
):
    require_secret(x_ingest_secret)
    tg = await ensure_client()
    if not await tg.is_user_authorized():
        raise HTTPException(status_code=401, detail="Telegram not authorized")

    query = parse_channel_query(body.query)
    try:
        entity = await tg.get_entity(query if not query.isdigit() else int(query))
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Channel not found: {exc}") from exc

    telegram_id = str(entity.id)
    username = getattr(entity, "username", None)
    title = (
        getattr(entity, "title", None)
        or getattr(entity, "first_name", None)
        or username
        or telegram_id
    )
    avatar_rel = await download_channel_avatar(entity, telegram_id)
    cover_url = (
        f"/api/channel-avatars/{telegram_id}" if avatar_rel else None
    )

    return {
        "ok": True,
        "title": title,
        "username": username,
        "telegramId": telegram_id,
        "coverUrl": cover_url,
        "avatarPath": avatar_rel,
    }


@app.post("/reindex")
async def reindex(
    body: ReindexBody,
    x_ingest_secret: Optional[str] = Header(default=None),
):
    require_secret(x_ingest_secret)
    channels = await fetch_channels()
    targets = channels
    if body.channelId:
        targets = [c for c in channels if c.get("id") == body.channelId]
        if not targets:
            raise HTTPException(status_code=404, detail="Channel not found")

    total = 0
    for ch in targets:
        try:
            total += await index_channel(ch, limit=body.limit, mode=body.mode)
        except HTTPException:
            raise
        except Exception as exc:
            log.exception("reindex failed for %s", ch.get("id"))
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"ok": True, "indexed": total}


@app.get("/channel-avatars/{telegram_id}")
async def channel_avatar(
    telegram_id: str,
    x_ingest_secret: Optional[str] = Header(default=None),
):
    require_secret(x_ingest_secret)
    path = AVATARS_DIR / f"{telegram_id}.jpg"
    if not path.exists():
        # try any extension
        matches = list(AVATARS_DIR.glob(f"{telegram_id}.*"))
        if not matches:
            raise HTTPException(status_code=404, detail="Avatar missing")
        path = matches[0]
    media = mimetypes.guess_type(str(path))[0] or "image/jpeg"
    return FileResponse(path, media_type=media)


@app.get("/covers/{name}")
async def get_cover(
    name: str,
    x_ingest_secret: Optional[str] = Header(default=None),
):
    require_secret(x_ingest_secret)
    safe = Path(name).name
    path = COVERS_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="Cover missing")
    media = mimetypes.guess_type(str(path))[0] or "image/jpeg"
    return FileResponse(path, media_type=media)


@app.get("/stream/{track_id}")
async def stream_track(
    track_id: str,
    request: Request,
    x_ingest_secret: Optional[str] = Header(default=None),
    x_telegram_channel_id: Optional[str] = Header(default=None),
    x_telegram_message_id: Optional[str] = Header(default=None),
    x_telegram_file_id: Optional[str] = Header(default=None),
    x_mime_type: Optional[str] = Header(default=None),
    x_file_size: Optional[str] = Header(default=None),
):
    require_secret(x_ingest_secret)
    if not x_telegram_channel_id or not x_telegram_message_id:
        raise HTTPException(status_code=400, detail="Missing telegram headers")

    cache_file = CACHE_DIR / f"{track_id}.bin"
    mime = x_mime_type or "audio/mpeg"

    async with stream_sem:
        tg = await ensure_client()
        if not await tg.is_user_authorized():
            raise HTTPException(status_code=401, detail="Telegram not authorized")

        if not cache_file.exists():
            try:
                entity = await tg.get_entity(int(x_telegram_channel_id))
                message = await tg.get_messages(entity, ids=int(x_telegram_message_id))
                if not message or not message.media:
                    raise HTTPException(status_code=404, detail="Message media missing")
                await tg.download_media(message, file=str(cache_file))
                _trim_cache()
            except HTTPException:
                raise
            except Exception as exc:
                log.exception("download failed")
                if cache_file.exists():
                    cache_file.unlink(missing_ok=True)
                raise HTTPException(status_code=502, detail=str(exc)) from exc

        if not cache_file.exists():
            raise HTTPException(status_code=404, detail="Cache miss")

        file_size = cache_file.stat().st_size
        range_header = request.headers.get("range")

        if range_header:
            m = re.match(r"bytes=(\d+)-(\d*)", range_header)
            if not m:
                raise HTTPException(status_code=416, detail="Invalid range")
            start = int(m.group(1))
            end = int(m.group(2) or file_size - 1)
            end = min(end, file_size - 1)
            if start > end or start >= file_size:
                raise HTTPException(status_code=416, detail="Invalid range")

            def iter_range():
                with cache_file.open("rb") as f:
                    f.seek(start)
                    remaining = end - start + 1
                    while remaining > 0:
                        chunk = f.read(min(64 * 1024, remaining))
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        yield chunk

            headers = {
                "Content-Type": mime,
                "Content-Length": str(end - start + 1),
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Cache-Control": "private, max-age=60",
            }
            return StreamingResponse(iter_range(), status_code=206, headers=headers)

        return FileResponse(
            cache_file,
            media_type=mime,
            headers={
                "Accept-Ranges": "bytes",
                "Cache-Control": "private, max-age=60",
                "Content-Length": str(file_size),
            },
        )
