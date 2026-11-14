import { useRef, useState } from "react";

/** Opt-in recording tools; capture starts only through the browser's picker. */
export function DemoRecorder() {
  const recorder = useRef<MediaRecorder | null>(null);
  const [status, setStatus] = useState("");
  const [recording, setRecording] = useState(false);
  if (new URLSearchParams(location.search).get("record") !== "1") return null;
  async function start() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 }, audio: false,
        // Chromium offers this tab first; the operator still selects explicitly.
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions);
      const chunks: BlobPart[] = [];
      const type = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9" : "video/webm";
      const next = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5_000_000 });
      recorder.current = next;
      next.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      next.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const url = URL.createObjectURL(new Blob(chunks, { type }));
        const link = document.createElement("a");
        link.href = url; link.download = "AFTERMARKET-gameplay-economy.webm"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setRecording(false); setStatus("Recording saved to Downloads.");
      };
      stream.getVideoTracks()[0].onended = () => { if (next.state !== "inactive") next.stop(); };
      next.start(1000); setRecording(true); setStatus("Recording this selected surface · no microphone");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Recording unavailable"); }
  }
  return <div style={{ position: "fixed", bottom: 8, left: 8, zIndex: 10000, background: "#111d", color: "white", padding: 8, fontSize: 11 }}>
    <button onClick={() => recording ? recorder.current?.stop() : void start()}>
      {recording ? "STOP & SAVE DEMO" : "RECORD THIS TAB"}
    </button> <span>{status}</span>
  </div>;
}
