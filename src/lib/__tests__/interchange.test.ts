import { describe, it, expect } from "vitest";
import { smpte, buildOtio, buildMarkerCsv } from "../interchange";

describe("interchange", () => {
  it("formats SMPTE timecode at 30fps", () => {
    expect(smpte(0)).toBe("00:00:00:00");
    expect(smpte(1.5, 30)).toBe("00:00:01:15");
    expect(smpte(61, 30)).toBe("00:01:01:00");
    expect(smpte(3661, 30)).toBe("01:01:01:00");
  });

  it("builds valid OTIO JSON with a clip and chapter markers", () => {
    const otio = buildOtio({
      name: "My Clip",
      mediaName: "my.mp4",
      durationSec: 10,
      fps: 30,
      chapters: [
        { start: 0, title: "Intro" },
        { start: 5, title: "Point" },
      ],
    });
    const doc = JSON.parse(otio);
    expect(doc.OTIO_SCHEMA).toBe("Timeline.1");
    expect(doc.name).toBe("My Clip");
    const clip = doc.tracks.children[0].children[0];
    expect(clip.OTIO_SCHEMA).toContain("Clip");
    expect(clip.media_reference.target_url).toBe("my.mp4");
    expect(clip.source_range.duration.value).toBe(300); // 10s * 30fps
    expect(clip.markers).toHaveLength(2);
    expect(clip.markers[1].marked_range.start_time.value).toBe(150); // 5s * 30
    expect(clip.markers[0].name).toBe("Intro");
  });

  it("builds a Resolve/Premiere marker CSV", () => {
    const csv = buildMarkerCsv([{ start: 0, title: "Start" }, { start: 12.5, title: 'A "quote"' }], 30);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("Timecode In,Timecode Out,Name,Comment,Color");
    expect(lines[1]).toContain("00:00:00:00");
    expect(lines[1]).toContain('"Start"');
    expect(lines[2]).toContain("00:00:12:15");
    expect(lines[2]).toContain('"A ""quote"""'); // CSV-escaped quotes
  });
});
