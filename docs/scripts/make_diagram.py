"""Generate docs/how-it-works-{light,dark}.svg for the README.

Run: python docs/scripts/make_diagram.py docs
"""

import sys
from pathlib import Path

OUT = Path(sys.argv[1])
FONT = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"
W, H = 1090, 530
BW, BH = 190, 84

THEMES = {
    "light": dict(bg="#FFFFFF", box="#F6F5F2", stroke="#D9D6CF", text="#111318", sub="#4B4F5C",
                  group="#B9B5AC", http="#7D818C", ws="#3D5AFE", badge_text="#FFFFFF"),
    "dark": dict(bg="#0D1117", box="#161B22", stroke="#30363D", text="#E6EDF3", sub="#9198A1",
                 group="#484F58", http="#8B929C", ws="#7B8FFF", badge_text="#0D1117"),
}

BOXES = {  # name: (x, y, title, subtitle)
    "phone": (40, 60, "Phone", "/c/{id} · reads motion sensors"),
    "laptop": (40, 320, "Laptop", "/ · uploads + renders model"),
    "tunnel": (310, 60, "cloudflared", "public HTTPS URL"),
    "proxy": (580, 190, "Caddy proxy", ":8080 · single origin"),
    "web": (860, 50, "web", "Next.js · viewer + phone UI"),
    "api": (860, 190, "api", "FastAPI · REST + WS hub"),
    "redis": (860, 340, "Redis", "sessions (TTL) · pub/sub"),
}

# (path, kind, label, label x, label y, anchor, both ends)
LINKS = [
    ("M230 102 H306", "ws", "HTTPS · WSS", 268, 92, "middle", False),
    ("M500 102 H675 V186", "ws", "proxy:80", 512, 92, "start", False),
    ("M230 362 H675 V278", "ws", "http://localhost:8080", 250, 352, "start", False),
    ("M770 222 H815 V92 H856", "http", "pages", 837, 82, "middle", False),
    ("M770 242 H856", "ws", "/api · /ws", 813, 234, "middle", False),
    ("M955 278 V336", "ws", "pub/sub", 965, 312, "start", True),
]

BADGES = [("1", 230, 320), ("4", 230, 404), ("2", 230, 60), ("3", 1050, 190)]


def svg(t: dict) -> str:
    o = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" '
        f'role="img" aria-label="Pivot architecture: the phone reaches a Caddy proxy through a '
        f'cloudflared tunnel, the laptop reaches it on localhost:8080; Caddy routes pages to the '
        f'Next.js web app and /api and /ws to the FastAPI api, which relays phone orientation to '
        f'the laptop through Redis pub/sub.">',
        "<defs>",
    ]
    for kind in ("ws", "http"):
        o.append(
            f'<marker id="a-{kind}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" '
            f'markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" '
            f'fill="{t[kind]}"/></marker>'
        )
    o.append("</defs>")
    o.append(f'<rect width="{W}" height="{H}" rx="20" fill="{t["bg"]}"/>')
    o.append(f'<g font-family="{FONT}">')

    # docker compose group
    o.append(
        f'<rect x="290" y="20" width="780" height="430" rx="18" fill="none" '
        f'stroke="{t["group"]}" stroke-width="1.5" stroke-dasharray="6 6"/>'
    )
    o.append(
        f'<text x="1054" y="440" text-anchor="end" font-size="13" font-weight="600" '
        f'fill="{t["sub"]}" letter-spacing="0.06em">DOCKER COMPOSE</text>'
    )
    o.append(
        f'<text x="40" y="40" font-size="13" font-weight="600" fill="{t["sub"]}" '
        f'letter-spacing="0.06em">DEVICES</text>'
    )

    for path, kind, label, lx, ly, anchor, both in LINKS:
        start = f' marker-start="url(#a-{kind})"' if both else ""
        o.append(
            f'<path d="{path}" fill="none" stroke="{t[kind]}" stroke-width="2.5" '
            f'stroke-linejoin="round"{start} marker-end="url(#a-{kind})"/>'
        )
        o.append(
            f'<text x="{lx}" y="{ly}" text-anchor="{anchor}" font-size="12.5" '
            f'fill="{t["sub"]}">{label}</text>'
        )

    for x, y, title, subtitle in BOXES.values():
        o.append(
            f'<rect x="{x}" y="{y}" width="{BW}" height="{BH}" rx="14" fill="{t["box"]}" '
            f'stroke="{t["stroke"]}" stroke-width="1.5"/>'
        )
        o.append(
            f'<text x="{x + 18}" y="{y + 36}" font-size="17" font-weight="700" '
            f'fill="{t["text"]}">{title}</text>'
        )
        o.append(
            f'<text x="{x + 18}" y="{y + 60}" font-size="12.5" fill="{t["sub"]}">{subtitle}</text>'
        )

    for n, cx, cy in BADGES:
        o.append(f'<circle cx="{cx}" cy="{cy}" r="13" fill="{t["ws"]}"/>')
        o.append(
            f'<text x="{cx}" y="{cy + 4.5}" text-anchor="middle" font-size="13" '
            f'font-weight="700" fill="{t["badge_text"]}">{n}</text>'
        )

    # legend
    y = 492
    o.append(f'<path d="M40 {y} H76" stroke="{t["ws"]}" stroke-width="2.5"/>')
    o.append(
        f'<text x="86" y="{y + 4.5}" font-size="13" fill="{t["text"]}">Live WebSocket: phone '
        f'orientation → api → Redis pub/sub → api → laptop, up to 60 messages/s</text>'
    )
    o.append(f'<path d="M800 {y} H836" stroke="{t["http"]}" stroke-width="2.5"/>')
    o.append(f'<text x="846" y="{y + 4.5}" font-size="13" fill="{t["text"]}">HTTP only</text>')
    o.append(
        f'<text x="1050" y="{y + 4.5}" text-anchor="end" font-size="13" '
        f'fill="{t["sub"]}">① – ④ steps below</text>'
    )
    o.append("</g></svg>")
    return "\n".join(o) + "\n"


for name, theme in THEMES.items():
    (OUT / f"how-it-works-{name}.svg").write_text(svg(theme), encoding="utf-8", newline="\n")
print("ok")
