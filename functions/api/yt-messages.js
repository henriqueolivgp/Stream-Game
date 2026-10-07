// GET /api/yt-messages?liveChatId=xxx&pageToken=yyy
// Proxy seguro: injeta YT_API_KEY no servidor e devolve só o essencial ao overlay.
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const liveChatId = (url.searchParams.get("liveChatId") || "").trim();
    const pageToken = (url.searchParams.get("pageToken") || "").trim();

    if (!liveChatId) {
        return Response.json({ error: "Falta ?liveChatId=" }, { status: 400 });
    }
    if (!env.YT_API_KEY) {
        return Response.json(
            { error: "YT_API_KEY não configurada nas Environment Variables das Pages." },
            { status: 500 },
        );
    }

    const params = new URLSearchParams({
        liveChatId,
        part: "snippet,authorDetails",
        maxResults: "200",
        key: env.YT_API_KEY,
    });
    if (pageToken) params.set("pageToken", pageToken);

    let r;
    try {
        r = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?${params}`);
    } catch {
        return Response.json({ error: "Falha de rede até ao YouTube." }, { status: 502 });
    }

    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
        const msg =
            (j.error && j.error.message) || `HTTP ${r.status} do YouTube.`;
        return Response.json({ error: msg, detail: j }, { status: r.status });
    }

    const messages = (j.items || []).map((it) => {
        const sn = it.snippet || {};
        const au = it.authorDetails || {};
        const text =
            (sn.displayMessage ||
                (sn.textMessageDetails && sn.textMessageDetails.messageText) ||
                "").slice(0, 200);
        return {
            author: (au.displayName || "yt").slice(0, 25),
            text,
            isMod: !!au.isChatModerator,
            isOwner: !!au.isChatOwner,
        };
    });

    return Response.json({
        messages,
        nextPageToken: j.nextPageToken || null,
        pollingIntervalMillis: j.pollingIntervalMillis || 6000,
    });
}
