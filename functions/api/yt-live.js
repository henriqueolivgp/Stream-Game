// GET /api/yt-live?videoId=xxx
// Proxy seguro: a YT_API_KEY fica só no servidor (env), nunca exposta ao browser/OBS.
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const videoId = (url.searchParams.get("videoId") || "").trim();

    if (!videoId) {
        return Response.json({ error: "Falta ?videoId=" }, { status: 400 });
    }
    if (!env.YT_API_KEY) {
        return Response.json(
            { error: "YT_API_KEY não configurada nas Environment Variables das Pages." },
            { status: 500 },
        );
    }
    // Aceita ID puro ou URL completa da live
    const m = videoId.match(/(?:v=|youtu\.be\/|live\/)([\w-]{6,})/);
    const id = m ? m[1] : videoId;

    const api = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${encodeURIComponent(id)}&key=${env.YT_API_KEY}`;
    let r;
    try {
        r = await fetch(api);
    } catch {
        return Response.json({ error: "Falha de rede até ao YouTube." }, { status: 502 });
    }

    if (!r.ok) {
        const t = await r.text();
        return Response.json(
            { error: "YouTube recusou o pedido.", detail: t.slice(0, 500) },
            { status: r.status },
        );
    }

    const j = await r.json();
    const item = j.items && j.items[0];
    if (!item) {
        return Response.json({ error: "Vídeo não encontrado. Confirma o Video ID." }, { status: 404 });
    }

    const liveChatId =
        item.liveStreamingDetails && item.liveStreamingDetails.activeLiveChatId;

    return Response.json({
        videoId: id,
        title: item.snippet ? item.snippet.title : "",
        isLive:
            !!(item.snippet && item.snippet.liveBroadcastContent === "live") ||
            !!liveChatId,
        liveChatId: liveChatId || null,
        hint: liveChatId
            ? undefined
            : "A live existe mas o chat não está ativo (pode estar offline, ser estreia sem chat, ou o chat estar desativado).",
    });
}
