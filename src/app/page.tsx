import Editor from "@/components/Editor";

// The editor is the whole product in Phase 1, so render it at the root. (We
// render directly rather than redirect() so the page works in static export,
// e.g. the GitHub Pages demo.)
export default function Home() {
  return <Editor />;
}
