const LOCAL_OFFLINE_URL = "http://127.0.0.1:4175/__mock/offline"

export function sanitizeMockFrontendSource(code, id) {
  if (!id.includes("/src/")) return null
  let transformed = code
    .replace(/https?:\/\/[^\s"'`)]+/g, (target) => (
      /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(target)
      || target === "http://www.w3.org/2000/svg"
        ? target
        : LOCAL_OFFLINE_URL
    ))
    .replace(
      /\b(?:[a-z0-9-]+\.)+(?:net|corp|internal)(?::\d+)?(?:\/[^\s"'`)]+)?/gi,
      "127.0.0.1:4175/__mock/offline",
    )

  if (id.endsWith("/src/features/fdc-trend/pages/SpiderFeaturePage.jsx")) {
    transformed = transformed
      .replace(
        /const STEP_SEQ_OPTIONS = \[[^\n]+\]/,
        'const STEP_SEQ_OPTIONS = ["U%10000", "U%20000"]',
      )
      .replace(
        /const HARD_SPEC_DEFAULT_LINE = [^\n]+/,
        "const HARD_SPEC_DEFAULT_LINE = FDC_LINES[0]",
      )
      .replace(
        /const \[selectedSdwt, setSelectedSdwt\] = useState\(\(\) => new Set\(\[[^\]]*\]\)\)/,
        "const [selectedSdwt, setSelectedSdwt] = useState(() => new Set(SDWT_OPTIONS.slice(0, 1)))",
      )
      .replace(
        /\bt\d+\.[a-z]+\b/gi,
        "USER_TEST_001",
      )
  }

  return transformed === code ? null : transformed
}
